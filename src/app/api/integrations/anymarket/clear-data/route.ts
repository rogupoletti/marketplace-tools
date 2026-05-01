import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const userDoc = await adminDb.collection("users").doc(uid).get();
        const accountId = userDoc.data()?.accountId;

        if (!accountId) {
            return NextResponse.json({ error: "Acesso negado. Account ID não encontrado." }, { status: 403 });
        }

        const accountRef = adminDb.collection("accounts").doc(accountId);
        const collections = ["anymarketOrders", "anymarketOrderItems", "salesDaily"];

        console.log(`[Clear Data] Iniciando limpeza para conta ${accountId}...`);

        for (const collName of collections) {
            const snapshot = await accountRef.collection(collName).get();
            if (snapshot.empty) continue;

            const BATCH_LIMIT = 450;
            let batch = adminDb.batch();
            let count = 0;

            for (const doc of snapshot.docs) {
                batch.delete(doc.ref);
                count++;
                if (count >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = adminDb.batch();
                    count = 0;
                }
            }
            if (count > 0) await batch.commit();
            console.log(`[Clear Data] Coleção ${collName} limpa.`);
        }

        // Também resetamos o status da integração
        await accountRef.collection("integrations").doc("anymarket").update({
            lastSyncStatus: 'none',
            syncProgress: 0,
            syncOffset: 0,
            totalOrders: 0,
            lastInitialSyncAt: null,
            lastSuccessfulSyncAt: null,
            lastSyncError: null
        });

        return NextResponse.json({ message: "Dados limpos com sucesso" });

    } catch (error: any) {
        console.error("Erro ao limpar dados:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}
