"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";
import { useReposicaoState } from "./useReposicaoState";
import { UploadSection } from "./components/UploadSection";
import { SummaryCards } from "./components/SummaryCards";
import { DataTable } from "./components/DataTable";
import { Modals } from "./components/Modals";
import { Edit2, Download, Truck, Clock, RefreshCw, UploadCloud, ChevronDown } from "lucide-react";
import { parseMLBs } from "./core-logic";
import { utils, writeFile } from 'xlsx';
import { parseTransitoExcel } from "./excel-utils";

export function ReposicaoFullContent() {
    const { produtosProcessados, produtosFiltrados, selectedSkus, parametros, lastUpdate, limparTransito, fetchVendasAnymarket, fetchMlInventory, fetchProdutosDb, produtosRaw, setProdutosRaw } = useReposicaoState();
    const { user, loading, userData } = useAuth();
    const { showAlert, showConfirm } = useUI();
    const router = useRouter();

    const [editingSku, setEditingSku] = useState<string | null>(null);
    const [bulkEditParams, setBulkEditParams] = useState({ isOpen: false });
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isRemessaModalOpen, setIsRemessaModalOpen] = useState(false);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [isUploadingTransito, setIsUploadingTransito] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (userData?.role === 'subaccount_user') {
                router.push("/dashboard");
            }
        }
    }, [user, loading, router, userData]);

    const stats = useMemo(() => {
        let rupturasFull = 0;
        let alertasGiro = 0;
        let emDia = 0;
        let naoCadastrados = 0;

        // Stats should also respect filtering
        produtosFiltrados.forEach(p => {
            if (p.status === "NÃO CADASTRADO") naoCadastrados++;
            else if (p.status === "RUPTURA FULL" || p.status === "RUPTURA GERAL") rupturasFull++;
            else if (p.status === "ESTOQUE BAIXO") alertasGiro++;
            else if (p.status === "ATIVO / OK" || p.status === "ATIVO / SEM VENDAS") emDia++;
        });

        return { rupturasFull, alertasGiro, emDia, naoCadastrados };
    }, [produtosFiltrados]);

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)] overflow-hidden">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2d3277]"></div>
            </div>
        );
    }

    const handleExportCSV = () => {
        setIsExportModalOpen(true);
    };

    const formatExcelDecimal = (value: number, decimals: number) => {
        return value.toFixed(decimals).replace(".", ",");
    };

    const isInvalidMlb = (value: string) => {
        const normalized = value.trim().toUpperCase();
        return !normalized || normalized === "NULL" || normalized === "#N/D";
    };

    const getNormalMlbs = (mlb: string) => {
        return parseMLBs(mlb).filter((value) => !isInvalidMlb(value));
    };

    const getPreferredRemessaMlb = (mlbCatalogo: string, mlb: string) => {
        const catalogMlb = parseMLBs(mlbCatalogo).find((value) => !isInvalidMlb(value));
        if (catalogMlb) return catalogMlb;

        return getNormalMlbs(mlb)[0] || "";
    };

    const handleExecuteExport = (type: 'full' | 'filtered') => {
        const data = type === 'full' ? produtosProcessados : produtosFiltrados;
        if (data.length === 0) return showAlert("Aviso", "Nenhum dado para exportar.", "warning");

        const exportData = data.map(p => ({
            "Curva ABC": p.curvaABC || "Z",
            "ABC Ind.": p.curvaABCFornecedor || "Z",
            "SKU": p.sku,
            "EAN": p.ean || "",
            "Descrição": p.descricao,
            "MLB(s)": getNormalMlbs(p.mlb).join(", "),
            "Marca": p.marca,
            "Fornecedor": p.fornecedor,
            "Estoque Full": p.estoqueFull,
            "Estoque Empresa": p.estoqueEmpresa,
            "Giro Diário Qtd": formatExcelDecimal(p.giroDiarioQtd, 2),
            "Giro Diário Valor (Liq)": formatExcelDecimal(p.giroDiarioValorLiquido, 2),
            "Giro Diário Valor (Bruto)": formatExcelDecimal(p.giroDiarioValorBruto, 2),
            "Vendas Qtd": p.vendasQtdPeriodo,
            "Vendas Valor Liquido": formatExcelDecimal(p.vendasValorLiquidoPeriodo, 2),
            "Vendas Valor Bruto": formatExcelDecimal(p.vendasValorBrutoPeriodo, 2),
            "Dias Inativos": p.diasInativos,
            "Venda Perdida (Liq)": formatExcelDecimal(p.vendaPerdidaLiquida, 2),
            "Venda Perdida (Bruta)": formatExcelDecimal(p.vendaPerdidaBruta, 2),
            "Em Transferência": p.emTransf,
            "Tamanho da Caixa": p.tamanhoCaixa,
            "Nº Caixas": formatExcelDecimal(p.numCaixas, 2),
            "Dias Estoque Full": p.diasEstoqueFull > 0 ? formatExcelDecimal(p.diasEstoqueFull, 1) : 0,
            "Dias Estoque Total": p.diasEstoqueTotal > 0 ? formatExcelDecimal(p.diasEstoqueTotal, 1) : 0,
            "MLB Catálogo": p.mlbCatalogo || "",
            "Dias Desejado (Total)": p.diasDesejadoItem + (parametros?.leadTime || 7),
            "Sugestão Reposição": p.sugestaoReposicao,
            "Necessidade": p.necessidade,
            "ASP": formatExcelDecimal(p.asp, 2),
            "Mark up": formatExcelDecimal(p.markup, 2),
            "Status": p.status
        }));

        const ws = utils.json_to_sheet(exportData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Reposicao");
        writeFile(wb, "Reposicao_Full_Export.xlsx"); // Using .xlsx for better compatibility
    };

    const handleCriarRemessa = () => {
        setIsRemessaModalOpen(true);
    };

    const handleExecuteRemessa = (type: 'full' | 'filtered') => {
        const sourceData = type === 'full' ? produtosProcessados : produtosFiltrados;
        const toShip = sourceData.filter(p => p.sugestaoReposicao > 0);

        if (toShip.length === 0) return showAlert("Aviso", "Nenhum produto tem sugestão de reposição > 0.", "warning");

        const totalUnits = toShip.reduce((acc, p) => acc + p.sugestaoReposicao, 0);
        const typeLabel = type === 'full' ? 'Completa' : 'Filtrada';

        showConfirm("Criar Remessa", `Criar remessa ${typeLabel} para ${toShip.length} SKUs totalizando ${totalUnits} unidades?`, () => {
            // Header Row
            const rows: Array<Array<string | number>> = [
                ["SKU", "Cód Universal", "Código ML", "N. do Anúncio", "N. da Variação", "Qtd de unidades"]
            ];

            // Empty rows (2, 3, 4, 5)
            for (let i = 0; i < 4; i++) {
                rows.push(["", "", "", "", "", ""]);
            }

            // Data starting from row 6
            toShip.forEach(p => {
                // Use a single listing code: catalog first, then first regular MLB.
                const mlbAnuncio = getPreferredRemessaMlb(p.mlbCatalogo, p.mlb);

                rows.push([
                    p.sku,
                    "", // Cód Universal (must be blank)
                    "", // Código ML (must be blank)
                    mlbAnuncio || "", // N. do Anúncio
                    "", // N. da Variação (must be blank)
                    p.sugestaoReposicao
                ]);
            });

            const ws = utils.aoa_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Remessa");
            writeFile(wb, `remessa_full_${typeLabel.toLowerCase()}.xlsx`);
            showAlert("Sucesso", "Remessa gerada com sucesso!", "success");
        });
    };

    const handleTransitoUploadHeader = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingTransito(true);
        try {
            const { data, errors } = await parseTransitoExcel(file);
            if (errors.length > 0) {
                showAlert("Erro", errors[0], "error");
                return;
            }

            const skusNoArquivo = Object.keys(data);
            if (skusNoArquivo.length === 0) {
                showAlert("Aviso", "Nenhum dado de trânsito encontrado no arquivo.", "warning");
                return;
            }

            // Merge emTransf into produtosRaw (only emTransf is updated, nothing else)
            const updatedProdutos = produtosRaw.map(p => {
                const emTransf = data[p.sku];
                if (emTransf !== undefined) {
                    return { ...p, emTransf };
                }
                return p;
            });
            setProdutosRaw(updatedProdutos);

            const totalMatched = updatedProdutos.filter(p => data[p.sku] !== undefined).length;
            showAlert("Sucesso", `Dados de trânsito importados: ${totalMatched} SKUs atualizados de ${skusNoArquivo.length} encontrados no arquivo.`, "success");
        } catch (err: unknown) {
            showAlert("Erro", err instanceof Error ? err.message : "Erro ao processar arquivo.", "error");
        } finally {
            setIsUploadingTransito(false);
            if (e.target) e.target.value = '';
        }
    };



    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col relative text-gray-800">
            {/* Topo */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reposição Full – Mercado Livre</h1>
                    <p className="text-gray-500 mt-1">Otimize seu estoque no Full com base no giro diário e lead time.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    {selectedSkus.length > 0 && (
                        <button
                            onClick={() => setBulkEditParams({ isOpen: true })}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors cursor-pointer"
                        >
                            <Edit2 className="w-4 h-4" />
                            Editar {`(${selectedSkus.length})`}
                        </button>
                    )}

                    <div className="relative">
                        <input
                            type="file"
                            id="header-transito-upload"
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleTransitoUploadHeader}
                            disabled={isUploadingTransito}
                        />
                        <label
                            htmlFor="header-transito-upload"
                            className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors cursor-pointer ${isUploadingTransito ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {isUploadingTransito ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                            ) : (
                                <UploadCloud className="w-4 h-4" />
                            )}
                            Importar Trânsito
                        </label>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                            onBlur={() => setTimeout(() => setIsExportDropdownOpen(false), 200)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2d3277] text-white rounded-lg text-sm font-medium hover:bg-[#2d3277]/90 shadow-sm transition-colors cursor-pointer"
                        >
                            <Download className="w-4 h-4" />
                            Exportar
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isExportDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                <button
                                    onClick={() => handleExportCSV()}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar Excel
                                </button>
                                <button
                                    onClick={() => handleCriarRemessa()}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <Truck className="w-4 h-4" />
                                    Criar Remessa
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto custom-scrollbar flex flex-col pb-6 pr-2">
                <UploadSection />
                <SummaryCards />

                <div className="flex flex-1 min-h-[500px]">
                    <DataTable onEditItem={setEditingSku} />
                </div>
            </div>

            {/* Footer */}
            {produtosProcessados.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 px-6 flex items-center justify-between text-sm shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="flex gap-6 font-medium">
                        <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                            {stats.naoCadastrados} Não Cadastrados
                        </div>
                        <div className="flex items-center gap-2 text-red-700">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                            {stats.rupturasFull} Rupturas (Full/Geral)
                        </div>
                        <div className="flex items-center gap-2 text-yellow-700">
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                            {stats.alertasGiro} Alertas de Giro
                        </div>
                        <div className="flex items-center gap-2 text-green-700">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                            {stats.emDia} Em Dia
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <span className="text-gray-500 text-xs hidden sm:block">
                            Última atualização: {lastUpdate ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(lastUpdate) : '---'}
                        </span>
                        <button
                            onClick={() => {
                                fetchProdutosDb();
                                fetchVendasAnymarket();
                                fetchMlInventory();
                                showAlert("Sincronizando", "Buscando dados atualizados das integrações...", "info");
                            }}
                            className="flex items-center gap-1.5 text-[#2d3277] font-semibold hover:text-[#2d3277]/80 cursor-pointer"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Sincronizar Agora
                        </button>

                        <button
                            onClick={() => {
                                showConfirm("Limpar Trânsito", "Isso apagará apenas os dados importados da planilha de 'Em Trânsito'. Deseja continuar?", () => {
                                    limparTransito();
                                    showAlert("Sucesso", "Dados de trânsito limpos com sucesso.", "success");
                                });
                            }}
                            className="flex items-center gap-1.5 text-red-600 font-semibold hover:text-red-700 cursor-pointer"
                        >
                            <Clock className="w-4 h-4" />
                            Limpar
                        </button>
                    </div>
                </div>
            )}

            <Modals
                editingSku={editingSku}
                onClose={() => setEditingSku(null)}
                bulkEditParams={bulkEditParams}
                onCloseBulk={() => setBulkEditParams({ isOpen: false })}
                isExportModalOpen={isExportModalOpen}
                onCloseExport={() => setIsExportModalOpen(false)}
                onExecuteExport={handleExecuteExport}
                isRemessaModalOpen={isRemessaModalOpen}
                onCloseRemessa={() => setIsRemessaModalOpen(false)}
                onExecuteRemessa={handleExecuteRemessa}
            />
        </div>
    );
}
