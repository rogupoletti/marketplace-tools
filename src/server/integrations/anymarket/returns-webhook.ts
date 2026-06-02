import "server-only";

import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import {
    MarketplaceReturn,
    ReturnChannel,
    ReturnHistoryAction,
    ReturnStatus,
    ReturnType,
    RETURN_STATUS_LABELS,
} from "@/lib/returns";

type ProcessingStatus = "received" | "processed" | "ignored" | "failed";

export interface NormalizedAnyMarketReturnEvent {
    eventType?: string;
    externalEventId?: string;
    externalReturnId?: string;
    externalOrderId?: string;
    marketplaceOrderId?: string;
    orderNumber?: string;
    invoiceNumber?: string;
    customerName?: string;
    marketplace?: string;
    anymarketStatus?: string;
    trackingCode?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
    eventTimestamp?: string;
    rawPayload: unknown;
    isReturnEvent: boolean;
}

interface ProcessAnyMarketReturnWebhookResult {
    logId: string;
    returnId?: string;
    processingStatus: ProcessingStatus;
    processingMessage: string;
    createdReturn: boolean;
    statusChanged: boolean;
    duplicate: boolean;
}

const RETURN_STATUS_ORDER: Record<ReturnStatus, number> = {
    on_the_way: 1,
    pending_analysis: 2,
    pending_dispute_or_refund: 3,
    waiting_dispute_or_refund: 4,
    pending_return_invoice: 5,
    resolved: 6,
    cancelled: 99,
};

const ANYMARKET_RETURN_STATUS_MAP: Record<string, ReturnStatus> = {
    RETURN_REQUESTED: "on_the_way",
    RETURN_CREATED: "on_the_way",
    RETURN_IN_TRANSIT: "on_the_way",
    WAITING_DELIVERY: "on_the_way",
    WAITING_CARRIER: "on_the_way",
    IN_TRANSIT: "on_the_way",
    ON_THE_WAY: "on_the_way",
    A_CAMINHO: "on_the_way",
    RETURN_DELIVERED: "pending_analysis",
    RETURN_RECEIVED: "pending_analysis",
    WAITING_CONFERENCE: "pending_analysis",
    CHECKED: "pending_analysis",
    RECEIVED: "pending_analysis",
    DELIVERED: "pending_analysis",
    RECEBIDO: "pending_analysis",
    ENTREGUE: "pending_analysis",
    ANALYSIS_REQUIRED: "pending_analysis",
    PENDING_ANALYSIS: "pending_analysis",
    REFUND_REQUESTED: "waiting_dispute_or_refund",
    REFUND_PENDING: "waiting_dispute_or_refund",
    DISPUTE_OPENED: "waiting_dispute_or_refund",
    DISPUTE_REQUIRED: "pending_dispute_or_refund",
    PENDING_DISPUTE: "pending_dispute_or_refund",
    PENDING_REFUND: "pending_dispute_or_refund",
    RETURN_INVOICE_PENDING: "pending_return_invoice",
    PENDING_RETURN_INVOICE: "pending_return_invoice",
    RETURN_COMPLETED: "resolved",
    REFUND_COMPLETED: "resolved",
    COMPLETED: "resolved",
    RESOLVED: "resolved",
    FINALIZED: "resolved",
    CANCELLED: "cancelled",
    CANCELED: "cancelled",
};

function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    ) as T;
}

function normalizeKey(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase();
}

function cleanString(value: unknown): string | undefined {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    return undefined;
}

function getByPath(payload: unknown, path: string): unknown {
    if (!payload || typeof payload !== "object") return undefined;
    return path.split(".").reduce<unknown>((current, key) => {
        if (!current || typeof current !== "object") return undefined;
        return (current as Record<string, unknown>)[key];
    }, payload);
}

function firstString(payload: unknown, paths: string[]): string | undefined {
    for (const path of paths) {
        const value = cleanString(getByPath(payload, path));
        if (value) return value;
    }
    return undefined;
}

function firstTimestamp(payload: unknown, paths: string[]): string | undefined {
    for (const path of paths) {
        const value = cleanString(getByPath(payload, path));
        if (!value) continue;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return undefined;
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
        .join(",")}}`;
}

function hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function mapMarketplaceToChannel(marketplace?: string): ReturnChannel {
    const normalized = normalizeKey(marketplace || "");
    if (normalized.includes("MELI") || normalized.includes("MERCADO_LIVRE") || normalized.includes("MERCADOLIVRE")) {
        return "meli";
    }
    if (normalized.includes("SHOPEE")) return "shopee";
    if (normalized.includes("ECOMMERCE") || normalized.includes("E_COMMERCE")) return "ecommerce";
    return "other";
}

function inferReturnType(channel: ReturnChannel, marketplace?: string): ReturnType {
    const normalized = normalizeKey(marketplace || "");
    if (normalized.includes("FULL")) return "full";
    if (normalized.includes("FLEX")) return "flex";
    if (channel === "ecommerce") return "ecommerce";
    return "other";
}

export function mapAnyMarketReturnStatusToInternalStatus(anymarketStatus?: string): ReturnStatus | null {
    if (!anymarketStatus) return null;
    return ANYMARKET_RETURN_STATUS_MAP[normalizeKey(anymarketStatus)] || null;
}

export function canAutoAdvanceReturnStatus(currentStatus: ReturnStatus, nextStatus: ReturnStatus): boolean {
    if (currentStatus === "resolved" || currentStatus === "cancelled") return false;
    if (nextStatus === "cancelled") return false;
    return RETURN_STATUS_ORDER[nextStatus] > RETURN_STATUS_ORDER[currentStatus];
}

export function normalizeAnyMarketReturnWebhookPayload(payload: unknown): NormalizedAnyMarketReturnEvent {
    const eventType = firstString(payload, [
        "eventType",
        "type",
        "event",
        "action",
        "topic",
        "resource",
        "subject",
    ]);
    const externalEventId = firstString(payload, [
        "eventId",
        "event.id",
        "notificationId",
        "notification.id",
        "uuid",
        "webhookId",
    ]);
    let externalReturnId = firstString(payload, [
        "returnId",
        "anymarketReturnId",
        "marketplaceReturnId",
        "return.id",
        "return.code",
        "return.marketplaceReturnId",
        "devolution.id",
        "devolution.code",
        "devolution.marketplaceReturnId",
        "reverseLogistics.id",
        "reverseLogistics.marketplaceReturnId",
        "content.returnId",
        "content.marketplaceReturnId",
        "content.return.id",
        "content.return.code",
        "content.return.marketplaceReturnId",
        "content.devolution.id",
        "content.devolution.marketplaceReturnId",
        "content.reverseLogistics.id",
        "content.reverseLogistics.marketplaceReturnId",
    ]);
    const externalOrderId = firstString(payload, [
        "orderId",
        "anymarketOrderId",
        "order.id",
        "content.orderId",
        "content.order.id",
        "content.order.idOrder",
        "sale.id",
        "content.sale.id",
    ]);
    const marketplaceOrderId = firstString(payload, [
        "marketplaceOrderId",
        "marketPlaceOrderId",
        "marketPlaceNumber",
        "return.marketplaceOrderId",
        "order.marketPlaceNumber",
        "order.marketplaceOrderId",
        "content.marketplaceOrderId",
        "content.marketPlaceNumber",
        "content.return.marketplaceOrderId",
        "content.order.marketPlaceNumber",
        "content.order.marketplaceOrderId",
    ]);
    const orderNumber = firstString(payload, [
        "orderNumber",
        "number",
        "order.number",
        "order.orderNumber",
        "content.orderNumber",
        "content.order.number",
    ]);
    const invoiceNumber = firstString(payload, [
        "invoiceNumber",
        "invoice.number",
        "nfe.number",
        "content.invoiceNumber",
        "content.invoice.number",
        "content.nfe.number",
    ]);
    const customerName = firstString(payload, [
        "customerName",
        "customer.name",
        "buyer.name",
        "client.name",
        "order.customer.name",
        "content.customerName",
        "content.customer.name",
        "content.buyer.name",
        "content.order.customer.name",
    ]);
    const marketplace = firstString(payload, [
        "marketplace",
        "marketPlace",
        "channel",
        "canal",
        "order.marketPlace",
        "content.marketplace",
        "content.marketPlace",
        "content.channel",
        "content.order.marketPlace",
    ]);
    const anymarketStatus = firstString(payload, [
        "status",
        "returnStatus",
        "status.name",
        "status.description",
        "return.status",
        "return.status.name",
        "devolution.status",
        "reverseLogistics.status",
        "content.status",
        "content.returnStatus",
        "content.status.name",
        "content.return.status",
        "content.devolution.status",
        "content.reverseLogistics.status",
    ]);
    const trackingCode = firstString(payload, [
        "trackingCode",
        "trackingNumber",
        "tracking.number",
        "tracking.code",
        "return.trackingCode",
        "return.trackingNumber",
        "return.tracking.number",
        "devolution.trackingCode",
        "devolution.trackingNumber",
        "reverseLogistics.trackingCode",
        "reverseLogistics.trackingNumber",
        "reverseLogistics.tracking.number",
        "content.trackingCode",
        "content.trackingNumber",
        "content.tracking.number",
        "content.return.trackingCode",
        "content.return.trackingNumber",
        "content.return.tracking.number",
        "content.devolution.trackingCode",
        "content.devolution.trackingNumber",
        "content.reverseLogistics.trackingCode",
        "content.reverseLogistics.trackingNumber",
        "content.reverseLogistics.tracking.number",
    ]);
    const trackingCarrier = firstString(payload, [
        "trackingCarrier",
        "carrier",
        "tracking.carrier",
        "return.trackingCarrier",
        "return.tracking.carrier",
        "devolution.trackingCarrier",
        "reverseLogistics.trackingCarrier",
        "reverseLogistics.carrier",
        "reverseLogistics.tracking.carrier",
        "content.trackingCarrier",
        "content.carrier",
        "content.tracking.carrier",
        "content.return.trackingCarrier",
        "content.return.tracking.carrier",
        "content.devolution.trackingCarrier",
        "content.reverseLogistics.trackingCarrier",
        "content.reverseLogistics.carrier",
        "content.reverseLogistics.tracking.carrier",
    ]);
    const trackingUrl = firstString(payload, [
        "trackingUrl",
        "tracking.url",
        "return.trackingUrl",
        "return.tracking.url",
        "devolution.trackingUrl",
        "reverseLogistics.trackingUrl",
        "reverseLogistics.tracking.url",
        "content.trackingUrl",
        "content.tracking.url",
        "content.return.trackingUrl",
        "content.return.tracking.url",
        "content.devolution.trackingUrl",
        "content.reverseLogistics.trackingUrl",
        "content.reverseLogistics.tracking.url",
    ]);
    const eventTimestamp = firstTimestamp(payload, [
        "eventTimestamp",
        "timestamp",
        "createdAt",
        "updatedAt",
        "date",
        "eventDate",
        "content.createdAt",
        "content.updatedAt",
        "content.date",
        "tracking.date",
        "tracking.updatedAt",
        "return.tracking.date",
        "return.tracking.updatedAt",
        "reverseLogistics.tracking.date",
        "reverseLogistics.tracking.updatedAt",
        "content.tracking.date",
        "content.tracking.updatedAt",
    ]);
    const eventHints = [
        eventType,
        firstString(payload, ["entity", "module", "content.type", "content.resource"]),
        externalReturnId,
        trackingCode,
    ]
        .filter(Boolean)
        .join(" ");
    const normalizedHints = normalizeKey(eventHints);
    if (!externalReturnId && (
        normalizedHints.includes("RETURN") ||
        normalizedHints.includes("RETURNS") ||
        normalizedHints.includes("DEVOL") ||
        normalizedHints.includes("REVERSE") ||
        normalizedHints.includes("REFUND")
    )) {
        externalReturnId = firstString(payload, ["id", "content.id"]);
    }
    const isReturnEvent =
        Boolean(externalReturnId) ||
        Boolean(trackingCode && normalizedHints.includes("TRACK")) ||
        Boolean(getByPath(payload, "return")) ||
        Boolean(getByPath(payload, "returns")) ||
        Boolean(getByPath(payload, "devolution")) ||
        Boolean(getByPath(payload, "reverseLogistics")) ||
        Boolean(getByPath(payload, "content.return")) ||
        Boolean(getByPath(payload, "content.returns")) ||
        Boolean(getByPath(payload, "content.devolution")) ||
        Boolean(getByPath(payload, "content.reverseLogistics")) ||
        normalizedHints.includes("RETURN") ||
        normalizedHints.includes("RETURNS") ||
        normalizedHints.includes("DEVOL") ||
        normalizedHints.includes("REVERSE") ||
        normalizedHints.includes("REFUND");

    return {
        eventType,
        externalEventId,
        externalReturnId,
        externalOrderId,
        marketplaceOrderId,
        orderNumber,
        invoiceNumber,
        customerName,
        marketplace,
        anymarketStatus,
        trackingCode,
        trackingCarrier,
        trackingUrl,
        eventTimestamp,
        rawPayload: payload,
        isReturnEvent,
    };
}

function buildIdempotencyKey(event: NormalizedAnyMarketReturnEvent) {
    if (event.externalEventId) return `anymarket:return:event:${event.externalEventId}`;

    const rawHash = hash(stableStringify(event.rawPayload)).slice(0, 16);
    return [
        "anymarket:return",
        event.externalReturnId || "no-return-id",
        event.externalOrderId || event.marketplaceOrderId || event.orderNumber || "no-order-id",
        event.anymarketStatus || "no-status",
        event.eventTimestamp || rawHash,
    ].join(":");
}

async function findExistingReturn(accountId: string, event: NormalizedAnyMarketReturnEvent) {
    const returnsRef = adminDb.collection("accounts").doc(accountId).collection("returns");
    const lookupFields: Array<[keyof MarketplaceReturn, string | undefined]> = [
        ["externalReturnId", event.externalReturnId],
        ["marketplaceOrderId", event.marketplaceOrderId],
        ["externalOrderId", event.externalOrderId],
        ["orderNumber", event.orderNumber || event.marketplaceOrderId || event.externalOrderId],
        ["invoiceNumber", event.invoiceNumber],
    ];

    for (const [field, value] of lookupFields) {
        if (!value) continue;
        const snapshot = await returnsRef.where(field, "==", value).limit(1).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return {
                ref: doc.ref,
                data: { id: doc.id, ...doc.data() } as MarketplaceReturn,
            };
        }
    }

    return null;
}

function getExternalReturnUpdate(event: NormalizedAnyMarketReturnEvent, now: string) {
    return withoutUndefined({
        source: "anymarket",
        externalReturnId: event.externalReturnId,
        externalOrderId: event.externalOrderId,
        marketplaceOrderId: event.marketplaceOrderId,
        marketplace: event.marketplace,
        anymarketStatus: event.anymarketStatus,
        trackingCode: event.trackingCode,
        trackingCarrier: event.trackingCarrier,
        trackingUrl: event.trackingUrl,
        trackingUpdatedAt: event.trackingCode || event.trackingCarrier || event.trackingUrl ? event.eventTimestamp || now : undefined,
        lastWebhookReceivedAt: now,
        lastExternalStatusAt: event.eventTimestamp || now,
        invoiceNumber: event.invoiceNumber,
        customerName: event.customerName,
        updatedAt: now,
        updatedByEmail: "anymarket_webhook",
    });
}

function getInitialStatus(mappedStatus: ReturnStatus | null): ReturnStatus {
    if (mappedStatus && canAutoAdvanceReturnStatus("on_the_way", mappedStatus)) {
        return mappedStatus;
    }
    return "on_the_way";
}

function getOrderNumber(event: NormalizedAnyMarketReturnEvent) {
    return event.orderNumber || event.marketplaceOrderId || event.externalOrderId || event.externalReturnId;
}

async function markLog(
    accountId: string,
    logId: string,
    idempotencyHash: string,
    processingStatus: ProcessingStatus,
    processingMessage: string,
    extra: Record<string, unknown> = {}
) {
    const now = new Date().toISOString();
    const accountRef = adminDb.collection("accounts").doc(accountId);
    const batch = adminDb.batch();

    batch.set(
        accountRef.collection("webhookEvents").doc(logId),
        withoutUndefined({
            processingStatus,
            processingMessage,
            processedAt: now,
            ...extra,
        }),
        { merge: true }
    );
    batch.set(
        accountRef.collection("webhookIdempotency").doc(idempotencyHash),
        withoutUndefined({
            processingStatus,
            processingMessage,
            processedAt: now,
            lastLogId: logId,
        }),
        { merge: true }
    );

    await batch.commit();
}

export async function processAnyMarketReturnWebhook(
    accountId: string,
    payload: unknown
): Promise<ProcessAnyMarketReturnWebhookResult> {
    const event = normalizeAnyMarketReturnWebhookPayload(payload);
    const now = new Date().toISOString();
    const accountRef = adminDb.collection("accounts").doc(accountId);
    const logRef = accountRef.collection("webhookEvents").doc();
    const idempotencyKey = buildIdempotencyKey(event);
    const idempotencyHash = hash(idempotencyKey);
    const idempotencyRef = accountRef.collection("webhookIdempotency").doc(idempotencyHash);
    let duplicate = false;

    await adminDb.runTransaction(async (transaction) => {
        const idempotencyDoc = await transaction.get(idempotencyRef);
        const existing = idempotencyDoc.exists ? idempotencyDoc.data() || {} : {};
        duplicate = idempotencyDoc.exists && existing.processingStatus !== "failed";

        transaction.set(
            logRef,
            withoutUndefined({
                source: "anymarket",
                eventType: event.eventType || "return_webhook",
                externalEventId: event.externalEventId,
                externalReturnId: event.externalReturnId,
                externalOrderId: event.externalOrderId,
                marketplace: event.marketplace,
                rawPayload: event.rawPayload,
                idempotencyKey,
                idempotencyHash,
                processingStatus: duplicate ? "ignored" : "received",
                processingMessage: duplicate ? "Evento ignorado por duplicidade." : "Evento recebido.",
                createdAt: now,
                processedAt: duplicate ? now : undefined,
            })
        );

        transaction.set(
            idempotencyRef,
            withoutUndefined({
                source: "anymarket",
                eventType: event.eventType || "return_webhook",
                idempotencyKey,
                idempotencyHash,
                firstLogId: existing.firstLogId || logRef.id,
                lastLogId: logRef.id,
                duplicateCount: duplicate ? Number(existing.duplicateCount || 0) + 1 : Number(existing.duplicateCount || 0),
                processingStatus: duplicate ? existing.processingStatus || "ignored" : "received",
                processingMessage: duplicate ? "Evento duplicado recebido." : "Evento recebido.",
                createdAt: existing.createdAt || now,
                updatedAt: now,
                lastDuplicateAt: duplicate ? now : existing.lastDuplicateAt,
            }),
            { merge: true }
        );
    });

    if (duplicate) {
        return {
            logId: logRef.id,
            processingStatus: "ignored",
            processingMessage: "Evento ignorado por duplicidade.",
            createdReturn: false,
            statusChanged: false,
            duplicate: true,
        };
    }

    try {
        if (!event.isReturnEvent) {
            const message = "Evento ignorado porque nao parece ser uma devolucao.";
            await markLog(accountId, logRef.id, idempotencyHash, "ignored", message);
            return {
                logId: logRef.id,
                processingStatus: "ignored",
                processingMessage: message,
                createdReturn: false,
                statusChanged: false,
                duplicate: false,
            };
        }

        const orderNumber = getOrderNumber(event);
        if (!orderNumber) {
            const message = "Evento de devolucao sem pedido ou identificador externo suficiente.";
            await markLog(accountId, logRef.id, idempotencyHash, "failed", message);
            return {
                logId: logRef.id,
                processingStatus: "failed",
                processingMessage: message,
                createdReturn: false,
                statusChanged: false,
                duplicate: false,
            };
        }

        const mappedStatus = mapAnyMarketReturnStatusToInternalStatus(event.anymarketStatus);
        const existingReturn = await findExistingReturn(accountId, event);

        if (!existingReturn) {
            const channel = mapMarketplaceToChannel(event.marketplace);
            const returnType = inferReturnType(channel, event.marketplace);
            const status = getInitialStatus(mappedStatus);
            const returnRef = accountRef.collection("returns").doc();
            const returnData = withoutUndefined({
                accountId,
                source: "anymarket",
                orderNumber,
                invoiceNumber: event.invoiceNumber,
                customerName: event.customerName || "Cliente nao informado",
                channel,
                returnType,
                status,
                externalReturnId: event.externalReturnId,
                externalOrderId: event.externalOrderId,
                marketplaceOrderId: event.marketplaceOrderId,
                marketplace: event.marketplace,
                anymarketStatus: event.anymarketStatus,
                trackingCode: event.trackingCode,
                trackingCarrier: event.trackingCarrier,
                trackingUrl: event.trackingUrl,
                trackingUpdatedAt: event.trackingCode || event.trackingCarrier || event.trackingUrl ? event.eventTimestamp || now : undefined,
                lastWebhookReceivedAt: now,
                lastExternalStatusAt: event.eventTimestamp || now,
                returnDate: (event.eventTimestamp || now).slice(0, 10),
                notes: `Criada automaticamente via AnyMarket.${event.anymarketStatus ? ` Status externo: ${event.anymarketStatus}.` : ""}`,
                createdAt: now,
                updatedAt: now,
                createdByEmail: "anymarket_webhook",
                updatedByEmail: "anymarket_webhook",
            });
            const historyRef = returnRef.collection("history").doc();
            const historyNote = status === "on_the_way"
                ? "Devolucao criada automaticamente via webhook AnyMarket."
                : `Devolucao criada automaticamente via webhook AnyMarket em ${RETURN_STATUS_LABELS[status]}.`;

            const batch = adminDb.batch();
            batch.set(returnRef, returnData);
            batch.set(
                historyRef,
                withoutUndefined({
                    returnId: returnRef.id,
                    action: "created" as ReturnHistoryAction,
                    newStatus: status,
                    origin: "anymarket_webhook",
                    eventLogId: logRef.id,
                    note: historyNote,
                    createdAt: now,
                    createdByEmail: "anymarket_webhook",
                })
            );
            await batch.commit();

            const message = "Devolucao criada automaticamente via AnyMarket.";
            await markLog(accountId, logRef.id, idempotencyHash, "processed", message, { returnId: returnRef.id });
            return {
                logId: logRef.id,
                returnId: returnRef.id,
                processingStatus: "processed",
                processingMessage: message,
                createdReturn: true,
                statusChanged: status !== "on_the_way",
                duplicate: false,
            };
        }

        const current = existingReturn.data;
        const updateData = getExternalReturnUpdate(event, now);
        let nextStatus: ReturnStatus | undefined;
        let action: ReturnHistoryAction = "webhook_received";
        let previousStatus: ReturnStatus | undefined;
        let newStatus: ReturnStatus | undefined;
        let message = "Webhook AnyMarket processado sem alteracao de etapa.";
        let historyNote = message;
        let statusChanged = false;

        if (!mappedStatus) {
            message = event.anymarketStatus
                ? `Status externo nao mapeado: ${event.anymarketStatus}.`
                : "Webhook AnyMarket recebido sem status externo mapeavel.";
            historyNote = message;
        } else if (mappedStatus === current.status) {
            message = `Webhook AnyMarket confirmado no status ${RETURN_STATUS_LABELS[current.status]}.`;
            historyNote = message;
        } else if (canAutoAdvanceReturnStatus(current.status, mappedStatus)) {
            nextStatus = mappedStatus;
            previousStatus = current.status;
            newStatus = mappedStatus;
            action = "status_changed";
            statusChanged = true;
            message = `Status avancado automaticamente para ${RETURN_STATUS_LABELS[mappedStatus]}.`;
            historyNote = `Status alterado automaticamente de "${RETURN_STATUS_LABELS[current.status]}" para "${RETURN_STATUS_LABELS[mappedStatus]}" via AnyMarket.`;
        } else if (current.status === "resolved" || current.status === "cancelled") {
            message = `Evento recebido, mas a devolucao esta em ${RETURN_STATUS_LABELS[current.status]} e nao foi movimentada automaticamente.`;
            historyNote = message;
        } else if (mappedStatus === "cancelled") {
            message = "Evento de cancelamento recebido; status interno mantido para avaliacao manual.";
            historyNote = message;
        } else {
            message = `Evento ignorado por representar retrocesso de "${RETURN_STATUS_LABELS[current.status]}" para "${RETURN_STATUS_LABELS[mappedStatus]}".`;
            historyNote = message;
        }

        const historyRef = existingReturn.ref.collection("history").doc();
        const batch = adminDb.batch();
        batch.update(
            existingReturn.ref,
            withoutUndefined({
                ...updateData,
                status: nextStatus,
            })
        );
        batch.set(
            historyRef,
            withoutUndefined({
                returnId: existingReturn.ref.id,
                action,
                previousStatus,
                newStatus,
                origin: "anymarket_webhook",
                eventLogId: logRef.id,
                note: historyNote,
                createdAt: now,
                createdByEmail: "anymarket_webhook",
            })
        );
        await batch.commit();

        await markLog(accountId, logRef.id, idempotencyHash, "processed", message, { returnId: existingReturn.ref.id });
        return {
            logId: logRef.id,
            returnId: existingReturn.ref.id,
            processingStatus: "processed",
            processingMessage: message,
            createdReturn: false,
            statusChanged,
            duplicate: false,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao processar webhook AnyMarket.";
        await markLog(accountId, logRef.id, idempotencyHash, "failed", message);
        throw error;
    }
}
