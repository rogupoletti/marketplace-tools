"use client";

import React, { useState, useEffect } from 'react';
import { useReposicaoState } from '../useReposicaoState';
import { X } from 'lucide-react';

interface ModalsProps {
    editingSku: string | null;
    onClose: () => void;
    bulkEditParams: { isOpen: boolean };
    onCloseBulk: () => void;
    isExportModalOpen: boolean;
    onCloseExport: () => void;
    onExecuteExport: (type: 'full' | 'filtered') => void;
    isRemessaModalOpen: boolean;
    onCloseRemessa: () => void;
    onExecuteRemessa: (type: 'full' | 'filtered') => void;
}

export function Modals({ 
    editingSku, 
    onClose, 
    bulkEditParams, 
    onCloseBulk, 
    isExportModalOpen, 
    onCloseExport, 
    onExecuteExport,
    isRemessaModalOpen,
    onCloseRemessa,
    onExecuteRemessa
}: ModalsProps) {
    const { produtosProcessados, overridesGlobais, updateOverride, updateOverridesBulk, selectedSkus, parametros } = useReposicaoState();

    // Single Edit State
    const [singleAtivo, setSingleAtivo] = useState(true);
    const [singleMotivo, setSingleMotivo] = useState("");
    const [singleDias, setSingleDias] = useState<number | ''>('');
    const [singleCaixa, setSingleCaixa] = useState<number | ''>('');

    // Bulk Edit State
    const [bulkAtivo, setBulkAtivo] = useState<boolean | null>(null); // null means no change
    const [bulkMotivo, setBulkMotivo] = useState("");
    const [bulkDias, setBulkDias] = useState<number | ''>('');
    const [bulkCaixa, setBulkCaixa] = useState<number | ''>('');

    // Load single product data when modal opens
    useEffect(() => {
        if (editingSku) {
            const override = overridesGlobais[editingSku];
            const prod = produtosProcessados.find(p => p.sku === editingSku);

            setSingleAtivo(override?.ativo !== false);
            setSingleMotivo(override?.motivoInativo || "");

            if (override?.diasEstoqueDesejado !== undefined) {
                setSingleDias(override.diasEstoqueDesejado);
            } else if (prod) {
                setSingleDias(''); // Empty means using global
            }

            if (override?.tamanhoCaixa !== undefined) {
                setSingleCaixa(override.tamanhoCaixa);
            } else if (prod) {
                setSingleCaixa(prod.tamanhoCaixa);
            }
        }
    }, [editingSku, overridesGlobais, produtosProcessados]);

    // Reset bulk state when opened
    useEffect(() => {
        if (bulkEditParams.isOpen) {
            setBulkAtivo(null);
            setBulkMotivo("");
            setBulkDias('');
            setBulkCaixa('');
        }
    }, [bulkEditParams.isOpen]);

    const handleSaveSingle = () => {
        if (!editingSku) return;
        updateOverride(editingSku, {
            ativo: singleAtivo,
            motivoInativo: !singleAtivo ? singleMotivo : undefined,
            diasEstoqueDesejado: singleDias === '' ? undefined : Number(singleDias),
            tamanhoCaixa: singleCaixa === '' ? undefined : Number(singleCaixa)
        });
        onClose();
    };

    const handleSaveBulk = () => {
        if (selectedSkus.length === 0) return;

        const updates: any = {};
        if (bulkAtivo !== null) {
            updates.ativo = bulkAtivo;
            if (!bulkAtivo) updates.motivoInativo = bulkMotivo;
        }
        if (bulkDias !== '') {
            updates.diasEstoqueDesejado = Number(bulkDias);
        }
        if (bulkCaixa !== '') {
            updates.tamanhoCaixa = Number(bulkCaixa);
        } // if bulkDias === '', we don't clear it. Bulk edit usually applies changes, not clear them, unless we add an explicit "Clear" option. Let's keep it simple.

        updateOverridesBulk(selectedSkus, updates);
        onCloseBulk();
    };

    const prodToEdit = editingSku ? produtosProcessados.find(p => p.sku === editingSku) : null;

    return (
        <>
            {/* --- SINGLE EDIT MODAL --- */}
            {editingSku && prodToEdit && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">Editar Produto</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="mb-6">
                                <div className="text-sm font-bold text-gray-900">{prodToEdit.sku}</div>
                                <div className="text-sm text-gray-500 mt-1">{prodToEdit.descricao}</div>
                                <div className="flex gap-2 mt-3 text-xs text-gray-500">
                                    <span className="bg-gray-100 px-2 py-1 rounded">Marca: {prodToEdit.marca || '—'}</span>
                                    <span className="bg-gray-100 px-2 py-1 rounded">MLB(s): {prodToEdit.mlbs.length}</span>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={singleAtivo}
                                            onChange={(e) => setSingleAtivo(e.target.checked)}
                                            className="w-5 h-5 text-[#2d3277] border-gray-300 rounded focus:ring-[#2d3277]"
                                        />
                                        <span className="text-sm font-semibold text-gray-800">Produto Ativo</span>
                                    </label>
                                </div>

                                {!singleAtivo && (
                                    <div className="pl-8 animate-in slide-in-from-top-2 fade-in">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Motivo da Inativação</label>
                                        <select
                                            value={singleMotivo}
                                            onChange={(e) => setSingleMotivo(e.target.value)}
                                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] cursor-pointer"
                                        >
                                            <option value="">-- Selecione o motivo --</option>
                                            <option value="Baixo Giro">Baixo Giro</option>
                                            <option value="Fora de Linha">Fora de Linha</option>
                                            <option value="Bloqueado Indústria">Bloqueado Indústria</option>
                                            <option value="Bloqueado Marketplace">Bloqueado Marketplace</option>
                                        </select>
                                    </div>
                                )}

                                <hr className="border-gray-100 my-2" />

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dias de Estoque Desejado</label>
                                    <p className="text-xs text-gray-400 mb-2">Deixe em branco para usar o padrão global ({parametros.diasEstoquePadrao} dias).</p>
                                    <div className="relative max-wxs">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder={parametros.diasEstoquePadrao.toString()}
                                            value={singleDias}
                                            onChange={(e) => setSingleDias(e.target.value ? Number(e.target.value) : '')}
                                            className="block w-full max-w-[200px] rounded-lg border-gray-300 bg-gray-50 border py-2 pl-4 pr-12 text-sm focus:border-[#2d3277] focus:ring-[#2d3277]"
                                        />
                                        <div className="absolute inset-y-0 left-[160px] flex items-center pr-4 pointer-events-none">
                                            <span className="text-gray-400 sm:text-sm font-medium">dias</span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-100 my-2" />

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tamanho da Caixa</label>
                                    <p className="text-xs text-gray-400 mb-2">Utilizado para arredondar a sugestão para múltiplos inteiros.</p>
                                    <div className="relative max-wxs">
                                        <input
                                            type="number"
                                            min="1"
                                            value={singleCaixa}
                                            onChange={(e) => setSingleCaixa(e.target.value ? Number(e.target.value) : '')}
                                            className="block w-full max-w-[200px] rounded-lg border-gray-300 bg-gray-50 border py-2 px-4 text-sm focus:border-[#2d3277] focus:ring-[#2d3277]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                Cancelar
                            </button>
                            <button onClick={handleSaveSingle} className="px-4 py-2 text-sm font-medium text-white bg-[#2d3277] rounded-lg hover:bg-[#2d3277]/90 transition-colors shadow-sm cursor-pointer">
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* --- BULK EDIT MODAL --- */}
            {bulkEditParams.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Edição em Massa</h3>
                                <p className="text-xs text-[#2d3277] font-semibold mt-0.5">{selectedSkus.length} produtos selecionados</p>
                            </div>
                            <button onClick={onCloseBulk} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="bg-blue-50 border border-blue-100 text-blue-800 text-sm p-3 rounded-lg mb-6 leading-relaxed">
                                As alterações feitas aqui serão aplicadas a todos os <strong>{selectedSkus.length}</strong> produtos selecionados. Deixe os campos em branco/misto para não alterá-los.
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Status do Produto</label>
                                    <select
                                        value={bulkAtivo === null ? "" : bulkAtivo ? "true" : "false"}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBulkAtivo(val === "" ? null : val === "true");
                                        }}
                                        className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277]"
                                    >
                                        <option value="">-- Manter status atual --</option>
                                        <option value="true">Marcar todos como Ativos</option>
                                        <option value="false">Marcar todos como Inativos</option>
                                    </select>
                                </div>

                                {bulkAtivo === false && (
                                    <div className="animate-in slide-in-from-top-2 fade-in">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Motivo da Inativação</label>
                                        <select
                                            value={bulkMotivo}
                                            onChange={(e) => setBulkMotivo(e.target.value)}
                                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:border-[#2d3277] focus:ring-[#2d3277] cursor-pointer"
                                        >
                                            <option value="">-- Selecione o motivo --</option>
                                            <option value="Baixo Giro">Baixo Giro</option>
                                            <option value="Fora de Linha">Fora de Linha</option>
                                            <option value="Bloqueado Indústria">Bloqueado Indústria</option>
                                            <option value="Bloqueado Marketplace">Bloqueado Marketplace</option>
                                        </select>
                                    </div>
                                )}

                                <hr className="border-gray-100 my-2" />

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dias de Estoque Desejado</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="-- Manter atual --"
                                            value={bulkDias}
                                            onChange={(e) => setBulkDias(e.target.value ? Number(e.target.value) : '')}
                                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 pl-4 pr-12 text-sm focus:border-[#2d3277] focus:ring-[#2d3277]"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                            <span className="text-gray-400 sm:text-sm font-medium">dias</span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="border-gray-100 my-2" />

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tamanho da Caixa</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="-- Manter atual --"
                                            value={bulkCaixa}
                                            onChange={(e) => setBulkCaixa(e.target.value ? Number(e.target.value) : '')}
                                            className="block w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-4 text-sm focus:border-[#2d3277] focus:ring-[#2d3277]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
                            <button onClick={onCloseBulk} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                Cancelar
                            </button>
                            <button onClick={handleSaveBulk} className="px-4 py-2 text-sm font-medium text-white bg-[#2d3277] rounded-lg hover:bg-[#2d3277]/90 transition-colors shadow-sm cursor-pointer">
                                Aplicar em {selectedSkus.length} produtos
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- EXPORT OPTIONS MODAL --- */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">Exportar Dados</h3>
                            <button onClick={onCloseExport} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-6 italic">
                                Escolha como deseja exportar os dados para o arquivo Excel.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        onExecuteExport('filtered');
                                        onCloseExport();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm cursor-pointer"
                                >
                                    Exportar Lista Filtrada
                                </button>
                                <button
                                    onClick={() => {
                                        onExecuteExport('full');
                                        onCloseExport();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2d3277] rounded-xl text-sm font-semibold text-white hover:bg-[#2d3277]/90 transition-all shadow-md cursor-pointer"
                                >
                                    Exportar Lista Completa
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center rounded-b-2xl">
                            <button onClick={onCloseExport} className="text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- REMESSA OPTIONS MODAL --- */}
            {isRemessaModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">Criar Remessa</h3>
                            <button onClick={onCloseRemessa} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-6 italic">
                                Escolha quais produtos serão incluídos na remessa (apenas itens com sugestão &gt; 0).
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        onExecuteRemessa('filtered');
                                        onCloseRemessa();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm cursor-pointer"
                                >
                                    Remessa Lista Filtrada
                                </button>
                                <button
                                    onClick={() => {
                                        onExecuteRemessa('full');
                                        onCloseRemessa();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2d3277] rounded-xl text-sm font-semibold text-white hover:bg-[#2d3277]/90 transition-all shadow-md cursor-pointer"
                                >
                                    Remessa Lista Completa
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center rounded-b-2xl">
                            <button onClick={onCloseRemessa} className="text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
