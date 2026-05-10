"use client";

import React from 'react';
import { Settings } from 'lucide-react';
import { useReposicaoState } from '../useReposicaoState';

export function GlobalParams({ isPopover, onClose }: { isPopover?: boolean; onClose?: () => void }) {
    const { parametros, setParametros, produtosProcessados } = useReposicaoState();

    if (produtosProcessados.length === 0) return null;

    return (
        <div className={`${isPopover ? 'p-4 bg-white flex flex-col h-full overflow-hidden' : 'bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6'}`}>
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#2d3277]" />
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Parâmetros Globais</h2>
                </div>
                {isPopover && (
                    <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer">Fechar</button>
                )}
            </div>

            <div className={`grid gap-6 ${isPopover ? 'grid-cols-1 overflow-y-auto flex-1 custom-scrollbar pr-1 pb-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>

                {/* Dias de Estoque Padrão */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dias de Estoque Padrão</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            value={parametros.diasEstoquePadrao}
                            onChange={(e) => setParametros({ diasEstoquePadrao: parseInt(e.target.value) || 0 })}
                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 pl-4 pr-12 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                            <span className="text-gray-400 sm:text-sm font-medium">dias</span>
                        </div>
                    </div>
                </div>

                {/* Lead Time */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Lead Time</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            value={parametros.leadTime}
                            onChange={(e) => setParametros({ leadTime: parseInt(e.target.value) || 0 })}
                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 pl-4 pr-12 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                            <span className="text-gray-400 sm:text-sm font-medium">dias</span>
                        </div>
                    </div>
                </div>

                {/* Cálculo do Giro */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cálculo do Giro</label>
                    <select
                        value={parametros.calculoGiroDias}
                        onChange={(e) => setParametros({ calculoGiroDias: parseInt(e.target.value) as any })}
                        className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 pl-4 pr-10 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors cursor-pointer"
                    >
                        <option value={7}>Últimos 7 dias</option>
                        <option value={14}>Últimos 14 dias</option>
                        <option value={30}>Últimos 30 dias</option>
                        <option value={60}>Últimos 60 dias</option>
                        <option value={90}>Últimos 90 dias</option>
                    </select>
                </div>

                {/* Toggle Mode */}
                <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dias de Estoque</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl w-full h-10 mb-[2px]">
                        <button
                            onClick={() => setParametros({ usarMediaGlobal: true })}
                            className={`flex-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${parametros.usarMediaGlobal
                                    ? 'bg-white text-[#2d3277] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Média global
                        </button>
                        <button
                            onClick={() => setParametros({ usarMediaGlobal: false })}
                            className={`flex-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${!parametros.usarMediaGlobal
                                    ? 'bg-white text-[#2d3277] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Por item
                        </button>
                    </div>
                </div>

            </div>
            {isPopover && (
                <div className="pt-4 mt-4 border-t border-gray-100 shrink-0">
                    <button 
                        onClick={onClose}
                        className="w-full py-2 bg-[#2d3277] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#1e2255]"
                    >
                        Concluído
                    </button>
                </div>
            )}
        </div>
    );
}
