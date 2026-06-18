"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { AlertCircle, Building2, CheckCircle2, LogIn, LogOut, RefreshCw, ShieldCheck, ShoppingBag } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";

interface TrayStatus {
    provider: "tray";
    enabled: boolean;
    status: "connected" | "disconnected" | "error";
    storeId?: string | null;
    sellerId?: string | null;
    apiBaseUrl?: string | null;
    tokenExpiresAt?: string | null;
    lastSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    lastSyncStatus?: "none" | "running" | "success" | "error";
    lastSyncError?: string | null;
    lastSyncCreated?: number;
    lastSyncUpdated?: number;
    lastSyncSkipped?: number;
    lastSyncErrors?: number;
    syncProgress?: number;
    totalOrders?: number;
}

interface AccountOption {
    id: string;
    name: string;
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export default function TrayIntegrationPage() {
    const { user, loading, userData } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showAlert, showConfirm } = useUI();

    const [status, setStatus] = useState<TrayStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");

    const isSuperadmin = userData?.role === "superadmin" || userData?.isAdmin === true;
    const canAccessTray = isSuperadmin || userData?.role === "account_admin";

    const fetchStatus = useCallback(async () => {
        if (!user) return;

        try {
            const idToken = await user.getIdToken();
            const url = selectedAccountId
                ? `/api/integrations/tray/status?accountId=${selectedAccountId}`
                : "/api/integrations/tray/status";

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${idToken}` },
            });

            if (res.ok) {
                setStatus(await res.json());
            } else {
                setStatus({ provider: "tray", enabled: false, status: "disconnected" });
            }
        } catch (error) {
            console.error("Erro ao buscar status Tray:", error);
            setStatus({ provider: "tray", enabled: false, status: "error" });
        } finally {
            setIsLoadingStatus(false);
        }
    }, [selectedAccountId, user]);

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        if (!canAccessTray) {
            router.push("/dashboard");
            return;
        }

        fetchStatus();
    }, [canAccessTray, fetchStatus, loading, router, user]);

    useEffect(() => {
        const trayStatus = searchParams.get("tray_status");
        if (trayStatus === "success") {
            showAlert("Sucesso", "Conta Tray conectada com sucesso!", "success");
            window.history.replaceState({}, "", window.location.pathname);
        } else if (trayStatus === "error" || trayStatus === "invalid_params") {
            showAlert("Erro", "Falha ao conectar conta Tray.", "error");
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [searchParams, showAlert]);

    useEffect(() => {
        if (!isSuperadmin || !user) return;

        const fetchAccounts = async () => {
            try {
                const q = query(collection(db, "accounts"), orderBy("name"));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || "Sem Nome",
                }));

                setAccounts(list);
                if (list.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(list[0].id);
                }
            } catch (error) {
                console.error("Erro ao buscar contas:", error);
            }
        };

        fetchAccounts();
    }, [isSuperadmin, selectedAccountId, user]);

    useEffect(() => {
        if (user && canAccessTray) {
            fetchStatus();
        }
    }, [canAccessTray, fetchStatus, selectedAccountId, user]);

    const handleConnect = async () => {
        if (isSuperadmin && !selectedAccountId) {
            showAlert("Aviso", "Selecione uma conta para conectar a Tray.", "warning");
            return;
        }

        setIsConnecting(true);
        try {
            const idToken = await user!.getIdToken();
            const url = selectedAccountId
                ? `/api/integrations/tray/auth?accountId=${selectedAccountId}`
                : "/api/integrations/tray/auth";

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${idToken}` },
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erro ao iniciar conexao com a Tray.");
            if (data.url) window.location.href = data.url;
        } catch (error: unknown) {
            showAlert("Erro", getErrorMessage(error, "Falha ao conectar Tray."), "error");
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        showConfirm(
            "Desconectar Tray",
            "Tem certeza que deseja remover a conexao com a Tray? As vendas ja importadas serao mantidas.",
            async () => {
                setIsDisconnecting(true);
                try {
                    const idToken = await user!.getIdToken();
                    const url = selectedAccountId
                        ? `/api/integrations/tray/disconnect?accountId=${selectedAccountId}`
                        : "/api/integrations/tray/disconnect";

                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${idToken}` },
                    });
                    const data = await res.json().catch(() => ({}));

                    if (!res.ok) throw new Error(data.error || "Erro ao desconectar Tray.");

                    showAlert("Sucesso", "Tray desconectada com sucesso.", "success");
                    setStatus({ provider: "tray", enabled: false, status: "disconnected" });
                    fetchStatus();
                } catch (error: unknown) {
                    showAlert("Erro", getErrorMessage(error, "Falha ao desconectar Tray."), "error");
                } finally {
                    setIsDisconnecting(false);
                }
            },
            "Sim, desconectar",
            "Cancelar"
        );
    };

    const handleSyncSales = async () => {
        if (!isSuperadmin) return;
        if (!selectedAccountId) {
            showAlert("Aviso", "Selecione uma conta para carregar as vendas.", "warning");
            return;
        }

        showConfirm(
            "Carregar vendas Tray",
            "Isso buscara os pedidos dos ultimos 90 dias e somara as vendas nas ferramentas de reposicao. Deseja continuar?",
            async () => {
                setIsSyncing(true);
                try {
                    const idToken = await user!.getIdToken();
                    const res = await fetch("/api/integrations/tray/sync-sales-90-days", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${idToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ accountId: selectedAccountId }),
                    });
                    const data = await res.json();

                    if (!res.ok || !data.success) {
                        throw new Error(data.error || "Erro ao carregar vendas Tray.");
                    }

                    showAlert(
                        "Sucesso",
                        `Vendas Tray carregadas: ${data.created} criadas, ${data.updated} atualizadas e ${data.skipped} ignoradas.`,
                        "success"
                    );
                    fetchStatus();
                } catch (error: unknown) {
                    showAlert("Erro", getErrorMessage(error, "Falha ao carregar vendas Tray."), "error");
                } finally {
                    setIsSyncing(false);
                }
            },
            "Carregar vendas",
            "Cancelar"
        );
    };

    if (loading || isLoadingStatus) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)] overflow-hidden">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d3277]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Integracao Tray</h1>
                {status?.enabled && status.status === "connected" && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        Conectado
                    </div>
                )}
            </div>

            {isSuperadmin && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#2d3277]" />
                        Conta Cliente
                    </h2>
                    <div className="max-w-md">
                        <select
                            value={selectedAccountId}
                            onChange={(event) => setSelectedAccountId(event.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2d3277] focus:border-[#2d3277] outline-none"
                        >
                            <option value="" disabled>Selecione uma conta...</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>{account.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    {status?.enabled ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <LogIn className="w-5 h-5 text-[#2d3277]" />}
                    Status da Conexao
                </h2>

                {status?.enabled ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center shadow-sm">
                                <ShoppingBag className="w-6 h-6 text-[#2d3277]" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Conta Tray conectada</p>
                                <div className="text-xs text-gray-500 mt-1 space-y-1">
                                    <p>Loja: {status.storeId || "Nao informada"}</p>
                                    <p>Base API: {status.apiBaseUrl || "Padrao da integracao"}</p>
                                    <p>Ultima sincronizacao: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString("pt-BR") : "Ainda nao ocorreu"}</p>
                                    {(status.lastSyncCreated || status.lastSyncUpdated || status.lastSyncSkipped) ? (
                                        <p>Ultima carga: {status.lastSyncCreated || 0} criadas, {status.lastSyncUpdated || 0} atualizadas, {status.lastSyncSkipped || 0} ignoradas</p>
                                    ) : null}
                                    {status.lastSyncStatus === "error" && status.lastSyncError && (
                                        <p className="text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {status.lastSyncError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <LogOut className="w-4 h-4" />
                            {isDisconnecting ? "Desconectando..." : "Desconectar"}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-200">
                            <ShoppingBag className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Conecte sua loja Tray</h3>
                        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                            Nesta primeira etapa, a Tray sera usada como fonte de pedidos e vendas para alimentar as ferramentas de reposicao.
                        </p>
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting || (isSuperadmin && !selectedAccountId)}
                            className="px-6 py-2.5 bg-[#2d3277] text-white font-medium rounded-lg hover:bg-[#2d3277]/90 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2 mx-auto"
                        >
                            <LogIn className="w-5 h-5" />
                            {isConnecting ? "Redirecionando..." : "Conectar Tray"}
                        </button>
                    </div>
                )}
            </div>

            {isSuperadmin && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <RefreshCw className={`w-5 h-5 text-[#2d3277] ${status?.lastSyncStatus === "running" ? "animate-spin" : ""}`} />
                        Vendas
                    </h2>

                    <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="font-medium text-gray-800">Carregar vendas dos ultimos 90 dias</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Os pedidos Tray serao consolidados no historico usado pela reposicao, somando com integracoes ja conectadas.
                                </p>
                            </div>
                            <button
                                onClick={handleSyncSales}
                                disabled={isSyncing || status?.lastSyncStatus === "running" || !status?.enabled || !selectedAccountId}
                                className="w-full sm:w-auto px-5 py-2 bg-[#2d3277] text-white font-medium rounded-lg hover:bg-[#2d3277]/90 disabled:opacity-50 transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${isSyncing || status?.lastSyncStatus === "running" ? "animate-spin" : ""}`} />
                                {isSyncing || status?.lastSyncStatus === "running" ? "Carregando..." : "Carregar vendas dos ultimos 90 dias"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
