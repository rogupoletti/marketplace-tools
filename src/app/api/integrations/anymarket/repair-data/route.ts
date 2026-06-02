import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizeAnyMarketReturnWebhookPayload } from "@/server/integrations/anymarket/returns-webhook";

const VALID_STATUSES = [
    "PAID_WAITING_SHIP",
    "PAID_WAITING_DELIVERY",
    "INVOICED",
    "CONCLUDED",
    "SHIPPED",
    "DELIVERED",
];

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
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        const accountRef = adminDb.collection("accounts").doc(accountId);
        const FieldValue = require('firebase-admin').firestore.FieldValue;

        // Rodamos em background para não dar timeout
        (async () => {
            console.log(`[Repair Data] Iniciando reparo para conta ${accountId}...`);

            // 1. Limpar salesDaily atual
            const salesSnapshot = await accountRef.collection("salesDaily").get();
            let batch = adminDb.batch();
            let count = 0;
            const BATCH_LIMIT = 450;

            for (const doc of salesSnapshot.docs) {
                batch.delete(doc.ref);
                count++;
                if (count >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = adminDb.batch();
                    count = 0;
                }
            }
            if (count > 0) await batch.commit();
            console.log("[Repair Data] salesDaily limpa.");

            // 2. Buscar todos os itens de orderItems
            const ordersSnapshot = await accountRef.collection("anymarketOrders").get();
            const validSaleOrders = new Set<string>();
            ordersSnapshot.forEach((doc) => {
                const order = doc.data();
                if (VALID_STATUSES.includes(order.status) && !normalizeAnyMarketReturnWebhookPayload(order).isReturnEvent) {
                    validSaleOrders.add(doc.id);
                }
            });

            const itemsSnapshot = await accountRef.collection("anymarketOrderItems").get();
            console.log(`[Repair Data] Processando ${itemsSnapshot.size} itens para nova agregação...`);

            batch = adminDb.batch();
            count = 0;

            for (const doc of itemsSnapshot.docs) {
                const item = doc.data();
                if (!validSaleOrders.has(String(item.orderId || ""))) continue;
                
                // Padronização do marketplace
                const marketplace = (item.marketplace || "UNKNOWN").toUpperCase().includes("MERCADO") 
                    ? "MERCADO_LIVRE" 
                    : (item.marketplace || "UNKNOWN");

                if ((item.vendaQtd || 0) > 0) {
                    const dailyId = `${item.date}_${item.sku}_${marketplace}`;
                    const dailyRef = accountRef.collection("salesDaily").doc(dailyId);
                    
                    batch.set(dailyRef, {
                        sku: item.sku,
                        date: item.date,
                        marketplace: marketplace,
                        vendaQtd: FieldValue.increment(item.vendaQtd),
                        vendaValorBruto: FieldValue.increment(item.vendaValorBruto),
                        vendaValorLiquido: FieldValue.increment(item.vendaValorLiquido)
                    }, { merge: true });
                    
                    count++;
                    if (count >= BATCH_LIMIT) {
                        await batch.commit();
                        batch = adminDb.batch();
                        count = 0;
                    }
                }
            }
            if (count > 0) await batch.commit();
            console.log("[Repair Data] Reparo concluído com sucesso.");
        })().catch(err => console.error("[Repair Data] Erro crítico:", err));

        return NextResponse.json({ message: "Reparo iniciado em background" });

    } catch (error: any) {
        console.error("Erro ao iniciar reparo:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}
