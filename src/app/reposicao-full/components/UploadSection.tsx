"use client";

import React, { useCallback, useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useReposicaoState } from '../useReposicaoState';
import { parseProdutosExcel } from '../excel-utils';
import { useUI } from "@/lib/ui-context";

interface DragDropBoxProps {
    title: string;
    description: string;
    onDrop: (file: File) => void;
    isLoading: boolean;
    isSuccess: boolean;
    error: string | null;
}

function DragDropBox({ title, description, onDrop, isLoading, isSuccess, error }: DragDropBoxProps) {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onDrop(e.dataTransfer.files[0]);
        }
    }, [onDrop]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onDrop(e.target.files[0]);
        }
    }, [onDrop]);

    return (
        <div
            className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-colors
        ${isDragOver ? 'border-[#2d3277] bg-[#2d3277]/5' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
        ${isSuccess && !error ? 'border-green-400 bg-green-50' : ''}
        ${error ? 'border-red-400 bg-red-50' : ''}
      `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleInputChange}
                disabled={isLoading}
            />

            <div className="flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                {isLoading ? (
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2d3277] mb-3" />
                ) : error ? (
                    <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                ) : isSuccess ? (
                    <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
                ) : (
                    <UploadCloud className={`w-10 h-10 mb-3 ${isDragOver ? 'text-[#2d3277]' : 'text-gray-400'}`} />
                )}

                <p className="mb-1 text-sm font-semibold text-gray-700">
                    {title}
                </p>
                <p className="text-xs text-gray-500 max-w-[200px]">
                    {error ? <span className="text-red-600 font-medium">{error}</span> : isSuccess ? <span className="text-green-600 font-medium">Arquivo carregado com sucesso</span> : description}
                </p>
            </div>
        </div>
    );
}

export function UploadSection() {
    const { setProdutosRaw, produtosRaw, vendasRaw, fetchVendasAnymarket } = useReposicaoState();
    const { showAlert } = useUI();

    const [loadingProd, setLoadingProd] = useState(false);
    const [errorProd, setErrorProd] = useState<string | null>(null);

    const handleProdDrop = async (file: File) => {
        setLoadingProd(true);
        setErrorProd(null);
        const { data, errors } = await parseProdutosExcel(file);

        if (errors.length > 0) {
            setErrorProd(errors[0]); // Show only first error
        } else if (data.length === 0) {
            setErrorProd("Nenhum produto válido encontrado.");
        } else {
            setProdutosRaw(data);
        }
        setLoadingProd(false);
    };

    const handleFetchAnymarket = async () => {
        // Agora automático, mas mantemos o erro caso precise debugar
        try {
            await fetchVendasAnymarket();
        } catch (error: any) {
            console.error("Erro no auto-fetch:", error);
        }
    };

    const hasProdutos = produtosRaw.length > 0;
    const hasVendas = Object.keys(vendasRaw).length > 0;

    if (hasProdutos && hasVendas) {
        return null; // Don't show large upload boxes if everything is loaded
    }

    return (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#2d3277]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileSpreadsheet className="w-8 h-8 text-[#2d3277]" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Cadastro de Produtos</h2>
                <p className="text-gray-500 mt-2 max-w-lg mx-auto">
                    Carregue seu cadastro de produtos e estoque para iniciar o cálculo de reposição.
                </p>
            </div>

            <div className="w-full max-w-xl">
                {!hasProdutos && (
                    <DragDropBox
                        title="Upload Produtos / Estoque"
                        description="Arraste o Excel com colunas: sku, descrição, mlb, marca, fornecedor, estoque full, etc."
                        onDrop={handleProdDrop}
                        isLoading={loadingProd}
                        isSuccess={hasProdutos}
                        error={errorProd}
                    />
                )}
            </div>

            {!hasVendas && (
                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3 text-yellow-800 max-w-xl w-full">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Nenhum dado de venda encontrado</h4>
                        <p className="text-xs mt-1">
                            Para calcular a reposição, precisamos dos dados de vendas. Vá em 
                            <a href="/integrations/anymarket" className="mx-1 font-bold underline hover:text-yellow-900">Integrações</a> 
                            e faça a Carga Inicial.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
