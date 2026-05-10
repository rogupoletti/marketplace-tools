"use client";

import React, { useMemo } from 'react';
import { useReposicaoState } from '../useReposicaoState';
import { FilterX } from 'lucide-react';

export function SidebarFilters({ isPopover, onClose }: { isPopover?: boolean; onClose?: () => void }) {
    const { filtros, setFiltros, produtosProcessados } = useReposicaoState();

    const marcasDisponiveis = useMemo(() => {
        const s = new Set<string>();
        produtosProcessados.forEach(p => p.marca && s.add(p.marca));
        return Array.from(s).sort();
    }, [produtosProcessados]);

    const fornecedoresDisponiveis = useMemo(() => {
        const s = new Set<string>();
        produtosProcessados.forEach(p => p.fornecedor && s.add(p.fornecedor));
        return Array.from(s).sort();
    }, [produtosProcessados]);

    const handleStatusToggle = (statusName: string) => {
        if (filtros.status.includes(statusName)) {
            setFiltros({ status: filtros.status.filter(s => s !== statusName) });
        } else {
            setFiltros({ status: [...filtros.status, statusName] });
        }
    };

    const handleClear = () => {
        setFiltros({
            status: [],
            marca: "",
            fornecedor: "",
            giroMinimo: 0,
            estoqueMax: null,
            reposicaoMin: null,
        });
    };

    const content = (
        <div className={`${isPopover ? 'p-4 flex flex-col h-full bg-white overflow-hidden' : 'w-72 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-full sticky top-0'}`}>
            <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-sm font-bold text-gray-900 tracking-wide uppercase">Filtros</h2>
                <div className="flex gap-4">
                    <button
                        onClick={handleClear}
                        className="text-xs font-semibold text-[#2d3277] hover:text-[#2d3277]/80 flex items-center gap-1 cursor-pointer"
                    >
                        Limpar
                    </button>
                    {isPopover && (
                        <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer">Fechar</button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 pb-2">

                {/* Status */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Status do Estoque</label>
                    <div className="space-y-2">
                        {["Ruptura Full", "Ruptura Geral", "Estoque Baixo", "Ativo / OK", "Ativo / Sem Vendas", "Novo", "Inativo", "Não Cadastrado"].map(s => {
                            const upperS = s.toUpperCase();
                            return (
                                <label key={s} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={filtros.status.includes(upperS)}
                                        onChange={() => handleStatusToggle(upperS)}
                                        className="w-4 h-4 text-[#2d3277] border-gray-300 rounded focus:ring-[#2d3277]"
                                    />
                                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{s}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Marca */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Marca</label>
                    <select
                        value={filtros.marca}
                        onChange={(e) => setFiltros({ marca: e.target.value })}
                        className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors cursor-pointer"
                    >
                        <option value="">Todas as marcas...</option>
                        {marcasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* Fornecedor */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fornecedor</label>
                    <select
                        value={filtros.fornecedor}
                        onChange={(e) => setFiltros({ fornecedor: e.target.value })}
                        className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors cursor-pointer"
                    >
                        <option value="">Todos os fornecedores...</option>
                        {fornecedoresDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>

                {/* Giro Mínimo */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Giro Mínimo Diário</label>
                        <span className="text-xs font-semibold text-[#2d3277] bg-[#2d3277]/10 px-2 py-0.5 rounded">{filtros.giroMinimo}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100" 
                        step="0.5"
                        value={filtros.giroMinimo}
                        onChange={(e) => setFiltros({ giroMinimo: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2d3277]"
                    />
                </div>

                {/* Estoque e Reposicao Minima */}
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 truncate">Estoque Máx</label>
                        <input
                            type="number"
                            min="0"
                            placeholder="—"
                            value={filtros.estoqueMax ?? ''}
                            onChange={(e) => setFiltros({ estoqueMax: e.target.value ? parseInt(e.target.value) : null })}
                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 truncate">Reposição Mín</label>
                        <input
                            type="number"
                            min="0"
                            placeholder="—"
                            value={filtros.reposicaoMin ?? ''}
                            onChange={(e) => setFiltros({ reposicaoMin: e.target.value ? parseInt(e.target.value) : null })}
                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors"
                        />
                    </div>
                </div>

            </div>
            {isPopover && (
                <div className="pt-4 mt-auto border-t border-gray-100 shrink-0">
                    <button 
                        onClick={onClose}
                        className="w-full py-2 bg-[#2d3277] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#1e2255]"
                    >
                        Ver Resultados
                    </button>
                </div>
            )}
        </div>
    );

    return content;
}
