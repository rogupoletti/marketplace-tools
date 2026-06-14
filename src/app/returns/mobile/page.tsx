"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { ArrowRight, Building2, Loader2, PackagePlus, RotateCcw, Save, Search, Send, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import {
    MarketplaceReturn,
    MobileReturnScan,
    ReturnAnalysisDisposition,
    ReturnAnalysisItem,
    ReturnPhoto,
    ReturnPhotoType,
} from "@/lib/returns";
import { ManualReturnCreateForm, ManualReturnFormPayload } from "./components/ManualReturnCreateForm";
import { MobileReturnScanner } from "./components/MobileReturnScanner";
import { MobileStepLayout } from "./components/MobileStepLayout";
import { ReturnAnalysisSummary } from "./components/ReturnAnalysisSummary";
import { ReturnIdentificationResult } from "./components/ReturnIdentificationResult";
import { ReturnItemAnalysisCard } from "./components/ReturnItemAnalysisCard";

type Step = "scan" | "not_found" | "multiple" | "manual_create" | "analysis" | "summary" | "done";
type ToastState = { type: "success" | "error" | "info"; message: string } | null;
type ToastType = NonNullable<ToastState>["type"];

interface PersistedMobileSession {
    step: Step;
    selectedAccountId?: string;
    scan?: MobileReturnScan | null;
    matches?: MarketplaceReturn[];
    currentReturn?: MarketplaceReturn | null;
    analysisItems?: ReturnAnalysisItem[];
    photos?: ReturnPhoto[];
    isAddProductOpen?: boolean;
    productSearch?: string;
}

interface ResolveResponse {
    status: "found" | "multiple" | "not_found";
    scan: MobileReturnScan;
    return?: MarketplaceReturn;
    matches: MarketplaceReturn[];
}

interface AnalysisResponse {
    return: MarketplaceReturn;
    analysisItems: ReturnAnalysisItem[];
    photos: ReturnPhoto[];
}

interface AccountOption {
    id: string;
    name: string;
}

interface CatalogProduct {
    sku: string;
    ean: string;
    descricao: string;
}

const PROBLEM_STATUSES = new Set(["problem", "wrong_product", "partial"]);
const MANUAL_RETURN_FORM_ID = "mobile-manual-return-form";
const RETURN_SUMMARY_FORM_ID = "mobile-return-summary-form";
const MOBILE_SESSION_STORAGE_KEY = "sellerDock.mobileReturns.session";

function isStep(value: unknown): value is Step {
    return (
        value === "scan" ||
        value === "not_found" ||
        value === "multiple" ||
        value === "manual_create" ||
        value === "analysis" ||
        value === "summary" ||
        value === "done"
    );
}

function readPersistedMobileSession(): PersistedMobileSession | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.sessionStorage.getItem(MOBILE_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw) as Partial<PersistedMobileSession>;
        if (!isStep(data.step)) return null;
        return {
            step: data.step,
            selectedAccountId: typeof data.selectedAccountId === "string" ? data.selectedAccountId : "",
            scan: data.scan || null,
            matches: Array.isArray(data.matches) ? data.matches : [],
            currentReturn: data.currentReturn || null,
            analysisItems: Array.isArray(data.analysisItems) ? data.analysisItems : [],
            photos: Array.isArray(data.photos) ? data.photos : [],
            isAddProductOpen: data.isAddProductOpen === true,
            productSearch: typeof data.productSearch === "string" ? data.productSearch : "",
        };
    } catch (error) {
        console.warn("Nao foi possivel restaurar a sessao mobile de devolucoes:", error);
        return null;
    }
}

function clearPersistedMobileSession() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(MOBILE_SESSION_STORAGE_KEY);
}

async function compressImageFile(file: File, options: { maxSide?: number; quality?: number } = {}) {
    if (!file.type.startsWith("image/")) return file;

    try {
        const maxSide = options.maxSide ?? 1200;
        const quality = options.quality ?? 0.68;
        const imageUrl = URL.createObjectURL(file);
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageUrl;
        });

        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext("2d");
        if (!context) return file;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        URL.revokeObjectURL(imageUrl);
        if (!blob) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    } catch (error) {
        console.warn("Falha ao comprimir imagem:", error);
        return file;
    }
}

function itemNeedsPhoto(item: ReturnAnalysisItem) {
    return PROBLEM_STATUSES.has(item.status);
}

function uniqueReturnsById(items: MarketplaceReturn[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function createManualAnalysisDraft(returnId: string, product?: CatalogProduct): ReturnAnalysisItem {
    const now = new Date().toISOString();
    return {
        id: "",
        returnId,
        sku: product?.sku || "",
        productName: product?.descricao || product?.sku || "Produto recebido manualmente",
        ean: product?.ean || "",
        expectedQty: 0,
        receivedQty: 1,
        status: "ok",
        problemTypes: [],
        notes: "",
        addedManually: true,
        createdAt: now,
        updatedAt: now,
    };
}

export default function MobileReturnsPage() {
    const router = useRouter();
    const { user, userData, loading } = useAuth();
    const [initialSession] = useState<PersistedMobileSession | null>(() => readPersistedMobileSession());
    const toastTimerRef = useRef<number | null>(null);
    const addProductSectionRef = useRef<HTMLElement | null>(null);
    const analysisItemsRef = useRef<ReturnAnalysisItem[]>([]);
    const pendingItemSaveTimersRef = useRef<Map<string, number>>(new Map());
    const pendingItemDraftsRef = useRef<Map<string, ReturnAnalysisItem>>(new Map());
    const restoredReturnIdRef = useRef<string | null>(null);
    const [step, setStep] = useState<Step>(initialSession?.step || "scan");
    const [toast, setToast] = useState<ToastState>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [isAccountsLoading, setIsAccountsLoading] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState(initialSession?.selectedAccountId || "");
    const [scan, setScan] = useState<MobileReturnScan | null>(initialSession?.scan || null);
    const [labelPhoto, setLabelPhoto] = useState<File | null>(null);
    const [matches, setMatches] = useState<MarketplaceReturn[]>(initialSession?.matches || []);
    const [currentReturn, setCurrentReturn] = useState<MarketplaceReturn | null>(initialSession?.currentReturn || null);
    const [analysisItems, setAnalysisItems] = useState<ReturnAnalysisItem[]>(initialSession?.analysisItems || []);
    const [photos, setPhotos] = useState<ReturnPhoto[]>(initialSession?.photos || []);
    const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
    const [isCatalogLoading, setIsCatalogLoading] = useState(false);
    const [isAddProductOpen, setIsAddProductOpen] = useState(initialSession?.isAddProductOpen || false);
    const [productSearch, setProductSearch] = useState(initialSession?.productSearch || "");
    const [uploadingPhotoItemId, setUploadingPhotoItemId] = useState<string | null>(null);

    const role = userData?.role;
    const isSuper = role === "superadmin" || userData?.isAdmin === true;
    const canAccess = Boolean(
        role === "superadmin" ||
        role === "account_admin" ||
        role === "account_user" ||
        userData?.isAdmin === true
    );
    const accountReady = !isSuper || Boolean(selectedAccountId);

    const accountQuery = useMemo(() => {
        if (!isSuper || !selectedAccountId) return "";
        return `?accountId=${encodeURIComponent(selectedAccountId)}`;
    }, [isSuper, selectedAccountId]);

    const filteredCatalogProducts = useMemo(() => {
        const term = productSearch.trim().toLowerCase();
        if (!term) return catalogProducts.slice(0, 12);
        return catalogProducts
            .filter((product) => {
                const sku = product.sku.toLowerCase();
                const name = product.descricao.toLowerCase();
                const ean = product.ean.toLowerCase();
                return sku.includes(term) || name.includes(term) || ean.includes(term);
            })
            .slice(0, 20);
    }, [catalogProducts, productSearch]);

    const showToast = useCallback((message: string, type: ToastType = "success") => {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        if (type === "error") {
            window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
        }
        toastTimerRef.current = window.setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
        }, type === "error" ? 8000 : 3200);
    }, []);

    useEffect(() => () => {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        pendingItemSaveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        pendingItemSaveTimersRef.current.clear();
    }, []);

    useEffect(() => {
        analysisItemsRef.current = analysisItems;
    }, [analysisItems]);

    useEffect(() => {
        if (step === "scan" && !scan && !currentReturn) {
            clearPersistedMobileSession();
            return;
        }

        window.sessionStorage.setItem(MOBILE_SESSION_STORAGE_KEY, JSON.stringify({
            step,
            selectedAccountId,
            scan,
            matches,
            currentReturn,
            analysisItems,
            photos,
            isAddProductOpen,
            productSearch,
        } satisfies PersistedMobileSession));
    }, [
        analysisItems,
        currentReturn,
        isAddProductOpen,
        matches,
        photos,
        productSearch,
        scan,
        selectedAccountId,
        step,
    ]);

    useEffect(() => {
        if (!loading && !user) router.replace("/login");
    }, [loading, router, user]);

    useEffect(() => {
        if (!loading && user && userData && !canAccess) router.replace("/dashboard");
    }, [canAccess, loading, router, user, userData]);

    useEffect(() => {
        if (!isSuper || !user) return;

        const loadAccounts = async () => {
            setIsAccountsLoading(true);
            try {
                const snapshot = await getDocs(query(collection(db, "accounts"), orderBy("name")));
                const list = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    name: String(doc.data().name || "Conta sem nome"),
                }));
                setAccounts(list);
            } catch (error) {
                console.error("Erro ao carregar contas:", error);
                showToast("Erro ao carregar contas.", "error");
            } finally {
                setIsAccountsLoading(false);
            }
        };

        loadAccounts();
    }, [isSuper, showToast, user]);

    const authedJson = useCallback(async <T,>(path: string, body: unknown): Promise<T> => {
        if (!user) throw new Error("Usuário não autenticado");
        const token = await user.getIdToken();
        const response = await fetch(`/api/returns/mobile/${path}${accountQuery}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro na operação");
        return data as T;
    }, [accountQuery, user]);

    const authedForm = useCallback(async <T,>(path: string, formData: FormData): Promise<T> => {
        if (!user) throw new Error("Usuário não autenticado");
        const token = await user.getIdToken();
        const response = await fetch(`/api/returns/mobile/${path}${accountQuery}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro na operação");
        return data as T;
    }, [accountQuery, user]);

    const authedGet = useCallback(async <T,>(path: string): Promise<T> => {
        if (!user) throw new Error("Usuário não autenticado");
        const token = await user.getIdToken();
        const response = await fetch(`/api/returns/mobile/${path}${accountQuery}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro na operação");
        return data as T;
    }, [accountQuery, user]);

    const authedDelete = useCallback(async <T,>(path: string, body: unknown): Promise<T> => {
        if (!user) throw new Error("Usuário não autenticado");
        const token = await user.getIdToken();
        const response = await fetch(`/api/returns/mobile/${path}${accountQuery}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro na operação");
        return data as T;
    }, [accountQuery, user]);

    useEffect(() => {
        if (!user || !accountReady) return;

        let active = true;
        const loadProducts = async () => {
            setIsCatalogLoading(true);
            try {
                const data = await authedGet<{ products: CatalogProduct[] }>("catalog/products");
                if (active) setCatalogProducts(data.products || []);
            } catch (error) {
                console.error("Erro ao carregar catalogo para devolucao mobile:", error);
            } finally {
                if (active) setIsCatalogLoading(false);
            }
        };

        loadProducts();
        return () => {
            active = false;
        };
    }, [accountReady, authedGet, user]);

    useEffect(() => {
        if (step === "analysis" && currentReturn && analysisItems.length === 0 && currentReturn.analysisLocked !== true) {
            setIsAddProductOpen(true);
        }
    }, [analysisItems.length, currentReturn, step]);

    const loadAnalysis = useCallback(async (returnId: string, nextStep: Extract<Step, "analysis" | "summary" | "done"> = "analysis") => {
        const data = await authedJson<AnalysisResponse>("analysis/start", { returnId });
        setCurrentReturn(data.return);
        setAnalysisItems(data.analysisItems);
        analysisItemsRef.current = data.analysisItems;
        setPhotos(data.photos);
        setStep(nextStep);
    }, [authedJson]);

    useEffect(() => {
        if (!user || !accountReady) return;
        if (!initialSession?.currentReturn?.id) return;
        if (initialSession.step !== "analysis" && initialSession.step !== "summary" && initialSession.step !== "done") return;

        const restoreKey = `${selectedAccountId || "default"}:${initialSession.currentReturn.id}:${initialSession.step}`;
        if (restoredReturnIdRef.current === restoreKey) return;
        restoredReturnIdRef.current = restoreKey;

        loadAnalysis(initialSession.currentReturn.id, initialSession.step).catch((error) => {
            console.error("Erro ao restaurar devolucao mobile:", error);
            showToast("Não foi possível restaurar a devolução em andamento.", "error");
            clearPersistedMobileSession();
            setStep("scan");
            setScan(null);
            setMatches([]);
            setCurrentReturn(null);
            setAnalysisItems([]);
            analysisItemsRef.current = [];
            setPhotos([]);
            setIsAddProductOpen(false);
            setProductSearch("");
        });
    }, [accountReady, initialSession, loadAnalysis, selectedAccountId, showToast, user]);

    const resolveScan = useCallback(async (nextScan: MobileReturnScan) => {
        if (!accountReady) {
            showToast("Selecione uma conta antes de escanear.", "error");
            return;
        }

        setIsBusy(true);
        setScan(nextScan);
        try {
            const result = await authedJson<ResolveResponse>("resolve", {
                rawValue: nextScan.rawValue,
                scanType: nextScan.scanType,
            });
            setScan(result.scan);
            const uniqueMatches = uniqueReturnsById(result.matches || []);

            if (result.status === "found" && result.return) {
                showToast("Devolução identificada.", "success");
                await loadAnalysis(result.return.id);
                return;
            }

            if (uniqueMatches.length === 1) {
                showToast("Devolução identificada.", "success");
                await loadAnalysis(uniqueMatches[0].id);
                return;
            }

            if (uniqueMatches.length > 1) {
                setMatches(uniqueMatches);
                setStep("multiple");
                return;
            }

            setMatches([]);
            setStep("not_found");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao buscar devolução";
            showToast(message, "error");
        } finally {
            setIsBusy(false);
        }
    }, [accountReady, authedJson, loadAnalysis, showToast]);

    const createManualReturn = async (payload: ManualReturnFormPayload) => {
        setIsBusy(true);
        try {
            const formData = new FormData();
            formData.append("payload", JSON.stringify(payload));
            if (labelPhoto) formData.append("labelPhoto", await compressImageFile(labelPhoto, { maxSide: 1200, quality: 0.68 }));

            const data = await authedForm<AnalysisResponse>("manual", formData);
            setCurrentReturn(data.return);
            setAnalysisItems(data.analysisItems);
            analysisItemsRef.current = data.analysisItems;
            setPhotos(data.photos);
            showToast("Devolução criada. Analise os itens.", "success");
            setStep("analysis");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao criar devolução";
            showToast(message, "error");
        } finally {
            setIsBusy(false);
        }
    };

    const replaceAnalysisItem = useCallback((item: ReturnAnalysisItem) => {
        setAnalysisItems((current) => {
            const exists = current.some((currentItem) => currentItem.id === item.id);
            const next = exists
                ? current.map((currentItem) => currentItem.id === item.id ? item : currentItem)
                : [...current, item];
            analysisItemsRef.current = next;
            return next;
        });
    }, []);

    const saveAnalysisItem = useCallback(async (
        item: ReturnAnalysisItem,
        options: { silent?: boolean; background?: boolean } = {}
    ) => {
        if (!currentReturn) return null;
        if (!options.background && item.id) {
            const existingTimer = pendingItemSaveTimersRef.current.get(item.id);
            if (existingTimer) window.clearTimeout(existingTimer);
            pendingItemSaveTimersRef.current.delete(item.id);
            pendingItemDraftsRef.current.delete(item.id);
        }
        if (!options.background) setIsBusy(true);
        try {
            const data = await authedJson<{ item: ReturnAnalysisItem }>("analysis/items", {
                returnId: currentReturn.id,
                item: { ...item, itemId: item.id },
            });
            if (!options.background || !pendingItemDraftsRef.current.has(data.item.id)) {
                replaceAnalysisItem(data.item);
            }
            if (!options.silent) showToast("Produto analisado.", "success");
            return data.item;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao salvar item";
            showToast(message, "error");
            return null;
        } finally {
            if (!options.background) setIsBusy(false);
        }
    }, [authedJson, currentReturn, replaceAnalysisItem, showToast]);

    const queueAnalysisItemSave = useCallback((item: ReturnAnalysisItem) => {
        if (!item.id) return;
        replaceAnalysisItem(item);
        pendingItemDraftsRef.current.set(item.id, item);

        const existingTimer = pendingItemSaveTimersRef.current.get(item.id);
        if (existingTimer) window.clearTimeout(existingTimer);

        const timer = window.setTimeout(async () => {
            pendingItemSaveTimersRef.current.delete(item.id);
            const draft = pendingItemDraftsRef.current.get(item.id);
            if (!draft) return;
            pendingItemDraftsRef.current.delete(item.id);
            await saveAnalysisItem(draft, { silent: true, background: true });
        }, 700);

        pendingItemSaveTimersRef.current.set(item.id, timer);
    }, [replaceAnalysisItem, saveAnalysisItem]);

    const flushPendingItemSaves = useCallback(async () => {
        const drafts = Array.from(pendingItemDraftsRef.current.values());
        pendingItemSaveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        pendingItemSaveTimersRef.current.clear();
        pendingItemDraftsRef.current.clear();
        await Promise.all(drafts.map((item) => saveAnalysisItem(item, { silent: true, background: true })));
    }, [saveAnalysisItem]);

    const scrollToAddProductSearch = useCallback(() => {
        window.setTimeout(() => {
            const element = addProductSectionRef.current;
            if (!element) {
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
            }

            const top = element.getBoundingClientRect().top + window.scrollY - 92;
            window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            const input = element.querySelector<HTMLInputElement>("input[data-product-search='true']");
            input?.focus({ preventScroll: true });
        }, 50);
    }, []);

    const openAddProductSearch = useCallback(() => {
        setIsAddProductOpen(true);
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(scrollToAddProductSearch);
        });
    }, [scrollToAddProductSearch]);

    const deleteAnalysisItem = async (item: ReturnAnalysisItem) => {
        if (!currentReturn || !item.addedManually || !item.id) return;
        const confirmed = window.confirm("Apagar este item adicionado manualmente?");
        if (!confirmed) return;

        setIsBusy(true);
        try {
            const data = await authedDelete<{ itemId: string; deletedPhotoIds: string[] }>("analysis/items", {
                returnId: currentReturn.id,
                itemId: item.id,
            });
            setAnalysisItems((current) => {
                const next = current.filter((currentItem) => currentItem.id !== data.itemId);
                analysisItemsRef.current = next;
                return next;
            });
            setPhotos((current) => current.filter((photo) => photo.itemId !== data.itemId && !data.deletedPhotoIds.includes(photo.id)));
            showToast("Item apagado.", "success");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao apagar item";
            showToast(message, "error");
        } finally {
            setIsBusy(false);
        }
    };

    const uploadPhoto = async (item: ReturnAnalysisItem, file: File, type: ReturnPhotoType) => {
        if (!currentReturn) return;
        setUploadingPhotoItemId(item.id || "new");
        const savedItem = await saveAnalysisItem(item, { silent: true });
        if (!savedItem) {
            setUploadingPhotoItemId(null);
            return;
        }

        setIsBusy(true);
        try {
            const compressedFile = await compressImageFile(file, { maxSide: 1100, quality: 0.62 });
            const formData = new FormData();
            formData.append("returnId", currentReturn.id);
            formData.append("itemId", savedItem.id);
            formData.append("type", type);
            formData.append("file", compressedFile);

            const data = await authedForm<{ photo: ReturnPhoto }>("photos", formData);
            setPhotos((current) => [...current, data.photo]);
            showToast("Foto salva.", "success");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao salvar foto";
            showToast(message, "error");
        } finally {
            setIsBusy(false);
            setUploadingPhotoItemId(null);
        }
    };

    const openSummary = async () => {
        await flushPendingItemSaves();
        const latestItems = analysisItemsRef.current;
        const missingPhotoItem = latestItems.find((item) => itemNeedsPhoto(item) && !photos.some((photo) => photo.itemId === item.id));
        if (missingPhotoItem) {
            showToast("Anexe ao menos 1 foto para o item com problema.", "error");
            return;
        }
        setStep("summary");
    };

    const finalizeAnalysis = async (disposition: ReturnAnalysisDisposition, generalNotes: string) => {
        if (!currentReturn) return;
        setIsBusy(true);
        try {
            const data = await authedJson<{ return: MarketplaceReturn }>("finalize", {
                returnId: currentReturn.id,
                disposition,
                generalNotes,
            });
            setCurrentReturn(data.return);
            showToast("Análise concluída.", "success");
            setStep("done");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao concluir análise";
            showToast(message, "error");
        } finally {
            setIsBusy(false);
        }
    };

    const resetFlow = () => {
        clearPersistedMobileSession();
        setStep("scan");
        setScan(null);
        setLabelPhoto(null);
        setMatches([]);
        setCurrentReturn(null);
        setAnalysisItems([]);
        analysisItemsRef.current = [];
        setPhotos([]);
        setIsAddProductOpen(false);
        setProductSearch("");
        setUploadingPhotoItemId(null);
        setToast(null);
    };

    if (loading) {
        return (
            <MobileStepLayout title="Carregando" subtitle="Preparando o módulo mobile de devoluções.">
                <div className="grid min-h-[60dvh] place-items-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            </MobileStepLayout>
        );
    }

    if (!user) {
        return (
            <MobileStepLayout title="Entrando" subtitle="Redirecionando para o login.">
                <div className="grid min-h-[60dvh] place-items-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            </MobileStepLayout>
        );
    }

    if (!canAccess) {
        return (
            <MobileStepLayout title="Acesso negado" subtitle="Seu usuário não tem permissão para operar devoluções mobile.">
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
                    <ShieldAlert className="h-8 w-8" />
                    <p className="mt-3 text-sm font-semibold">Procure um administrador da conta para ajustar seu acesso.</p>
                </div>
            </MobileStepLayout>
        );
    }

    if (isSuper && !accountReady) {
        return (
            <MobileStepLayout
                title="Selecionar conta"
                subtitle="Escolha a conta que receberá a devolução."
                toast={toast}
                isBusy={isAccountsLoading}
            >
                {isAccountsLoading ? (
                    <div className="grid min-h-[50dvh] place-items-center">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((account) => (
                            <button
                                key={account.id}
                                type="button"
                                onClick={() => setSelectedAccountId(account.id)}
                                className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 text-left font-extrabold text-gray-900"
                            >
                                <Building2 className="h-5 w-5 text-blue-600" />
                                {account.name}
                            </button>
                        ))}
                    </div>
                )}
            </MobileStepLayout>
        );
    }

    if (step === "not_found" && scan) {
        return (
            <MobileStepLayout
                title="Identificar devolução"
                stepLabel="Resultado"
                onBack={() => setStep("scan")}
                toast={toast}
                isBusy={isBusy}
            >
                <ReturnIdentificationResult
                    mode="not_found"
                    scan={scan}
                    onManualSearch={() => setStep("scan")}
                    onCreateManual={() => setStep("manual_create")}
                    onRescan={resetFlow}
                />
            </MobileStepLayout>
        );
    }

    if (step === "multiple" && scan) {
        return (
            <MobileStepLayout
                title="Escolher devolução"
                stepLabel="Resultado"
                onBack={() => setStep("scan")}
                toast={toast}
                isBusy={isBusy}
            >
                <ReturnIdentificationResult
                    mode="multiple"
                    scan={scan}
                    matches={matches}
                    onSelectReturn={(item) => loadAnalysis(item.id)}
                    onManualSearch={() => setStep("scan")}
                    onCreateManual={() => setStep("manual_create")}
                    onRescan={resetFlow}
                />
            </MobileStepLayout>
        );
    }

    if (step === "manual_create" && scan) {
        return (
            <MobileStepLayout
                title="Criar devolução manual"
                subtitle="Preencha apenas o que estiver disponível na etiqueta."
                stepLabel="Manual"
                onBack={() => setStep("not_found")}
                toast={toast}
                isBusy={isBusy}
                footer={
                    <button
                        type="submit"
                        form={MANUAL_RETURN_FORM_ID}
                        disabled={isBusy}
                        className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                    >
                        <Save className="h-5 w-5" />
                        {isBusy ? "Salvando..." : "Salvar e analisar itens"}
                    </button>
                }
            >
                <ManualReturnCreateForm
                    formId={MANUAL_RETURN_FORM_ID}
                    showSubmitButton={false}
                    scan={scan}
                    labelPhoto={labelPhoto}
                    isSaving={isBusy}
                    onSubmit={createManualReturn}
                />
            </MobileStepLayout>
        );
    }

    if (step === "summary") {
        return (
            <MobileStepLayout
                title="Concluir análise"
                subtitle="Revise os dados antes de finalizar."
                stepLabel="Resumo"
                onBack={() => setStep("analysis")}
                toast={toast}
                isBusy={isBusy}
                footer={
                    <button
                        type="submit"
                        form={RETURN_SUMMARY_FORM_ID}
                        disabled={isBusy}
                        className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                    >
                        <Send className="h-5 w-5" />
                        {isBusy ? "Finalizando..." : "Concluir análise"}
                    </button>
                }
            >
                <ReturnAnalysisSummary
                    formId={RETURN_SUMMARY_FORM_ID}
                    showSubmitButton={false}
                    items={analysisItems}
                    photos={photos}
                    returnType={currentReturn?.returnType || "other"}
                    isSaving={isBusy}
                    onFinalize={finalizeAnalysis}
                />
            </MobileStepLayout>
        );
    }

    if (step === "done") {
        return (
            <MobileStepLayout title="Análise concluída" subtitle="A devolução foi atualizada com o destino escolhido." toast={toast}>
                <div className="space-y-4">
                    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <h2 className="text-xl font-extrabold text-emerald-950">Tudo certo</h2>
                        <p className="mt-2 text-sm font-semibold text-emerald-800">
                            A análise foi bloqueada para alterações simples e registrada no histórico.
                        </p>
                    </section>
                    <button
                        type="button"
                        onClick={resetFlow}
                        className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20"
                    >
                        <RotateCcw className="h-5 w-5" />
                        Escanear próxima devolução
                    </button>
                </div>
            </MobileStepLayout>
        );
    }

    if (step === "analysis" && currentReturn) {
        const locked = currentReturn.analysisLocked === true;
        return (
            <MobileStepLayout
                title="Analisar itens"
                subtitle={currentReturn.marketplaceOrderId || currentReturn.orderNumber || currentReturn.id}
                stepLabel="Conferência"
                onBack={() => setStep("scan")}
                toast={toast}
                isBusy={isBusy}
                footer={
                    analysisItems.length === 0 ? (
                        <button
                            type="button"
                            onClick={openAddProductSearch}
                            disabled={locked || isBusy}
                            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                        >
                            <Search className="h-5 w-5" />
                            Pesquisar produto
                        </button>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                type="button"
                                onClick={openAddProductSearch}
                                disabled={locked || isBusy}
                                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 font-extrabold text-gray-800 disabled:bg-gray-100"
                            >
                                <PackagePlus className="h-5 w-5" />
                                Buscar produto recebido
                            </button>
                            <button
                                type="button"
                                onClick={openSummary}
                                disabled={isBusy}
                                className="flex h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                            >
                                Ir para resumo
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    )
                }
            >
                {locked ? (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        Esta análise já foi concluída. As alterações simples estão bloqueadas.
                    </div>
                ) : null}
                {isAddProductOpen && !locked ? (
                    <section ref={addProductSectionRef} className="mb-4 rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                        <label className="block">
                            <span className="text-sm font-bold text-gray-700">Buscar por SKU ou nome</span>
                            <div className="mt-2 grid grid-cols-[20px_1fr] items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-blue-500">
                                <Search className="h-5 w-5 text-gray-400" />
                                <input
                                    data-product-search="true"
                                    value={productSearch}
                                    onChange={(event) => setProductSearch(event.target.value)}
                                    placeholder="Digite SKU, EAN ou produto"
                                    className="h-12 min-w-0 border-0 bg-transparent font-semibold outline-none"
                                />
                            </div>
                        </label>

                        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                            {isCatalogLoading ? (
                                <div className="flex min-h-16 items-center justify-center gap-2 rounded-lg bg-gray-50 text-sm font-bold text-gray-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Carregando catálogo
                                </div>
                            ) : filteredCatalogProducts.length > 0 ? (
                                filteredCatalogProducts.map((product) => (
                                    <button
                                        key={product.sku}
                                        type="button"
                                        disabled={isBusy}
                                        onClick={async () => {
                                            const saved = await saveAnalysisItem(createManualAnalysisDraft(currentReturn.id, product));
                                            if (saved) {
                                                setIsAddProductOpen(false);
                                                setProductSearch("");
                                            }
                                        }}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left"
                                    >
                                        <p className="text-sm font-extrabold text-gray-950">{product.sku}</p>
                                        <p className="mt-1 text-sm font-semibold text-gray-600">{product.descricao || "Produto sem descrição"}</p>
                                        {product.ean ? <p className="mt-1 text-xs font-bold text-gray-400">EAN: {product.ean}</p> : null}
                                    </button>
                                ))
                            ) : (
                                <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm font-semibold text-gray-500">
                                    Nenhum produto encontrado no catálogo.
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                                const saved = await saveAnalysisItem(createManualAnalysisDraft(currentReturn.id));
                                if (saved) {
                                    setIsAddProductOpen(false);
                                    setProductSearch("");
                                }
                            }}
                            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 font-extrabold text-gray-800 disabled:bg-gray-100"
                        >
                            <PackagePlus className="h-5 w-5" />
                            Adicionar sem cadastro
                        </button>
                    </section>
                ) : null}
                {analysisItems.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                        <p className="text-base font-extrabold text-gray-950">Nenhum item para análise</p>
                        <p className="mt-2 text-sm font-semibold text-gray-500">
                            Pesquise um produto no catálogo para iniciar a conferência.
                        </p>
                        {!isAddProductOpen ? (
                            <button
                                type="button"
                                onClick={openAddProductSearch}
                                disabled={isBusy}
                                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 font-extrabold text-white disabled:bg-gray-300"
                            >
                                <Search className="h-5 w-5" />
                                Pesquisar produto
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="space-y-4 pb-28">
                        {analysisItems.map((item, index) => (
                            <ReturnItemAnalysisCard
                                key={item.id}
                                item={item}
                                index={index}
                                total={analysisItems.length}
                                photos={photos}
                                disabled={locked || isBusy}
                                onChange={queueAnalysisItemSave}
                                onDelete={deleteAnalysisItem}
                                onPhotoUpload={uploadPhoto}
                                isPhotoUploading={uploadingPhotoItemId === item.id || (uploadingPhotoItemId === "new" && !item.id)}
                            />
                        ))}
                    </div>
                )}
            </MobileStepLayout>
        );
    }

    return (
        <MobileStepLayout
            title="Escanear devolução"
            subtitle="Aponte a câmera para o QR Code ou código de barras da etiqueta."
            stepLabel="Mobile"
            toast={toast}
            isBusy={isBusy}
        >
            {isSuper ? (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <label className="text-sm font-bold text-blue-900" htmlFor="mobile-account">
                        Conta operacional
                    </label>
                    <select
                        id="mobile-account"
                        value={selectedAccountId}
                        onChange={(event) => setSelectedAccountId(event.target.value)}
                        className="mt-2 h-12 w-full rounded-lg border border-blue-200 bg-white px-3 text-base font-semibold outline-none"
                    >
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                    </select>
                </div>
            ) : null}
            <MobileReturnScanner
                disabled={isBusy || !accountReady}
                onScan={resolveScan}
            />
        </MobileStepLayout>
    );
}
