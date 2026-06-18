export type TrayConnectionStatus = "connected" | "disconnected" | "error";

export interface TrayTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    store_id?: string | number;
    seller_id?: string | number;
    user_id?: string | number;
    api_address?: string;
    api_host?: string;
    api_url?: string;
}

export interface TrayIntegrationData {
    provider: "tray";
    enabled: boolean;
    status: TrayConnectionStatus;
    storeId?: string;
    sellerId?: string;
    apiBaseUrl?: string;
    tokenExpiresAt?: string;
    encryptedAccessToken?: string;
    accessTokenIv?: string;
    accessTokenAuthTag?: string;
    encryptedRefreshToken?: string;
    refreshTokenIv?: string;
    refreshTokenAuthTag?: string;
    lastSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    lastSyncStatus?: "none" | "running" | "success" | "error";
    lastSyncError?: string | null;
    lastSyncCreated?: number;
    lastSyncUpdated?: number;
    lastSyncSkipped?: number;
    lastSyncErrors?: number;
    syncProgress?: number;
    totalOrders?: number;
    updatedAt?: string;
    createdAt?: string;
}

export interface TrayRawOrder {
    [key: string]: unknown;
}

export interface TrayCustomer {
    name?: string;
    email?: string;
    document?: string;
}

export interface TraySaleItem {
    itemDocId: string;
    orderDocId: string;
    externalOrderId: string;
    externalProductId?: string;
    sku: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice: number;
    date: string;
    marketplace: string;
    vendaQtd: number;
    vendaValorBruto: number;
    vendaValorLiquido: number;
    provider: "tray";
    storeId: string;
    isValidSale: boolean;
    rawPayload: unknown;
    updatedAt: string;
    createdAt?: string;
}

export interface TrayExternalSale {
    provider: "tray";
    storeId: string;
    externalOrderId: string;
    orderDocId: string;
    orderNumber?: string;
    status?: string;
    statusId?: string | number;
    marketplace: string;
    customer?: TrayCustomer;
    items: TraySaleItem[];
    totalAmount?: number;
    orderDate?: string;
    updatedAtExternal?: string;
    rawPayload: unknown;
    isValidSale: boolean;
    createdAt?: string;
    updatedAt: string;
}

export interface TraySyncResult {
    success: boolean;
    provider: "tray";
    periodDays: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    lastSyncAt: string;
}
