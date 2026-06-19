import "server-only";

import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import {
    MarketplaceReturn,
    MarketplaceReturnItem,
    ReturnChannel,
    ReturnHistoryAction,
    ReturnStatus,
    ReturnType,
    RETURN_STATUS_LABELS,
} from "@/lib/returns";
import { decryptToken } from "@/server/utils/crypto";
import { indexReturnIdentifiers } from "@/server/returns/mobile";
import { AnymarketClient } from "./anymarket-client";
import { AnymarketIntegrationStatus } from "./anymarket-types";

type ProcessingStatus = "received" | "processed" | "ignored" | "failed";

export interface NormalizedAnyMarketReturnEvent {
    eventType?: string;
    externalEventId?: string;
    externalReturnId?: string;
    externalOrderId?: string;
    marketplaceOrderId?: string;
    marketplaceReturnId?: string;
    orderNumber?: string;
    invoiceNumber?: string;
    customerName?: string;
    marketplace?: string;
    anymarketStatus?: string;
    trackingCode?: string;
    trackingUrl?: string;
    reverseShippingId?: string;
    reverseTrackingCode?: string;
    reverseTrackingNumber?: string;
    reverseMarketplaceShippingId?: string;
    reverseShippingStatus?: string;
    reverseShippingSubStatus?: string;
    returnItems?: MarketplaceReturnItem[];
    orderFull?: boolean;
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
    RETURN_CHECK_NOT_OK: "pending_dispute_or_refund",
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

function cleanNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace(",", "."));
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function cleanBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    if (typeof value === "string") {
        const normalized = normalizeKey(value);
        if (["TRUE", "SIM", "YES", "S", "1"].includes(normalized)) return true;
        if (["FALSE", "NAO", "NO", "N", "0"].includes(normalized)) return false;
    }
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

function firstBoolean(payload: unknown, paths: string[]): boolean | undefined {
    for (const path of paths) {
        const value = cleanBoolean(getByPath(payload, path));
        if (value !== undefined) return value;
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

function mergeEventDetails(
    event: NormalizedAnyMarketReturnEvent,
    details: Partial<NormalizedAnyMarketReturnEvent>
): NormalizedAnyMarketReturnEvent {
    return {
        ...event,
        externalOrderId: event.externalOrderId || details.externalOrderId,
        marketplaceOrderId: event.marketplaceOrderId || details.marketplaceOrderId,
        marketplaceReturnId: event.marketplaceReturnId || details.marketplaceReturnId,
        orderNumber: event.orderNumber || details.orderNumber,
        invoiceNumber: event.invoiceNumber || details.invoiceNumber,
        customerName: event.customerName || details.customerName,
        marketplace: event.marketplace || details.marketplace,
        anymarketStatus: event.anymarketStatus || details.anymarketStatus,
        trackingCode: event.trackingCode || details.trackingCode,
        trackingUrl: event.trackingUrl || details.trackingUrl,
        reverseShippingId: event.reverseShippingId || details.reverseShippingId,
        reverseTrackingCode: event.reverseTrackingCode || details.reverseTrackingCode,
        reverseTrackingNumber: event.reverseTrackingNumber || details.reverseTrackingNumber,
        reverseMarketplaceShippingId: event.reverseMarketplaceShippingId || details.reverseMarketplaceShippingId,
        reverseShippingStatus: event.reverseShippingStatus || details.reverseShippingStatus,
        reverseShippingSubStatus: event.reverseShippingSubStatus || details.reverseShippingSubStatus,
        returnItems: event.returnItems || details.returnItems,
        orderFull: event.orderFull ?? details.orderFull,
        eventTimestamp: event.eventTimestamp || details.eventTimestamp,
    };
}

function mergeOrderDetails(
    event: NormalizedAnyMarketReturnEvent,
    details: Partial<NormalizedAnyMarketReturnEvent>
): NormalizedAnyMarketReturnEvent {
    const merged = mergeEventDetails(event, details);
    return {
        ...merged,
        orderNumber: details.orderNumber || merged.orderNumber,
    };
}

function normalizeAnyMarketOrderDetails(order: unknown): Partial<NormalizedAnyMarketReturnEvent> {
    return {
        externalOrderId: firstString(order, [
            "id",
            "orderId",
            "anymarketOrderId",
            "idOrder",
            "order.id",
            "content.id",
            "content.order.id",
        ]),
        orderNumber: firstString(order, [
            "marketPlaceNumber",
            "marketplaceNumber",
            "orderNumber",
            "number",
            "id",
            "order.orderNumber",
            "order.number",
            "order.id",
            "content.orderNumber",
            "content.number",
            "content.id",
        ]),
        invoiceNumber: firstString(order, [
            "invoiceNumber",
            "invoice.number",
            "invoice.nfeNumber",
            "invoice.nfNumber",
            "invoices.0.number",
            "invoices.0.nfeNumber",
            "invoices.0.nfNumber",
            "nfe.number",
            "nfe.nfeNumber",
            "nfe.invoiceNumber",
            "nf.number",
            "nf.numero",
            "notaFiscal.numero",
            "notaFiscal.number",
            "order.invoiceNumber",
            "order.invoice.number",
            "content.invoiceNumber",
            "content.invoice.number",
        ]),
        customerName: firstString(order, [
            "customerName",
            "buyer.name",
            "buyer.fullName",
            "buyer.nickname",
            "customer.name",
            "customer.fullName",
            "client.name",
            "billingAddress.name",
            "billingAddress.receiverName",
            "shippingAddress.name",
            "shippingAddress.receiverName",
            "deliveryAddress.name",
            "deliveryAddress.receiverName",
            "receiverName",
            "order.buyer.name",
            "order.customer.name",
            "content.buyer.name",
            "content.customer.name",
        ]),
        marketplace: firstString(order, [
            "marketPlace",
            "marketplace",
            "marketPlace.name",
            "marketplace.name",
            "marketPlaceId",
            "marketplaceId",
            "channel",
            "accountName",
            "order.marketPlace",
            "order.marketplace",
            "content.marketPlace",
            "content.marketplace",
        ]),
        anymarketStatus: firstString(order, [
            "status",
            "status.name",
            "status.description",
            "order.status",
            "order.status.name",
            "content.status",
            "content.status.name",
        ]),
        orderFull: firstBoolean(order, [
            "full",
            "isFull",
            "fulfillment",
            "order.full",
            "order.isFull",
            "order.fulfillment",
            "content.full",
            "content.isFull",
            "content.fulfillment",
            "content.order.full",
            "content.order.isFull",
            "content.order.fulfillment",
        ]),
        eventTimestamp: firstTimestamp(order, [
            "updatedAt",
            "createdAt",
            "paymentDate",
            "invoice.date",
            "invoice.createdAt",
            "content.updatedAt",
            "content.createdAt",
        ]),
    };
}

function normalizeAnyMarketReturnDetails(returnPayload: unknown): Partial<NormalizedAnyMarketReturnEvent> {
    const externalOrderId = firstString(returnPayload, [
        "orderId",
        "anymarketOrderId",
        "idOrder",
        "order.id",
        "content.orderId",
        "content.order.id",
    ]);
    const marketplaceOrderId = firstString(returnPayload, [
        "marketplaceOrderId",
        "marketPlaceOrderId",
        "return.marketplaceOrderId",
        "return.marketPlaceOrderId",
        "content.marketplaceOrderId",
        "content.marketPlaceOrderId",
        "content.return.marketplaceOrderId",
        "content.return.marketPlaceOrderId",
    ]);

    return {
        externalReturnId: firstString(returnPayload, [
            "id",
            "returnId",
            "anymarketReturnId",
            "return.id",
            "content.id",
            "content.returnId",
        ]),
        externalOrderId,
        marketplaceOrderId,
        marketplaceReturnId: firstString(returnPayload, [
            "marketplaceReturnId",
            "return.marketplaceReturnId",
            "content.marketplaceReturnId",
            "content.return.marketplaceReturnId",
        ]),
        orderNumber: marketplaceOrderId || externalOrderId,
        invoiceNumber: firstString(returnPayload, [
            "invoiceNumber",
            "invoice.number",
            "invoice.nfeNumber",
            "invoice.nfNumber",
            "order.invoiceNumber",
            "order.invoice.number",
            "content.invoiceNumber",
            "content.invoice.number",
        ]),
        customerName: firstString(returnPayload, [
            "customerName",
            "buyerName",
            "buyer.name",
            "customer.name",
            "client.name",
            "order.buyer.name",
            "order.customer.name",
            "content.buyerName",
            "content.customerName",
            "content.buyer.name",
            "content.customer.name",
        ]),
        marketplace: firstString(returnPayload, [
            "marketplace",
            "marketPlace",
            "marketplace.name",
            "marketPlace.name",
            "accountName",
            "order.marketPlace",
            "order.marketplace",
            "content.marketplace",
            "content.marketPlace",
        ]),
        anymarketStatus: firstString(returnPayload, [
            "status",
            "returnStatus",
            "status.name",
            "status.description",
            "return.status",
            "reverseLogistics.status",
            "content.status",
            "content.returnStatus",
        ]),
        orderFull: firstBoolean(returnPayload, [
            "order.full",
            "order.isFull",
            "order.fulfillment",
            "content.order.full",
            "content.order.isFull",
            "content.order.fulfillment",
        ]),
        eventTimestamp: firstTimestamp(returnPayload, [
            "updatedAt",
            "createdAt",
            "date",
            "content.updatedAt",
            "content.createdAt",
        ]),
        returnItems: normalizeAnyMarketReturnItems(returnPayload),
    };
}

function normalizeAnyMarketReturnItems(returnPayload: unknown): MarketplaceReturnItem[] | undefined {
    const items = getArrayByPath(returnPayload, [
        "items",
        "return.items",
        "content.items",
        "content.return.items",
    ]);
    if (items.length === 0) return undefined;

    return items
        .map((item) => {
            const normalized = {
                id: firstString(item, ["id"]),
                orderItemId: firstString(item, ["orderItemId", "itemId"]),
                skuId: firstString(item, ["skuId", "sku.id"]),
                marketplaceSkuId: firstString(item, ["marketplaceSkuId", "marketPlaceSkuId"]),
                sku: firstString(item, [
                    "sku",
                    "partnerId",
                    "sku.partnerId",
                    "sku.sku",
                    "marketplaceSkuId",
                    "skuId",
                ]),
                title: firstString(item, [
                    "title",
                    "productTitle",
                    "name",
                    "description",
                    "sku.title",
                    "sku.name",
                ]),
                quantity: cleanNumber(getByPath(item, "quantity")) ||
                    cleanNumber(getByPath(item, "amount")) ||
                    cleanNumber(getByPath(item, "returnedAmount")) ||
                    cleanNumber(getByPath(item, "returnQuantity")),
            } satisfies MarketplaceReturnItem;

            return Object.fromEntries(
                Object.entries(normalized).filter(([, value]) => value !== undefined)
            ) as MarketplaceReturnItem;
        })
        .filter((item) => Object.keys(item).length > 0);
}

function getArrayByPath(payload: unknown, paths: string[]): unknown[] {
    for (const path of paths) {
        const value = getByPath(payload, path);
        if (Array.isArray(value)) return value;
    }
    return [];
}

function getReverseTrackingCode(marketplace: string | undefined, shipping: unknown): string | undefined {
    const normalizedMarketplace = normalizeKey(marketplace || "");
    const trackingNumber = firstString(shipping, [
        "trackingNumber",
        "trackingCode",
        "tracking.number",
        "tracking.code",
    ]);
    const marketplaceShippingId = firstString(shipping, [
        "marketplaceShippingId",
        "marketPlaceShippingId",
        "shippingId",
    ]);

    if (normalizedMarketplace.includes("MERCADO_LIVRE") || normalizedMarketplace.includes("MERCADOLIVRE") || normalizedMarketplace.includes("MELI")) {
        return marketplaceShippingId || trackingNumber;
    }

    if (normalizedMarketplace.includes("SHOPEE")) {
        return trackingNumber || marketplaceShippingId;
    }

    return trackingNumber || marketplaceShippingId;
}

function normalizeAnyMarketShippingDetails(
    returnPayload: unknown,
    shipping: unknown,
    marketplace?: string
): Partial<NormalizedAnyMarketReturnEvent> {
    const reverseTrackingNumber = firstString(shipping, [
        "trackingNumber",
        "trackingCode",
        "tracking.number",
        "tracking.code",
    ]);
    const reverseMarketplaceShippingId = firstString(shipping, [
        "marketplaceShippingId",
        "marketPlaceShippingId",
        "shippingId",
    ]);
    const reverseTrackingCode = getReverseTrackingCode(marketplace, shipping) || firstString(returnPayload, [
        "trackingCode",
        "trackingNumber",
        "tracking.number",
        "tracking.code",
    ]);

    return {
        trackingCode: reverseTrackingCode,
        trackingUrl: firstString(shipping, [
            "trackingUrl",
            "tracking.url",
        ]),
        reverseShippingId: firstString(shipping, ["id"]),
        reverseTrackingCode,
        reverseTrackingNumber,
        reverseMarketplaceShippingId,
        reverseShippingStatus: firstString(shipping, ["status"]),
        reverseShippingSubStatus: firstString(shipping, ["subStatus"]),
        eventTimestamp: firstTimestamp(shipping, [
            "updatedAt",
            "createdAt",
            "estimatedDelivery",
        ]),
    };
}

function expandEventByReturnShipping(
    event: NormalizedAnyMarketReturnEvent,
    returnPayload: unknown
): NormalizedAnyMarketReturnEvent[] {
    const shippingItems = getArrayByPath(returnPayload, ["shipping", "content.shipping"]);
    if (shippingItems.length === 0) return [event];

    return shippingItems.map((shipping) => mergeEventDetails(
        event,
        normalizeAnyMarketShippingDetails(returnPayload, shipping, event.marketplace)
    ));
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

function inferReturnType(channel: ReturnChannel, marketplace?: string, orderFull?: boolean): ReturnType {
    if (orderFull === true) return "full";
    if (orderFull === false) return "flex";

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
        "return.marketplaceOrderId",
        "return.marketPlaceOrderId",
        "order.marketplaceOrderId",
        "content.marketplaceOrderId",
        "content.marketPlaceOrderId",
        "content.return.marketplaceOrderId",
        "content.return.marketPlaceOrderId",
        "content.order.marketplaceOrderId",
    ]);
    const orderNumber = firstString(payload, [
        "orderNumber",
        "number",
        "marketPlaceNumber",
        "marketplaceNumber",
        "order.number",
        "order.orderNumber",
        "order.marketPlaceNumber",
        "order.marketplaceNumber",
        "content.orderNumber",
        "content.order.number",
        "content.marketPlaceNumber",
        "content.marketplaceNumber",
        "content.order.marketPlaceNumber",
        "content.order.marketplaceNumber",
    ]);
    const invoiceNumber = firstString(payload, [
        "invoiceNumber",
        "invoice.number",
        "invoice.nfeNumber",
        "invoice.nfNumber",
        "invoices.0.number",
        "invoices.0.nfeNumber",
        "invoices.0.nfNumber",
        "nfe.number",
        "nfe.nfeNumber",
        "nfe.invoiceNumber",
        "nf.number",
        "nf.numero",
        "notaFiscal.numero",
        "notaFiscal.number",
        "order.invoiceNumber",
        "order.invoice.number",
        "content.invoiceNumber",
        "content.invoice.number",
        "content.invoice.nfeNumber",
        "content.invoice.nfNumber",
        "content.nfe.number",
    ]);
    const customerName = firstString(payload, [
        "customerName",
        "customer.name",
        "customer.fullName",
        "buyer.name",
        "buyer.fullName",
        "buyer.nickname",
        "client.name",
        "billingAddress.name",
        "billingAddress.receiverName",
        "shippingAddress.name",
        "shippingAddress.receiverName",
        "deliveryAddress.name",
        "deliveryAddress.receiverName",
        "receiverName",
        "order.customer.name",
        "order.buyer.name",
        "content.customerName",
        "content.customer.name",
        "content.customer.fullName",
        "content.buyer.name",
        "content.buyer.fullName",
        "content.order.customer.name",
        "content.order.buyer.name",
    ]);
    const marketplace = firstString(payload, [
        "marketplace",
        "marketPlace",
        "marketPlace.name",
        "marketplace.name",
        "marketPlaceId",
        "marketplaceId",
        "channel",
        "canal",
        "accountName",
        "order.marketPlace",
        "order.marketplace",
        "order.marketPlace.name",
        "content.marketplace",
        "content.marketPlace",
        "content.marketPlace.name",
        "content.marketPlaceId",
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
        trackingUrl,
        eventTimestamp,
        rawPayload: payload,
        isReturnEvent,
    };
}

async function getAnyMarketClient(accountId: string): Promise<AnymarketClient | null> {
    const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
    const doc = await integrationRef.get();
    if (!doc.exists) return null;

    const config = doc.data() as Partial<AnymarketIntegrationStatus>;
    if (!config.enabled || !config.encryptedToken || !config.tokenIv || !config.tokenAuthTag) return null;

    const token = decryptToken(config.encryptedToken, config.tokenIv, config.tokenAuthTag);
    return new AnymarketClient(token);
}

async function enrichReturnEventsFromOrder(
    accountId: string,
    event: NormalizedAnyMarketReturnEvent
): Promise<NormalizedAnyMarketReturnEvent[]> {
    let client: AnymarketClient | null = null;
    try {
        client = await getAnyMarketClient(accountId);
    } catch (error) {
        console.warn("[Anymarket Returns Webhook] Nao foi possivel carregar a integracao para enriquecer o pedido.", error);
        return [event];
    }

    if (!client) return [event];

    let enrichedEvent = event;
    let enrichedEvents = [event];
    const returnId = cleanString(event.externalReturnId);
    if (returnId) {
        try {
            const returnPayload = await client.fetchApi(`/orders/returns/${encodeURIComponent(returnId)}`, {}, 1);
            if (returnPayload && typeof returnPayload === "object") {
                const returnDetails = normalizeAnyMarketReturnDetails(returnPayload);
                enrichedEvent = mergeEventDetails(enrichedEvent, returnDetails);
                enrichedEvents = expandEventByReturnShipping(enrichedEvent, returnPayload);
            }
        } catch (error) {
            console.warn(`[Anymarket Returns Webhook] Nao foi possivel buscar detalhes da devolucao ${returnId}.`, error);
        }
    }

    const candidateIds = [
        enrichedEvent.externalOrderId,
        event.externalOrderId,
        enrichedEvent.orderNumber,
        enrichedEvent.marketplaceOrderId,
        event.orderNumber,
        event.marketplaceOrderId,
    ]
        .map((value) => cleanString(value))
        .filter((value): value is string => Boolean(value) && value !== returnId);
    const uniqueCandidateIds = [...new Set(candidateIds)];

    for (const candidateId of uniqueCandidateIds) {
        try {
            const order = await client.fetchApi(`/orders/${encodeURIComponent(candidateId)}`, {}, 1);
            if (!order || typeof order !== "object") continue;

            const details = normalizeAnyMarketOrderDetails(order);
            return enrichedEvents.map((eventItem) => mergeOrderDetails(eventItem, details));
        } catch (error) {
            console.warn(`[Anymarket Returns Webhook] Nao foi possivel buscar detalhes do pedido ${candidateId}.`, error);
        }
    }

    return enrichedEvents;
}

function buildIdempotencyKey(event: NormalizedAnyMarketReturnEvent) {
    const shippingKey = event.reverseShippingId || event.reverseTrackingCode || event.trackingCode || "no-shipping-id";
    if (event.externalEventId) return `anymarket:return:event:${event.externalEventId}:${shippingKey}`;

    const rawHash = hash(stableStringify(event.rawPayload)).slice(0, 16);
    return [
        "anymarket:return",
        event.externalReturnId || "no-return-id",
        shippingKey,
        event.externalOrderId || event.marketplaceOrderId || event.orderNumber || "no-order-id",
        event.anymarketStatus || "no-status",
        event.eventTimestamp || rawHash,
    ].join(":");
}

async function findExistingReturn(accountId: string, event: NormalizedAnyMarketReturnEvent) {
    const returnsRef = adminDb.collection("accounts").doc(accountId).collection("returns");

    if (event.externalReturnId) {
        const snapshot = await returnsRef.where("externalReturnId", "==", event.externalReturnId).limit(50).get();
        const matches = snapshot.docs.map((doc) => ({
            ref: doc.ref,
            data: { id: doc.id, ...doc.data() } as MarketplaceReturn,
        }));

        const shippingMatched = matches.find(({ data }) => (
            (event.reverseShippingId && data.reverseShippingId === event.reverseShippingId) ||
            (event.reverseTrackingCode && (data.reverseTrackingCode === event.reverseTrackingCode || data.trackingCode === event.reverseTrackingCode)) ||
            (event.trackingCode && data.trackingCode === event.trackingCode)
        ));
        if (shippingMatched) return shippingMatched;

        if (event.reverseShippingId || event.reverseTrackingCode || event.trackingCode) {
            const legacyMatch = matches.find(({ data }) => !data.reverseShippingId && !data.reverseTrackingCode && !data.trackingCode);
            if (legacyMatch) return legacyMatch;
            if (matches.length === 1) return matches[0];
            return null;
        }

        if (matches[0]) return matches[0];
    }

    const lookupFields: Array<[keyof MarketplaceReturn, string | undefined]> = [
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
        marketplaceReturnId: event.marketplaceReturnId,
        marketplace: event.marketplace,
        anymarketStatus: event.anymarketStatus,
        trackingCode: event.trackingCode,
        trackingUrl: event.trackingUrl,
        trackingUpdatedAt: event.trackingCode || event.trackingUrl ? event.eventTimestamp || now : undefined,
        reverseShippingId: event.reverseShippingId,
        reverseTrackingCode: event.reverseTrackingCode,
        reverseTrackingNumber: event.reverseTrackingNumber,
        reverseMarketplaceShippingId: event.reverseMarketplaceShippingId,
        reverseShippingStatus: event.reverseShippingStatus,
        reverseShippingSubStatus: event.reverseShippingSubStatus,
        returnItems: event.returnItems && event.returnItems.length > 0 ? event.returnItems : undefined,
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

async function processAnyMarketReturnEvent(
    accountId: string,
    event: NormalizedAnyMarketReturnEvent
): Promise<ProcessAnyMarketReturnWebhookResult> {
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
                marketplaceReturnId: event.marketplaceReturnId,
                marketplaceOrderId: event.marketplaceOrderId,
                marketplace: event.marketplace,
                trackingCode: event.trackingCode,
                reverseShippingId: event.reverseShippingId,
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
                externalReturnId: event.externalReturnId,
                reverseShippingId: event.reverseShippingId,
                trackingCode: event.trackingCode,
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
            const returnType = inferReturnType(channel, event.marketplace, event.orderFull);
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
                marketplaceReturnId: event.marketplaceReturnId,
                marketplace: event.marketplace,
                anymarketStatus: event.anymarketStatus,
                trackingCode: event.trackingCode,
                trackingUrl: event.trackingUrl,
                trackingUpdatedAt: event.trackingCode || event.trackingUrl ? event.eventTimestamp || now : undefined,
                reverseShippingId: event.reverseShippingId,
                reverseTrackingCode: event.reverseTrackingCode,
                reverseTrackingNumber: event.reverseTrackingNumber,
                reverseMarketplaceShippingId: event.reverseMarketplaceShippingId,
                reverseShippingStatus: event.reverseShippingStatus,
                reverseShippingSubStatus: event.reverseShippingSubStatus,
                returnItems: event.returnItems && event.returnItems.length > 0 ? event.returnItems : undefined,
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
            await indexReturnIdentifiers(accountId, returnRef.id, returnData as MarketplaceReturn, "integration");

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
        const inferredReturnType = inferReturnType(current.channel, event.marketplace, event.orderFull);
        const shouldUpdateReturnType = current.returnType === "other" && inferredReturnType !== "other";
        const currentOrderLooksLikeFallback = Boolean(
            !current.orderNumber ||
            current.orderNumber === current.externalReturnId ||
            current.orderNumber === event.externalReturnId ||
            current.orderNumber === current.externalOrderId ||
            current.orderNumber === event.externalOrderId ||
            current.orderNumber === current.marketplaceOrderId ||
            current.orderNumber === event.marketplaceOrderId
        );
        const shouldUpdateOrderNumber = Boolean(
            event.orderNumber &&
            event.orderNumber !== current.orderNumber &&
            currentOrderLooksLikeFallback
        );
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
                returnType: shouldUpdateReturnType ? inferredReturnType : undefined,
                orderNumber: shouldUpdateOrderNumber ? event.orderNumber : undefined,
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
        await indexReturnIdentifiers(
            accountId,
            existingReturn.ref.id,
            {
                ...current,
                ...updateData,
                returnType: shouldUpdateReturnType ? inferredReturnType : current.returnType,
                orderNumber: shouldUpdateOrderNumber ? event.orderNumber : current.orderNumber,
                status: nextStatus || current.status,
            } as MarketplaceReturn,
            "integration"
        );

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

export async function processAnyMarketReturnWebhook(
    accountId: string,
    payload: unknown
): Promise<ProcessAnyMarketReturnWebhookResult> {
    const events = await enrichReturnEventsFromOrder(
        accountId,
        normalizeAnyMarketReturnWebhookPayload(payload)
    );
    const results: ProcessAnyMarketReturnWebhookResult[] = [];

    for (const event of events) {
        results.push(await processAnyMarketReturnEvent(accountId, event));
    }

    const representativeResult = results.find((result) => result.processingStatus === "processed") || results[0];
    if (!representativeResult) {
        throw new Error("Nenhum evento AnyMarket foi processado.");
    }

    if (results.length <= 1) return representativeResult;

    return {
        ...representativeResult,
        createdReturn: results.some((result) => result.createdReturn),
        statusChanged: results.some((result) => result.statusChanged),
        duplicate: results.every((result) => result.duplicate),
        processingMessage: `${representativeResult.processingMessage} ${results.length} item(ns) de envio reverso processado(s).`,
    };
}
