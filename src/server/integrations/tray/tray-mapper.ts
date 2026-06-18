import "server-only";
import { TrayExternalSale, TrayRawOrder, TraySaleItem } from "./tray-types";

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringOrUndefined(value: unknown): string | undefined {
    if (value === undefined || value === null || String(value).trim() === "") return undefined;
    return String(value);
}

function firstValue(...values: unknown[]) {
    return values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
}

function numberValue(value: unknown, fallback = 0): number {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDate(value: unknown): string | undefined {
    if (!value) return undefined;
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

    const text = String(value);
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
        return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`).toISOString();
    }

    return undefined;
}

function dateOnly(value?: string) {
    return (value || new Date().toISOString()).split("T")[0];
}

function normalizeText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function safeDocIdPart(value: string) {
    return value.replace(/[\/\\#?[\]]+/g, "_").slice(0, 300) || "unknown";
}

export function normalizeTrayMarketplace(order: TrayRawOrder): string {
    const raw = firstValue(
        order.marketplace,
        order.market_place,
        order.marketPlace,
        order.channel,
        order.channel_name,
        order.source,
        order.origin,
        order.sale_channel,
        asRecord(order.SaleChannel).name,
        asRecord(order.Marketplace).name
    );

    if (!raw) return "TRAY";

    const normalized = normalizeText(String(raw));
    if (!normalized) return "TRAY";
    if (normalized.includes("SHOPEE")) return "SHOPEE";
    if (normalized.includes("MERCADO") || normalized.includes("MELI") || normalized.includes("MLB")) return "MERCADO_LIVRE";

    return normalized;
}

export function isTrayValidSale(status?: string, statusId?: string | number): boolean {
    const normalized = normalizeText(String(status || statusId || ""));
    if (!normalized) return true;

    const invalidTokens = ["CANCEL", "CANCELED", "CANCELADO", "ESTORN", "REFUND", "DEVOLVID", "FRAUD"];
    return !invalidTokens.some(token => normalized.includes(token));
}

function extractCustomer(order: TrayRawOrder) {
    const customer = asRecord(order.Customer || order.customer || order.Client || order.client);
    return {
        name: stringOrUndefined(firstValue(customer.name, customer.nome, order.customer_name, order.client_name)),
        email: stringOrUndefined(firstValue(customer.email, order.customer_email, order.client_email)),
        document: stringOrUndefined(firstValue(customer.cpf, customer.cnpj, customer.document, customer.document_number, order.customer_document)),
    };
}

function extractRawItems(order: TrayRawOrder): Record<string, unknown>[] {
    const candidates = [
        order.Products,
        order.products,
        order.Items,
        order.items,
        order.OrderProducts,
        order.order_products,
    ];

    const list = candidates.find(Array.isArray);
    if (!list) return [];

    return list.map((item) => {
        const record = asRecord(item);
        return asRecord(record.Product || record.product || record.Item || record.item || item);
    });
}

export function mapTrayOrderToExternalSale(rawOrder: TrayRawOrder, storeId: string): TrayExternalSale {
    const externalOrderId = String(firstValue(rawOrder.id, rawOrder.order_id, rawOrder.code, rawOrder.number) || "");
    const orderDocId = `${safeDocIdPart(storeId)}_${safeDocIdPart(externalOrderId)}`;
    const orderDate = normalizeDate(firstValue(rawOrder.date, rawOrder.created, rawOrder.created_at, rawOrder.date_created, rawOrder.OrderDate));
    const updatedAtExternal = normalizeDate(firstValue(rawOrder.modified, rawOrder.modified_at, rawOrder.updated_at, rawOrder.date_modified));
    const statusRecord = asRecord(rawOrder.Status);
    const status = stringOrUndefined(firstValue(rawOrder.status, rawOrder.status_name, statusRecord.name));
    const statusIdValue = firstValue(rawOrder.status_id, rawOrder.statusId, statusRecord.id);
    const statusId = typeof statusIdValue === "number" || typeof statusIdValue === "string" ? statusIdValue : stringOrUndefined(statusIdValue);
    const marketplace = normalizeTrayMarketplace(rawOrder);
    const isValidSale = isTrayValidSale(status, statusId);
    const now = new Date().toISOString();
    const rawItems = extractRawItems(rawOrder);
    const totalAmount = firstValue(rawOrder.total, rawOrder.total_amount, rawOrder.total_order);

    const items: TraySaleItem[] = rawItems.map((item, index) => {
        const sku = String(firstValue(item.sku, item.reference, item.reference_code, item.ean, item.product_id, `TRAY-${externalOrderId}-${index}`));
        const quantity = numberValue(firstValue(item.quantity, item.amount, item.qty), 1);
        const unitPrice = numberValue(firstValue(item.price, item.unit_price, item.sale_price), 0);
        const totalPrice = numberValue(firstValue(item.total, item.total_price, item.price_total), unitPrice * quantity);

        return {
            itemDocId: `${orderDocId}_${safeDocIdPart(String(firstValue(item.id, item.product_id, index)))}`,
            orderDocId,
            externalOrderId,
            externalProductId: stringOrUndefined(firstValue(item.id, item.product_id, item.external_product_id)),
            sku,
            name: stringOrUndefined(firstValue(item.name, item.description, item.title)),
            quantity,
            unitPrice,
            totalPrice,
            date: dateOnly(orderDate),
            marketplace,
            vendaQtd: quantity,
            vendaValorBruto: totalPrice,
            vendaValorLiquido: totalPrice,
            provider: "tray",
            storeId,
            isValidSale,
            rawPayload: item,
            updatedAt: now,
        };
    });

    return {
        provider: "tray",
        storeId,
        externalOrderId,
        orderDocId,
        orderNumber: stringOrUndefined(firstValue(rawOrder.number, rawOrder.order_number, rawOrder.code)),
        status,
        statusId,
        marketplace,
        customer: extractCustomer(rawOrder),
        items,
        totalAmount: totalAmount === undefined ? undefined : numberValue(totalAmount),
        orderDate,
        updatedAtExternal,
        rawPayload: rawOrder,
        isValidSale,
        updatedAt: now,
    };
}
