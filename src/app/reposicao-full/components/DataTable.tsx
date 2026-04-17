"use client";

import React, { useState, useMemo } from 'react';
import { useReposicaoState } from '../useReposicaoState';
import { Edit2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings, Check, RotateCcw, GripVertical, FilterX, Layout } from 'lucide-react';
import { ProdutoProcessado, StatusReposicao } from '../types';

import { SidebarFilters } from './SidebarFilters';
import { GlobalParams } from './GlobalParams';

function StatusBadge({ status }: { status: StatusReposicao }) {
    const badgeColors: Record<StatusReposicao, string> = {
        "ATIVO / OK": "bg-green-100 text-green-800",
        "ATIVO / SEM VENDAS": "bg-cyan-100 text-cyan-800",
        "ESTOQUE BAIXO": "bg-yellow-100 text-yellow-800",
        "RUPTURA GERAL": "bg-red-900 text-white",
        "RUPTURA FULL": "bg-red-100 text-red-800",
        "INATIVO": "bg-gray-100 text-gray-800",
        "NÃO CADASTRADO": "bg-indigo-100 text-indigo-800",
        "NOVO": "bg-blue-100 text-blue-800"
    };

    return (
        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full tracking-wide whitespace-nowrap ${badgeColors[status]}`}>
            {status}
        </span>
    );
}

const COLUMN_LABELS: Record<string, string> = {
    mlbs: "MLB(s)",
    mlbCatalogo: "MLB Catálogo",
    estoqueFull: "Full / Empresa",
    status: "Status",
    diasInativos: "Dias Inativo",
    giroDiarioQtd: "Giro Diário",
    vendasQtdPeriodo: "Vendas Qtd",
    vendasValorLiquidoPeriodo: "Vendas Liq (R$)",
    vendasValorBrutoPeriodo: "Vendas Bruta (R$)",
    vendaPerdidaLiquida: "Perda Liq (R$)",
    vendaPerdidaBruta: "Perda Bruta (R$)",
    diasEstoqueFull: "Dias Est. Full",
    diasEstoqueTotal: "Dias Est. Total",
    emTransf: "Em Transf.",
    tamanhoCaixa: "Tam. Caixa",
    numCaixas: "Nº Caixas",
    sugestaoReposicao: "Sugestão",
    asp: "ASP (R$)",
    markup: "Mark up",
};

export function DataTable({ onEditItem }: { onEditItem: (sku: string) => void }) {
    const { 
        produtosProcessados, 
        produtosFiltrados: filteredData, 
        filtros, 
        setFiltros, 
        parametros, 
        selectedSkus, 
        setSelectedSkus,
        colunasVisiveis,
        setColunasVisiveis
    } = useReposicaoState();

    const [sortConfig, setSortConfig] = useState<{ key: keyof ProdutoProcessado | ''; direction: 'asc' | 'desc' }>({ key: '', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isParamsOpen, setIsParamsOpen] = useState(false);
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const itemsPerPage = 50;

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFiltros({ busca: e.target.value });
        setCurrentPage(1);
    };

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig.key !== '') {
            sortableItems.sort((a, b) => {
                let aVal = a[sortConfig.key as keyof ProdutoProcessado] as any;
                let bVal = b[sortConfig.key as keyof ProdutoProcessado] as any;

                if (aVal === undefined || aVal === null) aVal = '';
                if (bVal === undefined || bVal === null) bVal = '';

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedData, currentPage]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    const requestSort = (key: keyof ProdutoProcessado) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof ProdutoProcessado) => {
        if (sortConfig.key !== key) return <ChevronUp className="w-3 h-3 text-gray-300" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#2d3277]" /> : <ChevronDown className="w-3 h-3 text-[#2d3277]" />;
    };

    const handleSelectAllOnPage = () => {
        const pageSkus = paginatedData.map(p => p.sku);
        const allSelected = pageSkus.every(sku => selectedSkus.includes(sku));
        if (allSelected) {
            setSelectedSkus(selectedSkus.filter(sku => !pageSkus.includes(sku)));
        } else {
            const newSelections = [...selectedSkus];
            pageSkus.forEach(sku => {
                if (!newSelections.includes(sku)) newSelections.push(sku);
            });
            setSelectedSkus(newSelections);
        }
    };

    const handleSelectRow = (sku: string) => {
        if (selectedSkus.includes(sku)) {
            setSelectedSkus(selectedSkus.filter(s => s !== sku));
        } else {
            setSelectedSkus([...selectedSkus, sku]);
        }
    };

    const toggleColumn = (colId: string) => {
        if (colunasVisiveis.includes(colId)) {
            setColunasVisiveis(colunasVisiveis.filter(c => c !== colId));
        } else {
            setColunasVisiveis([...colunasVisiveis, colId]);
        }
    };

    const resetColumns = () => {
        setColunasVisiveis(['sku', 'mlbs', 'estoqueFull', 'emTransf', 'numCaixas', 'status', 'diasInativos', 'giroDiarioQtd', 'sugestaoReposicao']);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    // DnD Handlers
    const handleDragStart = (e: React.DragEvent, colId: string) => {
        setDraggedColumn(colId);
        e.dataTransfer.effectAllowed = "move";
        // Ghost image styling could be added here
    };

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        if (colId !== draggedColumn) {
            setDragOverColumn(colId);
        }
    };

    const handleDrop = (e: React.DragEvent, targetColId: string) => {
        e.preventDefault();
        if (!draggedColumn || draggedColumn === targetColId) return;

        const newOrder = [...colunasVisiveis];
        const draggedIdx = newOrder.indexOf(draggedColumn);
        const targetIdx = newOrder.indexOf(targetColId);

        if (draggedIdx > -1 && targetIdx > -1) {
            newOrder.splice(draggedIdx, 1);
            newOrder.splice(targetIdx, 0, draggedColumn);
            setColunasVisiveis(newOrder);
        }

        setDraggedColumn(null);
        setDragOverColumn(null);
    };

    const allPageSelected = paginatedData.length > 0 && paginatedData.every(p => selectedSkus.includes(p.sku));

    if (produtosProcessados.length === 0) return null;

    return (
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-w-0 overflow-hidden">
            {/* Table Local Header: Search + Counts */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
                <div className="flex items-center gap-4">
                    <div className="relative w-72">
                        <input
                            type="text"
                            placeholder="Buscar SKU, Descrição ou MLB..."
                            value={filtros.busca}
                            onChange={handleSearch}
                            className="block w-full rounded-lg border-gray-300 bg-white border py-2 pl-4 pr-10 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] transition-colors"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                        >
                            <Layout className="w-4 h-4 text-gray-400" />
                            Colunas
                        </button>

                        {isSelectorOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex flex-col h-[400px]">
                                <div className="p-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-bold text-gray-900 uppercase">Configurar Colunas</span>
                                    <button onClick={resetColumns} className="text-[10px] text-[#2d3277] hover:underline flex items-center gap-1 font-bold cursor-pointer">
                                        <RotateCcw className="w-3 h-3" /> Resetar
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1">Visíveis (Arraste para ordenar)</div>
                                    <div className="space-y-0.5">
                                        {colunasVisiveis.map((id) => (
                                            <div 
                                                key={id} 
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, id)}
                                                onDragOver={(e) => handleDragOver(e, id)}
                                                onDrop={(e) => handleDrop(e, id)}
                                                className={`flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-move transition-colors border-2 ${draggedColumn === id ? 'opacity-50 border-dashed border-[#2d3277]' : 'border-transparent'} ${dragOverColumn === id ? 'bg-blue-50 border-l-[#2d3277]' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleColumn(id)}>
                                                    <GripVertical className="w-3 h-3 text-gray-400" />
                                                    <span className="text-xs font-bold text-gray-900">{COLUMN_LABELS[id] || id}</span>
                                                </div>
                                                <Check className="w-3.5 h-3.5 text-green-500 cursor-pointer" onClick={() => toggleColumn(id)} />
                                            </div>
                                        ))}
                                    </div>

                                    {Object.entries(COLUMN_LABELS).some(([id]) => !colunasVisiveis.includes(id)) && (
                                        <>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase px-2 mt-4 mb-1 border-t border-gray-50 pt-2">Ocultas</div>
                                            <div className="space-y-0.5">
                                                {Object.entries(COLUMN_LABELS)
                                                    .filter(([id]) => !colunasVisiveis.includes(id))
                                                    .map(([id, label]) => (
                                                        <div 
                                                            key={id} 
                                                            onClick={() => toggleColumn(id)}
                                                            className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2 pl-5">
                                                                <span className="text-xs text-gray-500">{label}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="p-3 border-t border-gray-100 shrink-0">
                                    <button 
                                        onClick={() => setIsSelectorOpen(false)}
                                        className="w-full py-2 bg-[#2d3277] text-white text-xs font-bold rounded-lg hover:bg-[#1e2255] transition-colors shadow-sm cursor-pointer"
                                    >
                                        Concluir
                                    </button>
                                </div>
                            </div>
                        )}
                        {isSelectorOpen && <div className="fixed inset-0 z-40" onClick={() => setIsSelectorOpen(false)}></div>}
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer ${filtros.status.length > 0 || filtros.marca || filtros.fornecedor || filtros.giroMinimo > 0 || filtros.estoqueMax !== null || filtros.reposicaoMin !== null ? 'bg-[#2d3277] text-white border-[#2d3277]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                        >
                            <FilterX className="w-4 h-4" />
                            Filtros
                        </button>

                        {isFiltersOpen && (
                            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col h-[500px]">
                                <SidebarFilters isPopover onClose={() => setIsFiltersOpen(false)} />
                            </div>
                        )}
                        {isFiltersOpen && <div className="fixed inset-0 z-40" onClick={() => setIsFiltersOpen(false)}></div>}
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setIsParamsOpen(!isParamsOpen)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                        >
                            <Settings className="w-4 h-4 text-gray-500" />
                            Parâmetros
                        </button>

                        {isParamsOpen && (
                            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col h-[450px]">
                                <GlobalParams isPopover onClose={() => setIsParamsOpen(false)} />
                            </div>
                        )}
                        {isParamsOpen && <div className="fixed inset-0 z-40" onClick={() => setIsParamsOpen(false)}></div>}
                    </div>
                </div>
                
                <div className="text-xs font-medium text-gray-500">
                    Exibindo {paginatedData.length} de {sortedData.length} produtos
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                    <thead className="bg-gray-50 sticky top-0 z-30">
                        <tr>
                            <th scope="col" className="px-5 py-3 text-left w-10 sticky left-0 bg-gray-50 border-b border-gray-200 z-40">
                                <input
                                    type="checkbox"
                                    checked={allPageSelected}
                                    onChange={handleSelectAllOnPage}
                                    className="w-4 h-4 text-[#2d3277] border-gray-300 rounded focus:ring-[#2d3277] cursor-pointer"
                                />
                            </th>
                            <th 
                                scope="col" 
                                className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group sticky left-10 bg-gray-50 border-b border-gray-200 border-r border-gray-100 z-40" 
                                onClick={() => requestSort('sku')}
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'sku')}
                                onDragOver={(e) => handleDragOver(e, 'sku')}
                                onDrop={(e) => handleDrop(e, 'sku')}
                            >
                                <div className="flex items-center gap-1 group-hover:text-gray-700 transition-colors whitespace-nowrap">
                                    <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />
                                    SKU & Descrição {getSortIcon('sku')}
                                </div>
                            </th>
                            
                            {colunasVisiveis.map(colId => {
                                if (colId === 'sku' || colId === 'descricao') return null; // handled above
                                const isOver = dragOverColumn === colId;
                                return (
                                    <th 
                                        key={colId}
                                        scope="col" 
                                        className={`px-5 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-move group border-b border-gray-200 transition-all ${isOver ? 'bg-blue-50 border-l-2 border-l-[#2d3277]' : ''}`} 
                                        onClick={() => requestSort(colId as keyof ProdutoProcessado)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, colId)}
                                        onDragOver={(e) => handleDragOver(e, colId)}
                                        onDrop={(e) => handleDrop(e, colId)}
                                    >
                                        <div className="flex items-center justify-center gap-1 group-hover:text-gray-700 transition-colors whitespace-nowrap">
                                            <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />
                                            {COLUMN_LABELS[colId]} {getSortIcon(colId as keyof ProdutoProcessado)}
                                        </div>
                                    </th>
                                );
                            })}

                            <th scope="col" className="px-5 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 border-b border-gray-200 border-l border-gray-100 z-40">
                                AÇÕES
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedData.map((item) => {
                            const isSelected = selectedSkus.includes(item.sku);
                            return (
                                <tr key={item.sku} className={`${isSelected ? 'bg-blue-50/50' : 'hover:bg-[#2d3277]/[0.02]'} transition-colors group/row`}>
                                    <td className={`px-5 py-4 whitespace-nowrap sticky left-0 border-b border-gray-50 z-10 transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white group-hover/row:bg-[#f9f9fb]'}`}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleSelectRow(item.sku)}
                                            className="w-4 h-4 text-[#2d3277] border-gray-300 rounded focus:ring-[#2d3277] cursor-pointer"
                                        />
                                    </td>
                                    <td className={`px-5 py-4 min-w-[280px] sticky left-10 border-b border-gray-50 border-r border-gray-100 z-10 transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white group-hover/row:bg-[#f9f9fb]'}`}>
                                        <div className="flex flex-col">
                                            <div className="text-sm font-bold text-gray-900">{item.sku}</div>
                                            <div className="text-[11px] text-gray-500 truncate max-w-[200px]" title={item.descricao}>{item.descricao}</div>
                                        </div>
                                    </td>

                                    {colunasVisiveis.map(colId => {
                                        if (colId === 'sku' || colId === 'descricao') return null;

                                        return (
                                            <td key={colId} className="px-5 py-4 whitespace-nowrap text-center border-b border-gray-50">
                                                {renderCell(colId, item, formatCurrency, parametros)}
                                            </td>
                                        );
                                    })}

                                    <td className={`px-5 py-4 whitespace-nowrap text-center sticky right-0 border-b border-gray-50 border-l border-gray-100 z-10 transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white group-hover/row:bg-[#f9f9fb]'}`}>
                                        <button 
                                            onClick={() => onEditItem(item.sku)}
                                            className="p-2 text-gray-400 hover:text-[#2d3277] hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                            title="Editar item"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {paginatedData.length === 0 && (
                            <tr>
                                <td colSpan={colunasVisiveis.length + 3} className="px-5 py-8 text-center text-sm text-gray-500">
                                    Nenhum produto encontrado com os filtros atuais.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
                    <span className="text-xs text-gray-500">Página {currentPage} de {totalPages}</span>
                    <div className="flex gap-1">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex gap-1 px-2">
                            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                let pageNum = currentPage;
                                if (currentPage < 3) pageNum = i + 1;
                                else if (currentPage > totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                if (pageNum < 1 || pageNum > totalPages) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors cursor-pointer ${currentPage === pageNum ? 'bg-[#2d3277] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                        </div>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function renderCell(colId: string, item: ProdutoProcessado, formatCurrency: (v: number) => string, parametros: any) {
    switch (colId) {
        case 'mlbs':
            return (
                <div className="flex flex-wrap justify-center gap-1 max-w-[120px]">
                    {item.mlbs.slice(0, 2).map(m => (
                        <span key={m} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold border border-gray-200">{m}</span>
                    ))}
                    {item.mlbs.length > 2 && <span className="text-[9px] text-gray-400 font-bold pt-1">+{item.mlbs.length - 2}</span>}
                </div>
            );
        case 'mlbCatalogo':
            return <span className="text-[11px] font-medium text-gray-600">{item.mlbCatalogo || '—'}</span>;
        case 'estoqueFull':
            return (
                <div className="flex items-center justify-center gap-1.5">
                    <span className={`text-sm font-bold ${item.estoqueFull === 0 ? 'text-red-500' : 'text-green-600'}`}>{item.estoqueFull}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm font-medium text-gray-600">{item.estoqueEmpresa}</span>
                </div>
            );
        case 'status':
            return <StatusBadge status={item.status} />;
        case 'diasInativos':
            return item.diasInativos > 0 ? <span className="text-red-500 text-xs font-bold">{item.diasInativos} dias</span> : <span className="text-gray-400 text-xs">—</span>;
        case 'giroDiarioQtd':
            return <span className="text-xs font-bold text-gray-700">{item.giroDiarioQtd > 0 ? item.giroDiarioQtd.toFixed(1) : '—'}</span>;
        case 'vendasQtdPeriodo':
            return <span className="text-xs font-medium text-gray-600">{item.vendasQtdPeriodo}</span>;
        case 'vendasValorLiquidoPeriodo':
            return <span className="text-xs font-medium text-gray-600">{formatCurrency(item.vendasValorLiquidoPeriodo)}</span>;
        case 'vendasValorBrutoPeriodo':
            return <span className="text-xs font-medium text-gray-600">{formatCurrency(item.vendasValorBrutoPeriodo)}</span>;
        case 'vendaPerdidaLiquida':
            return item.vendaPerdidaLiquida > 0 ? <span className="text-red-500 text-xs font-bold">{formatCurrency(item.vendaPerdidaLiquida)}</span> : <span className="text-gray-400 text-xs">—</span>;
        case 'vendaPerdidaBruta':
            return item.vendaPerdidaBruta > 0 ? <span className="text-red-500 text-xs font-bold">{formatCurrency(item.vendaPerdidaBruta)}</span> : <span className="text-gray-400 text-xs">—</span>;
        case 'diasEstoqueFull':
            return <span className="text-xs font-medium text-gray-600">{item.diasEstoqueFull > 0 ? Math.ceil(item.diasEstoqueFull) : '—'}</span>;
        case 'diasEstoqueTotal':
            return <span className="text-xs font-medium text-gray-600">{item.diasEstoqueTotal > 0 ? Math.ceil(item.diasEstoqueTotal) : '—'}</span>;
        case 'emTransf':
            return <span className={`text-xs font-bold ${item.emTransf > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{item.emTransf > 0 ? item.emTransf : '—'}</span>;
        case 'tamanhoCaixa':
            return <span className="text-xs font-medium text-gray-600">{item.tamanhoCaixa || 1}</span>;
        case 'numCaixas':
            return <span className={`text-xs font-black ${item.numCaixas > 0 ? 'text-[#2d3277]' : 'text-gray-400'}`}>{item.numCaixas > 0 ? item.numCaixas : '—'}</span>;
        case 'sugestaoReposicao':
            return (
                <div className="flex flex-col items-center">
                    <span className="text-lg font-black text-[#2d3277]">{item.sugestaoReposicao}</span>
                    <span className="text-[10px] font-medium text-gray-400 -mt-1">
                        {item.giroDiarioQtd === 0 ? "Sem vendas" : `Prev: ${item.diasDesejadoItem + (parametros?.leadTime || 7)} dias`}
                    </span>
                </div>
            );
        case 'asp':
            return <span className="text-xs font-bold text-gray-700">{item.asp > 0 ? formatCurrency(item.asp) : '—'}</span>;
        case 'markup':
            return <span className="text-xs font-bold text-gray-700">{item.markup > 0 ? item.markup.toFixed(2) : '—'}</span>;
        default:
            return null;
    }
}
