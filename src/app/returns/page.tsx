"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    CalendarDays,
    Camera,
    CheckCircle2,
    ClipboardList,
    Edit3,
    FileText,
    Filter,
    Loader2,
    MoreVertical,
    PackageOpen,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    type LucideIcon,
    X,
} from "lucide-react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { useUI } from "@/lib/ui-context";
import {
    MarketplaceReturn,
    ReturnAnalysisItem,
    ReturnChannel,
    ReturnFormData,
    ReturnHistoryEvent,
    ReturnPhoto,
    ReturnProblemType,
    ReturnStatus,
    ReturnType,
    RETURN_CHANNEL_LABELS,
    RETURN_CHANNELS,
    RETURN_HISTORY_ACTION_LABELS,
    RETURN_SOURCE_LABELS,
    RETURN_STATUS_LABELS,
    RETURN_STATUSES,
    RETURN_TYPE_LABELS,
    RETURN_TYPES,
} from "@/lib/returns";

type ReturnFormState = ReturnFormData & { status?: ReturnStatus };
type QuickActionVariant = "success" | "warning";
type ReturnOrderItem = NonNullable<MarketplaceReturn["returnItems"]>[number];

interface UnifiedReturnItem {
    key: string;
    title: string;
    sku: string;
    ean?: string;
    orderItem?: ReturnOrderItem;
    analysisItem?: ReturnAnalysisItem;
    photos: ReturnPhoto[];
    source: "order" | "mobile";
}

interface QuickAction {
    key: string;
    label: string;
    variant: QuickActionVariant;
    icon: LucideIcon;
    run: (item: MarketplaceReturn) => void;
}

const EMPTY_FORM: ReturnFormState = {
    orderNumber: "",
    invoiceNumber: "",
    customerName: "",
    channel: "meli",
    returnType: "full",
    returnDate: "",
    expectedArrivalDate: "",
    notes: "",
};

const ANALYSIS_STATUS_LABELS: Record<ReturnAnalysisItem["status"], string> = {
    ok: "Recebido OK",
    problem: "Com problema",
    not_received: "Não recebido",
    wrong_product: "Produto diferente",
    partial: "Quantidade parcial",
};

const PROBLEM_TYPE_LABELS: Record<ReturnProblemType, string> = {
    damaged: "Avariado",
    package_violated: "Embalagem violada",
    missing_part: "Faltando peça/acessório",
    used_product: "Produto usado",
    wrong_product: "Produto errado",
    expired_product: "Produto vencido",
    partial_quantity: "Quantidade parcial",
    not_resellable: "Sem condições de revenda",
    other: "Outro",
};

function formatDate(date: string | undefined) {
    if (!date) return "-";
    const [year, month, day] = date.split("-");
    if (!year || !month || !day) return date;
    return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface MatchDetails {
    matched: boolean;
    fieldName?: string;
    fieldValue?: string;
}

function getMatchDetails(item: MarketplaceReturn, query: string, field: string): MatchDetails {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { matched: false };

    const match = (val: string | undefined | null) => {
        if (!val) return false;
        return val.toLowerCase().includes(q);
    };

    const checkField = (val: string | undefined | null, name: string) => {
        if (match(val)) {
            return { matched: true, fieldName: name, fieldValue: val! };
        }
        return null;
    };

    if (field === "order") {
        const m = checkField(item.orderNumber, "Pedido") || 
                  checkField(item.externalOrderId, "Pedido") || 
                  checkField(item.marketplaceOrderId, "Pedido");
        return m || { matched: false };
    }

    if (field === "tracking") {
        const m = checkField(item.reverseTrackingCode, "Rastreio") || 
                  checkField(item.trackingCode, "Rastreio") || 
                  checkField(item.reverseTrackingNumber, "Rastreio");
        return m || { matched: false };
    }

    if (field === "invoice") {
        const m = checkField(item.invoiceNumber, "Nota Fiscal");
        return m || { matched: false };
    }

    if (field === "returnId") {
        if (match(item.marketplaceReturnId) || match(item.externalReturnId) || match(item.id)) {
            return { matched: true };
        }
        return { matched: false };
    }

    if (field === "all") {
        if (match(item.marketplaceReturnId) || match(item.id) || match(item.externalReturnId)) {
            return { matched: true };
        }
        
        const others = checkField(item.customerName, "Cliente") ||
                       checkField(item.orderNumber, "Pedido") ||
                       checkField(item.reverseTrackingCode, "Rastreio") ||
                       checkField(item.invoiceNumber, "Nota Fiscal") ||
                       checkField(item.externalOrderId, "Pedido") ||
                       checkField(item.marketplaceOrderId, "Pedido") ||
                       checkField(item.trackingCode, "Rastreio") ||
                       checkField(item.reverseTrackingNumber, "Rastreio") ||
                       checkField(item.shipmentId, "Envio") ||
                       checkField(item.packId, "Pacote");
                       
        return others || { matched: false };
    }

    return { matched: false };
}

function sourceLabel(item: MarketplaceReturn) {
    return RETURN_SOURCE_LABELS[item.source || "manual"];
}

function statusColor(status: ReturnStatus) {
    const colors: Record<ReturnStatus, string> = {
        on_the_way: "border-blue-200 bg-blue-50 text-blue-700",
        pending_analysis: "border-amber-200 bg-amber-50 text-amber-700",
        pending_dispute_or_refund: "border-orange-200 bg-orange-50 text-orange-700",
        waiting_dispute_or_refund: "border-violet-200 bg-violet-50 text-violet-700",
        pending_return_invoice: "border-sky-200 bg-sky-50 text-sky-700",
        resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
        cancelled: "border-rose-200 bg-rose-50 text-rose-700",
    };
    return colors[status];
}

function resolvedOrInvoiceStatus(item: MarketplaceReturn): ReturnStatus {
    return item.returnType === "full" ? "resolved" : "pending_return_invoice";
}

function returnItemSkuLabel(item: NonNullable<MarketplaceReturn["returnItems"]>[number]) {
    return item.sku || item.marketplaceSkuId || item.skuId || "-";
}

function normalizeSku(value: string | undefined) {
    return (value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function analysisHasIssue(item?: ReturnAnalysisItem) {
    if (!item) return false;
    return item.status !== "ok" || item.problemTypes.length > 0;
}

function ReturnPhotoGrid({
    photos,
    title,
}: {
    photos: ReturnPhoto[];
    title: string;
}) {
    if (photos.length === 0) return null;

    return (
        <div className="mt-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                <Camera className="w-3.5 h-3.5" />
                Fotos
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((photo, photoIndex) => (
                    <a
                        key={photo.id}
                        href={photo.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group block overflow-hidden rounded-lg border border-gray-200 bg-white"
                        title={`Abrir foto ${photoIndex + 1}`}
                    >
                        <Image
                            src={photo.downloadUrl}
                            alt={`Foto ${photoIndex + 1} de ${title}`}
                            width={160}
                            height={160}
                            unoptimized
                            className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                        />
                    </a>
                ))}
            </div>
        </div>
    );
}

function UnifiedReturnItemCard({ item }: { item: UnifiedReturnItem }) {
    const analysisItem = item.analysisItem;
    const hasIssue = analysisHasIssue(analysisItem);

    return (
        <div className={`rounded-xl border p-3 ${hasIssue ? "border-orange-200 bg-orange-50/50" : "border-gray-100 bg-gray-50"}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                        SKU: {item.sku || "-"}
                        {item.ean ? ` - EAN: ${item.ean}` : ""}
                        {item.orderItem?.orderItemId ? ` - Item pedido: ${item.orderItem.orderItemId}` : ""}
                    </p>
                </div>
                {analysisItem ? (
                    <span className={`flex-shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
                        hasIssue
                            ? "bg-orange-100 text-orange-700"
                            : "bg-emerald-100 text-emerald-700"
                    }`}>
                        {ANALYSIS_STATUS_LABELS[analysisItem.status]}
                    </span>
                ) : (
                    <span className="flex-shrink-0 rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                        Pedido
                    </span>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {item.orderItem ? (
                    <span className="rounded-md bg-white px-2 py-1 font-bold text-gray-600">
                        Esperado: {item.orderItem.quantity ?? "-"}
                    </span>
                ) : null}
                {analysisItem ? (
                    <span className="rounded-md bg-white px-2 py-1 font-bold text-gray-600">
                        Recebido: {analysisItem.receivedQty}
                    </span>
                ) : null}
                {item.source === "mobile" ? (
                    <span className="rounded-md bg-blue-50 px-2 py-1 font-bold text-[#2d3277]">
                        Adicionado no mobile
                    </span>
                ) : null}
            </div>

            {analysisItem?.problemTypes.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {analysisItem.problemTypes.map((problemType) => (
                        <span key={problemType} className="rounded-md border border-orange-200 bg-white px-2 py-1 text-xs font-bold text-orange-700">
                            {PROBLEM_TYPE_LABELS[problemType]}
                        </span>
                    ))}
                </div>
            ) : null}

            {analysisItem?.notes ? (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                    {analysisItem.notes}
                </p>
            ) : null}

            <ReturnPhotoGrid photos={item.photos} title={item.title} />
        </div>
    );
}

function hasFormChanges(form: ReturnFormState, original?: MarketplaceReturn | null) {
    if (!original) return true;
    return (
        form.orderNumber !== original.orderNumber ||
        form.invoiceNumber !== (original.invoiceNumber || "") ||
        form.customerName !== original.customerName ||
        form.channel !== original.channel ||
        form.returnType !== original.returnType ||
        form.returnDate !== original.returnDate ||
        form.expectedArrivalDate !== (original.expectedArrivalDate || "") ||
        form.notes !== (original.notes || "")
    );
}

export default function ReturnsPage() {
    const { user, userData, loading } = useAuth();
    const { showAlert, showConfirm } = useUI();
    const router = useRouter();

    const [returns, setReturns] = useState<MarketplaceReturn[]>([]);
    const [selectedReturn, setSelectedReturn] = useState<MarketplaceReturn | null>(null);
    const [history, setHistory] = useState<ReturnHistoryEvent[]>([]);
    const [detailAnalysisItems, setDetailAnalysisItems] = useState<ReturnAnalysisItem[]>([]);
    const [detailPhotos, setDetailPhotos] = useState<ReturnPhoto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTargetStatus, setDropTargetStatus] = useState<ReturnStatus | null>(null);
    const [isFiltersOpen, setIsFiltersOpen] = useState(true);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [pendingIssueReturn, setPendingIssueReturn] = useState<MarketplaceReturn | null>(null);
    const [pendingIssueText, setPendingIssueText] = useState("");
    const [isSavingIssue, setIsSavingIssue] = useState(false);
    const [isDetailMenuOpen, setIsDetailMenuOpen] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingReturn, setEditingReturn] = useState<MarketplaceReturn | null>(null);
    const [form, setForm] = useState<ReturnFormState>(EMPTY_FORM);

    const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");

    const [filters, setFilters] = useState({
        channel: "all",
        returnType: "all",
        status: "all",
        orderNumber: "",
        invoiceNumber: "",
        dateFrom: "",
        dateTo: "",
    });

    const [searchField, setSearchField] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const suggestions = useMemo(() => {
        if (searchQuery.trim().length < 2) return [];
        return returns
            .map((item) => {
                const details = getMatchDetails(item, searchQuery, searchField);
                return { item, details };
            })
            .filter(({ details }) => details.matched)
            .slice(0, 20);
    }, [returns, searchQuery, searchField]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelectSuggestion = (item: MarketplaceReturn) => {
        fetchReturnDetail(item);
        setSearchQuery("");
        setShowSuggestions(false);
    };
    const isSuper = userData?.role === "superadmin" || userData?.isAdmin === true;
    const canAccess =
        userData?.role === "superadmin" ||
        userData?.role === "account_admin" ||
        userData?.role === "account_user" ||
        userData?.isAdmin === true;
    const pendingIssueCurrentText = pendingIssueReturn?.pendingIssue?.trim() || "";
    const pendingIssueNextText = pendingIssueText.trim();
    const canSubmitPendingIssue = pendingIssueNextText.length > 0 && pendingIssueNextText !== pendingIssueCurrentText;

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        } else if (!loading && user && userData && !canAccess) {
            router.replace("/dashboard");
        }
    }, [canAccess, loading, router, user, userData]);

    useEffect(() => {
        if (!isSuper || !user) return;

        const fetchAccounts = async () => {
            try {
                const q = query(collection(db, "accounts"), orderBy("name"));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    name: doc.data().name || "Sem nome",
                }));
                setAccounts(list);
                if (!selectedAccountId && list.length > 0) {
                    setSelectedAccountId(list[0].id);
                }
            } catch (error) {
                console.error("Erro ao buscar contas:", error);
                showAlert("Erro", "Erro ao buscar contas.", "error");
            }
        };

        fetchAccounts();
    }, [isSuper, selectedAccountId, showAlert, user]);

    const accountQuery = useMemo(() => {
        if (isSuper) return selectedAccountId ? `?accountId=${selectedAccountId}` : "";
        return "";
    }, [isSuper, selectedAccountId]);

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ type, message });
        window.setTimeout(() => setToast(null), 3000);
    };

    const fetchReturns = useCallback(async () => {
        if (!user || !canAccess || (isSuper && !selectedAccountId)) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/returns${accountQuery}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao buscar devoluções");
            setReturns(Array.isArray(data.returns) ? data.returns : []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro ao buscar devoluções";
            showAlert("Erro", message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [accountQuery, canAccess, isSuper, selectedAccountId, showAlert, user]);

    useEffect(() => {
        if (!loading && user && canAccess) {
            fetchReturns();
        }
    }, [canAccess, fetchReturns, loading, user]);

    const filteredReturns = useMemo(() => {
        return returns.filter((item) => {
            if (filters.channel !== "all" && item.channel !== filters.channel) return false;
            if (filters.returnType !== "all" && item.returnType !== filters.returnType) return false;
            if (filters.status !== "all" && item.status !== filters.status) return false;
            if (
                filters.orderNumber.trim() &&
                !item.orderNumber.toLowerCase().includes(filters.orderNumber.trim().toLowerCase())
            ) return false;
            if (
                filters.invoiceNumber.trim() &&
                !(item.invoiceNumber || "").toLowerCase().includes(filters.invoiceNumber.trim().toLowerCase())
            ) return false;
            if (filters.dateFrom && item.returnDate < filters.dateFrom) return false;
            if (filters.dateTo && item.returnDate > filters.dateTo) return false;
            return true;
        });
    }, [filters, returns]);

    const groupedReturns = useMemo(() => {
        const groups = new Map<ReturnStatus, MarketplaceReturn[]>();
        RETURN_STATUSES.forEach((status) => groups.set(status, []));
        filteredReturns.forEach((item) => {
            groups.get(item.status)?.push(item);
        });
        return groups;
    }, [filteredReturns]);

    const detailPhotosByItemId = useMemo(() => {
        const groups = new Map<string, ReturnPhoto[]>();
        detailPhotos.forEach((photo) => {
            if (!photo.itemId) return;
            const current = groups.get(photo.itemId) || [];
            current.push(photo);
            groups.set(photo.itemId, current);
        });
        return groups;
    }, [detailPhotos]);

    const detailUnifiedItems = useMemo<UnifiedReturnItem[]>(() => {
        const orderItems = selectedReturn?.returnItems || [];
        const usedAnalysisIds = new Set<string>();
        const analysisBySku = new Map<string, ReturnAnalysisItem[]>();

        detailAnalysisItems.forEach((item) => {
            const skuKey = normalizeSku(item.sku);
            if (!skuKey) return;
            const current = analysisBySku.get(skuKey) || [];
            current.push(item);
            analysisBySku.set(skuKey, current);
        });

        const unified: UnifiedReturnItem[] = orderItems.map((orderItem, index) => {
            const sku = returnItemSkuLabel(orderItem);
            const skuKey = normalizeSku(sku);
            const matchedAnalysis = skuKey
                ? (analysisBySku.get(skuKey) || []).find((item) => !usedAnalysisIds.has(item.id))
                : undefined;

            if (matchedAnalysis) usedAnalysisIds.add(matchedAnalysis.id);

            return {
                key: `order-${orderItem.id || orderItem.orderItemId || sku || index}`,
                title: orderItem.title || matchedAnalysis?.productName || "Item sem descricao",
                sku,
                ean: matchedAnalysis?.ean,
                orderItem,
                analysisItem: matchedAnalysis,
                photos: matchedAnalysis ? detailPhotosByItemId.get(matchedAnalysis.id) || [] : [],
                source: "order",
            };
        });

        detailAnalysisItems.forEach((item) => {
            if (usedAnalysisIds.has(item.id)) return;
            unified.push({
                key: `mobile-${item.id}`,
                title: item.productName || "Produto sem descricao",
                sku: item.sku || "-",
                ean: item.ean,
                analysisItem: item,
                photos: detailPhotosByItemId.get(item.id) || [],
                source: "mobile",
            });
        });

        return unified;
    }, [detailAnalysisItems, detailPhotosByItemId, selectedReturn?.returnItems]);

    const detailProblemItems = useMemo(() => {
        return detailUnifiedItems.filter((item) => analysisHasIssue(item.analysisItem));
    }, [detailUnifiedItems]);

    const openCreateForm = () => {
        setEditingReturn(null);
        setForm({
            ...EMPTY_FORM,
            returnDate: new Date().toISOString().slice(0, 10),
        });
        setIsFormOpen(true);
    };

    const openEditForm = (item: MarketplaceReturn) => {
        setIsDetailMenuOpen(false);
        setEditingReturn(item);
        setForm({
            orderNumber: item.orderNumber,
            invoiceNumber: item.invoiceNumber || "",
            customerName: item.customerName,
            channel: item.channel,
            returnType: item.returnType,
            returnDate: item.returnDate,
            expectedArrivalDate: item.expectedArrivalDate || "",
            notes: item.notes || "",
            status: item.status,
        });
        setIsFormOpen(true);
    };

    const fetchReturnDetail = async (item: MarketplaceReturn) => {
        if (!user) return;
        setSelectedReturn(item);
        setIsDetailMenuOpen(false);
        setDetailAnalysisItems([]);
        setDetailPhotos([]);
        setIsDetailLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/returns/${item.id}${accountQuery}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao buscar detalhes");
            setSelectedReturn(data.return);
            setHistory(Array.isArray(data.history) ? data.history : []);
            setDetailAnalysisItems(Array.isArray(data.analysisItems) ? data.analysisItems : []);
            setDetailPhotos(Array.isArray(data.photos) ? data.photos : []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro ao buscar detalhes";
            showAlert("Erro", message, "error");
        } finally {
            setIsDetailLoading(false);
        }
    };

    const refreshSelectedReturn = async (item: MarketplaceReturn) => {
        await fetchReturnDetail(item);
        await fetchReturns();
    };

    const updateReturn = async (id: string, payload: Record<string, unknown>) => {
        if (!user) throw new Error("Usuário não autenticado");
        const token = await user.getIdToken();
        const response = await fetch(`/api/returns/${id}${accountQuery}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao atualizar devolução");
        return data.return as MarketplaceReturn;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) return;

        setIsSaving(true);
        try {
            const token = await user.getIdToken();
            const payload = {
                orderNumber: form.orderNumber,
                invoiceNumber: form.invoiceNumber,
                customerName: form.customerName,
                channel: form.channel,
                returnType: form.returnType,
                returnDate: form.returnDate,
                expectedArrivalDate: form.expectedArrivalDate,
                notes: form.notes,
            };

            if (editingReturn) {
                const updatePayload: Record<string, unknown> = { ...payload };
                if (form.status && form.status !== editingReturn.status) {
                    updatePayload.status = form.status;
                }

                if (!hasFormChanges(form, editingReturn) && !updatePayload.status) {
                    setIsFormOpen(false);
                    return;
                }

                const updated = await updateReturn(editingReturn.id, updatePayload);
                setReturns((current) => current.map((item) => item.id === updated.id ? updated : item));
                if (selectedReturn?.id === updated.id) await refreshSelectedReturn(updated);
                showAlert("Sucesso", "Devolução atualizada com sucesso.", "success");
            } else {
                const response = await fetch(`/api/returns${accountQuery}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Erro ao criar devolução");
                setReturns((current) => [data.return, ...current]);
                showToast("Devolução criada com sucesso.");
            }

            setIsFormOpen(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro ao salvar devolução";
            showAlert("Erro", message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (
        item: MarketplaceReturn,
        status: ReturnStatus,
        historyNote?: string,
        extraPayload: Record<string, unknown> = {}
    ) => {
        const hasExtraPayload = Object.keys(extraPayload).length > 0;
        if (item.status === status && !historyNote && !hasExtraPayload) return;

        const previousReturns = returns;
        const optimistic = {
            ...item,
            ...extraPayload,
            status,
            updatedAt: new Date().toISOString(),
        } as MarketplaceReturn;

        setReturns((current) => current.map((returnItem) => returnItem.id === item.id ? optimistic : returnItem));
        if (selectedReturn?.id === item.id) setSelectedReturn(optimistic);

        try {
            const updated = await updateReturn(item.id, { status, historyNote, ...extraPayload });
            setReturns((current) => current.map((returnItem) => returnItem.id === item.id ? updated : returnItem));
            if (selectedReturn?.id === item.id) await fetchReturnDetail(updated);
            showToast("Status atualizado com sucesso.");
        } catch (error: unknown) {
            setReturns(previousReturns);
            if (selectedReturn?.id === item.id) setSelectedReturn(item);
            const message = error instanceof Error ? error.message : "Erro ao alterar status";
            showAlert("Erro", message, "error");
        }
    };

    const handleDeleteReturn = async (item: MarketplaceReturn) => {
        if (!user) return;

        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/returns/${item.id}${accountQuery}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao apagar devolução");

            setReturns((current) => current.filter((returnItem) => returnItem.id !== item.id));
            if (selectedReturn?.id === item.id) {
                setSelectedReturn(null);
                setHistory([]);
                setDetailAnalysisItems([]);
                setDetailPhotos([]);
            }
            showToast("Devolução apagada com sucesso.");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro ao apagar devolução";
            showToast(message, "error");
        }
    };

    const confirmDeleteReturn = (item: MarketplaceReturn) => {
        setIsDetailMenuOpen(false);
        showConfirm(
            "Apagar devolução",
            "Tem certeza que deseja apagar esta devolução manual? Esta ação remove também o histórico.",
            () => handleDeleteReturn(item),
            "Apagar",
            "Cancelar"
        );
    };

    const openPendingIssueModal = (item: MarketplaceReturn) => {
        setPendingIssueReturn(item);
        setPendingIssueText(item.pendingIssue || "");
    };

    const handlePendingIssueSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!pendingIssueReturn) return;

        const issue = pendingIssueText.trim();
        if (!canSubmitPendingIssue) {
            showToast(
                issue ? "Altere a pendência antes de registrar." : "Descreva a pendência antes de registrar.",
                "error"
            );
            return;
        }

        setIsSavingIssue(true);
        try {
            const targetStatus: ReturnStatus = pendingIssueReturn.status === "pending_analysis"
                ? "pending_dispute_or_refund"
                : pendingIssueReturn.status;

            const historyNote = pendingIssueReturn.pendingIssue
                ? `Pendência atualizada: ${issue}`
                : `Pendência registrada: ${issue}`;

            if (targetStatus === pendingIssueReturn.status) {
                const updated = await updateReturn(pendingIssueReturn.id, {
                    pendingIssue: issue,
                    historyNote,
                });
                setReturns((current) => current.map((item) => item.id === updated.id ? updated : item));
                if (selectedReturn?.id === updated.id) await fetchReturnDetail(updated);
                showToast("Pendência atualizada com sucesso.");
            } else {
                await handleStatusChange(pendingIssueReturn, targetStatus, historyNote, { pendingIssue: issue });
            }

            setPendingIssueReturn(null);
            setPendingIssueText("");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Erro ao registrar pendência";
            showToast(message, "error");
        } finally {
            setIsSavingIssue(false);
        }
    };

    const getQuickActions = (item: MarketplaceReturn): QuickAction[] => {
        switch (item.status) {
            case "on_the_way":
                return [{
                    key: "received",
                    label: "Marcar como Recebida",
                    variant: "success",
                    icon: CheckCircle2,
                    run: (returnItem) => handleStatusChange(returnItem, "pending_analysis", "Devolução recebida e enviada para análise."),
                }];
            case "pending_analysis":
                return [
                    {
                        key: "no_pending",
                        label: "Liberar sem Pendências",
                        variant: "success",
                        icon: CheckCircle2,
                        run: (returnItem) => {
                            const targetStatus = resolvedOrInvoiceStatus(returnItem);
                            const note = targetStatus === "resolved"
                                ? "Análise concluída sem pendências. Devolução finalizada."
                                : "Análise concluída sem pendências. Aguardando nota de devolução.";
                            handleStatusChange(returnItem, targetStatus, note, { pendingIssue: "" });
                        },
                    },
                    {
                        key: "with_pending",
                        label: "Registrar Pendência",
                        variant: "warning",
                        icon: AlertTriangle,
                        run: openPendingIssueModal,
                    },
                ];
            case "pending_dispute_or_refund":
                return [{
                    key: "disputed",
                    label: "Marcar como Contestada",
                    variant: "success",
                    icon: CheckCircle2,
                    run: (returnItem) => handleStatusChange(returnItem, "waiting_dispute_or_refund", "Contestação registrada. Aguardando retorno."),
                }];
            case "waiting_dispute_or_refund":
                return [{
                    key: "dispute_resolved",
                    label: "Marcar como Resolvida",
                    variant: "success",
                    icon: CheckCircle2,
                    run: (returnItem) => {
                        const targetStatus = resolvedOrInvoiceStatus(returnItem);
                        const note = targetStatus === "resolved"
                            ? "Contestação resolvida. Devolução finalizada."
                            : "Contestação resolvida. Aguardando nota de devolução.";
                        handleStatusChange(returnItem, targetStatus, note);
                    },
                }];
            case "pending_return_invoice":
                return [{
                    key: "invoice_done",
                    label: "Concluir Devolução",
                    variant: "success",
                    icon: CheckCircle2,
                    run: (returnItem) => handleStatusChange(returnItem, "resolved", "Nota de devolução concluída. Devolução finalizada."),
                }];
            default:
                return [];
        }
    };

    const renderQuickActions = (item: MarketplaceReturn, layout: "card" | "detail") => {
        const actions = getQuickActions(item);
        if (actions.length === 0) return null;

        return (
            <div className={layout === "card" ? "mt-3 flex flex-col gap-2" : "flex flex-wrap gap-2"}>
                {actions.map((action) => {
                    const Icon = action.icon;
                    const className = action.variant === "success"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-orange-500 text-white hover:bg-orange-600";

                    return (
                        <button
                            key={action.key}
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                action.run(item);
                            }}
                            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold shadow-sm ${className}`}
                        >
                            <Icon className="w-4 h-4" />
                            {action.label}
                        </button>
                    );
                })}
            </div>
        );
    };

    const handleDrop = async (status: ReturnStatus) => {
        if (!draggedId) return;
        const item = returns.find((returnItem) => returnItem.id === draggedId);
        setDraggedId(null);
        setDropTargetStatus(null);
        if (!item || item.status === status) return;
        await handleStatusChange(item, status);
    };

    const clearFilters = () => {
        setFilters({
            channel: "all",
            returnType: "all",
            status: "all",
            orderNumber: "",
            invoiceNumber: "",
            dateFrom: "",
            dateTo: "",
        });
    };

    if (loading || !user || !userData || (!canAccess && userData.role !== undefined)) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <Loader2 className="w-10 h-10 animate-spin text-[#2d3277]" />
            </div>
        );
    }

    if (!canAccess) {
        return null;
    }

    return (
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {toast && (
                <div className="fixed top-24 right-5 z-[120] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className={`${toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"} text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold`}>
                        {toast.message}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestão de Devoluções</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Controle manual de devoluções por etapa operacional.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {isSuper && (
                        <select
                            value={selectedAccountId}
                            onChange={(event) => setSelectedAccountId(event.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        >
                            <option value="">Selecione uma conta</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={fetchReturns}
                        disabled={isLoading || (isSuper && !selectedAccountId)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                        Atualizar
                    </button>
                    <button
                        onClick={openCreateForm}
                        disabled={isSuper && !selectedAccountId}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2d3277] text-white rounded-lg hover:bg-[#252963] disabled:opacity-50 text-sm font-semibold shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Devolução
                    </button>
                </div>
            </div>

            <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 mb-5">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-[#2d3277]" />
                        <h2 className="text-sm font-bold text-gray-800">Busca</h2>
                    </div>
                    
                    <div ref={searchRef} className="relative flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-[#2d3277]/20 focus-within:border-[#2d3277]/30 transition-all w-full max-w-xl">
                        <select
                            aria-label="Tipo de busca"
                            value={searchField}
                            onChange={(e) => setSearchField(e.target.value)}
                            className="bg-transparent border-r border-gray-200 rounded-l-lg py-1.5 pl-3 pr-8 text-xs text-gray-500 font-semibold focus:outline-none focus:ring-0 cursor-pointer h-full outline-none"
                        >
                            <option value="all">Todos</option>
                            <option value="order">Pedido</option>
                            <option value="tracking">Rastreio</option>
                            <option value="invoice">Nota Fiscal</option>
                            <option value="returnId">ID Devolução</option>
                        </select>
                        <div className="relative flex-1 flex items-center">
                            <input
                                type="text"
                                placeholder="Buscar devolução..."
                                value={searchQuery}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchQuery(val);
                                    setShowSuggestions(val.trim().length >= 2);
                                }}
                                onFocus={() => {
                                    if (searchQuery.trim().length >= 2) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                        setShowSuggestions(false);
                                    }
                                }}
                                className="bg-transparent flex-1 py-1.5 pl-3 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 outline-none w-full"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setShowSuggestions(false);
                                    }}
                                    aria-label="Limpar busca"
                                    className="absolute right-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {showSuggestions && searchQuery.trim().length >= 2 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-y-auto max-h-64 divide-y divide-gray-100">
                                {suggestions.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-500 text-center">
                                        Nenhuma devolução encontrada para &apos;{searchQuery}&apos;
                                    </div>
                                ) : (
                                    suggestions.map(({ item, details }) => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectSuggestion(item)}
                                            className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors focus:bg-gray-50 outline-none"
                                        >
                                            <div className="flex items-center">
                                                {item.channel === "meli" ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                        Meli
                                                    </span>
                                                ) : item.channel === "shopee" ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                                                        Shopee
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                                                        {item.channel || "Outro"}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 mx-3 text-left">
                                                <div className="text-sm font-bold text-gray-900 truncate">
                                                    {item.marketplaceReturnId || item.id}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">
                                                    Pedido: {item.orderNumber} · Cliente: {item.customerName}
                                                </div>
                                                {details.fieldName && details.fieldValue && (
                                                    <div className="text-xs text-indigo-600 font-medium mt-0.5 truncate">
                                                        {details.fieldName}: {details.fieldValue}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium whitespace-nowrap">
                                                {formatDate(item.returnDate)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 mb-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-[#2d3277]" />
                        <h2 className="text-sm font-bold text-gray-800">Filtros</h2>
                        <span className="text-xs text-gray-400">{filteredReturns.length} de {returns.length} devoluções</span>
                    </div>

                    <button
                        onClick={() => setIsFiltersOpen((current) => !current)}
                        className="px-3 py-1.5 text-sm font-semibold text-[#2d3277] hover:bg-blue-50 rounded-lg"
                    >
                        {isFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                    </button>
                </div>

                {isFiltersOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Canal</span>
                        <select
                            value={filters.channel}
                            onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        >
                            <option value="all">Todos</option>
                            {RETURN_CHANNELS.map((channel) => (
                                <option key={channel} value={channel}>{RETURN_CHANNEL_LABELS[channel]}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Tipo</span>
                        <select
                            value={filters.returnType}
                            onChange={(event) => setFilters((current) => ({ ...current, returnType: event.target.value }))}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        >
                            <option value="all">Todos</option>
                            {RETURN_TYPES.map((type) => (
                                <option key={type} value={type}>{RETURN_TYPE_LABELS[type]}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Status</span>
                        <select
                            value={filters.status}
                            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        >
                            <option value="all">Todos</option>
                            {RETURN_STATUSES.map((status) => (
                                <option key={status} value={status}>{RETURN_STATUS_LABELS[status]}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Pedido</span>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                value={filters.orderNumber}
                                onChange={(event) => setFilters((current) => ({ ...current, orderNumber: event.target.value }))}
                                placeholder="Número"
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Nota fiscal</span>
                        <input
                            value={filters.invoiceNumber}
                            onChange={(event) => setFilters((current) => ({ ...current, invoiceNumber: event.target.value }))}
                            placeholder="NF"
                            className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        />
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">De</span>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        />
                    </label>

                    <label className="block">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Até</span>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                            className="mt-1 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                        />
                    </label>
                </div>

                <div className="mt-3 flex justify-end">
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                    >
                        <X className="w-4 h-4" />
                        Limpar filtros
                    </button>
                </div>
                    </div>
                )}
            </section>

            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-10 h-10 animate-spin text-[#2d3277]" />
                </div>
            ) : returns.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm py-20 flex flex-col items-center text-center px-4">
                    <PackageOpen className="w-12 h-12 text-gray-300 mb-4" />
                    <h2 className="text-lg font-bold text-gray-700">Nenhuma devolução cadastrada</h2>
                    <p className="text-sm text-gray-500 mt-1">Crie a primeira devolução manual para iniciar o funil.</p>
                    <button
                        onClick={openCreateForm}
                        className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#2d3277] text-white rounded-lg hover:bg-[#252963] text-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Devolução
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto pb-3">
                    <div className={`grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 min-w-[1680px] min-h-[520px] ${isFiltersOpen ? "h-[calc(100vh-360px)]" : "h-[calc(100vh-230px)]"}`}>
                        {RETURN_STATUSES.map((status) => {
                            const columnItems = groupedReturns.get(status) || [];
                            return (
                                <section
                                    key={status}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setDropTargetStatus(status);
                                    }}
                                    onDragLeave={() => setDropTargetStatus(null)}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        handleDrop(status);
                                    }}
                                    className={`rounded-xl border bg-gray-50/80 h-full overflow-hidden flex flex-col transition-colors ${
                                        dropTargetStatus === status ? "border-[#2d3277] bg-blue-50/50" : "border-gray-200"
                                    }`}
                                >
                                    <div className="sticky top-0 z-20 px-4 py-3 bg-white border-b border-gray-100 rounded-t-xl shadow-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <h2 className="text-sm font-bold text-gray-800 leading-tight pr-2">
                                                {RETURN_STATUS_LABELS[status]}
                                            </h2>
                                            <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${statusColor(status)}`}>
                                                {columnItems.length}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-3 pt-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
                                        {columnItems.length === 0 ? (
                                            <div className="h-28 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 text-center px-4">
                                                Sem devoluções nesta etapa
                                            </div>
                                        ) : columnItems.map((item) => (
                                            <article
                                                key={item.id}
                                                draggable
                                                onDragStart={() => setDraggedId(item.id)}
                                                onDragEnd={() => {
                                                    setDraggedId(null);
                                                    setDropTargetStatus(null);
                                                }}
                                                onClick={() => fetchReturnDetail(item)}
                                                className={`bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-[#2d3277]/30 transition-all cursor-pointer ${
                                                    draggedId === item.id ? "opacity-60" : ""
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-gray-400 uppercase">Pedido</p>
                                                        <h3 className="font-bold text-gray-900 truncate">{item.orderNumber}</h3>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span
                                                            className="max-w-[120px] truncate text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md"
                                                            title={item.marketplace || RETURN_CHANNEL_LABELS[item.channel]}
                                                        >
                                                            {item.marketplace || RETURN_CHANNEL_LABELS[item.channel]}
                                                        </span>
                                                        <span className={item.source === "anymarket"
                                                            ? "text-[11px] font-bold bg-blue-50 text-[#2d3277] px-2 py-1 rounded-md"
                                                            : "text-[11px] font-bold bg-gray-50 text-gray-500 px-2 py-1 rounded-md"
                                                        }>
                                                            {sourceLabel(item)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 text-sm">
                                                    <p className="text-gray-700 truncate">{item.customerName}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-md">
                                                            {RETURN_TYPE_LABELS[item.returnType]}
                                                        </span>
                                                        {item.anymarketStatus && (
                                                            <span className="text-xs text-[#2d3277] bg-blue-50 border border-blue-100 px-2 py-1 rounded-md">
                                                                AnyMarket: {item.anymarketStatus}
                                                            </span>
                                                        )}
                                                        {item.invoiceNumber && (
                                                            <span className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-md">
                                                                NF {item.invoiceNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <CalendarDays className="w-3.5 h-3.5" />
                                                        <span>
                                                            {item.expectedArrivalDate
                                                                ? `Prev. ${formatDate(item.expectedArrivalDate)}`
                                                                : formatDate(item.returnDate)}
                                                        </span>
                                                    </div>
                                                    {item.pendingIssue && (
                                                        <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                                                            <span className="font-bold">Pendência: </span>
                                                            <span className="block max-h-9 overflow-hidden">{item.pendingIssue}</span>
                                                        </div>
                                                    )}
                                                    {item.analysisSummary && (
                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            {item.analysisSummary.problemItems > 0 ? (
                                                                <span className="rounded-md border border-orange-100 bg-orange-50 px-2 py-1 font-bold text-orange-700">
                                                                    {item.analysisSummary.problemItems} problema(s)
                                                                </span>
                                                            ) : null}
                                                            {item.analysisSummary.manuallyAddedItems > 0 ? (
                                                                <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-bold text-[#2d3277]">
                                                                    {item.analysisSummary.manuallyAddedItems} item(ns) adicionados
                                                                </span>
                                                            ) : null}
                                                            {item.analysisSummary.photoCount > 0 ? (
                                                                <span className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1 font-bold text-gray-600">
                                                                    {item.analysisSummary.photoCount} foto(s)
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    {renderQuickActions(item, "card")}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>
            )}

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingReturn ? "Editar devolução" : "Nova Devolução"}
                            </h2>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-xs font-bold text-gray-500">Número do pedido *</span>
                                    <input
                                        required
                                        value={form.orderNumber}
                                        onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-gray-500">Nota fiscal</span>
                                    <input
                                        value={form.invoiceNumber}
                                        onChange={(event) => setForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    />
                                </label>

                                <label className="block md:col-span-2">
                                    <span className="text-xs font-bold text-gray-500">Cliente *</span>
                                    <input
                                        required
                                        value={form.customerName}
                                        onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-gray-500">Canal *</span>
                                    <select
                                        value={form.channel}
                                        onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as ReturnChannel }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    >
                                        {RETURN_CHANNELS.map((channel) => (
                                            <option key={channel} value={channel}>{RETURN_CHANNEL_LABELS[channel]}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-gray-500">Tipo *</span>
                                    <select
                                        value={form.returnType}
                                        onChange={(event) => setForm((current) => ({ ...current, returnType: event.target.value as ReturnType }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    >
                                        {RETURN_TYPES.map((type) => (
                                            <option key={type} value={type}>{RETURN_TYPE_LABELS[type]}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-gray-500">Data da devolução *</span>
                                    <input
                                        required
                                        type="date"
                                        value={form.returnDate}
                                        onChange={(event) => setForm((current) => ({ ...current, returnDate: event.target.value }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-gray-500">Previsão de chegada</span>
                                    <input
                                        type="date"
                                        value={form.expectedArrivalDate}
                                        onChange={(event) => setForm((current) => ({ ...current, expectedArrivalDate: event.target.value }))}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    />
                                </label>

                                {editingReturn && (
                                    <label className="block md:col-span-2">
                                        <span className="text-xs font-bold text-gray-500">Status</span>
                                        <select
                                            value={form.status}
                                            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ReturnStatus }))}
                                            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#2d3277]/20"
                                        >
                                            {RETURN_STATUSES.map((status) => (
                                                <option key={status} value={status}>{RETURN_STATUS_LABELS[status]}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                <label className="block md:col-span-2">
                                    <span className="text-xs font-bold text-gray-500">Observações</span>
                                    <textarea
                                        value={form.notes}
                                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                        rows={4}
                                        className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-[#2d3277]/20"
                                    />
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFormOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isSaving}
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#2d3277] text-white text-sm font-semibold rounded-lg hover:bg-[#252963] disabled:opacity-50"
                                >
                                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {pendingIssueReturn && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Registrar Pendência</h2>
                                <p className="text-sm text-gray-500 mt-1">Pedido {pendingIssueReturn.orderNumber}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setPendingIssueReturn(null);
                                    setPendingIssueText("");
                                }}
                                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePendingIssueSubmit} className="p-6 space-y-4">
                            <label className="block">
                                <span className="text-xs font-bold text-gray-500">Descrição da pendência *</span>
                                <textarea
                                    required
                                    value={pendingIssueText}
                                    onChange={(event) => setPendingIssueText(event.target.value)}
                                    rows={5}
                                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-[#2d3277]/20 focus:border-[#2d3277]/40"
                                    placeholder="Ex.: produto avariado, item divergente, embalagem incompleta..."
                                />
                            </label>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingIssueReturn(null);
                                        setPendingIssueText("");
                                    }}
                                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isSavingIssue || !canSubmitPendingIssue}
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#2d3277] text-white text-sm font-semibold rounded-lg hover:bg-[#252963] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSavingIssue && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Registrar Pendência
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedReturn && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] flex items-center justify-end p-0 sm:p-4">
                    <aside className="bg-white w-full sm:max-w-2xl h-full sm:h-[calc(100vh-2rem)] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Pedido</p>
                                <h2 className="text-xl font-bold text-gray-900">{selectedReturn.orderNumber}</h2>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`inline-flex text-xs font-bold px-2 py-1 rounded-full border ${statusColor(selectedReturn.status)}`}>
                                        {RETURN_STATUS_LABELS[selectedReturn.status]}
                                    </span>
                                    <span className={selectedReturn.source === "anymarket"
                                        ? "inline-flex text-xs font-bold px-2 py-1 rounded-full border border-blue-100 bg-blue-50 text-[#2d3277]"
                                        : "inline-flex text-xs font-bold px-2 py-1 rounded-full border border-gray-100 bg-gray-50 text-gray-600"
                                    }>
                                        {sourceLabel(selectedReturn)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsDetailMenuOpen((current) => !current)}
                                        aria-label="Ações da devolução"
                                        aria-expanded={isDetailMenuOpen}
                                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                    {isDetailMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-gray-100 bg-white py-1 shadow-xl z-10">
                                            <button
                                                type="button"
                                                onClick={() => openEditForm(selectedReturn)}
                                                className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => confirmDeleteReturn(selectedReturn)}
                                                className="w-full inline-flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Apagar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedReturn(null);
                                        setHistory([]);
                                        setDetailAnalysisItems([]);
                                        setDetailPhotos([]);
                                        setIsDetailMenuOpen(false);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {isDetailLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-10 h-10 animate-spin text-[#2d3277]" />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-xl">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Cliente</p>
                                        <p className="font-semibold text-gray-800 mt-1">{selectedReturn.customerName}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Nota fiscal</p>
                                        <p className="font-semibold text-gray-800 mt-1">{selectedReturn.invoiceNumber || "-"}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Canal / tipo</p>
                                        <p className="font-semibold text-gray-800 mt-1">
                                            {RETURN_CHANNEL_LABELS[selectedReturn.channel]} / {RETURN_TYPE_LABELS[selectedReturn.returnType]}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Datas</p>
                                        <p className="font-semibold text-gray-800 mt-1">
                                            {formatDate(selectedReturn.returnDate)}
                                            {selectedReturn.expectedArrivalDate ? ` · Prev. ${formatDate(selectedReturn.expectedArrivalDate)}` : ""}
                                        </p>
                                    </div>
                                </div>

                                {selectedReturn.source === "anymarket" && (
                                    <div className="bg-white border border-blue-100 rounded-xl p-4">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                            <RefreshCw className="w-4 h-4 text-[#2d3277]" />
                                            AnyMarket
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Marketplace</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.marketplace || RETURN_CHANNEL_LABELS[selectedReturn.channel]}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Status</p>
                                                <p className="font-semibold text-gray-800 mt-1">{selectedReturn.anymarketStatus || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Pedido marketplace</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.marketplaceOrderId || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Devolução marketplace</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.marketplaceReturnId || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Pedido AnyMarket</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.externalOrderId || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Devolução AnyMarket</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.externalReturnId || "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Ultimo webhook</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.lastWebhookReceivedAt ? formatDateTime(selectedReturn.lastWebhookReceivedAt) : "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Rastreio reverso</p>
                                                <p className="font-semibold text-gray-800 mt-1">
                                                    {selectedReturn.reverseTrackingCode || selectedReturn.trackingCode || "-"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {getQuickActions(selectedReturn).length > 0 && (
                                    <div className="bg-white border border-gray-100 rounded-xl p-4">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            Próxima ação
                                        </h3>
                                        {renderQuickActions(selectedReturn, "detail")}
                                    </div>
                                )}

                                <div className="bg-white border border-gray-100 rounded-xl p-4">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                        <PackageOpen className="w-4 h-4 text-[#2d3277]" />
                                        Itens do pedido e conferencia
                                    </h3>
                                    {detailUnifiedItems.length > 0 ? (
                                        <div className="space-y-3">
                                            {detailUnifiedItems.map((item) => (
                                                <UnifiedReturnItemCard key={item.key} item={item} />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400">Nenhum item informado.</p>
                                    )}
                                </div>

                                <div className="hidden bg-white border border-gray-100 rounded-xl p-4">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                        <PackageOpen className="w-4 h-4 text-[#2d3277]" />
                                        Itens devolvidos
                                    </h3>
                                    {selectedReturn.returnItems && selectedReturn.returnItems.length > 0 ? (
                                        <div className="divide-y divide-gray-100">
                                            {selectedReturn.returnItems.map((item, index) => (
                                                <div key={`${item.id || item.orderItemId || item.sku || index}`} className="py-3 first:pt-0 last:pb-0">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-gray-800 break-words">
                                                                {item.title || "Item sem descrição"}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                SKU: {returnItemSkuLabel(item)}
                                                                {item.orderItemId ? ` · Item pedido: ${item.orderItemId}` : ""}
                                                            </p>
                                                        </div>
                                                        <span className="flex-shrink-0 rounded-md bg-gray-50 px-2 py-1 text-xs font-bold text-gray-600">
                                                            Qtd. {item.quantity ?? "-"}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400">Nenhum item informado pela AnyMarket.</p>
                                    )}
                                </div>

                                <div className="bg-white border border-gray-100 rounded-xl p-4">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                            <ClipboardList className="w-4 h-4 text-[#2d3277]" />
                                            Status
                                        </h3>
                                        <select
                                            value={selectedReturn.status}
                                            onChange={(event) => handleStatusChange(selectedReturn, event.target.value as ReturnStatus)}
                                            className={`px-3 py-2 rounded-lg border text-sm font-semibold outline-none ${statusColor(selectedReturn.status)}`}
                                        >
                                            {RETURN_STATUSES.map((status) => (
                                                <option key={status} value={status}>{RETURN_STATUS_LABELS[status]}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {(selectedReturn.pendingIssue ||
                                    detailProblemItems.length > 0 ||
                                    selectedReturn.status === "pending_dispute_or_refund" ||
                                    selectedReturn.status === "waiting_dispute_or_refund") && (
                                    <div className="bg-white border border-blue-100 rounded-xl p-4">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-[#2d3277]" />
                                                Pendência
                                            </h3>
                                            <button
                                                onClick={() => openPendingIssueModal(selectedReturn)}
                                                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-[#2d3277] hover:bg-blue-100 rounded-lg text-sm font-semibold"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                                {selectedReturn.pendingIssue ? "Editar" : "Registrar"}
                                            </button>
                                        </div>
                                        <p className="text-sm text-[#2d3277] whitespace-pre-wrap">
                                            {selectedReturn.pendingIssue || "Nenhuma pendência registrada."}
                                        </p>
                                        {detailProblemItems.length > 0 ? (
                                            <div className="mt-4 border-t border-blue-100 pt-4">
                                                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                                                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                                                    Problemas da conferencia
                                                </h4>
                                                <div className="space-y-3">
                                                    {detailProblemItems.map((item) => (
                                                        <UnifiedReturnItemCard key={`pending-${item.key}`} item={item} />
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                <div className="bg-white border border-gray-100 rounded-xl p-4">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                        <FileText className="w-4 h-4 text-[#2d3277]" />
                                        Observações
                                    </h3>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                        {selectedReturn.notes || "Sem observações."}
                                    </p>
                                </div>

                                <div className="bg-white border border-gray-100 rounded-xl p-4">
                                    <h3 className="font-bold text-gray-900 mb-4">Histórico</h3>
                                    {history.length === 0 ? (
                                        <p className="text-sm text-gray-400">Nenhum histórico registrado.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {history.map((event) => (
                                                <div key={event.id} className="flex gap-3">
                                                    <div className="mt-1 w-2 h-2 rounded-full bg-[#2d3277] flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800">
                                                            {RETURN_HISTORY_ACTION_LABELS[event.action]}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {formatDateTime(event.createdAt)}
                                                            {event.origin === "anymarket_webhook"
                                                                ? " · AnyMarket"
                                                                : event.createdByEmail ? ` · ${event.createdByEmail}` : ""}
                                                        </p>
                                                        {event.note && (
                                                            <p className="text-sm text-gray-600 mt-1">{event.note}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
}
