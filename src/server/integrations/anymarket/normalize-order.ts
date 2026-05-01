import { AnymarketOrder, NormalizedOrderItem } from "./anymarket-types";

export function normalizeOrder(order: AnymarketOrder): NormalizedOrderItem[] {
    const normalizedItems: NormalizedOrderItem[] = [];
    
    // Na Anymarket, a data da venda principal costuma ser createdAt ou paymentDate.
    // Usaremos createdAt como base. Extraímos apenas a parte da data YYYY-MM-DD.
    const dateStr = order.createdAt.split('T')[0];
    
    // Calcula o total de taxas do pedido
    let totalMarketplaceFee = 0;
    if (order.payments && Array.isArray(order.payments)) {
        for (const payment of order.payments) {
            if (payment.marketplaceFee) {
                totalMarketplaceFee += payment.marketplaceFee;
            }
        }
    }

    // Como o marketplaceFee é por pedido, e temos múltiplos itens, 
    // precisamos ratear a taxa para cada item proporcionalmente ao valor dele no pedido,
    // ou se tiver apenas 1 item, joga tudo nele.
    // O valor bruto total dos itens:
    const totalItemsBruto = order.items.reduce((acc, item) => acc + item.total, 0);

    order.items.forEach((item, index) => {
        // Identificação do SKU
        const sku = item.sku.partnerId || `UNKNOWN-${order.id}-${index}`;
        
        const vendaQtd = item.amount;
        const vendaValorBruto = item.total;
        
        // Rateio da taxa de marketplace
        let itemFee = 0;
        if (totalMarketplaceFee > 0 && totalItemsBruto > 0) {
            const proportion = vendaValorBruto / totalItemsBruto;
            itemFee = totalMarketplaceFee * proportion;
        }

        const vendaValorLiquido = vendaValorBruto - itemFee;
        const netAmountEstimated = totalMarketplaceFee === 0;

        normalizedItems.push({
            orderId: order.id.toString(),
            itemId: `${order.id}_${index}`, // Usando o index como identificador único na ausência de itemId no item
            sku,
            date: dateStr,
            marketplace: (order.marketPlace || "UNKNOWN").toUpperCase().includes("MERCADO") ? "MERCADO_LIVRE" : (order.marketPlace || "UNKNOWN"),
            vendaQtd,
            vendaValorBruto,
            vendaValorLiquido,
            netAmountEstimated
        });
    });

    return normalizedItems;
}
