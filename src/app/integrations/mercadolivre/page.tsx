"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useUI } from "@/lib/ui-context";
import { ShieldCheck, LogIn, LogOut, CheckCircle2, Building2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface IntegrationStatus {
    status: string;
    enabled: boolean;
    mlUserId?: number;
    lastSyncAt?: number;
    expiresAt?: number;
    tokenExpired?: boolean;
}

export default function MercadoLivreIntegrationPage() {
    const { user, loading, userData } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showAlert, showConfirm } = useUI();

    const [status, setStatus] = useState<IntegrationStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    
    const [accounts, setAccounts] = useState<{ id: string, name: string }[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");

    const fetchStatus = useCallback(async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const url = selectedAccountId 
                ? `/api/integrations/mercadolivre/status?accountId=${selectedAccountId}`
                : "/api/integrations/mercadolivre/status";
                
            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            } else {
                setStatus(null);
            }
        } catch (error) {
            console.error("Erro ao buscar status:", error);
            setStatus(null);
        } finally {
            setIsLoadingStatus(false);
        }
    }, [user, selectedAccountId]);

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

    useEffect(() => {
        const mlStatus = searchParams.get("ml_status");
        if (mlStatus === "success") {
            showAlert("Sucesso", "Conta do Mercado Livre conectada com sucesso!", "success");
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        } else if (mlStatus === "error" || mlStatus === "invalid_params") {
            showAlert("Erro", "Falha ao conectar conta do Mercado Livre.", "error");
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams, showAlert]);

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

    const handleDisconnect = async () => {
        const accountId = selectedAccountId || userData?.accountId;
        if (!accountId) return;

        showConfirm(
            "Desconectar Conta", 
            "Tem certeza que deseja desconectar sua conta do Mercado Livre? A sincronização de estoque será interrompida.",
            async () => {
                try {
                    const idToken = await user!.getIdToken();
                    const url = selectedAccountId 
                        ? `/api/integrations/mercadolivre/disconnect?accountId=${selectedAccountId}`
                        : `/api/integrations/mercadolivre/disconnect`;

                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${idToken}` }
                    });

                    if (res.ok) {
                        setStatus(null);
                        showAlert("Sucesso", "Conta desconectada com sucesso.", "success");
                        fetchStatus();
                    } else {
                        const data = await res.json();
                        throw new Error(data.error || "Erro ao desconectar");
                    }
                } catch (error: any) {
                    showAlert("Erro", "Falha ao desconectar: " + error.message, "error");
                }
            },
            "Sim, Desconectar",
            "Cancelar"
        );
    };

    const handleConnect = async () => {
        const accountId = selectedAccountId || userData?.accountId;
        if (userData?.role === 'superadmin' && !selectedAccountId) {
            return showAlert("Aviso", "Selecione uma conta para conectar.", "warning");
        }

        setIsConnecting(true);
        try {
            const idToken = await user!.getIdToken();
            const url = accountId 
                ? `/api/integrations/mercadolivre/auth?accountId=${accountId}`
                : `/api/integrations/mercadolivre/auth`;

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${idToken}` }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao obter URL de autenticação");

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            showAlert("Erro", error.message, "error");
            setIsConnecting(false);
        }
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
                <h1 className="text-2xl font-bold text-gray-900">Integração Mercado Livre</h1>
                {status?.enabled && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        Conectado
                    </div>
                )}
            </div>

            {userData?.role === 'superadmin' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#2d3277]" />
                        Conta Cliente (Superadmin)
                    </h2>
                    <div className="max-w-md relative">
                        <select 
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="w-full pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2d3277] focus:border-[#2d3277] outline-none appearance-none"
                        >
                            <option value="" disabled>Selecione uma conta...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    {status?.enabled ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <LogIn className="w-5 h-5 text-[#2d3277]" />}
                    Status da Conexão
                </h2>
                
                {status?.enabled ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center p-2 shadow-sm">
                                <img src="https://logodownload.org/wp-content/uploads/2016/08/mercado-livre-logo-4.png" alt="Mercado Livre" className="w-full h-auto object-contain" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">Conta Vinculada (ID: {status.mlUserId})</p>
                                <div className="text-xs text-gray-500 mt-1 space-y-1">
                                    <p>Última Sincronização: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('pt-BR') : 'Ainda não ocorreu'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                            <button 
                                onClick={handleDisconnect}
                                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Desconectar Conta
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-200">
                            <img src="https://logodownload.org/wp-content/uploads/2016/08/mercado-livre-logo-4.png" alt="Mercado Livre" className="w-12 h-auto opacity-50 grayscale" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Conecte sua conta do Mercado Livre</h3>
                        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                            Para visualizar seu estoque do Fulfillment e estatísticas, conecte sua conta oficial do Mercado Livre de forma segura.
                        </p>
                        <button 
                            onClick={handleConnect}
                            disabled={isConnecting || (userData?.role === 'superadmin' && !selectedAccountId)}
                            className="px-6 py-2.5 bg-[#FFE600] text-gray-900 font-medium rounded-lg hover:bg-[#F3DB00] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2 mx-auto"
                        >
                            <LogIn className="w-5 h-5" />
                            {isConnecting ? "Redirecionando..." : "Conectar ao Mercado Livre"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
