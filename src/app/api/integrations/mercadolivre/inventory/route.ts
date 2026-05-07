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

        // Buscar o inventário mais recente no Firestore via Admin SDK
        const inventoryRef = adminDb.collection("accounts").doc(accountId).collection("ml_full_inventory");
        
        // 1. Descobrir qual é o timestamp do snapshot mais recente
        const latestDoc = await inventoryRef
            .orderBy("snapshot_at", "desc")
            .limit(1)
            .get();

        if (latestDoc.empty) {
            console.log(`[API ML Inventory] No inventory found for account: ${accountId}`);
            return NextResponse.json({ success: true, inventory: {}, count: 0 });
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

        console.log(`[API ML Inventory] Found ${Object.keys(inventoryMap).length} items`);

        return NextResponse.json({ 
            success: true, 
            inventory: inventoryMap,
            count: Object.keys(inventoryMap).length
        });
    } catch (error: any) {
        console.error("[API ML Inventory] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
