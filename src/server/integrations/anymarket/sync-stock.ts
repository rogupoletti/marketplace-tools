import { adminDb } from "@/lib/firebase-admin";
import { decryptToken } from "../../utils/crypto";
import { AnymarketClient } from "./anymarket-client";

type AnymarketSkuStock = {
  id?: string | number;
  partnerId?: string | number;
  amount?: string | number | null;
  sku?: {
    partnerId?: string | number;
    code?: string | number;
  };
};

/**
 * Sync only stock (estoqueEmpresa) from Anymarket.
 * Runs 3× a day (07:00, 13:00, 17:00).
 */
export async function syncStock(accountId: string) {
  const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
  const doc = await integrationRef.get();
  if (!doc.exists) throw new Error("Anymarket integration not configured for this account.");
  const cfg = doc.data();
  if (!cfg?.enabled || !cfg.encryptedToken) throw new Error("Integration disabled or token missing.");

  await integrationRef.update({
    stockLastSyncStatus: "running",
    stockLastSyncError: null,
  });

  try {
    const token = decryptToken(cfg.encryptedToken, cfg.tokenIv, cfg.tokenAuthTag);
    const client = new AnymarketClient(token);

    // Fetch all SKUs with stock information (endpoint /skus)
    const allSKUs: AnymarketSkuStock[] = [];
    let offset = 0;
    const limit = 100;
    let more = true;
    while (more) {
      const page = await client.fetchApi(`/skus?offset=${offset}&limit=${limit}`);
      const items = (page.content || []) as AnymarketSkuStock[];
      allSKUs.push(...items);
      if (items.length < limit) more = false; else offset += limit;
    }

    const syncedAt = new Date().toISOString();
    let batch = adminDb.batch();
    const prodCol = adminDb.collection("accounts").doc(accountId).collection("products");
    let pendingWrites = 0;
    for (const skuObj of allSKUs) {
      // In /skus endpoint, partnerId is usually at the top level
      const sku = String(skuObj.partnerId || skuObj.sku?.partnerId || skuObj.sku?.code || skuObj.id).trim();
      if (!sku) continue;
      const amount = Number(skuObj.amount ?? 0);
      const docRef = prodCol.doc(sku);
      batch.set(docRef, { estoqueEmpresa: amount, updatedAt: syncedAt }, { merge: true });
      pendingWrites++;

      if (pendingWrites >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        pendingWrites = 0;
      }
    }

    if (pendingWrites > 0) {
      await batch.commit();
    }

    await integrationRef.update({
      stockLastSyncAt: syncedAt,
      stockLastSyncStatus: "success",
      stockLastSyncError: null,
      stockLastSyncSkuCount: allSKUs.length,
    });

    console.log(`[syncStock] Updated estoqueEmpresa for ${allSKUs.length} SKUs (account ${accountId})`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await integrationRef.update({
      stockLastSyncStatus: "error",
      stockLastSyncError: message,
    });
    throw error;
  }
}
