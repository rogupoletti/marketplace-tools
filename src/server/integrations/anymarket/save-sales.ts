import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { AnymarketOrder, NormalizedOrderItem } from "./anymarket-types";

const VALID_STATUSES = [
    'PAID_WAITING_SHIP', 
    'PAID_WAITING_DELIVERY', 
    'INVOICED', 
    'CONCLUDED', 
    'SHIPPED', 
    'DELIVERED'
];

export async function saveSales(accountId: string, rawOrders: AnymarketOrder[], normalizedItems: NormalizedOrderItem[]) {
    const BATCH_LIMIT = 400; 
    let batch = adminDb.batch();
    let count = 0;

    async function commitBatch() {
        if (count > 0) {
            await batch.commit();
            batch = adminDb.batch();
            count = 0;
        }
    }

    const accountRef = adminDb.collection('accounts').doc(accountId);
    const FieldValue = require('firebase-admin').firestore.FieldValue;

    // 1. Buscar status dos pedidos existentes
    const orderIds = rawOrders.map(o => o.id.toString());
    const existingOrdersMap = new Map<string, AnymarketOrder>();
    
    // Dividimos em chunks de 30 (limite do 'in' no Firestore)
    for (let i = 0; i < orderIds.length; i += 30) {
        const chunk = orderIds.slice(i, i + 30);
        const existingSnapshot = await accountRef.collection('anymarketOrders')
            .where('__name__', 'in', chunk)
            .get();
        existingSnapshot.forEach(doc => {
            existingOrdersMap.set(doc.id, doc.data() as AnymarketOrder);
        });
    }

    console.log(`[Save Sales] Processando ${rawOrders.length} pedidos...`);

    // 2. Processar cada pedido com lógica de status
    for (const order of rawOrders) {
        const orderIdStr = order.id.toString();
        const existingOrder = existingOrdersMap.get(orderIdStr);
        
        const oldStatus = existingOrder?.status || 'UNKNOWN';
        const newStatus = order.status;

        const wasValid = VALID_STATUSES.includes(oldStatus);
        const isValid = VALID_STATUSES.includes(newStatus);

        // Otimização: se os dados estruturais do pedido não mudaram (como data de atualização) e o status é igual, 
        // poderíamos pular. Mas vamos salvar os raw data de qualquer forma para garantir integridade,
        // apenas não faremos operações matemáticas no salesDaily se o estado de validade não mudou.

        // Salva o pedido bruto atualizado
        const orderRef = accountRef.collection('anymarketOrders').doc(orderIdStr);
        batch.set(orderRef, order, { merge: true });
        count++;

        const items = normalizedItems.filter(item => item.orderId === orderIdStr);
        
        for (const item of items) {
            // Atualiza os itens
            const itemRef = accountRef.collection('anymarketOrderItems').doc(item.itemId);
            batch.set(itemRef, item, { merge: true });
            count++;

            // Lógica do salesDaily
            if (item.vendaQtd > 0) {
                const dailyId = `${item.date}_${item.sku}_${item.marketplace}`;
                const dailyRef = accountRef.collection('salesDaily').doc(dailyId);

                if (!wasValid && isValid) {
                    // Pedido novo ou era pendente/inválido e agora foi pago
                    batch.set(dailyRef, {
                        sku: item.sku,
                        date: item.date,
                        marketplace: item.marketplace,
                        vendaQtd: FieldValue.increment(item.vendaQtd),
                        vendaValorBruto: FieldValue.increment(item.vendaValorBruto),
                        vendaValorLiquido: FieldValue.increment(item.vendaValorLiquido)
                    }, { merge: true });
                    count++;
                } else if (wasValid && !isValid) {
                    // Pedido era válido (já somou) e agora foi cancelado ou ficou inválido. Precisamos estornar.
                    batch.set(dailyRef, {
                        sku: item.sku,
                        date: item.date,
                        marketplace: item.marketplace,
                        vendaQtd: FieldValue.increment(-item.vendaQtd),
                        vendaValorBruto: FieldValue.increment(-item.vendaValorBruto),
                        vendaValorLiquido: FieldValue.increment(-item.vendaValorLiquido)
                    }, { merge: true });
                    count++;
                }
                // Se wasValid === isValid, não fazemos nada no salesDaily (idempotência mantida)
            }
            
            if (count >= BATCH_LIMIT) await commitBatch();
        }
    }
    
    await commitBatch();
}
