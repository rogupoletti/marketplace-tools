export const RETURN_CHANNELS = ["meli", "shopee", "ecommerce", "other"] as const;
export const RETURN_TYPES = ["full", "flex", "ecommerce", "other"] as const;
export const RETURN_STATUSES = [
    "on_the_way",
    "pending_analysis",
    "pending_dispute_or_refund",
    "waiting_dispute_or_refund",
    "pending_return_invoice",
    "resolved",
    "cancelled",
] as const;

export type ReturnChannel = (typeof RETURN_CHANNELS)[number];
export type ReturnType = (typeof RETURN_TYPES)[number];
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type ReturnSource = "manual" | "anymarket";
export type ReturnHistoryOrigin = "manual" | "anymarket_webhook";

export type ReturnHistoryAction =
    | "created"
    | "updated"
    | "status_changed"
    | "webhook_received"
    | "cancelled"
    | "resolved";

export interface MarketplaceReturnItem {
    id?: string;
    orderItemId?: string;
    skuId?: string;
    marketplaceSkuId?: string;
    sku?: string;
    title?: string;
    quantity?: number;
}

export interface MarketplaceReturn {
    id: string;
    accountId: string;
    source?: ReturnSource;
    orderNumber: string;
    invoiceNumber?: string;
    customerName: string;
    channel: ReturnChannel;
    returnType: ReturnType;
    status: ReturnStatus;
    externalReturnId?: string;
    externalOrderId?: string;
    marketplaceOrderId?: string;
    marketplaceReturnId?: string;
    marketplace?: string;
    anymarketStatus?: string;
    trackingCode?: string;
    trackingUrl?: string;
    trackingUpdatedAt?: string;
    reverseShippingId?: string;
    reverseTrackingCode?: string;
    reverseTrackingNumber?: string;
    reverseMarketplaceShippingId?: string;
    reverseShippingStatus?: string;
    reverseShippingSubStatus?: string;
    returnItems?: MarketplaceReturnItem[];
    lastWebhookReceivedAt?: string;
    lastExternalStatusAt?: string;
    returnDate: string;
    expectedArrivalDate?: string;
    notes?: string;
    pendingIssue?: string;
    createdAt: string;
    updatedAt: string;
    createdByUid?: string;
    createdByEmail?: string;
    updatedByUid?: string;
    updatedByEmail?: string;
}

export interface ReturnHistoryEvent {
    id: string;
    returnId: string;
    action: ReturnHistoryAction;
    previousStatus?: ReturnStatus;
    newStatus?: ReturnStatus;
    origin?: ReturnHistoryOrigin;
    eventLogId?: string;
    note?: string;
    createdAt: string;
    createdByUid?: string;
    createdByEmail?: string;
}

export interface ReturnFormData {
    orderNumber: string;
    invoiceNumber?: string;
    customerName: string;
    channel: ReturnChannel;
    returnType: ReturnType;
    returnDate: string;
    expectedArrivalDate?: string;
    notes?: string;
    pendingIssue?: string;
}

export interface ReturnUpdateData extends Partial<ReturnFormData> {
    status?: ReturnStatus;
}

export const RETURN_CHANNEL_LABELS: Record<ReturnChannel, string> = {
    meli: "MELI",
    shopee: "Shopee",
    ecommerce: "Ecommerce",
    other: "Outro",
};

export const RETURN_TYPE_LABELS: Record<ReturnType, string> = {
    full: "Full",
    flex: "Flex",
    ecommerce: "Ecommerce",
    other: "Outro",
};

export const RETURN_SOURCE_LABELS: Record<ReturnSource, string> = {
    manual: "Manual",
    anymarket: "AnyMarket",
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
    on_the_way: "A Caminho",
    pending_analysis: "Pendente Análise",
    pending_dispute_or_refund: "Pendente Contestação / Reembolso",
    waiting_dispute_or_refund: "Aguardando Contestação / Reembolso",
    pending_return_invoice: "Pendente Nota Devolução",
    resolved: "Resolvido / Finalizado",
    cancelled: "Cancelada",
};

export const RETURN_HISTORY_ACTION_LABELS: Record<ReturnHistoryAction, string> = {
    created: "Devolução criada",
    updated: "Dados atualizados",
    status_changed: "Status alterado",
    webhook_received: "Webhook recebido",
    cancelled: "Devolução cancelada",
    resolved: "Devolução finalizada",
};

export function isReturnChannel(value: unknown): value is ReturnChannel {
    return typeof value === "string" && RETURN_CHANNELS.includes(value as ReturnChannel);
}

export function isReturnType(value: unknown): value is ReturnType {
    return typeof value === "string" && RETURN_TYPES.includes(value as ReturnType);
}

export function isReturnStatus(value: unknown): value is ReturnStatus {
    return typeof value === "string" && RETURN_STATUSES.includes(value as ReturnStatus);
}
