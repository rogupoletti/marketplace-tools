import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { AnymarketClient } from "./anymarket-client";
import { decryptToken } from "../../utils/crypto";
import { AnymarketIntegrationStatus, AnymarketOrder, AnymarketOrderPage } from "./anymarket-types";

/**
 * Sync products (sku, descricao, mlb, mlbCatalogo) once per day.
 * Preserves manual fields (fornecedor, tamanhoCaixa, etc.) already stored.
 */
export async function syncProducts(accountId: string) {
  const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
  const doc = await integrationRef.get();
  if (!doc.exists) throw new Error("Anymarket integration not configured for this account.");
  const config = doc.data() as AnymarketIntegrationStatus;
  if (!config.enabled || !config.encryptedToken) throw new Error("Integration disabled or token missing.");

  const token = decryptToken(config.encryptedToken, config.tokenIv, config.tokenAuthTag);
  const client = new AnymarketClient(token);

  // --- Fetch products ---
  const products: any[] = [];
  let offset = 0;
  const limit = 100;
  let more = true;
  while (more) {
    const page = await client.fetchApi(`/products?offset=${offset}&limit=${limit}`);
    const content = page.content || [];
    products.push(...content);
    more = page.page.number + 1 < page.page.totalPages && content.length > 0;
    offset += content.length;
  }

  const prodCol = adminDb.collection("accounts").doc(accountId).collection("products");

  // --- Step 2: Fetch Marketplace Links for each SKU directly ---
  console.log(`[syncProducts] Fetching marketplace links for ${products.length} products...`);
  
  // Get existing products to see what we already have
  const existingSnap = await prodCol.get();
  const existingMap: Record<string, any> = {};
  existingSnap.docs.forEach(d => {
    existingMap[d.id] = d.data();
  });

  const allSkus = products.flatMap(p => p.skus || []);
  const skuToMlb: Record<string, { mlb: string, mlbCatalogo: string }> = {};
  
  let fetchCount = 0;
  for (const s of allSkus) {
    const partnerId = String(s.partnerId || s.id);
    
    // Optimization: If we already have the MLB and it's not a forced sync, skip
    // (In the future we can add a 'force' flag if needed)
    if (existingMap[partnerId]?.mlb || existingMap[partnerId]?.mlbCatalogo) {
      skuToMlb[partnerId] = {
        mlb: existingMap[partnerId].mlb,
        mlbCatalogo: existingMap[partnerId].mlbCatalogo
      };
      continue;
    }

    try {
      // Small delay to be gentle with Anymarket's strict rate limits
      if (fetchCount > 0 && fetchCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const links = await client.fetchSkuMarketplaces(s.id);
      if (Array.isArray(links)) {
        const mlLinks = links.filter((l: any) => l.marketPlace === 'MERCADO_LIVRE');
        
        const mlbs = mlLinks
          .filter((l: any) => !l.isCatalog)
          .map((l: any) => l.idInMarketplace)
          .filter(Boolean);
          
        const catalogos = mlLinks
          .filter((l: any) => l.isCatalog)
          .map((l: any) => l.idInMarketplace)
          .filter(Boolean);

        skuToMlb[partnerId] = {
          mlb: mlbs.join(", "),
          mlbCatalogo: catalogos.join(", ")
        };
        fetchCount++;
      }
    } catch (err: any) {
      console.warn(`[syncProducts] Failed to fetch links for SKU ${s.id}: ${err.message}`);
      // If we hit a serious error (not just 404), maybe we should stop?
      if (err.message.includes('429')) {
        console.error("[syncProducts] Rate limit hit even with delays. Stopping marketplace fetch for this run.");
        break;
      }
    }

    if (fetchCount % 100 === 0 && fetchCount > 0) {
      console.log(`[syncProducts] Progress: Fetched ${fetchCount} new SKU mappings...`);
    }
  }

  // --- Step 3: Save to Firestore preserving manual fields ---
  let batch = adminDb.batch();
  let count = 0;

  for (const p of products) {
    const skus = p.skus || [];
    for (const s of skus) {
      const sku = String(s.partnerId || s.id);
      if (!sku) continue;

      const docRef = prodCol.doc(sku);
      
      const updateData: any = {
        sku,
        descricao: p.title || "",
        updatedAt: new Date().toISOString()
      };

      // Update mapping if found
      if (skuToMlb[sku]) {
        updateData.mlb = skuToMlb[sku].mlb;
        updateData.mlbCatalogo = skuToMlb[sku].mlbCatalogo;
      }

      batch.set(docRef, updateData, { merge: true });
      count++;
      
      if (count >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }
  console.log(`[syncProducts] ${products.length} products synced for account ${accountId}`);
}
