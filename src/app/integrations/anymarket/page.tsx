"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useUI } from "@/lib/ui-context";
import { Key, RefreshCw, CheckCircle2, Trash2, ShieldCheck, AlertCircle, Building2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface IntegrationStatus {
    enabled: boolean;
    tokenLast4?: string;
    lastInitialSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    lastSyncStatus?: 'none' | 'running' | 'success' | 'error';
    lastSyncError?: string | null;
    syncProgress?: number;
    syncOffset?: number;
    totalOrders?: number;
}

export default function AnymarketIntegrationPage() {
    const { user, loading, userData } = useAuth();
    const router = useRouter();
    const { showAlert, showConfirm } = useUI();

    const [token, setToken] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [status, setStatus] = useState<IntegrationStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    
    // Para cálculo de estimativa (ETA)
    const [syncStartTime, setSyncStartTime] = useState<number | null>(null);
    const [startProgress, setStartProgress] = useState<number>(0);
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
    
    // Para Superadmin: Lista de contas e conta selecionada
    const [accounts, setAccounts] = useState<{ id: string, name: string }[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");

    const fetchStatus = useCallback(async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const url = selectedAccountId 
                ? `/api/integrations/anymarket/status?accountId=${selectedAccountId}`
                : "/api/integrations/anymarket/status";
                
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);

                // Lógica de cálculo de ETA
                if (data.lastSyncStatus === 'running') {
                    if (syncStartTime === null || data.syncOffset === 0) {
                        setSyncStartTime(Date.now());
                        setStartProgress(data.syncOffset || 0);
                    } else if (data.syncOffset > startProgress) {
                        const elapsedMs = Date.now() - syncStartTime;
                        const processedSinceStart = data.syncOffset - startProgress;
                        const remaining = (data.totalOrders || 0) - (data.syncOffset || 0);
                        
                        if (processedSinceStart > 0 && remaining > 0) {
                            const msPerOrder = elapsedMs / processedSinceStart;
                            const remainingMs = remaining * msPerOrder;
                            
                            // Formata o tempo restante
                            const hours = Math.floor(remainingMs / 3600000);
                            const minutes = Math.floor((remainingMs % 3600000) / 60000);
                            const seconds = Math.floor((remainingMs % 60000) / 1000);
                            
                            if (hours > 0) {
                                setEstimatedTimeRemaining(`~${hours}h ${minutes}m`);
                            } else if (minutes > 0) {
                                setEstimatedTimeRemaining(`~${minutes}m ${seconds}s`);
                            } else {
                                setEstimatedTimeRemaining(`~${seconds}s`);
                            }
                        }
                    }
                } else {
                    setSyncStartTime(null);
                    setEstimatedTimeRemaining(null);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar status:", error);
        } finally {
            setIsLoadingStatus(false);
        }
    }, [user, syncStartTime, startProgress, selectedAccountId]);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (userData?.role !== 'superadmin' && userData?.role !== 'account_admin') {
                router.push("/dashboard");
            } else {
                fetchStatus();
            }
        }
    }, [user, loading, router, userData, fetchStatus]);

    // Carregar contas para superadmin
    useEffect(() => {
        if (userData?.role === 'superadmin' && user) {
            const fetchAccounts = async () => {
                try {
                    const q = query(collection(db, "accounts"), orderBy("name"));
                    const snapshot = await getDocs(q);
                    const accountsList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        name: doc.data().name || "Sem Nome"
                    }));
                    setAccounts(accountsList);
                    
                    // Se tiver contas e nenhuma selecionada, seleciona a primeira
                    if (accountsList.length > 0 && !selectedAccountId) {
                        setSelectedAccountId(accountsList[0].id);
                    }
                } catch (err) {
                    console.error("Erro ao buscar contas:", err);
                }
            };
            fetchAccounts();
        }
    }, [userData, user]);

    // Polling effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status?.lastSyncStatus === 'running') {
            interval = setInterval(() => {
                fetchStatus();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status?.lastSyncStatus, fetchStatus]);

    const handleSaveToken = async () => {
        if (!token.trim()) return showAlert("Erro", "Insira o token primeiro.", "error");

        setIsSaving(true);
        try {
            const idToken = await user!.getIdToken();
            const res = await fetch("/api/integrations/anymarket/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({ token })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao salvar token");

            showAlert("Sucesso", "Token salvo com sucesso!", "success");
            setToken("");
            fetchStatus();
        } catch (error: any) {
            showAlert("Erro", error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleValidateToken = async () => {
        setIsValidating(true);
        try {
            const idToken = await user!.getIdToken();
            const res = await fetch("/api/integrations/anymarket/validate", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${idToken}`
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro na validação");

            if (data.valid) {
                showAlert("Sucesso", "A conexão com a Anymarket está funcionando!", "success");
            } else {
                showAlert("Aviso", "A conexão falhou. Verifique se o token é válido.", "warning");
            }
        } catch (error: any) {
            showAlert("Erro", error.message, "error");
        } finally {
            setIsValidating(false);
        }
    };

    const handleInitialSync = async () => {
        showConfirm("Carga Inicial", "Isso fará o download das vendas dos últimos 15 dias. Deseja continuar?", async () => {
            setIsSyncing(true);
            try {
                const idToken = await user!.getIdToken();
                const res = await fetch("/api/integrations/anymarket/initial-sync", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ accountId: selectedAccountId })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro ao iniciar sync");

                showAlert("Sucesso", "A sincronização foi iniciada. Os dados aparecerão na ferramenta em breve.", "success");
                fetchStatus();
            } catch (error: any) {
                showAlert("Erro", error.message, "error");
            } finally {
                setIsSyncing(false);
            }
        });
    };

    const handleResetSync = async () => {
        showConfirm("Interromper Sincronização", "Deseja forçar a interrupção da sincronização atual? Isso não apagará os dados já importados.", async () => {
            try {
                const idToken = await user!.getIdToken();
                const res = await fetch("/api/integrations/anymarket/reset-sync", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${idToken}`
                    }
                });

                if (!res.ok) throw new Error("Erro ao interromper");

                showAlert("Sucesso", "Status resetado com sucesso.", "success");
                fetchStatus();
            } catch (error: any) {
                showAlert("Erro", error.message, "error");
            }
        });
    };

    const handleDeleteToken = async () => {
        showConfirm("Desconectar Integração", "Tem certeza que deseja remover o token e desativar a integração da Anymarket?", async () => {
            setIsDeleting(true);
            try {
                const idToken = await user!.getIdToken();
                const res = await fetch("/api/integrations/anymarket/token", {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${idToken}`
                    }
                });

                if (!res.ok) throw new Error("Erro ao remover integração");

                showAlert("Sucesso", "Integração removida com sucesso.", "success");
                setStatus({ enabled: false });
            } catch (error: any) {
                showAlert("Erro", error.message, "error");
            } finally {
                setIsDeleting(false);
            }
        });
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
                <h1 className="text-2xl font-bold text-gray-900">Integração Anymarket</h1>
                {status?.enabled && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        Conectado
                    </div>
                )}
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-[#2d3277]" />
                    Configuração de Token
                </h2>
                
                {status?.enabled ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                                <Key className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700">Token cadastrado</p>
                                <p className="text-xs text-gray-500">Final: ****{status.tokenLast4}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button 
                                onClick={() => setStatus({ ...status, enabled: false })}
                                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-[#2d3277] hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Alterar Token
                            </button>
                            <button 
                                onClick={handleDeleteToken}
                                disabled={isDeleting}
                                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {isDeleting ? "Removendo..." : "Desconectar"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-600 mb-4">
                            Insira o seu <strong>gumgaToken</strong> da Anymarket para permitir que o sistema sincronize suas vendas automaticamente.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <input 
                                type="password" 
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Cole aqui seu token da Anymarket..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3277] focus:border-[#2d3277] outline-none"
                            />
                            <button 
                                onClick={handleSaveToken}
                                disabled={isSaving}
                                className="px-6 py-2 bg-[#2d3277] text-white font-medium rounded-lg hover:bg-[#2d3277]/90 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isSaving ? "Salvando..." : "Salvar Token"}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-[#2d3277]" />
                    Ações de Sincronização
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg flex flex-col gap-3">
                        <h3 className="font-medium text-gray-800 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" /> Testar Conexão
                        </h3>
                        <p className="text-xs text-gray-500 flex-1">
                            Valida se o token cadastrado atual tem acesso correto à API da Anymarket.
                        </p>
                        <button 
                            onClick={handleValidateToken}
                            disabled={isValidating || !status?.enabled}
                            className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm"
                        >
                            {isValidating ? "Testando..." : "Testar Conexão"}
                        </button>
                    </div>

                    {userData?.role === 'superadmin' && (
                        <div className="p-4 border border-gray-200 rounded-lg flex flex-col gap-3">
                            <h3 className="font-medium text-gray-800 flex items-center gap-2">
                                <RefreshCw className={`w-4 h-4 text-[#2d3277] ${status?.lastSyncStatus === 'running' ? 'animate-spin' : ''}`} /> Carga Inicial
                            </h3>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-3">
                                    Sincroniza os pedidos dos últimos 90 dias para a conta selecionada.
                                </p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Escolher Conta</label>
                                        <div className="relative">
                                            <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <select 
                                                value={selectedAccountId}
                                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2d3277] focus:border-[#2d3277] outline-none appearance-none"
                                            >
                                                <option value="" disabled>Selecione uma conta...</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {status?.lastSyncStatus === 'running' && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span>Processando pedidos...</span>
                                                    <button 
                                                        onClick={handleResetSync}
                                                        className="text-red-500 hover:underline font-semibold"
                                                    >
                                                        (Interromper)
                                                    </button>
                                                </div>
                                                <span>{status.syncProgress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="bg-[#2d3277] h-full transition-all duration-500" 
                                                    style={{ width: `${status.syncProgress}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                                                <span>Total estimado: {status.totalOrders?.toLocaleString('pt-BR')} pedidos</span>
                                                {status.syncOffset === 0 ? (
                                                    <span className="font-medium text-[#2d3277] animate-pulse">Iniciando...</span>
                                                ) : estimatedTimeRemaining ? (
                                                    <span className="font-medium text-[#2d3277]">Restam: {estimatedTimeRemaining}</span>
                                                ) : (
                                                    <span className="font-medium text-[#2d3277]">Calculando tempo...</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {status?.lastSuccessfulSyncAt && status?.lastSyncStatus !== 'running' && (
                                        <p className="text-[10px] text-green-600 mt-1">
                                            Último sucesso: {new Date(status.lastSuccessfulSyncAt).toLocaleString('pt-BR')}
                                        </p>
                                    )}
                                    {status?.lastSyncStatus === 'error' && (
                                        <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Erro: {status.lastSyncError}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={handleInitialSync}
                                disabled={isSyncing || !selectedAccountId || status?.lastSyncStatus === 'running'}
                                className="w-full py-2 bg-[#2d3277] text-white font-medium rounded-lg hover:bg-[#2d3277]/90 disabled:opacity-50 transition-colors text-sm shadow-sm"
                            >
                                {isSyncing || status?.lastSyncStatus === 'running' ? "Sincronizando..." : "Carga Inicial (90 dias)"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
