"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";
import { Search, Package, ChevronLeft, ChevronRight, Upload, Download, Pencil, X } from "lucide-react";
import { utils, writeFile } from "xlsx";
import { parseCadastrosExcel } from "@/app/reposicao-full/excel-utils";

type MarketplaceKey = "mercadolivre" | "shopee";

interface MarketplaceItemConfig {
    ativo: boolean;
    motivoInativo?: string;
    inativoDesde?: string;
    diasEstoqueDesejado?: number;
}

interface MarketplaceConfig {
    mercadolivre: MarketplaceItemConfig;
    shopee: MarketplaceItemConfig;
}

interface Produto {
    sku: string;
    ean: string;
    descricao: string;
    mlb: string;
    mlbCatalogo: string;
    shopeeItemId: string;
    shopeeModelId: string;
    marca: string;
    fornecedor: string;
    estoqueFull: number;
    estoqueEmpresa: number;
    precoAtual: number;
    custoAtual: number;
    tamanhoCaixa: number;
    emTransf: number;
    marketplaceConfig: MarketplaceConfig;
}

interface CadastroUpdate {
    sku: string;
    marca?: string;
    fornecedor?: string;
    tamanhoCaixa?: number;
}

interface UploadResult {
    error?: string;
    totalUpdated: number;
    totalEncontrados: number;
    totalPlanilha: number;
}

interface ProductsResult {
    products?: Produto[];
    error?: string;
}

const PAGE_SIZE = 25;
const MOTIVOS_INATIVO = ["Baixo Giro", "Fora de Linha", "Bloqueado Indústria", "Bloqueado Marketplace"];

function getDefaultMarketplaceConfig(): MarketplaceConfig {
    return {
        mercadolivre: { ativo: true },
        shopee: { ativo: true },
    };
}

function normalizeProductForEdit(produto: Produto): Produto {
    return {
        ...produto,
        shopeeItemId: produto.shopeeItemId || "",
        shopeeModelId: produto.shopeeModelId || "",
        estoqueFull: Number(produto.estoqueFull) || 0,
        estoqueEmpresa: Number(produto.estoqueEmpresa) || 0,
        precoAtual: Number(produto.precoAtual) || 0,
        custoAtual: Number(produto.custoAtual) || 0,
        tamanhoCaixa: Number(produto.tamanhoCaixa) || 1,
        emTransf: Number(produto.emTransf) || 0,
        marketplaceConfig: {
            ...getDefaultMarketplaceConfig(),
            ...(produto.marketplaceConfig || {}),
            mercadolivre: {
                ativo: produto.marketplaceConfig?.mercadolivre?.ativo !== false,
                motivoInativo: produto.marketplaceConfig?.mercadolivre?.motivoInativo || "",
                inativoDesde: produto.marketplaceConfig?.mercadolivre?.inativoDesde,
                diasEstoqueDesejado: produto.marketplaceConfig?.mercadolivre?.diasEstoqueDesejado,
            },
            shopee: {
                ativo: produto.marketplaceConfig?.shopee?.ativo !== false,
                motivoInativo: produto.marketplaceConfig?.shopee?.motivoInativo || "",
                inativoDesde: produto.marketplaceConfig?.shopee?.inativoDesde,
                diasEstoqueDesejado: produto.marketplaceConfig?.shopee?.diasEstoqueDesejado,
            },
        },
    };
}

export default function CadastrosPage() {
    const { user, loading } = useAuth();
    const { showAlert } = useUI();
    const router = useRouter();

    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [page, setPage] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) return;

        const loadProducts = async () => {
            setIsLoading(true);
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/cadastros/products", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const result = await res.json() as ProductsResult;

                if (!res.ok) {
                    throw new Error(result.error || "Erro ao buscar produtos");
                }

                if (Array.isArray(result.products)) {
                    setProdutos(result.products.map(normalizeProductForEdit));
                    setIsLoading(false);
                    return;
                }
            } catch (e) {
                console.error("Failed to load products for cadastros from API", e);
            }

            try {
                const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
                if (stored) {
                    const data = JSON.parse(stored) as { produtosRaw?: Produto[] };
                    if (data.produtosRaw && Array.isArray(data.produtosRaw)) {
                        setProdutos(data.produtosRaw.map(normalizeProductForEdit));
                    }
                }
            } catch (e) {
                console.error("Failed to load products for cadastros from localStorage", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadProducts();
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

            const result = await res.json() as UploadResult;

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

            const dataMap = new Map<string, CadastroUpdate>(data.map((d) => [d.sku, d]));
            setProdutos((prev) => prev.map((p) => {
                const newData = dataMap.get(p.sku);
                if (!newData) return p;
                return {
                    ...p,
                    marca: newData.marca !== undefined ? newData.marca : p.marca,
                    fornecedor: newData.fornecedor !== undefined ? newData.fornecedor : p.fornecedor,
                    tamanhoCaixa: newData.tamanhoCaixa !== undefined ? newData.tamanhoCaixa : p.tamanhoCaixa
                };
            }));
            
            // Update local state and localStorage for immediate feedback
            const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
            if (stored) {
                const parsedStored = JSON.parse(stored) as { produtosRaw?: Produto[] };
                if (parsedStored.produtosRaw && Array.isArray(parsedStored.produtosRaw)) {
                    const updatedProdutos = parsedStored.produtosRaw.map((p) => {
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

        } catch (err: unknown) {
            showAlert("Erro", err instanceof Error ? err.message : "Falha ao processar arquivo", "error");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const updateEditingProduct = (updates: Partial<Produto>) => {
        setEditingProduct((prev) => prev ? { ...prev, ...updates } : prev);
    };

    const updateMarketplaceConfig = (marketplace: MarketplaceKey, updates: Partial<MarketplaceItemConfig>) => {
        setEditingProduct((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                marketplaceConfig: {
                    ...prev.marketplaceConfig,
                    [marketplace]: {
                        ...prev.marketplaceConfig[marketplace],
                        ...updates,
                    },
                },
            };
        });
    };

    const handleSaveProduct = async () => {
        if (!editingProduct || !user) return;

        setIsSavingProduct(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/cadastros/products", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    sku: editingProduct.sku,
                    ean: editingProduct.ean,
                    descricao: editingProduct.descricao,
                    mlb: editingProduct.mlb,
                    mlbCatalogo: editingProduct.mlbCatalogo,
                    shopeeItemId: editingProduct.shopeeItemId,
                    shopeeModelId: editingProduct.shopeeModelId,
                    marca: editingProduct.marca,
                    fornecedor: editingProduct.fornecedor,
                    estoqueFull: editingProduct.estoqueFull,
                    estoqueEmpresa: editingProduct.estoqueEmpresa,
                    precoAtual: editingProduct.precoAtual,
                    custoAtual: editingProduct.custoAtual,
                    tamanhoCaixa: editingProduct.tamanhoCaixa,
                    emTransf: editingProduct.emTransf,
                    marketplaceConfig: {
                        mercadolivre: {
                            ...editingProduct.marketplaceConfig.mercadolivre,
                            diasEstoqueDesejado: editingProduct.marketplaceConfig.mercadolivre.diasEstoqueDesejado ?? null,
                        },
                        shopee: {
                            ...editingProduct.marketplaceConfig.shopee,
                            diasEstoqueDesejado: editingProduct.marketplaceConfig.shopee.diasEstoqueDesejado ?? null,
                        },
                    },
                }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erro ao salvar produto");

            const normalized = normalizeProductForEdit(editingProduct);
            setProdutos((prev) => prev.map((p) => p.sku === normalized.sku ? normalized : p));
            setEditingProduct(null);
            showAlert("Sucesso", "Produto atualizado com sucesso.", "success");
        } catch (error) {
            showAlert("Erro", error instanceof Error ? error.message : "Erro ao salvar produto", "error");
        } finally {
            setIsSavingProduct(false);
        }
    };

    const filtered = useMemo(() => {
        if (!busca.trim()) return produtos;
        const q = busca.toLowerCase();
        return produtos.filter(p =>
            p.sku.toLowerCase().includes(q) ||
            (p.ean || "").toLowerCase().includes(q) ||
            p.descricao.toLowerCase().includes(q) ||
            (p.mlb || "").toLowerCase().includes(q) ||
            (p.shopeeItemId || "").toLowerCase().includes(q) ||
            (p.shopeeModelId || "").toLowerCase().includes(q) ||
            (p.fornecedor || "").toLowerCase().includes(q) ||
            (p.marca || "").toLowerCase().includes(q)
        );
    }, [produtos, busca]);

    const handleExportExcel = () => {
        if (filtered.length === 0) {
            showAlert("Aviso", "Nenhum cadastro para exportar.", "warning");
            return;
        }

        const exportData = filtered.map((p) => ({
            "SKU": p.sku,
            "EAN": p.ean || "",
            "Descricao": p.descricao,
            "MLB": p.mlb || "",
            "MLB Catalogo": p.mlbCatalogo || "",
            "Shopee Item ID": p.shopeeItemId || "",
            "Shopee Model ID": p.shopeeModelId || "",
            "Marca": p.marca || "",
            "Fornecedor": p.fornecedor || "",
            "Estoque Full": p.estoqueFull ?? 0,
            "Estoque Empresa": p.estoqueEmpresa ?? 0,
            "Preco Atual": p.precoAtual ?? 0,
            "Custo Atual": p.custoAtual ?? 0,
            "Tamanho Caixa": p.tamanhoCaixa ?? 0,
            "Em Transferencia": p.emTransf ?? 0,
            "Status Mercado Livre": p.marketplaceConfig.mercadolivre.ativo ? "Ativo" : "Inativo",
            "Motivo ML": p.marketplaceConfig.mercadolivre.motivoInativo || "",
            "Dias Desejados ML": p.marketplaceConfig.mercadolivre.diasEstoqueDesejado ?? "",
            "Status Shopee": p.marketplaceConfig.shopee.ativo ? "Ativo" : "Inativo",
            "Motivo Shopee": p.marketplaceConfig.shopee.motivoInativo || "",
            "Dias Desejados Shopee": p.marketplaceConfig.shopee.diasEstoqueDesejado ?? "",
        }));

        const ws = utils.json_to_sheet(exportData);
        ws["!cols"] = [
            { wch: 18 },
            { wch: 18 },
            { wch: 60 },
            { wch: 18 },
            { wch: 18 },
            { wch: 24 },
            { wch: 28 },
            { wch: 16 },
            { wch: 16 },
            { wch: 18 },
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Cadastros");

        const date = new Date().toISOString().slice(0, 10);
        writeFile(wb, `cadastros_${date}.xlsx`);
    };

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
                        className="flex items-center gap-2 px-4 py-2 bg-[#2d3277] text-white rounded-lg hover:bg-[#252963] transition-colors disabled:opacity-50 font-medium text-sm"
                    >
                        {isUploading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        Atualizar via Excel
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={filtered.length === 0}
                        title={busca.trim() ? "Exportar cadastros filtrados" : "Exportar todos os cadastros"}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Excel
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
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">EAN</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Descrição</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">MLB</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">MLB Catálogo</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Marca</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Fornecedor</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">ML</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Shopee</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Est. Empresa</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Tam. Caixa</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {paginated.map((p) => (
                                        <tr key={p.sku} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-medium text-[#2d3277]">{p.sku}</td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.ean || "â€”"}</td>
                                            <td className="px-4 py-3 text-gray-700 max-w-[300px] truncate" title={p.descricao}>{p.descricao}</td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.mlb || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.mlbCatalogo || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600">{p.marca || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600">{p.fornecedor || "—"}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[11px] font-semibold ${p.marketplaceConfig.mercadolivre.ativo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                                    {p.marketplaceConfig.mercadolivre.ativo ? "Ativo" : "Inativo"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[11px] font-semibold ${p.marketplaceConfig.shopee.ativo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                                    {p.marketplaceConfig.shopee.ativo ? "Ativo" : "Inativo"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800">{p.estoqueEmpresa}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800">{p.tamanhoCaixa}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setEditingProduct(normalizeProductForEdit(p))}
                                                    title="Editar produto"
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-[#2d3277] hover:bg-[#2d3277]/10 transition-colors cursor-pointer"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </td>
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

            {editingProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Editar Produto</h3>
                                <p className="text-xs font-mono text-[#2d3277] mt-1">{editingProduct.sku}</p>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <section>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Dados Gerais</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">EAN</span>
                                        <input value={editingProduct.ean || ""} onChange={(e) => updateEditingProduct({ ean: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block md:col-span-2">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</span>
                                        <input value={editingProduct.descricao || ""} onChange={(e) => updateEditingProduct({ descricao: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">MLB</span>
                                        <input value={editingProduct.mlb || ""} onChange={(e) => updateEditingProduct({ mlb: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">MLB Catálogo</span>
                                        <input value={editingProduct.mlbCatalogo || ""} onChange={(e) => updateEditingProduct({ mlbCatalogo: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Shopee Item ID</span>
                                        <input value={editingProduct.shopeeItemId || ""} onChange={(e) => updateEditingProduct({ shopeeItemId: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Shopee Model ID</span>
                                        <input value={editingProduct.shopeeModelId || ""} onChange={(e) => updateEditingProduct({ shopeeModelId: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Marca</span>
                                        <input value={editingProduct.marca || ""} onChange={(e) => updateEditingProduct({ marca: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor</span>
                                        <input value={editingProduct.fornecedor || ""} onChange={(e) => updateEditingProduct({ fornecedor: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                </div>
                            </section>

                            <section>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Estoque e Valores</h4>
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Est. Full</span>
                                        <input type="number" value={editingProduct.estoqueFull} onChange={(e) => updateEditingProduct({ estoqueFull: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Est. Empresa</span>
                                        <input type="number" value={editingProduct.estoqueEmpresa} onChange={(e) => updateEditingProduct({ estoqueEmpresa: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Em Transferência</span>
                                        <input type="number" value={editingProduct.emTransf} onChange={(e) => updateEditingProduct({ emTransf: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Tam. Caixa</span>
                                        <input type="number" min="1" value={editingProduct.tamanhoCaixa} onChange={(e) => updateEditingProduct({ tamanhoCaixa: Math.max(1, Number(e.target.value) || 1) })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Atual</span>
                                        <input type="number" step="0.01" value={editingProduct.precoAtual} onChange={(e) => updateEditingProduct({ precoAtual: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                    <label className="block">
                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Custo Atual</span>
                                        <input type="number" step="0.01" value={editingProduct.custoAtual} onChange={(e) => updateEditingProduct({ custoAtual: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                                    </label>
                                </div>
                            </section>

                            <section>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Configurações por Plataforma</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(["mercadolivre", "shopee"] as MarketplaceKey[]).map((marketplace) => {
                                        const config = editingProduct.marketplaceConfig[marketplace];
                                        const title = marketplace === "mercadolivre" ? "Mercado Livre" : "Shopee";
                                        return (
                                            <div key={marketplace} className="border border-gray-100 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h5 className="text-sm font-bold text-gray-800">{title}</h5>
                                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={config.ativo}
                                                            onChange={(e) => updateMarketplaceConfig(marketplace, {
                                                                ativo: e.target.checked,
                                                                motivoInativo: e.target.checked ? "" : config.motivoInativo,
                                                                inativoDesde: e.target.checked ? undefined : (config.inativoDesde || new Date().toISOString()),
                                                            })}
                                                            className="w-4 h-4 text-[#2d3277] border-gray-300 rounded"
                                                        />
                                                        Ativo
                                                    </label>
                                                </div>
                                                {!config.ativo && (
                                                    <label className="block mb-4">
                                                        <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo da Inativação</span>
                                                        <select
                                                            value={config.motivoInativo || ""}
                                                            onChange={(e) => updateMarketplaceConfig(marketplace, { motivoInativo: e.target.value })}
                                                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                                                        >
                                                            <option value="">-- Selecione o motivo --</option>
                                                            {MOTIVOS_INATIVO.map((motivo) => (
                                                                <option key={motivo} value={motivo}>{motivo}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                )}
                                                <label className="block">
                                                    <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Dias de Estoque Desejado</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Usar padrão global"
                                                        value={config.diasEstoqueDesejado ?? ""}
                                                        onChange={(e) => updateMarketplaceConfig(marketplace, { diasEstoqueDesejado: e.target.value === "" ? undefined : Number(e.target.value) })}
                                                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                                                    />
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setEditingProduct(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                Cancelar
                            </button>
                            <button onClick={handleSaveProduct} disabled={isSavingProduct} className="px-4 py-2 text-sm font-medium text-white bg-[#2d3277] rounded-lg hover:bg-[#2d3277]/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50">
                                {isSavingProduct ? "Salvando..." : "Salvar Alterações"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
