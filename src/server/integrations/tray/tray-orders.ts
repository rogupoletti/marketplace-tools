import "server-only";
import { TrayClient } from "./tray-client";
import { TrayRawOrder } from "./tray-types";

interface TrayOrderPage {
    orders: TrayRawOrder[];
    total?: number;
    page?: number;
    totalPages?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function toDateOnly(date: Date) {
    return date.toISOString().split("T")[0];
}

function unwrapOrder(raw: unknown): TrayRawOrder {
    const record = asRecord(raw);
    return asRecord(record.Order || record.order || raw);
}

function extractOrders(data: unknown): TrayOrderPage {
    const root = asRecord(data);
    const nestedData = asRecord(root.data);
    const list = root.Orders || root.orders || nestedData.Orders || nestedData.orders || root.results || [];
    const orders = asArray(list).map(unwrapOrder);
    const paging = asRecord(root.paging || root.Pagination || root.pagination || nestedData.paging);

    return {
        orders,
        total: Number(paging.total || paging.total_results || root.total || root.total_results) || undefined,
        page: Number(paging.page || paging.current_page || root.page) || undefined,
        totalPages: Number(paging.total_pages || paging.pages || root.total_pages) || undefined,
    };
}

export async function fetchTrayOrdersByPeriod(client: TrayClient, startDate: Date, endDate: Date): Promise<TrayRawOrder[]> {
    const limit = 50;
    let page = 1;
    let hasMore = true;
    const orders: TrayRawOrder[] = [];

    while (hasMore) {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            date_start: toDateOnly(startDate),
            date_end: toDateOnly(endDate),
            created_at_min: startDate.toISOString(),
            created_at_max: endDate.toISOString(),
        });

        const pageData = extractOrders(await client.fetchApi(`/orders?${params.toString()}`));
        orders.push(...pageData.orders);

        if (pageData.totalPages) {
            hasMore = page < pageData.totalPages;
        } else {
            hasMore = pageData.orders.length === limit;
        }

        page++;
        if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    return orders;
}
