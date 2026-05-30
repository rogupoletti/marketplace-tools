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

export type ReturnHistoryAction =
    | "created"
    | "updated"
    | "status_changed"
    | "cancelled"
    | "resolved";

export interface MarketplaceReturn {
    id: string;
    accountId: string;
    source?: "manual";
    orderNumber: string;
    invoiceNumber?: string;
    customerName: string;
    channel: ReturnChannel;
    returnType: ReturnType;
    status: ReturnStatus;
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
