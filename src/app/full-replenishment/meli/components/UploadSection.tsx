"use client";

import React, { useCallback, useState, useRef, useMemo } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet, RefreshCw, Truck } from 'lucide-react';
import { useReposicaoState } from '../useReposicaoState';
import { parseTransitoExcel } from '../excel-utils';
import { useUI } from "@/lib/ui-context";

export function UploadSection() {
    const { produtosRaw, setProdutosRaw, vendasRaw, fetchVendasAnymarket, isFetchingSales, isFetchingMl } = useReposicaoState();
    const { showAlert } = useUI();

    const [loadingTransito, setLoadingTransito] = useState(false);
    const [transitoSuccess, setTransitoSuccess] = useState(false);
    const [transitoError, setTransitoError] = useState<string | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasProdutos = produtosRaw.length > 0;
    const hasVendas = Object.keys(vendasRaw).length > 0;
    const hasTransitData = useMemo(() => produtosRaw.some(p => (p.emTransf || 0) > 0), [produtosRaw]);

    // Hide after 3 seconds on success
    React.useEffect(() => {
        if (transitoSuccess) {
            const timer = setTimeout(() => {
                setIsDismissed(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [transitoSuccess]);

    const handleTransitoUpload = async (file: File) => {
        setLoadingTransito(true);
        setTransitoError(null);
        setTransitoSuccess(false);
        try {
            const { data, errors } = await parseTransitoExcel(file);
            if (errors.length > 0) {
                setTransitoError(errors[0]);
                return;
            }
            const skusNoArquivo = Object.keys(data);
            if (skusNoArquivo.length === 0) {
                setTransitoError("Nenhum dado de trânsito encontrado no arquivo.");
                return;
            }

            // Merge emTransf into produtosRaw (ONLY emTransf is updated, nothing else)
            const updatedProdutos = produtosRaw.map(p => {
                const emTransf = data[p.sku];
                if (emTransf !== undefined) {
                    return { ...p, emTransf };
                }
                return p;
            });
            setProdutosRaw(updatedProdutos);

            const totalMatched = updatedProdutos.filter(p => data[p.sku] !== undefined).length;
            setTransitoSuccess(true);
            showAlert("Sucesso", `Dados de trânsito importados: ${totalMatched} SKUs atualizados de ${skusNoArquivo.length} encontrados no arquivo.`, "success");
        } catch (err: any) {
            setTransitoError(err.message || "Erro ao processar arquivo.");
        } finally {
            setLoadingTransito(false);
            // Reset file input so same file can be re-uploaded
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleTransitoUpload(e.target.files[0]);
        }
    }, [produtosRaw]);

    // Don't render if dismissed or if we already have transit data (and didn't just upload it)
    if (isDismissed || (hasTransitData && !transitoSuccess)) {
        return null;
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#2d3277]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileSpreadsheet className="w-8 h-8 text-[#2d3277]" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Reposição Full</h2>
                <p className="text-gray-500 mt-2 max-w-lg mx-auto">
                    Os produtos são carregados automaticamente da Anymarket. Importe o Excel de "Em Trânsito" para complementar os dados.
                </p>
            </div>

            {/* Importar Em Trânsito button */}
            <div className="w-full max-w-xl">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileInputChange}
                    id="transito-upload"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loadingTransito}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border-2 border-dashed transition-all cursor-pointer
                        ${transitoSuccess ? 'border-green-400 bg-green-50 text-green-700' :
                            transitoError ? 'border-red-400 bg-red-50 text-red-700' :
                                'border-[#2d3277]/30 bg-[#2d3277]/5 text-[#2d3277] hover:bg-[#2d3277]/10 hover:border-[#2d3277]/50'}`}
                >
                    {loadingTransito ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                    ) : transitoSuccess ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : transitoError ? (
                        <AlertCircle className="w-5 h-5" />
                    ) : (
                        <Truck className="w-5 h-5" />
                    )}
                    <span className="font-semibold text-sm">
                        {loadingTransito ? 'Processando...' :
                            transitoSuccess ? 'Arquivo importado com sucesso' :
                                transitoError ? transitoError :
                                    'Importar Em Trânsito (.xlsx)'}
                    </span>
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                    Faça o download do arquivo em Anúncios &gt; Gestão de estoque Full &gt; Controle de estoque &gt; Baixar relatórios de estoque &gt; Relatório geral de estoque
                </p>
            </div>

            {!hasVendas && (
                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3 text-yellow-800 max-w-xl w-full">
                    {isFetchingSales ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <div>
                        <h4 className="font-semibold text-sm">
                            {isFetchingSales ? "Sincronizando vendas..." : "Nenhum dado de venda encontrado"}
                        </h4>
                        <p className="text-xs mt-1">
                            {isFetchingSales
                                ? "Buscando dados da Anymarket. Isso pode levar alguns segundos."
                                : (
                                    <>
                                        Para calcular a reposição, precisamos dos dados de vendas. Vá em
                                        <a href="/integrations/anymarket" className="mx-1 font-bold underline hover:text-yellow-900">Integrações</a>
                                        e faça a Carga Inicial.
                                    </>
                                )
                            }
                        </p>
                    </div>
                </div>
            )}

            {isFetchingMl && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 text-blue-800 max-w-xl w-full">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    <p className="text-xs font-medium">Sincronizando estoque via API do Mercado Livre...</p>
                </div>
            )}
        </div>
    );
}
