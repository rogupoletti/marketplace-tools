import "server-only";

import { createHash, randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorageBucket } from "@/lib/firebase-admin";
import {
    MarketplaceReturn,
    MarketplaceReturnItem,
    MobileReturnScan,
    MobileScanType,
    ReturnAnalysisDisposition,
    ReturnAnalysisItem,
    ReturnAnalysisItemStatus,
    ReturnAnalysisSummaryData,
    ReturnChannel,
    ReturnIdentifierIndexMatch,
    ReturnMarketplace,
    ReturnPhoto,
    ReturnPhotoType,
    ReturnProblemType,
    ReturnStatus,
    ReturnType as MarketplaceReturnType,
    RETURN_ANALYSIS_DISPOSITIONS,
    RETURN_ANALYSIS_ITEM_STATUSES,
    RETURN_MARKETPLACES,
    RETURN_PHOTO_TYPES,
    RETURN_PROBLEM_TYPES,
    RETURN_STATUS_LABELS,
    isReturnType,
} from "@/lib/returns";

const IDENTIFIER_FIELDS: Array<{ field: string; type: ReturnIdentifierIndexMatch["type"] }> = [
    { field: "trackingCode", type: "tracking" },
    { field: "reverseTrackingCode", type: "tracking" },
    { field: "reverseTrackingNumber", type: "tracking" },
    { field: "reverseMarketplaceShippingId", type: "shipment_id" },
    { field: "reverseShippingId", type: "shipment_id" },
    { field: "shipmentId", type: "shipment_id" },
    { field: "packId", type: "pack_id" },
    { field: "marketplaceOrderId", type: "order_id" },
    { field: "externalOrderId", type: "order_id" },
    { field: "orderNumber", type: "order_id" },
    { field: "externalReturnId", type: "return_id" },
    { field: "marketplaceReturnId", type: "return_id" },
    { field: "labelBarcode", type: "barcode" },
    { field: "labelQrPayload", type: "qr_payload" },
];

const PROBLEM_STATUSES = new Set<ReturnAnalysisItemStatus>(["problem", "wrong_product", "partial"]);

function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    ) as T;
}

function cleanString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function cleanNumber(value: unknown, fallback: number) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace(",", "."));
        if (Number.isFinite(parsed)) return Math.max(0, parsed);
    }
    return fallback;
}

function isMobileScanType(value: unknown): value is MobileScanType {
    return value === "qr_code" || value === "barcode" || value === "manual";
}

function isReturnMarketplace(value: unknown): value is ReturnMarketplace {
    return typeof value === "string" && RETURN_MARKETPLACES.includes(value as ReturnMarketplace);
}

function isAnalysisStatus(value: unknown): value is ReturnAnalysisItemStatus {
    return typeof value === "string" && RETURN_ANALYSIS_ITEM_STATUSES.includes(value as ReturnAnalysisItemStatus);
}

function isProblemType(value: unknown): value is ReturnProblemType {
    return typeof value === "string" && RETURN_PROBLEM_TYPES.includes(value as ReturnProblemType);
}

function isPhotoType(value: unknown): value is ReturnPhotoType {
    return typeof value === "string" && RETURN_PHOTO_TYPES.includes(value as ReturnPhotoType);
}

function isDisposition(value: unknown): value is ReturnAnalysisDisposition {
    return typeof value === "string" && RETURN_ANALYSIS_DISPOSITIONS.includes(value as ReturnAnalysisDisposition);
}

export function normalizeReturnIdentifier(value: unknown) {
    const raw = typeof value === "string" || typeof value === "number" || typeof value === "bigint"
        ? String(value)
        : "";

    return raw
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
}

function identifierDocId(normalizedCode: string) {
    if (!normalizedCode.includes("/") && normalizedCode.length <= 900) return normalizedCode;
    return `sha256_${createHash("sha256").update(normalizedCode).digest("hex")}`;
}

export function createMobileScan(rawValue: string, scanType: MobileScanType): MobileReturnScan {
    return {
        rawValue,
        normalizedValue: normalizeReturnIdentifier(rawValue),
        scanType,
        scannedAt: new Date().toISOString(),
        source: "mobile_return_analysis",
    };
}

export function suggestMarketplaceFromText(value: unknown): ReturnMarketplace {
    const code = normalizeReturnIdentifier(value);
    if (code.startsWith("BR")) return "shopee";
    if (/^\d+$/.test(code)) return "mercado_livre";

    const normalized = String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    if (normalized.includes("shopee")) return "shopee";
    if (
        normalized.includes("mercado livre") ||
        normalized.includes("mercadolivre") ||
        normalized.includes("meli") ||
        normalized.includes("pack id") ||
        normalized.includes("packid")
    ) {
        return "mercado_livre";
    }
    if (normalized.includes("amazon")) return "amazon";
    if (normalized.includes("magalu") || normalized.includes("magazine luiza")) return "magalu";
    return "unknown";
}

function suggestReturnTypeFromTracking(value: unknown): MarketplaceReturnType {
    const code = normalizeReturnIdentifier(value);
    if (code.startsWith("BR")) return "full_shopee_cd";
    if (/^\d+$/.test(code)) return "full_meli_cd";
    return "other";
}

function marketplaceToChannel(marketplace: ReturnMarketplace): ReturnChannel {
    if (marketplace === "mercado_livre") return "meli";
    if (marketplace === "shopee") return "shopee";
    if (marketplace === "ecommerce") return "ecommerce";
    return "other";
}

function normalizeMarketplace(value: unknown): ReturnMarketplace {
    const text = String(value || "").toLowerCase();
    if (isReturnMarketplace(value)) return value;
    if (text.includes("shopee")) return "shopee";
    if (text.includes("meli") || text.includes("mercado")) return "mercado_livre";
    if (text.includes("amazon")) return "amazon";
    if (text.includes("magalu") || text.includes("magazine")) return "magalu";
    if (text.includes("ecommerce") || text.includes("e-commerce")) return "ecommerce";
    if (text.includes("other") || text.includes("outro")) return "other";
    return "unknown";
}

function marketplaceFromReturn(item: Partial<MarketplaceReturn>): ReturnMarketplace {
    return normalizeMarketplace(item.marketplace || item.channel);
}

function accountRef(accountId: string) {
    return adminDb.collection("accounts").doc(accountId);
}

function returnsRef(accountId: string) {
    return accountRef(accountId).collection("returns");
}

function serializeReturnDoc(doc: FirebaseFirestore.DocumentSnapshot): MarketplaceReturn {
    return { id: doc.id, ...doc.data() } as MarketplaceReturn;
}

function unique(values: Array<string | undefined>) {
    return Array.from(new Set(values.filter(Boolean) as string[]));
}

function uniqueReturnsById(items: MarketplaceReturn[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function scanTypeToIdentifierType(scanType: MobileScanType): ReturnIdentifierIndexMatch["type"] {
    if (scanType === "qr_code") return "qr_payload";
    if (scanType === "barcode") return "barcode";
    return "manual";
}

function getReturnIdentifierCandidates(data: Partial<MarketplaceReturn>) {
    const candidates: Array<{ code: string; type: ReturnIdentifierIndexMatch["type"] }> = [];

    for (const identifier of data.identifiers || []) {
        candidates.push({ code: identifier, type: "manual" });
    }

    for (const item of IDENTIFIER_FIELDS) {
        const value = (data as Record<string, unknown>)[item.field];
        const code = cleanString(value);
        if (code) candidates.push({ code, type: item.type });
    }

    if (data.labelInfo?.normalizedScanValue) {
        candidates.push({
            code: data.labelInfo.normalizedScanValue,
            type: data.labelInfo.scanType ? scanTypeToIdentifierType(data.labelInfo.scanType) : "manual",
        });
    }

    return candidates;
}

// Identifier resolution and index maintenance live here so the scanner and integrations share one lookup path.
export async function linkIdentifierToReturn(
    accountId: string,
    code: unknown,
    match: ReturnIdentifierIndexMatch,
    user?: { uid?: string; email?: string }
) {
    const normalizedCode = normalizeReturnIdentifier(code);
    if (!normalizedCode) return;

    const now = new Date().toISOString();
    const indexRef = accountRef(accountId)
        .collection("returnIdentifierIndex")
        .doc(identifierDocId(normalizedCode));
    const returnRef = returnsRef(accountId).doc(match.returnId);

    const indexMatch: ReturnIdentifierIndexMatch = {
        returnId: match.returnId,
        type: match.type,
        marketplace: match.marketplace,
        source: match.source,
    };

    const batch = adminDb.batch();
    batch.set(
        indexRef,
        withoutUndefined({
            code: normalizedCode,
            codeKey: identifierDocId(normalizedCode),
            type: match.type,
            marketplace: match.marketplace,
            updatedAt: now,
            createdAt: now,
            createdByUid: user?.uid,
            createdByEmail: user?.email,
            source: match.source,
            matches: FieldValue.arrayUnion(indexMatch),
        }),
        { merge: true }
    );
    batch.set(
        returnRef,
        withoutUndefined({
            identifiers: FieldValue.arrayUnion(normalizedCode),
            updatedAt: now,
            updatedByUid: user?.uid,
            updatedByEmail: user?.email,
        }),
        { merge: true }
    );
    await batch.commit();
}

export async function indexReturnIdentifiers(
    accountId: string,
    returnId: string,
    data: Partial<MarketplaceReturn>,
    source: ReturnIdentifierIndexMatch["source"] = "integration"
) {
    const marketplace = marketplaceFromReturn(data);
    const candidates = getReturnIdentifierCandidates(data);
    for (const candidate of candidates) {
        await linkIdentifierToReturn(accountId, candidate.code, {
            returnId,
            type: candidate.type,
            marketplace,
            source,
        });
    }
}

async function fetchMatchesFromIndex(accountId: string, matches: ReturnIdentifierIndexMatch[]) {
    const uniqueMatches = Array.from(
        new Map(matches.map((match) => [match.returnId, match])).values()
    );

    const docs = await Promise.all(
        uniqueMatches.map(async (match) => {
            const doc = await returnsRef(accountId).doc(match.returnId).get();
            return doc.exists ? serializeReturnDoc(doc) : null;
        })
    );
    return uniqueReturnsById(docs.filter(Boolean) as MarketplaceReturn[]);
}

async function fallbackReturnSearch(accountId: string, scan: MobileReturnScan) {
    const ref = returnsRef(accountId);
    const values = unique([
        scan.rawValue.trim(),
        scan.normalizedValue,
        normalizeReturnIdentifier(scan.rawValue),
    ]);
    const matches = new Map<string, MarketplaceReturn>();

    for (const value of values) {
        const identifiersSnapshot = await ref.where("identifiers", "array-contains", value).limit(10).get();
        identifiersSnapshot.docs.forEach((doc) => matches.set(doc.id, serializeReturnDoc(doc)));
    }

    for (const { field } of IDENTIFIER_FIELDS) {
        for (const value of values) {
            const snapshot = await ref.where(field, "==", value).limit(10).get();
            snapshot.docs.forEach((doc) => matches.set(doc.id, serializeReturnDoc(doc)));
        }
    }

    return uniqueReturnsById(Array.from(matches.values()));
}

export async function resolveReturnByIdentifier(accountId: string, scan: MobileReturnScan) {
    const normalizedCode = normalizeReturnIdentifier(scan.normalizedValue || scan.rawValue);
    const normalizedScan = { ...scan, normalizedValue: normalizedCode };
    if (!normalizedCode) throw new Error("Codigo de devolucao invalido");

    const indexDoc = await accountRef(accountId)
        .collection("returnIdentifierIndex")
        .doc(identifierDocId(normalizedCode))
        .get();

    let matches: MarketplaceReturn[] = [];
    if (indexDoc.exists) {
        const data = indexDoc.data() || {};
        const indexMatches = Array.isArray(data.matches) ? data.matches as ReturnIdentifierIndexMatch[] : [];
        matches = await fetchMatchesFromIndex(accountId, indexMatches);
    }

    if (matches.length === 0) {
        matches = await fallbackReturnSearch(accountId, normalizedScan);
        for (const item of matches) {
            await linkIdentifierToReturn(accountId, normalizedCode, {
                returnId: item.id,
                type: scanTypeToIdentifierType(scan.scanType),
                marketplace: marketplaceFromReturn(item),
                source: "operator_scan",
            });
        }
    }

    matches = uniqueReturnsById(matches);

    if (matches.length === 0) {
        return { status: "not_found" as const, scan: normalizedScan, matches: [] };
    }

    if (matches.length === 1) {
        return { status: "found" as const, scan: normalizedScan, return: matches[0], matches };
    }

    return { status: "multiple" as const, scan: normalizedScan, matches };
}

function parseScanPayload(value: unknown): MobileReturnScan {
    const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
    const rawValue = cleanString(data.rawValue);
    const scanType = isMobileScanType(data.scanType) ? data.scanType : "manual";
    if (!rawValue) throw new Error("Codigo lido e obrigatorio");

    return {
        rawValue,
        normalizedValue: normalizeReturnIdentifier(data.normalizedValue || rawValue),
        scanType,
        scannedAt: cleanString(data.scannedAt) || new Date().toISOString(),
        source: "mobile_return_analysis",
    };
}

function parseManualProducts(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item, index) => {
        const data = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
        return {
            id: `manual-${index + 1}`,
            sku: cleanString(data.sku) || "",
            title: cleanString(data.productName) || cleanString(data.title) || "",
            ean: cleanString(data.ean),
            quantity: 0,
            notes: cleanString(data.notes),
        };
    }).filter((item) => item.sku || item.title || item.ean || item.notes);
}

export interface ManualReturnCreatePayload {
    scan: MobileReturnScan;
    marketplace: ReturnMarketplace;
    returnType: MarketplaceReturnType;
    trackingCode?: string;
    packId?: string;
    marketplaceOrderId?: string;
    externalReturnId?: string;
    shipmentId?: string;
    labelBarcode?: string;
    labelQrPayload?: string;
    operatorNotes?: string;
    products: Array<MarketplaceReturnItem & { ean?: string; notes?: string }>;
}

export function parseManualReturnCreatePayload(payload: unknown): ManualReturnCreatePayload {
    const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    const scan = parseScanPayload(data.scan);
    const marketplace = isReturnMarketplace(data.marketplace)
        ? data.marketplace
        : suggestMarketplaceFromText(`${scan.rawValue} ${data.trackingCode || ""}`);
    const suggestedReturnType = suggestReturnTypeFromTracking(data.trackingCode || scan.normalizedValue || scan.rawValue);

    return {
        scan,
        marketplace,
        returnType: isReturnType(data.returnType) ? data.returnType : suggestedReturnType,
        trackingCode: cleanString(data.trackingCode),
        packId: cleanString(data.packId),
        marketplaceOrderId: cleanString(data.marketplaceOrderId),
        externalReturnId: cleanString(data.externalReturnId),
        shipmentId: cleanString(data.shipmentId),
        labelBarcode: cleanString(data.labelBarcode),
        labelQrPayload: cleanString(data.labelQrPayload),
        operatorNotes: cleanString(data.operatorNotes),
        products: parseManualProducts(data.products),
    };
}

function createAnalysisItemData(
    returnId: string,
    item: MarketplaceReturnItem & { ean?: string; notes?: string },
    now: string,
    addedManually: boolean
) {
    const expectedQty = addedManually ? 0 : Math.max(1, cleanNumber(item.quantity, 1));
    const receivedQty = addedManually ? 1 : expectedQty;
    return withoutUndefined({
        returnId,
        sku: item.sku || item.marketplaceSkuId || item.skuId || "",
        productName: item.title || "Produto sem descricao",
        ean: item.ean,
        expectedQty,
        receivedQty,
        status: "ok",
        problemTypes: [],
        notes: item.notes,
        addedManually,
        createdAt: now,
        updatedAt: now,
    });
}

function photoDownloadUrl(accountId: string, returnId: string, photoId: string, token: string) {
    const params = new URLSearchParams({
        accountId,
        returnId,
        token,
    });
    return `/api/returns/mobile/photos/${encodeURIComponent(photoId)}?${params.toString()}`;
}

// Upload of return photos is centralized here to validate files and write Firestore metadata consistently.
export async function uploadReturnPhotoBuffer(params: {
    accountId: string;
    returnId: string;
    itemId?: string;
    type: ReturnPhotoType;
    fileName: string;
    contentType: string;
    buffer: Buffer;
    createdBy?: string;
}) {
    if (!adminStorageBucket.name) {
        throw new Error("Firebase Storage bucket nao configurado");
    }

    if (!params.contentType.startsWith("image/")) {
        throw new Error("Arquivo de foto invalido");
    }

    const now = new Date().toISOString();
    const token = randomUUID();
    const extension = params.contentType.includes("png") ? "png" : params.contentType.includes("webp") ? "webp" : "jpg";
    const folder = params.type === "label"
        ? `accounts/${params.accountId}/returns/${params.returnId}/label`
        : `accounts/${params.accountId}/returns/${params.returnId}/items/${params.itemId}`;
    const storagePath = `${folder}/${Date.now()}-${randomUUID()}.${extension}`;
    const file = adminStorageBucket.file(storagePath);

    await file.save(params.buffer, {
        resumable: false,
        metadata: {
            contentType: params.contentType,
            metadata: {
                firebaseStorageDownloadTokens: token,
                originalName: params.fileName,
            },
        },
    });

    const photoRef = returnsRef(params.accountId).doc(params.returnId).collection("photos").doc();
    const photoData = withoutUndefined({
        returnId: params.returnId,
        itemId: params.itemId,
        type: params.type,
        storagePath,
        downloadUrl: photoDownloadUrl(params.accountId, params.returnId, photoRef.id, token),
        downloadToken: token,
        contentType: params.contentType,
        createdBy: params.createdBy,
        createdAt: now,
    });

    await photoRef.set(photoData);
    return { id: photoRef.id, ...photoData } as ReturnPhoto;
}

// Manual return creation persists the scan data and immediately prepares analysis items when products are informed.
export async function createManualReturnFromScan(params: {
    accountId: string;
    uid: string;
    email?: string;
    payload: ManualReturnCreatePayload;
    labelPhoto?: {
        fileName: string;
        contentType: string;
        buffer: Buffer;
    };
}) {
    const now = new Date().toISOString();
    const returnRef = returnsRef(params.accountId).doc();
    const payload = params.payload;
    const scan = payload.scan;
    const detectedMarketplace = suggestMarketplaceFromText(scan.rawValue);
    const marketplace = payload.marketplace || detectedMarketplace;
    const channel = marketplaceToChannel(marketplace);
    const trackingCode = payload.trackingCode || (scan.scanType !== "qr_code" ? scan.normalizedValue : undefined);
    const returnType = payload.returnType || suggestReturnTypeFromTracking(trackingCode || scan.normalizedValue || scan.rawValue);
    const labelBarcode = payload.labelBarcode || (scan.scanType === "barcode" ? scan.rawValue : undefined);
    const labelQrPayload = payload.labelQrPayload || (scan.scanType === "qr_code" ? scan.rawValue : undefined);
    const primaryIdentifier = scan.normalizedValue;
    const orderNumber =
        payload.marketplaceOrderId ||
        payload.packId ||
        trackingCode ||
        payload.externalReturnId ||
        primaryIdentifier;

    let labelPhoto: ReturnPhoto | undefined;
    if (params.labelPhoto) {
        labelPhoto = await uploadReturnPhotoBuffer({
            accountId: params.accountId,
            returnId: returnRef.id,
            type: "label",
            fileName: params.labelPhoto.fileName,
            contentType: params.labelPhoto.contentType,
            buffer: params.labelPhoto.buffer,
            createdBy: params.email || params.uid,
        });
    }

    const identifiers = unique([
        primaryIdentifier,
        trackingCode ? normalizeReturnIdentifier(trackingCode) : undefined,
        payload.packId ? normalizeReturnIdentifier(payload.packId) : undefined,
        payload.marketplaceOrderId ? normalizeReturnIdentifier(payload.marketplaceOrderId) : undefined,
        payload.externalReturnId ? normalizeReturnIdentifier(payload.externalReturnId) : undefined,
        payload.shipmentId ? normalizeReturnIdentifier(payload.shipmentId) : undefined,
        labelBarcode ? normalizeReturnIdentifier(labelBarcode) : undefined,
        labelQrPayload ? normalizeReturnIdentifier(labelQrPayload) : undefined,
    ]);

    const labelInfo = withoutUndefined({
        rawScanPayload: scan.rawValue,
        normalizedScanValue: scan.normalizedValue,
        scanType: scan.scanType,
        labelPhotoPath: labelPhoto?.storagePath,
        labelPhotoUrl: labelPhoto?.downloadUrl,
        detectedMarketplace,
    });

    const returnData = withoutUndefined({
        accountId: params.accountId,
        source: "manual_mobile_creation",
        orderNumber,
        customerName: "Cliente nao identificado",
        channel,
        returnType,
        status: "pending_analysis",
        marketplace,
        marketplaceOrderId: payload.marketplaceOrderId,
        externalReturnId: payload.externalReturnId,
        trackingCode,
        shipmentId: payload.shipmentId,
        packId: payload.packId,
        labelBarcode,
        labelQrPayload,
        identifiers,
        labelInfo,
        returnItems: payload.products.length > 0 ? payload.products : undefined,
        notes: payload.operatorNotes,
        pendingIssue: "",
        createdManually: true,
        createdFromMobile: true,
        returnDate: now.slice(0, 10),
        createdAt: now,
        updatedAt: now,
        createdByUid: params.uid,
        createdByEmail: params.email,
        updatedByUid: params.uid,
        updatedByEmail: params.email,
    });

    const historyRef = returnRef.collection("history").doc();
    const batch = adminDb.batch();
    batch.set(returnRef, returnData);
    batch.set(
        historyRef,
        withoutUndefined({
            returnId: returnRef.id,
            action: "created",
            newStatus: "pending_analysis",
            origin: "mobile_return_analysis",
            note: "Devolucao criada manualmente via mobile.",
            createdAt: now,
            createdByUid: params.uid,
            createdByEmail: params.email,
        })
    );

    payload.products.forEach((item) => {
        const itemRef = returnRef.collection("analysisItems").doc();
        batch.set(itemRef, createAnalysisItemData(returnRef.id, item, now, true));
    });

    await batch.commit();

    await indexReturnIdentifiers(params.accountId, returnRef.id, returnData as MarketplaceReturn, "manual_return_creation");

    return {
        return: { id: returnRef.id, ...returnData } as MarketplaceReturn,
        labelPhoto,
    };
}

export async function startReturnAnalysis(accountId: string, returnId: string) {
    const returnRef = returnsRef(accountId).doc(returnId);
    const returnDoc = await returnRef.get();
    if (!returnDoc.exists) throw new Error("Devolucao nao encontrada");

    const itemSnapshot = await returnRef.collection("analysisItems").orderBy("createdAt", "asc").get();
    const itemDocs = [...itemSnapshot.docs];
    const data = serializeReturnDoc(returnDoc);

    if (itemDocs.length === 0 && data.returnItems && data.returnItems.length > 0) {
        const now = new Date().toISOString();
        const batch = adminDb.batch();
        data.returnItems.forEach((item) => {
            const itemRef = returnRef.collection("analysisItems").doc();
            batch.set(itemRef, createAnalysisItemData(returnId, item, now, false));
        });
        await batch.commit();
    }

    const [items, photos] = await Promise.all([
        returnRef.collection("analysisItems").orderBy("createdAt", "asc").get(),
        returnRef.collection("photos").orderBy("createdAt", "asc").get(),
    ]);

    return {
        return: data,
        analysisItems: items.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReturnAnalysisItem[],
        photos: photos.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReturnPhoto[],
    };
}

export async function assertReturnCanBeEdited(accountId: string, returnId: string) {
    const returnDoc = await returnsRef(accountId).doc(returnId).get();
    if (!returnDoc.exists) throw new Error("Devolucao nao encontrada");
    const data = returnDoc.data() as MarketplaceReturn;
    if (data.analysisLocked) throw new Error("Analise ja concluida");
    return { ...data, id: returnDoc.id } as MarketplaceReturn;
}

export function parseAnalysisItemPayload(payload: unknown) {
    const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    const status = isAnalysisStatus(data.status) ? data.status : "ok";
    const rawProblemTypes = Array.isArray(data.problemTypes) ? data.problemTypes : [];

    const addedManually = data.addedManually === true;

    return {
        itemId: cleanString(data.itemId) || cleanString(data.id),
        sku: cleanString(data.sku) || "",
        productName: cleanString(data.productName) || "Produto sem descricao",
        ean: cleanString(data.ean),
        expectedQty: cleanNumber(data.expectedQty, addedManually ? 0 : 1),
        receivedQty: cleanNumber(data.receivedQty, status === "not_received" ? 0 : 1),
        status,
        problemTypes: rawProblemTypes.filter(isProblemType),
        notes: cleanString(data.notes) || "",
        addedManually,
    };
}

export async function upsertReturnAnalysisItem(params: {
    accountId: string;
    returnId: string;
    uid: string;
    email?: string;
    item: ReturnType<typeof parseAnalysisItemPayload>;
}) {
    const returnRef = returnsRef(params.accountId).doc(params.returnId);
    const returnDoc = await returnRef.get();
    if (!returnDoc.exists) throw new Error("Devolucao nao encontrada");
    const returnData = returnDoc.data() as MarketplaceReturn;
    if (returnData.analysisLocked) throw new Error("Analise ja concluida");

    const now = new Date().toISOString();
    const itemRef = params.item.itemId
        ? returnRef.collection("analysisItems").doc(params.item.itemId)
        : returnRef.collection("analysisItems").doc();

    const itemData = withoutUndefined({
        returnId: params.returnId,
        sku: params.item.sku,
        productName: params.item.productName,
        ean: params.item.ean,
        expectedQty: params.item.expectedQty,
        receivedQty: params.item.status === "not_received" ? 0 : params.item.receivedQty,
        status: params.item.status,
        problemTypes: params.item.problemTypes,
        notes: params.item.notes,
        addedManually: params.item.addedManually || !params.item.itemId,
        analyzedBy: params.email || params.uid,
        analyzedAt: now,
        updatedAt: now,
        createdAt: params.item.itemId ? undefined : now,
    });

    await itemRef.set(itemData, { merge: true });
    return { id: itemRef.id, ...itemData } as ReturnAnalysisItem;
}

export async function deleteReturnAnalysisItem(params: {
    accountId: string;
    returnId: string;
    itemId: string;
}) {
    const returnRef = returnsRef(params.accountId).doc(params.returnId);
    const itemRef = returnRef.collection("analysisItems").doc(params.itemId);
    const [returnDoc, itemDoc] = await Promise.all([
        returnRef.get(),
        itemRef.get(),
    ]);

    if (!returnDoc.exists) throw new Error("Devolucao nao encontrada");
    const returnData = returnDoc.data() as MarketplaceReturn;
    if (returnData.analysisLocked) throw new Error("Analise ja concluida");
    if (!itemDoc.exists) throw new Error("Item nao encontrado");

    const itemData = itemDoc.data() as ReturnAnalysisItem;
    if (itemData.addedManually !== true) {
        throw new Error("Apenas itens adicionados manualmente podem ser apagados");
    }

    const photosSnapshot = await returnRef.collection("photos").where("itemId", "==", params.itemId).get();
    await Promise.all(photosSnapshot.docs.map(async (photoDoc) => {
        const photoData = photoDoc.data() as ReturnPhoto;
        if (!photoData.storagePath) return;
        try {
            await adminStorageBucket.file(photoData.storagePath).delete();
        } catch (error) {
            console.warn("Nao foi possivel apagar arquivo de foto do item:", error);
        }
    }));

    const batch = adminDb.batch();
    photosSnapshot.docs.forEach((photoDoc) => batch.delete(photoDoc.ref));
    batch.delete(itemRef);
    await batch.commit();

    return {
        itemId: params.itemId,
        deletedPhotoIds: photosSnapshot.docs.map((photoDoc) => photoDoc.id),
    };
}

function summarizeAnalysis(items: ReturnAnalysisItem[], photos: ReturnPhoto[]): ReturnAnalysisSummaryData {
    return {
        expectedItems: items.filter((item) => !item.addedManually).length,
        okItems: items.filter((item) => item.status === "ok").length,
        problemItems: items.filter((item) => item.status === "problem" || item.status === "wrong_product" || item.status === "partial").length,
        notReceivedItems: items.filter((item) => item.status === "not_received").length,
        manuallyAddedItems: items.filter((item) => item.addedManually).length,
        photoCount: photos.length,
    };
}

function dispositionToStatus(disposition: ReturnAnalysisDisposition): ReturnStatus {
    if (disposition === "resolve") return "resolved";
    if (disposition === "pending_return_invoice") return "pending_return_invoice";
    return "pending_dispute_or_refund";
}

// Analysis finalization enforces required problem photos and locks simple edits after completion.
export async function finalizeReturnAnalysis(params: {
    accountId: string;
    returnId: string;
    uid: string;
    email?: string;
    disposition: unknown;
    generalNotes?: unknown;
}) {
    if (!isDisposition(params.disposition)) throw new Error("Destino da devolucao invalido");

    const returnRef = returnsRef(params.accountId).doc(params.returnId);
    const returnDoc = await returnRef.get();
    if (!returnDoc.exists) throw new Error("Devolucao nao encontrada");

    const [itemsSnapshot, photosSnapshot] = await Promise.all([
        returnRef.collection("analysisItems").orderBy("createdAt", "asc").get(),
        returnRef.collection("photos").orderBy("createdAt", "asc").get(),
    ]);
    const items = itemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReturnAnalysisItem[];
    const photos = photosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReturnPhoto[];
    const photoItemIds = new Set(photos.filter((photo) => photo.itemId).map((photo) => photo.itemId));

    const missingPhotoItem = items.find((item) => PROBLEM_STATUSES.has(item.status) && !photoItemIds.has(item.id));
    if (missingPhotoItem) {
        throw new Error(`Anexe ao menos 1 foto para o item "${missingPhotoItem.productName || missingPhotoItem.sku}".`);
    }

    const current = returnDoc.data() as MarketplaceReturn;
    const now = new Date().toISOString();
    const nextStatus = dispositionToStatus(params.disposition);
    const summary = summarizeAnalysis(items, photos);
    const historyRef = returnRef.collection("history").doc();
    const statusChanged = current.status !== nextStatus;
    const note = `Analise mobile concluida. Destino: ${RETURN_STATUS_LABELS[nextStatus]}.`;

    const batch = adminDb.batch();
    batch.update(
        returnRef,
        withoutUndefined({
            status: nextStatus,
            analysisSummary: summary,
            analysisDisposition: params.disposition,
            analysisGeneralNotes: cleanString(params.generalNotes) || "",
            analysisLocked: true,
            analysisCompletedAt: now,
            analysisCompletedByUid: params.uid,
            analysisCompletedByEmail: params.email,
            updatedAt: now,
            updatedByUid: params.uid,
            updatedByEmail: params.email,
        })
    );
    batch.set(
        historyRef,
        withoutUndefined({
            returnId: params.returnId,
            action: nextStatus === "resolved" ? "resolved" : statusChanged ? "status_changed" : "updated",
            previousStatus: statusChanged ? current.status : undefined,
            newStatus: statusChanged ? nextStatus : undefined,
            origin: "mobile_return_analysis",
            note,
            createdAt: now,
            createdByUid: params.uid,
            createdByEmail: params.email,
        })
    );
    await batch.commit();

    return {
        return: {
            ...current,
            id: returnDoc.id,
            status: nextStatus,
            analysisSummary: summary,
            analysisDisposition: params.disposition,
            analysisGeneralNotes: cleanString(params.generalNotes) || "",
            analysisLocked: true,
            analysisCompletedAt: now,
            updatedAt: now,
        } as MarketplaceReturn,
        summary,
    };
}

export function parsePhotoUploadPayload(value: FormData) {
    const returnId = cleanString(value.get("returnId"));
    const itemId = cleanString(value.get("itemId"));
    const type = value.get("type");
    const file = value.get("file");

    if (!returnId) throw new Error("Devolucao obrigatoria");
    if (!isPhotoType(type)) throw new Error("Tipo de foto invalido");
    if (type !== "label" && !itemId) throw new Error("Item da foto obrigatorio");
    if (!(file instanceof File)) throw new Error("Foto obrigatoria");
    if (!file.type.startsWith("image/")) throw new Error("Arquivo de foto invalido");

    return { returnId, itemId, type, file };
}
