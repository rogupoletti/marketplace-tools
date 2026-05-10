"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUI } from "@/lib/ui-context";
import { useReposicaoState } from "./useReposicaoState";
import { UploadSection } from "./components/UploadSection";
import { SummaryCards } from "./components/SummaryCards";
import { GlobalParams } from "./components/GlobalParams";
import { SidebarFilters } from "./components/SidebarFilters";
import { DataTable } from "./components/DataTable";
import { Modals } from "./components/Modals";
import { Edit2, Download, Truck, Clock, RefreshCw, UploadCloud } from "lucide-react";
import { utils, writeFile } from 'xlsx';
import { parseTransitoExcel, parseAgendamentoExcel } from "./excel-utils";

export function ReposicaoFullContent() {
    const { produtosProcessados, produtosFiltrados, selectedSkus, parametros, lastUpdate, recalcularAgora, limparDados, limparTransito, fetchVendasAnymarket, fetchProdutosDb, produtosRaw, setProdutosRaw, setAgendamentoMap, setHasEstoqueShopee } = useReposicaoState();
    const { user, loading, userData } = useAuth();
    const { showAlert, showConfirm } = useUI();
    const router = useRouter();

    const [editingSku, setEditingSku] = useState<string | null>(null);
    const [bulkEditParams, setBulkEditParams] = useState({ isOpen: false });
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isRemessaModalOpen, setIsRemessaModalOpen] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (userData?.role === 'subaccount_user') {
                router.push("/dash");
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

    const getFilteredDataForExport = () => {
        // If there are selections, export only selections. Otherwise, export filtered data.
        if (selectedSkus.length > 0) {
            return produtosProcessados.filter(p => selectedSkus.includes(p.sku));
        }
        return produtosFiltrados;
    };

    const handleExportCSV = () => {
        setIsExportModalOpen(true);
    };

    const handleExecuteExport = (type: 'full' | 'filtered') => {
        const data = type === 'full' ? produtosProcessados : produtosFiltrados;
        if (data.length === 0) return showAlert("Aviso", "Nenhum dado para exportar.", "warning");

        const exportData = data.map(p => ({
            "Curva ABC": p.curvaABC || "Z",
            "ABC Ind.": p.curvaABCFornecedor || "Z",
            "SKU": p.sku,
            "Descrição": p.descricao,
            "Shopee Item ID": p.shopeeItemId || "",
            "Shopee Model ID": p.shopeeModelId || "",
            "Marca": p.marca,
            "Fornecedor": p.fornecedor,
            "Estoque Full": p.estoqueFull,
            "Estoque Empresa": p.estoqueEmpresa,
            "Giro Diário Qtd": p.giroDiarioQtd.toFixed(2),
            "Giro Diário Valor (Liq)": p.giroDiarioValorLiquido.toFixed(2),
            "Giro Diário Valor (Bruto)": p.giroDiarioValorBruto.toFixed(2),
            "Vendas Qtd": p.vendasQtdPeriodo,
            "Vendas Valor Liquido": p.vendasValorLiquidoPeriodo.toFixed(2),
            "Vendas Valor Bruto": p.vendasValorBrutoPeriodo.toFixed(2),
            "Dias Inativos": p.diasInativos,
            "Venda Perdida (Liq)": p.vendaPerdidaLiquida.toFixed(2),
            "Venda Perdida (Bruta)": p.vendaPerdidaBruta.toFixed(2),
            "Em Transferência": p.emTransf,
            "Tamanho da Caixa": p.tamanhoCaixa,
            "Nº Caixas": p.numCaixas,
            "Dias Estoque Full": p.diasEstoqueFull > 0 ? p.diasEstoqueFull.toFixed(1) : "—",
            "Dias Estoque Total": p.diasEstoqueTotal > 0 ? p.diasEstoqueTotal.toFixed(1) : "—",

            "Dias Desejado (Total)": p.diasDesejadoItem + (parametros?.leadTime || 7),
            "Sugestão Reposição": p.sugestaoReposicao,
            "Necessidade": p.necessidade,
            "ASP": p.asp.toFixed(2),
            "Mark up": p.markup.toFixed(2),
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
            const rows: any[][] = [
                ["SKU", "Cód Universal", "Código ML", "N. do Anúncio", "N. da Variação", "Qtd de unidades"]
            ];

            // Empty rows (2, 3, 4, 5)
            for (let i = 0; i < 4; i++) {
                rows.push(["", "", "", "", "", ""]);
            }

            toShip.forEach(p => {
                rows.push([
                    p.sku,
                    "", // Cód Universal (must be blank)
                    "", // Código ML (must be blank)
                    p.shopeeItemId || "", // N. do Anúncio
                    p.shopeeModelId || "", // N. da Variação
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

    const [isUploadingTransito, setIsUploadingTransito] = useState(false);

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

            // Merge fields into produtosRaw
            const updatedProdutos = produtosRaw.map(p => {
                const importData = data[p.sku.toUpperCase()];
                if (importData !== undefined) {
                    return { 
                        ...p, 
                        estoqueFull: importData.estoqueFull,
                        emTransf: importData.emTransf,
                        shopeeItemId: importData.shopeeItemId,
                        shopeeModelId: importData.shopeeModelId
                    };
                }
                return p;
            });
            setProdutosRaw(updatedProdutos);
            setHasEstoqueShopee(true);

            const totalMatched = updatedProdutos.filter(p => data[p.sku] !== undefined).length;
            showAlert("Sucesso", `Dados de estoque importados: ${totalMatched} SKUs atualizados de ${skusNoArquivo.length} encontrados no arquivo.`, "success");
        } catch (err: any) {
            showAlert("Erro", err.message || "Erro ao processar arquivo.", "error");
        } finally {
            setIsUploadingTransito(false);
            if (e.target) e.target.value = '';
        }
    };

    const [isUploadingAgendamento, setIsUploadingAgendamento] = useState(false);

    const handleAgendamentoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAgendamento(true);
        try {
            const { data, errors } = await parseAgendamentoExcel(file);
            if (errors.length > 0) {
                showAlert("Erro", errors[0], "error");
                return;
            }

            setAgendamentoMap(data);
            const totalItems = Object.keys(data).length;
            showAlert("Sucesso", `Agendamento importado: ${totalItems} itens encontrados. As sugestões foram limitadas aos valores da planilha.`, "success");
        } catch (err: any) {
            showAlert("Erro", err.message || "Erro ao processar arquivo.", "error");
        } finally {
            setIsUploadingAgendamento(false);
            if (e.target) e.target.value = '';
        }
    };



    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col relative text-gray-800">
            {/* Topo */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reposição Full – Shopee</h1>
                    <p className="text-gray-500 mt-1">Otimize seu estoque no Full com base no giro diário e lead time.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => {
                            if (selectedSkus.length === 0) return showAlert("Aviso", "Selecione pelo menos um produto na tabela.", "warning");
                            setBulkEditParams({ isOpen: true });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors cursor-pointer"
                    >
                        <Edit2 className="w-4 h-4" />
                        Editar Selecionados {selectedSkus.length > 0 && `(${selectedSkus.length})`}
                    </button>

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
                            Importar Estoque Shopee
                        </label>
                    </div>

                    <div className="relative">
                        <input
                            type="file"
                            id="header-agendamento-upload"
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleAgendamentoUpload}
                            disabled={isUploadingAgendamento}
                        />
                        <label
                            htmlFor="header-agendamento-upload"
                            className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors cursor-pointer ${isUploadingAgendamento ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {isUploadingAgendamento ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                            ) : (
                                <UploadCloud className="w-4 h-4 text-orange-600" />
                            )}
                            Importar Agendamento Full
                        </label>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>
                    <button
                        onClick={handleCriarRemessa}
                        className="flex items-center gap-2 px-4 py-2 bg-[#2d3277] text-white rounded-lg text-sm font-medium hover:bg-[#2d3277]/90 shadow-sm transition-colors cursor-pointer"
                    >
                        <Truck className="w-4 h-4" />
                        Criar Remessa
                    </button>
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
                                showAlert("Sincronizando", "Buscando dados atualizados das integrações...", "info");
                            }}
                            className="flex items-center gap-1.5 text-[#2d3277] font-semibold hover:text-[#2d3277]/80 cursor-pointer"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Sincronizar Agora
                        </button>

                        <button
                            onClick={() => {
                                showConfirm("Limpar Importação", "Isso apagará os dados de estoque, trânsito e IDs de anúncio importados da planilha. Deseja continuar?", () => {
                                    limparTransito();
                                    showAlert("Sucesso", "Dados da planilha limpos com sucesso.", "success");
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
