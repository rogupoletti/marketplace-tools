import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { AnymarketClient } from "./anymarket-client";
import { decryptToken } from "../../utils/crypto";
import { AnymarketIntegrationStatus, AnymarketOrder, NormalizedOrderItem } from "./anymarket-types";
import { normalizeOrder } from "./normalize-order";
import { saveSales } from "./save-sales";

export async function syncOrders(accountId: string, daysBefore: number = 90) {
    const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
    const doc = await integrationRef.get();

    if (!doc.exists) {
        throw new Error("Anymarket integration not configured for this account.");
    }

    const config = doc.data() as AnymarketIntegrationStatus;

    if (!config.enabled || !config.encryptedToken) {
        throw new Error("Anymarket integration is disabled or token is missing.");
    }

    try {
        const isResuming = config.lastSyncStatus === 'error' || config.lastSyncStatus === 'running';
        const startOffset = isResuming ? (config.syncOffset || 0) : 0;

        await integrationRef.update({ 
            lastSyncStatus: 'running',
            syncProgress: isResuming ? (config.syncProgress || 0) : 0,
            totalOrders: isResuming ? (config.totalOrders || 0) : 0,
            syncOffset: startOffset
        });

        const token = decryptToken(config.encryptedToken, config.tokenIv, config.tokenAuthTag);
        const client = new AnymarketClient(token);

        // Período dinâmico baseado no parâmetro
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - daysBefore);
        const createdAfter = dateFrom.toISOString().split('.')[0] + 'Z'; 
        
        let offset = startOffset;
        const limit = 50;
        let hasMore = true;
        let totalProcessed = startOffset;

        console.log(`[Anymarket Sync] ${isResuming ? 'Retomando' : 'Iniciando'} busca de pedidos desde ${createdAfter} (Offset inicial: ${offset})...`);

        while (hasMore) {
            console.log(`[Anymarket Sync] Solicitando página (offset: ${offset})...`);
            const page = await client.fetchOrders(createdAfter, offset, limit);
            const orders = page.content;

            if (orders.length > 0) {
                const normalizedItems: NormalizedOrderItem[] = [];
                orders.forEach(order => {
                    const items = normalizeOrder(order);
                    normalizedItems.push(...items);
                });

                await saveSales(accountId, orders, normalizedItems);
                totalProcessed += orders.length;
                offset += orders.length;

                const progress = page.page.totalElements > 0 
                    ? Math.round((totalProcessed / page.page.totalElements) * 100) 
                    : 0;

                await integrationRef.update({ 
                    syncProgress: progress,
                    totalOrders: page.page.totalElements,
                    syncOffset: offset
                });

                console.log(`[Anymarket Sync] Processados ${totalProcessed} pedidos de um total de ${page.page.totalElements} (${progress}%)...`);
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            if (page.page.number + 1 >= page.page.totalPages || orders.length === 0) {
                hasMore = false;
            } else {
                // offset incrementado no saveSales
            }
        }

        await integrationRef.update({
            lastInitialSyncAt: new Date().toISOString(),
            lastSuccessfulSyncAt: new Date().toISOString(),
            lastSyncStatus: 'success',
            lastSyncError: null,
            syncProgress: 100,
            syncOffset: 0
        });

    } catch (error: any) {
        console.error("Anymarket sync error:", error);
        await integrationRef.update({
            lastSyncStatus: 'error',
            lastSyncError: error.message || "Unknown error"
        });
        throw error;
    }
}
