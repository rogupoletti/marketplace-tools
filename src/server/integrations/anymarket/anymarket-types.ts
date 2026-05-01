export interface AnymarketIntegrationStatus {
    enabled: boolean;
    tokenLast4: string;
    encryptedToken: string;
    tokenIv: string;
    tokenAuthTag: string;
    lastInitialSyncAt: string | null;
    lastDailySyncAt: string | null;
    lastSuccessfulSyncAt: string | null;
    lastSyncStatus: 'none' | 'running' | 'success' | 'error';
    lastSyncError: string | null;
    syncProgress: number;
    syncOffset: number;
    totalOrders: number;
    syncCursorCreatedAfter: string | null;
    syncCursorUpdatedAfter: string | null;
}

export interface AnymarketOrderPage {
    page: {
        size: number;
        totalElements: number;
        totalPages: number;
        number: number;
    };
    content: AnymarketOrder[];
}

export interface AnymarketOrderItem {
    sku: {
        partnerId: string; // O SKU real do lojista costuma vir no partnerId ou title
        title: string;
    };
    product: {
        title: string;
    };
    amount: number;
    unit: number; // Preço unitário
    discount: number;
    total: number;
}

export interface AnymarketOrder {
    id: number;
    marketPlaceId: string;
    marketPlaceNumber: string;
    marketPlace: string;
    accountName: string;
    createdAt: string;
    paymentDate: string;
    status: string;
    total: number;
    discount: number;
    freight: number;
    items: AnymarketOrderItem[];
    payments?: {
        marketplaceFee?: number;
    }[];
}

export interface NormalizedOrderItem {
    orderId: string;
    itemId: string;
    sku: string;
    date: string;
    marketplace: string;
    vendaQtd: number;
    vendaValorBruto: number;
    vendaValorLiquido: number;
    netAmountEstimated: boolean;
}

export interface DailySalesAggregation {
    sku: string;
    date: string; // YYYY-MM-DD
    marketplace: string;
    vendaQtd: number;
    vendaValorBruto: number;
    vendaValorLiquido: number;
}
