"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { ProdutoRaw, VendaRaw, ParametrosGlobais, UserOverrides, Filtros, ProdutoProcessado } from "./types";
import { processProduct, getMaxDate } from "./core-logic";
import { useAuth } from "@/lib/auth-context";

interface ReposicaoContextData {
    produtosRaw: ProdutoRaw[];
    vendasRaw: Record<string, VendaRaw[]>; // grouped by sku
    parametros: ParametrosGlobais;
    overridesGlobais: Record<string, UserOverrides>; // keyed by sku
    filtros: Filtros;

    produtosProcessados: ProdutoProcessado[];
    produtosFiltrados: ProdutoProcessado[];
    maxSalesDate: Date | null;
    lastUpdate: Date | null;

    // Actions
    setProdutosRaw: (p: ProdutoRaw[]) => void;
    setVendasRaw: (v: Record<string, VendaRaw[]>) => void;
    fetchVendasAnymarket: () => Promise<void>;
    setParametros: (p: Partial<ParametrosGlobais>) => void;
    setFiltros: (f: Partial<Filtros>) => void;
    updateOverride: (sku: string, o: Partial<UserOverrides>) => void;
    updateOverridesBulk: (skus: string[], o: Partial<UserOverrides>) => void;
    recalcularAgora: () => void;
    limparDados: () => void;
    selectedSkus: string[];
    setSelectedSkus: (skus: string[]) => void;
    toggleSelecionarTodos: (skus: string[]) => void;
    colunasVisiveis: string[];
    setColunasVisiveis: (cols: string[]) => void;
}

const ReposicaoContext = createContext<ReposicaoContextData>({} as ReposicaoContextData);

const DEFAULT_PARAMS: ParametrosGlobais = {
    diasEstoquePadrao: 30,
    leadTime: 7,
    calculoGiroDias: 30,
    usarMediaGlobal: true,
};

const DEFAULT_FILTROS: Filtros = {
    busca: "",
    status: [],
    marca: "",
    fornecedor: "",
    giroMinimo: 0,
    estoqueMax: null,
    reposicaoMin: null,
};

export function ReposicaoProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [isLoaded, setIsLoaded] = useState(false);
    const [produtosRaw, setProdutosRawState] = useState<ProdutoRaw[]>([]);
    const [vendasRaw, setVendasRawState] = useState<Record<string, VendaRaw[]>>({});
    const [parametros, setParametrosState] = useState<ParametrosGlobais>(DEFAULT_PARAMS);
    const [overridesGlobais, setOverridesGlobaisState] = useState<Record<string, UserOverrides>>({});
    const [filtros, setFiltrosState] = useState<Filtros>(DEFAULT_FILTROS);
    const [selectedSkus, setSelectedSkusState] = useState<string[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [colunasVisiveis, setColunasVisiveisState] = useState<string[]>([
        'sku', 'curvaABC', 'curvaABCFornecedor', 'mlbs', 'estoqueFull', 'emTransf', 'tamanhoCaixa', 'numCaixas', 'status', 'diasInativos', 'giroDiarioQtd', 'necessidade', 'sugestaoReposicao'
    ]);

    // Load from LocalStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
            if (stored) {
                const data = JSON.parse(stored);
                if (data.produtosRaw) setProdutosRawState(data.produtosRaw);
                if (data.vendasRaw) setVendasRawState(data.vendasRaw);
                if (data.parametros) setParametrosState(data.parametros);
                if (data.overridesGlobais) setOverridesGlobaisState(data.overridesGlobais);
                if (data.lastUpdate) setLastUpdate(new Date(data.lastUpdate));
                if (data.colunasVisiveis) setColunasVisiveisState(data.colunasVisiveis);
            }
        } catch (e) {
            console.error("Failed to load state", e);
        }
        setIsLoaded(true);
    }, []);

    // Auto-fetch sales from DB when user is logged in
    useEffect(() => {
        if (user && isLoaded) {
            fetchVendasAnymarket().catch(() => {
                // Silently fail or handle error - already logged in fetchVendasAnymarket
            });
        }
    }, [user, isLoaded]);

    // Save to LocalStorage
    const saveAction = (
        pRaw: ProdutoRaw[],
        vRaw: Record<string, VendaRaw[]>,
        params: ParametrosGlobais,
        overrides: Record<string, UserOverrides>
    ) => {
        const now = new Date();
        setLastUpdate(now);
        localStorage.setItem("@SellerDock:ReposicaoFull", JSON.stringify({
            produtosRaw: pRaw,
            vendasRaw: vRaw,
            parametros: params,
            overridesGlobais: overrides,
            lastUpdate: now.toISOString(),
            colunasVisiveis: colunasVisiveis,
        }));
    };

    const setProdutosRaw = (p: ProdutoRaw[]) => {
        setProdutosRawState(p);
        saveAction(p, vendasRaw, parametros, overridesGlobais);
    };

    const setVendasRaw = (v: Record<string, VendaRaw[]>) => {
        setVendasRawState(v);
        saveAction(produtosRaw, v, parametros, overridesGlobais);
    };

    const fetchVendasAnymarket = async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/reposicao-full/sales", {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao buscar vendas");

            const novasVendas: Record<string, VendaRaw[]> = {};
            
            data.sales.forEach((sale: any) => {
                const isMeli = sale.marketplace?.toUpperCase().includes("MERCADO") && sale.marketplace?.toUpperCase().includes("LIVRE");
                if (!isMeli) return; // Filtro de MELI apenas

                const sku = sale.sku;
                if (!novasVendas[sku]) {
                    novasVendas[sku] = [];
                }
                
                novasVendas[sku].push({
                    sku: sale.sku,
                    data: sale.date,
                    vendaQtd: sale.vendaQtd,
                    vendaValorLiquido: sale.vendaValorLiquido,
                    vendaValorBruto: sale.vendaValorBruto,
                });
            });

            setVendasRaw(novasVendas);
        } catch (e) {
            console.error("Erro ao importar da Anymarket:", e);
            throw e; // Lança para o componente lidar com UI
        }
    };

    const setParametros = (p: Partial<ParametrosGlobais>) => {
        const newParams = { ...parametros, ...p };
        setParametrosState(newParams);
        saveAction(produtosRaw, vendasRaw, newParams, overridesGlobais);
    };

    const updateOverride = (sku: string, o: Partial<UserOverrides>) => {
        const newOverrides = { ...overridesGlobais };
        newOverrides[sku] = { ...(newOverrides[sku] || { ativo: true }), ...o };
        // Maintain inativoDesde logic
        if (o.ativo === false && !newOverrides[sku].inativoDesde) {
            newOverrides[sku].inativoDesde = new Date().toISOString();
        } else if (o.ativo === true) {
            delete newOverrides[sku].inativoDesde;
            delete newOverrides[sku].motivoInativo;
        }
        setOverridesGlobaisState(newOverrides);
        saveAction(produtosRaw, vendasRaw, parametros, newOverrides);
    };

    const updateOverridesBulk = (skus: string[], o: Partial<UserOverrides>) => {
        const newOverrides = { ...overridesGlobais };
        skus.forEach(sku => {
            newOverrides[sku] = { ...(newOverrides[sku] || { ativo: true }), ...o };
            if (o.ativo === false && !newOverrides[sku].inativoDesde) {
                newOverrides[sku].inativoDesde = new Date().toISOString();
            } else if (o.ativo === true) {
                delete newOverrides[sku].inativoDesde;
                delete newOverrides[sku].motivoInativo;
            }
        });
        setOverridesGlobaisState(newOverrides);
        saveAction(produtosRaw, vendasRaw, parametros, newOverrides);
    };

    const recalcularAgora = () => {
        saveAction(produtosRaw, vendasRaw, parametros, overridesGlobais);
    };
    
    const limparDados = () => {
        setProdutosRawState([]);
        setVendasRawState({});
        setSelectedSkusState([]);
        setLastUpdate(null);
        localStorage.removeItem("@SellerDock:ReposicaoFull");
    };

    const maxSalesDate = useMemo(() => getMaxDate(vendasRaw), [vendasRaw]);

    // Derived Processed Data
    const produtosProcessados = useMemo(() => {
        // 1. Process individual products
        const processed = produtosRaw.map(prod => {
            const sku = prod.sku;
            const vendas = vendasRaw[sku] || [];
            const overrides = overridesGlobais[sku] || { ativo: true };
            return processProduct(prod, vendas, parametros, overrides, maxSalesDate);
        });

        if (processed.length === 0) return [];

        // 2. Calculate Global ABC Curve
        const withSales = processed
            .filter(p => p.vendasValorBrutoPeriodo > 0)
            .sort((a, b) => b.vendasValorBrutoPeriodo - a.vendasValorBrutoPeriodo);

        const totalRevenueGlobal = withSales.reduce((acc, p) => acc + p.vendasValorBrutoPeriodo, 0);

        let cumulativeRevenueGlobal = 0;
        const abcMapGlobal: Record<string, "A" | "B" | "C" | "Z"> = {};

        withSales.forEach(p => {
            cumulativeRevenueGlobal += p.vendasValorBrutoPeriodo;
            const pct = (cumulativeRevenueGlobal / totalRevenueGlobal) * 100;

            if (pct <= 80) abcMapGlobal[p.sku] = "A";
            else if (pct <= 95) abcMapGlobal[p.sku] = "B";
            else abcMapGlobal[p.sku] = "C";
        });

        // 3. Calculate Supplier ABC Curve
        const abcMapSupplier: Record<string, "A" | "B" | "C" | "Z"> = {};
        
        // Group by supplier
        const bySupplier: Record<string, typeof processed> = {};
        processed.forEach(p => {
            const s = p.fornecedor || "SEM FORNECEDOR";
            if (!bySupplier[s]) bySupplier[s] = [];
            bySupplier[s].push(p);
        });

        // Calculate ABC per supplier group
        Object.values(bySupplier).forEach(group => {
            const groupWithSales = group
                .filter(p => p.vendasValorBrutoPeriodo > 0)
                .sort((a, b) => b.vendasValorBrutoPeriodo - a.vendasValorBrutoPeriodo);

            const totalRevenueGroup = groupWithSales.reduce((acc, p) => acc + p.vendasValorBrutoPeriodo, 0);

            let cumulativeRevenueGroup = 0;
            groupWithSales.forEach(p => {
                cumulativeRevenueGroup += p.vendasValorBrutoPeriodo;
                const pct = (cumulativeRevenueGroup / totalRevenueGroup) * 100;

                if (pct <= 80) abcMapSupplier[p.sku] = "A";
                else if (pct <= 95) abcMapSupplier[p.sku] = "B";
                else abcMapSupplier[p.sku] = "C";
            });
        });

        // 4. Assign to all products
        return processed.map(p => ({
            ...p,
            curvaABC: abcMapGlobal[p.sku] || "Z",
            curvaABCFornecedor: abcMapSupplier[p.sku] || "Z"
        }));

    }, [produtosRaw, vendasRaw, parametros, overridesGlobais, maxSalesDate]);

    const produtosFiltrados = useMemo(() => {
        return produtosProcessados.filter(item => {
            // Busca Global (SKU ou desc ou MLB)
            if (filtros.busca) {
                const query = filtros.busca.toLowerCase();
                const matchesSku = item.sku.toLowerCase().includes(query);
                const matchesDesc = item.descricao.toLowerCase().includes(query);
                const matchesMlb = item.mlbs.some(mlb => mlb.toLowerCase().includes(query));
                if (!matchesSku && !matchesDesc && !matchesMlb) return false;
            }

            // Status
            if (filtros.status.length > 0) {
                if (!filtros.status.includes(item.status)) return false;
            }

            // Marca
            if (filtros.marca && item.marca !== filtros.marca) return false;

            // Fornecedor
            if (filtros.fornecedor && item.fornecedor !== filtros.fornecedor) return false;

            // Giro Minimo
            if (filtros.giroMinimo > 0 && item.giroDiarioQtd < filtros.giroMinimo) return false;

            // Estoque Max
            if (filtros.estoqueMax !== null && item.estoqueFull > filtros.estoqueMax) return false;

            // Reposicao Min
            if (filtros.reposicaoMin !== null && item.sugestaoReposicao < filtros.reposicaoMin) return false;

            return true;
        });
    }, [produtosProcessados, filtros]);

    if (!isLoaded) return null; // or a loading spinner

    return (
        <ReposicaoContext.Provider
            value={{
                produtosRaw,
                vendasRaw,
                parametros,
                overridesGlobais,
                filtros,
                produtosProcessados,
                produtosFiltrados,
                maxSalesDate,
                lastUpdate,

                setProdutosRaw,
                setVendasRaw,
                fetchVendasAnymarket,
                setParametros,
                setFiltros: (f) => setFiltrosState({ ...filtros, ...f }),
                updateOverride,
                updateOverridesBulk,
                recalcularAgora,
                limparDados,
                selectedSkus,
                setSelectedSkus: setSelectedSkusState,
                toggleSelecionarTodos: (skus) => {
                    if (selectedSkus.length === skus.length && skus.length > 0) {
                        setSelectedSkusState([]); // deselect all
                    } else {
                        setSelectedSkusState(skus); // select all
                    }
                },
                colunasVisiveis,
                setColunasVisiveis: (cols: string[]) => {
                    setColunasVisiveisState(cols);
                    const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
                    if (stored) {
                        const data = JSON.parse(stored);
                        data.colunasVisiveis = cols;
                        localStorage.setItem("@SellerDock:ReposicaoFull", JSON.stringify(data));
                    }
                }
            }}
        >
            {children}
        </ReposicaoContext.Provider>
    );
}

export function useReposicaoState() {
    const context = useContext(ReposicaoContext);
    if (!context) {
        throw new Error("useReposicaoState deve ser usado dentro de um ReposicaoProvider");
    }
    return context;
}
