import { adminDb } from "@/lib/firebase-admin";
import { MercadoLivreClient } from "./ml-client";
import { MLIntegrationData, MLFullInventorySnapshot } from "./ml-types";

export async function syncAccountFullInventory(accountId: string) {
    console.log(`[ML Full Sync] Starting sync for account: ${accountId}`);

    const integrationRef = adminDb
        .collection("accounts")
        .doc(accountId)
        .collection("integrations")
        .doc("mercadolivre");

    const doc = await integrationRef.get();

    if (!doc.exists) {
        console.log(`[ML Full Sync] Account ${accountId} does not have Mercado Livre connected. Skipping.`);
        return { success: false, reason: 'not_connected' };
    }

    let data = doc.data() as MLIntegrationData;
    const mlClient = new MercadoLivreClient();

    // Check if token needs refresh (giving a 5-minute buffer)
    if (Date.now() >= data.expires_at - (5 * 60 * 1000)) {
        console.log(`[ML Full Sync] Token expired or about to expire for account: ${accountId}. Refreshing...`);
        try {
            const newTokens = await mlClient.refreshToken(data.refresh_token);
            data = {
                ...data,
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                expires_at: Date.now() + (newTokens.expires_in * 1000),
                updated_at: Date.now()
            };
            await integrationRef.set(data, { merge: true });
        } catch (error: any) {
            console.error(`[ML Full Sync] Failed to refresh token for account: ${accountId}`, error);
            return { success: false, reason: 'token_refresh_failed', error: error.message };
        }
    }

    try {
        // Fetch all item IDs for the user
        const itemIds = await mlClient.fetchAllUserItems(data.user_id, data.access_token);
        console.log(`[ML Full Sync] Found ${itemIds.length} items for account: ${accountId}`);

        if (itemIds.length === 0) {
            return { success: true, count: 0 };
        }

        // Fetch details in chunks
        const itemDetails = await mlClient.fetchItemDetails(itemIds, data.access_token);
        
        // Filter only Fulfillment items
        const fullItems = itemDetails.filter(item => item.shipping?.logistic_type === 'fulfillment');
        console.log(`[ML Full Sync] Filtered ${fullItems.length} Fulfillment items for account: ${accountId}`);

        if (fullItems.length > 0) {
            const snapshotAt = Date.now();
            const batch = adminDb.batch();
            const inventoryCollection = adminDb
                .collection("accounts")
                .doc(accountId)
                .collection("ml_full_inventory");

            fullItems.forEach(item => {
                // We create a new document for each snapshot. 
                // A good ID could be `${item.id}_${snapshotAt}` to ensure uniqueness and order.
                const snapshotId = `${item.id}_${snapshotAt}`;
                const docRef = inventoryCollection.doc(snapshotId);
                
                const snapshotData: MLFullInventorySnapshot = {
                    item_id: item.id,
                    title: item.title,
                    available_quantity: item.available_quantity,
                    status: item.status,
                    logistic_type: item.shipping?.logistic_type,
                    permalink: item.permalink,
                    snapshot_at: snapshotAt,
                };
                
                batch.set(docRef, snapshotData);
            });

            // Firebase batches allow up to 500 operations. 
            // If an account has > 500 FULL items, we need to split batches.
            // For now, assuming most sellers have < 500 Full items, but let's be safe.
            let batchCount = 0;
            const chunkSize = 400;
            for (let i = 0; i < fullItems.length; i += chunkSize) {
                const chunk = fullItems.slice(i, i + chunkSize);
                const chunkBatch = adminDb.batch();
                
                chunk.forEach(item => {
                    const snapshotId = `${item.id}_${snapshotAt}`;
                    const docRef = inventoryCollection.doc(snapshotId);
                    chunkBatch.set(docRef, {
                        item_id: item.id,
                        title: item.title,
                        available_quantity: item.available_quantity,
                        status: item.status,
                        logistic_type: item.shipping?.logistic_type,
                        permalink: item.permalink,
                        snapshot_at: snapshotAt,
                    });
                });
                
                await chunkBatch.commit();
                batchCount++;
            }
            
            console.log(`[ML Full Sync] Saved ${fullItems.length} snapshots in ${batchCount} batches for account: ${accountId}`);
        }

        // Update last sync time
        await integrationRef.set({ lastSyncAt: Date.now() }, { merge: true });

        return { success: true, count: fullItems.length };

    } catch (error: any) {
        console.error(`[ML Full Sync] Error during sync for account: ${accountId}`, error);
        return { success: false, reason: 'extraction_failed', error: error.message };
    }
}

export async function runGlobalFullSync() {
    console.log("[ML Full Sync] Starting global sync...");
    
    try {
        const snapshot = await adminDb.collectionGroup("integrations")
            .where("provider", "==", "mercadolivre")
            .where("enabled", "==", true)
            .get();

        if (snapshot.empty) {
            console.log("[ML Full Sync] No active Mercado Livre accounts found.");
            return { processed: 0 };
        }

        console.log(`[ML Full Sync] Found ${snapshot.size} accounts to sync.`);

        const results = [];
        for (const doc of snapshot.docs) {
            const accountId = doc.ref.parent.parent?.id;
            if (accountId) {
                const result = await syncAccountFullInventory(accountId);
                results.push({ accountId, ...result });
            }
        }

        console.log("[ML Full Sync] Global sync completed.");
        return {
            total: snapshot.size,
            processed: results.length,
            results
        };
    } catch (error: any) {
        console.error("[ML Full Sync] Fatal error during global sync:", error);
        throw error;
    }
}
