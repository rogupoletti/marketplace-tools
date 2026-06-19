export const RETURN_CHANNELS = ["meli", "shopee", "ecommerce", "other"] as const;
export const RETURN_TYPES = ["full", "full_meli_cd", "full_shopee_cd", "flex", "ecommerce", "other"] as const;
export const RETURN_STATUSES = [
    "on_the_way",
    "pending_analysis",
    "pending_dispute_or_refund",
    "waiting_dispute_or_refund",
    "pending_return_invoice",
    "resolved",
    "cancelled",
] as const;
export const RETURN_MARKETPLACES = ["mercado_livre", "shopee", "amazon", "magalu", "ecommerce", "other", "unknown"] as const;
export const MOBILE_SCAN_TYPES = ["qr_code", "barcode", "manual"] as const;
export const RETURN_ANALYSIS_ITEM_STATUSES = ["ok", "problem", "not_received", "wrong_product", "partial"] as const;
export const RETURN_PROBLEM_TYPES = [
    "damaged",
    "package_violated",
    "missing_part",
    "used_product",
    "wrong_product",
    "expired_product",
    "partial_quantity",
    "not_resellable",
    "other",
] as const;
export const RETURN_PHOTO_TYPES = ["label", "package", "problem", "wrong_product"] as const;
export const RETURN_ANALYSIS_DISPOSITIONS = ["resolve", "dispute", "refund", "pending_return_invoice"] as const;

export type ReturnChannel = (typeof RETURN_CHANNELS)[number];
export type ReturnType = (typeof RETURN_TYPES)[number];
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type ReturnMarketplace = (typeof RETURN_MARKETPLACES)[number];
export type MobileScanType = (typeof MOBILE_SCAN_TYPES)[number];
export type ReturnAnalysisItemStatus = (typeof RETURN_ANALYSIS_ITEM_STATUSES)[number];
export type ReturnProblemType = (typeof RETURN_PROBLEM_TYPES)[number];
export type ReturnPhotoType = (typeof RETURN_PHOTO_TYPES)[number];
export type ReturnAnalysisDisposition = (typeof RETURN_ANALYSIS_DISPOSITIONS)[number];
export type ReturnSource = "manual" | "anymarket" | "manual_mobile_creation";
export type ReturnHistoryOrigin = "manual" | "anymarket_webhook" | "mobile_return_analysis";

export interface MobileReturnScan {
    rawValue: string;
    normalizedValue: string;
    scanType: MobileScanType;
    scannedAt: string;
    source: "mobile_return_analysis";
}

export interface ReturnIdentifierIndexMatch {
    returnId: string;
    type: "barcode" | "qr_payload" | "tracking" | "pack_id" | "order_id" | "return_id" | "shipment_id" | "manual";
    marketplace: ReturnMarketplace;
    source: "integration" | "operator_scan" | "manual_link" | "manual_return_creation";
}

export interface ReturnAnalysisItem {
    id: string;
    returnId: string;
    sku: string;
    productName: string;
    ean?: string;
    expectedQty: number;
    receivedQty: number;
    status: ReturnAnalysisItemStatus;
    problemTypes: ReturnProblemType[];
    notes?: string;
    addedManually: boolean;
    analyzedBy?: string;
    analyzedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ReturnPhoto {
    id: string;
    returnId: string;
    itemId?: string;
    type: ReturnPhotoType;
    storagePath: string;
    downloadUrl: string;
    downloadToken?: string;
    contentType?: string;
    createdBy?: string;
    createdAt: string;
}

export interface ReturnAnalysisSummaryData {
    expectedItems: number;
    okItems: number;
    problemItems: number;
    notReceivedItems: number;
    manuallyAddedItems: number;
    photoCount: number;
}

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
    shipmentId?: string;
    packId?: string;
    labelBarcode?: string;
    labelQrPayload?: string;
    identifiers?: string[];
    reverseShippingId?: string;
    reverseTrackingCode?: string;
    reverseTrackingNumber?: string;
    reverseMarketplaceShippingId?: string;
    reverseShippingStatus?: string;
    reverseShippingSubStatus?: string;
    arrivalDate?: string;
    disputeDeadlineDate?: string;
    returnItems?: MarketplaceReturnItem[];
    lastWebhookReceivedAt?: string;
    lastExternalStatusAt?: string;
    returnDate: string;
    expectedArrivalDate?: string;
    notes?: string;
    pendingIssue?: string;
    labelInfo?: {
        rawScanPayload?: string;
        normalizedScanValue?: string;
        scanType?: MobileScanType;
        labelPhotoPath?: string;
        labelPhotoUrl?: string;
        detectedMarketplace?: ReturnMarketplace;
    };
    createdManually?: boolean;
    createdFromMobile?: boolean;
    analysisSummary?: ReturnAnalysisSummaryData;
    analysisDisposition?: ReturnAnalysisDisposition;
    analysisGeneralNotes?: string;
    analysisLocked?: boolean;
    analysisCompletedAt?: string;
    analysisCompletedByUid?: string;
    analysisCompletedByEmail?: string;
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
    full_meli_cd: "Full - CD MELI",
    full_shopee_cd: "Full - CD Shopee",
    flex: "Flex",
    ecommerce: "Ecommerce",
    other: "Outro",
};

export const RETURN_SOURCE_LABELS: Record<ReturnSource, string> = {
    manual: "Manual",
    anymarket: "AnyMarket",
    manual_mobile_creation: "Manual mobile",
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
