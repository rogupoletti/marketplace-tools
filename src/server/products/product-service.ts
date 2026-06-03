import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type MarketplaceKey = "mercadolivre" | "shopee";

type MarketplaceConfig = {
  ativo: boolean;
  motivoInativo?: string;
  inativoDesde?: string;
  diasEstoqueDesejado?: number;
};

const MARKETPLACES = new Set<MarketplaceKey>(["mercadolivre", "shopee"]);

const STRING_FIELDS = [
  "ean",
  "descricao",
  "mlb",
  "mlbCatalogo",
  "marca",
  "fornecedor",
  "shopeeItemId",
  "shopeeModelId",
] as const;

const NUMBER_FIELDS = [
  "estoqueFull",
  "estoqueEmpresa",
  "precoAtual",
  "custoAtual",
  "tamanhoCaixa",
  "emTransf",
] as const;

async function getAccountIdFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Nao autorizado" }, { status: 401 }) };
  }

  const idToken = authHeader.split("Bearer ")[1];
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const uid = decodedToken.uid;

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return { error: NextResponse.json({ error: "Usuario nao encontrado" }, { status: 403 }) };
  }

  const accountId = userDoc.data()?.accountId;
  if (!accountId) {
    return { error: NextResponse.json({ error: "Acesso negado. Account ID nao encontrado." }, { status: 403 }) };
  }

  return { accountId };
}

function normalizeMarketplaceConfig(data: FirebaseFirestore.DocumentData, marketplace: MarketplaceKey): MarketplaceConfig {
  const dottedPrefix = `marketplaceConfig.${marketplace}.`;
  const dottedRaw = {
    ativo: data[`${dottedPrefix}ativo`],
    motivoInativo: data[`${dottedPrefix}motivoInativo`],
    inativoDesde: data[`${dottedPrefix}inativoDesde`],
    diasEstoqueDesejado: data[`${dottedPrefix}diasEstoqueDesejado`],
  };
  const raw = data.marketplaceConfig?.[marketplace] || dottedRaw;
  const legacyApplies = marketplace === "mercadolivre" && data.marketplaceConfig?.mercadolivre === undefined;
  const legacyInactive = legacyApplies && data.inativo === true;

  const ativo = raw.ativo !== undefined ? raw.ativo !== false : !legacyInactive;
  const config: MarketplaceConfig = { ativo };

  const motivoInativo = raw.motivoInativo ?? (legacyInactive ? data.motivoInativo : undefined);
  const inativoDesde = raw.inativoDesde ?? (legacyInactive ? data.inativoDesde : undefined);
  const diasEstoqueDesejado = Number(raw.diasEstoqueDesejado);

  if (!ativo && motivoInativo) config.motivoInativo = String(motivoInativo);
  if (!ativo && inativoDesde) config.inativoDesde = String(inativoDesde);
  if (Number.isFinite(diasEstoqueDesejado)) config.diasEstoqueDesejado = diasEstoqueDesejado;

  return config;
}

function normalizeProduct(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};

  return {
    sku: data.sku || doc.id,
    ean: data.ean || "",
    descricao: data.descricao || "",
    mlb: data.mlb || "",
    mlbCatalogo: data.mlbCatalogo || "",
    shopeeItemId: data.shopeeItemId || "",
    shopeeModelId: data.shopeeModelId || "",
    marca: data.marca || "",
    fornecedor: data.fornecedor || "",
    estoqueFull: Number(data.estoqueFull) || 0,
    estoqueEmpresa: Number(data.estoqueEmpresa) || 0,
    precoAtual: Number(data.precoAtual) || 0,
    custoAtual: Number(data.custoAtual) || 0,
    tamanhoCaixa: Number(data.tamanhoCaixa) || 1,
    emTransf: Number(data.emTransf) || 0,
    marketplaceConfig: {
      mercadolivre: normalizeMarketplaceConfig(data, "mercadolivre"),
      shopee: normalizeMarketplaceConfig(data, "shopee"),
    },
    inativo: data.inativo || false,
    motivoInativo: data.motivoInativo || "",
  };
}

function sanitizeProductPatch(product: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};

  for (const field of STRING_FIELDS) {
    if (product[field] !== undefined) updateData[field] = String(product[field] ?? "").trim();
  }

  for (const field of NUMBER_FIELDS) {
    if (product[field] !== undefined) {
      const value = Number(product[field]);
      if (!Number.isFinite(value)) throw new Error(`Campo numerico invalido: ${field}`);
      updateData[field] = field === "tamanhoCaixa" ? Math.max(1, value) : value;
    }
  }

  return updateData;
}

function sanitizeMarketplacePatch(marketplace: unknown, config: Record<string, unknown>) {
  const key = String(marketplace || "").toLowerCase() as MarketplaceKey;
  if (!MARKETPLACES.has(key)) throw new Error("Marketplace invalido.");

  const marketplaceData: Record<string, unknown> = {};

  if (config.ativo !== undefined) {
    const ativo = config.ativo !== false;
    marketplaceData.ativo = ativo;

    if (ativo) {
      marketplaceData.motivoInativo = admin.firestore.FieldValue.delete();
      marketplaceData.inativoDesde = admin.firestore.FieldValue.delete();
    } else {
      marketplaceData.inativoDesde = String(config.inativoDesde || new Date().toISOString());
      marketplaceData.motivoInativo = String(config.motivoInativo || "");
    }
  } else if (config.motivoInativo !== undefined) {
    marketplaceData.motivoInativo = String(config.motivoInativo || "");
  }

  if (config.diasEstoqueDesejado !== undefined) {
    if (config.diasEstoqueDesejado === null || config.diasEstoqueDesejado === "") {
      marketplaceData.diasEstoqueDesejado = admin.firestore.FieldValue.delete();
    } else {
      const dias = Number(config.diasEstoqueDesejado);
      if (!Number.isFinite(dias) || dias < 0) throw new Error("Dias de estoque desejado invalido.");
      marketplaceData.diasEstoqueDesejado = dias;
    }
  }

  return {
    marketplaceConfig: {
      [key]: marketplaceData,
    },
  };
}

function mergeUpdateData(target: Record<string, unknown>, patch: Record<string, unknown>) {
  const marketplaceConfig = patch.marketplaceConfig as Record<string, Record<string, unknown>> | undefined;
  if (marketplaceConfig) {
    const targetMarketplaceConfig = (target.marketplaceConfig || {}) as Record<string, Record<string, unknown>>;
    for (const [marketplace, config] of Object.entries(marketplaceConfig)) {
      targetMarketplaceConfig[marketplace] = {
        ...(targetMarketplaceConfig[marketplace] || {}),
        ...config,
      };
    }
    target.marketplaceConfig = targetMarketplaceConfig;
  }

  for (const [key, value] of Object.entries(patch)) {
    if (key !== "marketplaceConfig") target[key] = value;
  }
}

export async function getProducts(request: NextRequest) {
  try {
    const auth = await getAccountIdFromRequest(request);
    if (auth.error) return auth.error;

    const productsSnapshot = await adminDb
      .collection("accounts")
      .doc(auth.accountId)
      .collection("products")
      .get();

    const products = productsSnapshot.docs.map(normalizeProduct);
    console.log(`[API Products] Retornando ${products.length} registros para accountId ${auth.accountId}.`);

    return NextResponse.json({ products });
  } catch (error: unknown) {
    console.error("Erro ao buscar produtos:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro interno: " + message }, { status: 500 });
  }
}

export async function patchProducts(request: NextRequest) {
  try {
    const auth = await getAccountIdFromRequest(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : Array.isArray(body.updates) ? body.updates : body.sku ? [body] : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Nenhum produto informado." }, { status: 400 });
    }

    const prodCol = adminDb.collection("accounts").doc(auth.accountId).collection("products");
    let batch = adminDb.batch();
    let pendingWrites = 0;
    let totalUpdated = 0;
    const now = new Date().toISOString();

    for (const item of items) {
      if (!item || typeof item !== "object") continue;

      const sku = String(item.sku || "").trim();
      if (!sku) continue;

      const updateData = {
        ...sanitizeProductPatch(item),
        updatedAt: now,
      };

      if (item.marketplace) {
        mergeUpdateData(updateData, sanitizeMarketplacePatch(item.marketplace, item));
      }

      if (item.marketplaceConfig && typeof item.marketplaceConfig === "object") {
        for (const [marketplace, config] of Object.entries(item.marketplaceConfig as Record<string, Record<string, unknown>>)) {
          mergeUpdateData(updateData, sanitizeMarketplacePatch(marketplace, config));
        }
      }

      if (Object.keys(updateData).length <= 1) continue;

      batch.set(prodCol.doc(sku), updateData, { merge: true });
      pendingWrites++;
      totalUpdated++;

      if (pendingWrites >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        pendingWrites = 0;
      }
    }

    if (pendingWrites > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, totalUpdated });
  } catch (error: unknown) {
    console.error("Erro ao atualizar produtos:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
