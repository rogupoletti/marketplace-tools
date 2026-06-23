import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Buscar o accountId do usuário
        const userDoc = await adminDb.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const accountId = userData?.accountId;

        if (!accountId) {
            return NextResponse.json({ error: "No account linked" }, { status: 404 });
        }

        console.log(`[API ML Inventory] Fetching for account: ${accountId}`);

        // Parse parameter 'days' (default: 90)
        const { searchParams } = new URL(request.url);
        const daysParam = searchParams.get("days");
        const days = daysParam ? parseInt(daysParam, 10) : 90;
        const queryDays = isNaN(days) || days <= 0 ? 90 : days;

        // Buscar o inventário no Firestore via Admin SDK
        const inventoryRef = adminDb.collection("accounts").doc(accountId).collection("ml_full_inventory");
        
        // 1. Descobrir qual é o timestamp do snapshot mais recente
        const latestDoc = await inventoryRef
            .orderBy("snapshot_at", "desc")
            .limit(1)
            .get();

        if (latestDoc.empty) {
            console.log(`[API ML Inventory] No inventory found for account: ${accountId}`);
            return NextResponse.json({ success: true, inventory: {}, inventoryHistory: {}, count: 0 });
        }

        const latestTimestamp = latestDoc.docs[0].data().snapshot_at;
        console.log(`[API ML Inventory] Using latest snapshot from: ${new Date(latestTimestamp).toISOString()}`);

        // 2. Buscar todos os itens que pertencem a esse snapshot específico
        const snapshot = await inventoryRef
            .where("snapshot_at", "==", latestTimestamp)
            .get();

        const inventoryMap: Record<string, number> = {};
        const processedIds = new Set<string>();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const itemId = data.item_id;
            if (itemId && !processedIds.has(itemId)) {
                inventoryMap[itemId] = data.available_quantity || 0;
                processedIds.add(itemId);
            }
        });

        // 3. Buscar histórico de snapshots do período selecionado
        const minTimestamp = Date.now() - (queryDays * 24 * 60 * 60 * 1000);
        console.log(`[API ML Inventory] Fetching history from: ${new Date(minTimestamp).toISOString()}`);
        
        const historySnapshot = await inventoryRef
            .where("snapshot_at", ">=", minTimestamp)
            .orderBy("snapshot_at", "asc")
            .get();

        const inventoryHistory: Record<string, Record<string, number>> = {};

        historySnapshot.docs.forEach(doc => {
            const data = doc.data();
            const itemId = data.item_id;
            const snapshotAt = data.snapshot_at;
            const qty = data.available_quantity ?? 0;

            if (itemId && typeof snapshotAt === "number") {
                const dateStr = new Date(snapshotAt).toISOString().split("T")[0];

                if (!inventoryHistory[itemId]) {
                    inventoryHistory[itemId] = {};
                }
                // Because snapshot_at is ordered asc, later snapshots overwrite earlier ones for the same day
                inventoryHistory[itemId][dateStr] = qty;
            }
        });

        console.log(`[API ML Inventory] Found ${Object.keys(inventoryMap).length} items and historical snapshots for ${Object.keys(inventoryHistory).length} items`);

        return NextResponse.json({ 
            success: true, 
            inventory: inventoryMap,
            inventoryHistory: inventoryHistory,
            count: Object.keys(inventoryMap).length
        });
    } catch (error: unknown) {
        console.error("[API ML Inventory] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
