import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedTrayClient } from "./tray-auth";
import { fetchTrayOrdersByPeriod } from "./tray-orders";
import { mapTrayOrderToExternalSale } from "./tray-mapper";
import { saveTraySales } from "./save-sales";
import { TraySyncResult } from "./tray-types";

function friendlyError(error: unknown) {
    if (error instanceof Error) return error.message.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]");
    return "Erro desconhecido na sincronizacao Tray.";
}

export async function syncTraySalesLastDays(accountId: string, periodDays = 90): Promise<TraySyncResult> {
    const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("tray");
    const startedAt = new Date().toISOString();

    await integrationRef.set({
        lastSyncStatus: "running",
        lastSyncError: null,
        syncProgress: 0,
        updatedAt: startedAt,
    }, { merge: true });

    try {
        const { client, config } = await getAuthenticatedTrayClient(accountId);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const rawOrders = await fetchTrayOrdersByPeriod(client, startDate, endDate);
        await integrationRef.set({
            totalOrders: rawOrders.length,
            syncProgress: rawOrders.length > 0 ? 50 : 100,
        }, { merge: true });

        const storeId = config.storeId || "default";
        const sales = rawOrders.map(order => mapTrayOrderToExternalSale(order, storeId));
        const saveResult = await saveTraySales(accountId, sales);
        const lastSyncAt = new Date().toISOString();

        await integrationRef.set({
            provider: "tray",
            enabled: true,
            status: "connected",
            lastSyncAt,
            lastSuccessfulSyncAt: lastSyncAt,
            lastSyncStatus: "success",
            lastSyncError: null,
            lastSyncCreated: saveResult.created,
            lastSyncUpdated: saveResult.updated,
            lastSyncSkipped: saveResult.skipped,
            lastSyncErrors: saveResult.errors,
            syncProgress: 100,
            updatedAt: lastSyncAt,
        }, { merge: true });

        return {
            success: true,
            provider: "tray",
            periodDays,
            created: saveResult.created,
            updated: saveResult.updated,
            skipped: saveResult.skipped,
            errors: saveResult.errors,
            lastSyncAt,
        };
    } catch (error) {
        const message = friendlyError(error);
        await integrationRef.set({
            status: "error",
            lastSyncStatus: "error",
            lastSyncError: message,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        throw new Error(message);
    }
}
