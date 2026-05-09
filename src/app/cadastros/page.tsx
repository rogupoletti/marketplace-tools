"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";
import { Search, RefreshCw, Package, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { parseCadastrosExcel } from "@/app/reposicao-full/excel-utils";

interface Produto {
    sku: string;
    descricao: string;
    mlb: string;
    mlbCatalogo: string;
    marca: string;
    fornecedor: string;
    estoqueEmpresa: number;
    tamanhoCaixa: number;
    emTransf: number;
}

const PAGE_SIZE = 25;

export default function CadastrosPage() {
    const { user, loading, userData } = useAuth();
    const { showAlert } = useUI();
    const router = useRouter();

    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [page, setPage] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Load products from the reposicao state (localStorage) for now
    // Later this will come from /api/products (Firestore)
    useEffect(() => {
        if (!user) return;
        try {
            const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
            if (stored) {
                const data = JSON.parse(stored);
                if (data.produtosRaw && Array.isArray(data.produtosRaw)) {
                    setProdutos(data.produtosRaw);
                }
            }
        } catch (e) {
            console.error("Failed to load products for cadastros", e);
        }
        setIsLoading(false);
    }, [user]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { data, errors } = await parseCadastrosExcel(file);
            if (errors.length > 0) {
                showAlert("Erro", errors[0], "error");
                return;
            }

            if (data.length === 0) {
                showAlert("Aviso", "Nenhum dado válido encontrado na planilha.", "warning");
                return;
            }

            const token = await user?.getIdToken();
            if (!token) throw new Error("Usuário não autenticado");

            const res = await fetch("/api/cadastros/upload", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ items: data })
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || "Erro ao fazer upload");
            }

            const { totalUpdated, totalEncontrados, totalPlanilha } = result;

            if (totalUpdated === 0) {
                if (totalEncontrados === 0) {
                    showAlert("Aviso", `A planilha tem ${totalPlanilha} itens, mas NENHUM SKU correspondeu aos cadastrados no sistema. Verifique se a coluna SKU está correta e sem zeros a mais/menos.`, "warning");
                } else {
                    showAlert("Aviso", `${totalEncontrados} SKUs encontrados, mas nenhum possuía informações novas para atualizar (marca/forn/tam.caixa estavam vazios ou iguais).`, "warning");
                }
            } else {
                showAlert("Sucesso", `${totalUpdated} produtos atualizados com sucesso! (De ${totalEncontrados} encontrados no sistema)`, "success");
            }
            
            // Update local state and localStorage for immediate feedback
            const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
            if (stored) {
                const parsedStored = JSON.parse(stored);
                if (parsedStored.produtosRaw && Array.isArray(parsedStored.produtosRaw)) {
                    const dataMap = new Map(data.map((d: any) => [d.sku, d]));
                    const updatedProdutos = parsedStored.produtosRaw.map((p: any) => {
                        const newData = dataMap.get(p.sku);
                        if (newData) {
                            return {
                                ...p,
                                marca: newData.marca !== undefined ? newData.marca : p.marca,
                                fornecedor: newData.fornecedor !== undefined ? newData.fornecedor : p.fornecedor,
                                tamanhoCaixa: newData.tamanhoCaixa !== undefined ? newData.tamanhoCaixa : p.tamanhoCaixa
                            };
                        }
                        return p;
                    });

                    parsedStored.produtosRaw = updatedProdutos;
                    localStorage.setItem("@SellerDock:ReposicaoFull", JSON.stringify(parsedStored));
                    setProdutos(updatedProdutos);
                }
            }

        } catch (err: any) {
            showAlert("Erro", err.message || "Falha ao processar arquivo", "error");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const filtered = useMemo(() => {
        if (!busca.trim()) return produtos;
        const q = busca.toLowerCase();
        return produtos.filter(p =>
            p.sku.toLowerCase().includes(q) ||
            p.descricao.toLowerCase().includes(q) ||
            (p.mlb || "").toLowerCase().includes(q) ||
            (p.fornecedor || "").toLowerCase().includes(q) ||
            (p.marca || "").toLowerCase().includes(q)
        );
    }, [produtos, busca]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => {
        setPage(0);
    }, [busca]);

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d3277]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cadastros</h1>
                    <p className="text-gray-500 mt-1">
                        Visualize todos os produtos sincronizados da Anymarket.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium text-sm"
                    >
                        {isUploading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        Atualizar via Excel
                    </button>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
                        <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                        {produtos.length} produtos
                    </span>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por SKU, descrição, MLB, marca ou fornecedor..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d3277]/20 focus:border-[#2d3277]/40 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d3277]"></div>
                    </div>
                ) : produtos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Package className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium">Nenhum produto cadastrado</p>
                        <p className="text-sm mt-1">Importe produtos na tela de Reposição Full ou aguarde a sincronização da Anymarket.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">SKU</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Descrição</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">MLB</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">MLB Catálogo</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Marca</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Fornecedor</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Est. Empresa</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Tam. Caixa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {paginated.map((p) => (
                                        <tr key={p.sku} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-medium text-[#2d3277]">{p.sku}</td>
                                            <td className="px-4 py-3 text-gray-700 max-w-[300px] truncate" title={p.descricao}>{p.descricao}</td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.mlb || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.mlbCatalogo || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600">{p.marca || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600">{p.fornecedor || "—"}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800">{p.estoqueEmpresa}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800">{p.tamanhoCaixa}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                                <span className="text-xs text-gray-500">
                                    Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-medium text-gray-600 px-2">
                                        {page + 1} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
