import "server-only";
import { firestore } from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { TrayExternalSale, TraySaleItem } from "./tray-types";

interface SaveSalesResult {
    created: number;
    updated: number;
    skipped: number;
    errors: number;
}

interface SalesDelta {
    vendaQtd: number;
    vendaValorBruto: number;
    vendaValorLiquido: number;
    sku: string;
    date: string;
    marketplace: string;
}

const FieldValue = firestore.FieldValue;

function safeDocIdPart(value: string) {
    return value.replace(/[\/\\#?[\]]+/g, "_").slice(0, 300) || "unknown";
}

function addDelta(map: Map<string, SalesDelta>, item: Pick<TraySaleItem, "date" | "sku" | "marketplace" | "vendaQtd" | "vendaValorBruto" | "vendaValorLiquido">, multiplier: 1 | -1) {
    const dailyId = `${safeDocIdPart(item.date)}_${safeDocIdPart(item.sku)}_${safeDocIdPart(item.marketplace)}`;
    const current = map.get(dailyId) || {
        vendaQtd: 0,
        vendaValorBruto: 0,
        vendaValorLiquido: 0,
        sku: item.sku,
        date: item.date,
        marketplace: item.marketplace,
    };

    map.set(dailyId, {
        vendaQtd: current.vendaQtd + item.vendaQtd * multiplier,
        vendaValorBruto: current.vendaValorBruto + item.vendaValorBruto * multiplier,
        vendaValorLiquido: current.vendaValorLiquido + item.vendaValorLiquido * multiplier,
        sku: current.sku,
        date: current.date,
        marketplace: current.marketplace,
    });
}

export async function saveTraySales(accountId: string, sales: TrayExternalSale[]): Promise<SaveSalesResult> {
    const accountRef = adminDb.collection("accounts").doc(accountId);
    const BATCH_LIMIT = 400;
    let batch = adminDb.batch();
    let writeCount = 0;
    const result: SaveSalesResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

    async function commitBatch() {
        if (writeCount > 0) {
            await batch.commit();
            batch = adminDb.batch();
            writeCount = 0;
        }
    }

    for (const sale of sales) {
        if (!sale.externalOrderId) {
            result.skipped++;
            continue;
        }

        try {
            const orderRef = accountRef.collection("trayOrders").doc(sale.orderDocId);
            const existingOrder = await orderRef.get();
            const existingItemsSnapshot = await accountRef.collection("trayOrderItems")
                .where("orderDocId", "==", sale.orderDocId)
                .get();

            const existingItems = new Map<string, TraySaleItem>();
            existingItemsSnapshot.forEach(doc => existingItems.set(doc.id, doc.data() as TraySaleItem));

            const incomingItems = new Map<string, TraySaleItem>();
            sale.items.forEach(item => incomingItems.set(item.itemDocId, item));

            const deltas = new Map<string, SalesDelta>();

            existingItems.forEach((oldItem, itemDocId) => {
                if (oldItem.isValidSale) {
                    addDelta(deltas, oldItem, -1);
                }

                if (!incomingItems.has(itemDocId)) {
                    batch.delete(accountRef.collection("trayOrderItems").doc(itemDocId));
                    writeCount++;
                }
            });

            sale.items.forEach(item => {
                if (item.isValidSale) {
                    addDelta(deltas, item, 1);
                }

                const existingItem = existingItems.get(item.itemDocId);
                const itemRef = accountRef.collection("trayOrderItems").doc(item.itemDocId);
                batch.set(itemRef, {
                    ...item,
                    createdAt: existingItem?.createdAt || new Date().toISOString(),
                }, { merge: true });
                writeCount++;
            });

            deltas.forEach((delta, dailyId) => {
                if (delta.vendaQtd === 0 && delta.vendaValorBruto === 0 && delta.vendaValorLiquido === 0) return;

                const dailyRef = accountRef.collection("salesDaily").doc(dailyId);

                batch.set(dailyRef, {
                    sku: delta.sku,
                    date: delta.date,
                    marketplace: delta.marketplace,
                    vendaQtd: FieldValue.increment(delta.vendaQtd),
                    vendaValorBruto: FieldValue.increment(delta.vendaValorBruto),
                    vendaValorLiquido: FieldValue.increment(delta.vendaValorLiquido),
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
                writeCount++;
            });

            batch.set(orderRef, {
                ...sale,
                createdAt: existingOrder.exists ? existingOrder.data()?.createdAt : new Date().toISOString(),
            }, { merge: true });
            writeCount++;

            if (existingOrder.exists) result.updated++;
            else result.created++;

            if (writeCount >= BATCH_LIMIT) {
                await commitBatch();
            }
        } catch (error) {
            result.errors++;
            console.error("[Tray Save Sales] Erro ao salvar pedido Tray:", sale.externalOrderId, error);
        }
    }

    await commitBatch();
    return result;
}
