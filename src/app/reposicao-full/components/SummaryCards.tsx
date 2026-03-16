"use client";

import React from 'react';
import { useReposicaoState } from '../useReposicaoState';
import { AlertTriangle, Banknote, HelpCircle } from 'lucide-react';

export function SummaryCards() {
    const { produtosFiltrados, maxSalesDate } = useReposicaoState();

    // Total vendido (R$) no período
    const totalVendido = produtosFiltrados.reduce((sum, p) => sum + (p.vendasValorLiquidoPeriodo || 0), 0);

    // Venda perdida (ruptura) estimativa sum of per-SKU Vp
    const vendaPerdida = produtosFiltrados.reduce((sum, p) => sum + (p.vendaPerdidaLiquida || 0), 0);

    const totalPotencial = totalVendido + vendaPerdida;
    const proporcaoPerda = totalPotencial > 0 ? (vendaPerdida / totalPotencial) * 100 : 0;
    const proporcaoRealizada = totalPotencial > 0 ? (totalVendido / totalPotencial) * 100 : 0;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">

                {/* Left Side: Summary Values */}
                <div className="flex-1 flex flex-col sm:flex-row gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xs font-bold text-gray-500 tracking-wider">RESUMO DE PERFORMANCE</h3>
                            {maxSalesDate && (
                                <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                    Últimos {produtosFiltrados[0]?.diasDesejadoItem || 30} dias até {maxSalesDate.toLocaleDateString('pt-BR')}
                                </span>
                            )}
                        </div>
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-1 flex items-center gap-1.5">
                            TOTAL VENDIDO
                        </div>
                        <div className="flex items-center gap-2">
                            <Banknote className="w-6 h-6 text-[#2d3277]" />
                            <span className="text-3xl font-extrabold tracking-tight text-gray-900">{formatCurrency(totalVendido)}</span>
                        </div>
                    </div>

                    <div className="hidden sm:block w-px bg-gray-200"></div>

                    <div>
                        <h3 className="text-xs font-bold text-transparent tracking-wider mb-2 select-none">-</h3>
                        <div className="text-xs font-semibold text-gray-400 uppercase mb-1 flex items-center gap-1.5 group relative cursor-pointer">
                            VENDA PERDIDA (RUPTURA)
                            <HelpCircle className="w-3.5 h-3.5 text-gray-300" />
                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-left font-normal leading-relaxed">
                                Estimativa baseada no giro diário em valor multiplicado pelo menor valor entre o lead time e o período analisado, restrito apenas aos produtos atualmente em ruptura.
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-red-500" />
                                <span className="text-3xl font-extrabold tracking-tight text-red-500">{formatCurrency(vendaPerdida)}</span>
                            </div>
                            {proporcaoPerda > 0 && (
                                <span className="text-sm font-medium text-red-400">({proporcaoPerda.toFixed(1)}%)</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Progress Bar */}
                <div className="flex-1 max-w-sm pt-4 lg:pt-0">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-[#2d3277]">Proporção de Perda</span>
                        <span className="text-sm font-bold text-red-500">{proporcaoPerda.toFixed(1)}% do total potencial</span>
                    </div>

                    <div className="h-4 w-full bg-red-500 rounded-full overflow-hidden flex shadow-inner">
                        <div
                            className="h-full bg-[#2d3277] rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${proporcaoRealizada}%` }}
                        />
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs font-medium text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#2d3277]"></div>
                            Vendas Realizadas
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                            Vendas Perdidas
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
