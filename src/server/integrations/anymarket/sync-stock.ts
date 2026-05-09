import { adminDb } from "@/lib/firebase-admin";
import { decryptToken } from "../../utils/crypto";
import { AnymarketClient } from "./anymarket-client";

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

  const token = decryptToken(cfg.encryptedToken, cfg.tokenIv, cfg.tokenAuthTag);
  const client = new AnymarketClient(token);

  // Fetch all SKUs with stock information (endpoint /skus)
  const allSKUs: any[] = [];
  let offset = 0;
  const limit = 100;
  let more = true;
  while (more) {
    const page = await client.fetchApi(`/skus?offset=${offset}&limit=${limit}`);
    const items = page.content || [];
    allSKUs.push(...items);
    if (items.length < limit) more = false; else offset += limit;
  }

  const batch = adminDb.batch();
  const prodCol = adminDb.collection("accounts").doc(accountId).collection("products");
  for (const skuObj of allSKUs) {
    // In /skus endpoint, partnerId is usually at the top level
    const sku = String(skuObj.partnerId || skuObj.sku?.partnerId || skuObj.sku?.code || skuObj.id).trim();
    if (!sku) continue;
    const amount = Number(skuObj.amount ?? 0);
    const docRef = prodCol.doc(sku);
    batch.set(docRef, { estoqueEmpresa: amount }, { merge: true });
  }

  await batch.commit();
  console.log(`[syncStock] Updated estoqueEmpresa for ${allSKUs.length} SKUs (account ${accountId})`);
}
