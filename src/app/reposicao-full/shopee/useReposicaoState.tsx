"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useRef } from "react";
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
    isFetchingSales: boolean;

    // Actions
    setProdutosRaw: (p: ProdutoRaw[]) => void;
    setVendasRaw: (v: Record<string, VendaRaw[]>) => void;
    fetchProdutosDb: () => Promise<void>;
    fetchVendasAnymarket: () => Promise<void>;
    setParametros: (p: Partial<ParametrosGlobais>) => void;
    setFiltros: (f: Partial<Filtros>) => void;
    updateOverride: (sku: string, o: Partial<UserOverrides>) => void;
    updateOverridesBulk: (skus: string[], o: Partial<UserOverrides>) => void;
    recalcularAgora: () => void;
    limparDados: () => void;
    limparTransito: () => void;
    resetUploadTrigger: number;
    selectedSkus: string[];
    setSelectedSkus: (skus: string[]) => void;
    toggleSelecionarTodos: (skus: string[]) => void;
    colunasVisiveis: string[];
    setColunasVisiveis: (cols: string[]) => void;
    setAgendamentoMap: (map: Record<string, number>) => void;
    hasAgendamento: boolean;
    hasEstoqueShopee: boolean;
    setHasEstoqueShopee: (v: boolean) => void;
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

const DEFAULT_VISIBLE_COLUMNS = [
    'sku', 'curvaABC', 'curvaABCFornecedor', 'ean', 'shopeeItemId', 'estoqueFull', 'emTransf', 'tamanhoCaixa', 'numCaixas', 'status', 'diasInativos', 'giroDiarioQtd', 'necessidade', 'qtdeMaxPermitida', 'sugestaoReposicao'
];

function ensureEanColumn(cols: unknown): string[] {
    if (!Array.isArray(cols)) return DEFAULT_VISIBLE_COLUMNS;

    const visibleColumns = cols.filter((col): col is string => typeof col === "string");
    if (visibleColumns.length === 0) return DEFAULT_VISIBLE_COLUMNS;

    if (!visibleColumns.includes("ean")) {
        const insertAfter = visibleColumns.indexOf("curvaABCFornecedor");
        visibleColumns.splice(insertAfter >= 0 ? insertAfter + 1 : 1, 0, "ean");
    }

    return visibleColumns;
}

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
    const [colunasVisiveis, setColunasVisiveisState] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
    const [isFetchingSales, setIsFetchingSales] = useState(false);
    const [resetUploadTrigger, setResetUploadTrigger] = useState(0);
    const [agendamentoMap, setAgendamentoMapState] = useState<Record<string, number>>({});
    const [hasAgendamento, setHasAgendamento] = useState(false);
    const [hasEstoqueShopee, setHasEstoqueShopee] = useState(false);

    // Load from LocalStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem("@SellerDock:ReposicaoFullShopee");
            if (stored) {
                const data = JSON.parse(stored);
                if (data.produtosRaw) setProdutosRawState(data.produtosRaw);
                // vendasRaw is no longer stored in localStorage due to size limits
                if (data.parametros) setParametrosState(data.parametros);
                if (data.overridesGlobais) setOverridesGlobaisState(data.overridesGlobais);
                if (data.lastUpdate) setLastUpdate(new Date(data.lastUpdate));
                if (data.colunasVisiveis) setColunasVisiveisState(ensureEanColumn(data.colunasVisiveis));
                if (data.agendamentoMap) {
                    setAgendamentoMapState(data.agendamentoMap);
                    setHasAgendamento(true);
                }
                if (data.hasEstoqueShopee) setHasEstoqueShopee(true);
                console.log("[ReposicaoState] Initial Shopee state loaded from localStorage");
            }
        } catch (e) {
            console.error("Failed to load state", e);
        }
        setIsLoaded(true);
    }, []);

    // Save to LocalStorage - Use effect to avoid stale closures and ensure consistency
    const isFirstRun = useRef(true);
    useEffect(() => {
        if (!isLoaded) return;

        // Skip first run after loading to avoid immediately overwriting with same data
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        const now = new Date();
        setLastUpdate(now);
        try {
            localStorage.setItem("@SellerDock:ReposicaoFullShopee", JSON.stringify({
                produtosRaw,
                // vendasRaw is excluded because it's too large for localStorage
                parametros,
                overridesGlobais,
                lastUpdate: now.toISOString(),
                colunasVisiveis: ensureEanColumn(colunasVisiveis),
                agendamentoMap,
                hasEstoqueShopee,
            }));
        } catch (e) {
            console.error("Failed to save state to localStorage (likely quota exceeded)", e);
        }
    }, [produtosRaw, vendasRaw, parametros, overridesGlobais, colunasVisiveis, agendamentoMap, hasEstoqueShopee, isLoaded]);

    // Auto-fetch data from DB when user is logged in
    useEffect(() => {
        if (user && isLoaded) {
            fetchProdutosDb().catch(() => { });
            fetchVendasAnymarket().catch(() => { });
        }
    }, [user, isLoaded]);

    const setProdutosRaw = (p: ProdutoRaw[]) => {
        setProdutosRawState(p);
    };

    const setVendasRaw = (v: Record<string, VendaRaw[]>) => {
        setVendasRawState(v);
    };

    const fetchProdutosDb = async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/reposicao-full/products", {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao buscar produtos");

            if (data.products && Array.isArray(data.products)) {
                console.log(`[ReposicaoState] Loaded ${data.products.length} products from DB`);
                setProdutosRawState(data.products);
            } else {
                console.warn("[ReposicaoState] API returned success but products array is missing or empty", data);
            }
        } catch (e) {
            console.error("Erro ao buscar produtos do DB:", e);
        }
    };



    const fetchVendasAnymarket = async () => {
        if (!user || isFetchingSales) return;
        setIsFetchingSales(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/reposicao-full/sales", {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao buscar vendas");

            const novasVendas: Record<string, VendaRaw[]> = {};
            const sales = data.sales || [];

            sales.forEach((sale: any) => {
                // User feedback: check specifically for "SHOPEE"
                const marketplace = (sale.marketplace || "").toUpperCase();
                const isShopee = marketplace === "SHOPEE";
                if (!isShopee) return;

                const sku = sale.sku;
                if (!sku) return;

                if (!novasVendas[sku]) {
                    novasVendas[sku] = [];
                }

                novasVendas[sku].push({
                    sku: sale.sku,
                    data: sale.date,
                    vendaQtd: sale.vendaQtd || 0,
                    vendaValorLiquido: sale.vendaValorLiquido || 0,
                    vendaValorBruto: sale.vendaValorBruto || 0,
                });
            });

            setVendasRawState(novasVendas);
        } catch (e) {
            console.error("Erro ao importar da Anymarket:", e);
        } finally {
            setIsFetchingSales(false);
        }
    };

    const setParametros = (p: Partial<ParametrosGlobais>) => {
        setParametrosState(prev => ({ ...prev, ...p }));
    };

    const updateOverride = (sku: string, o: Partial<UserOverrides>) => {
        setOverridesGlobaisState(prev => {
            const newOverrides = { ...prev };
            newOverrides[sku] = { ...(newOverrides[sku] || { ativo: true }), ...o };
            if (o.ativo === false && !newOverrides[sku].inativoDesde) {
                newOverrides[sku].inativoDesde = new Date().toISOString();
            } else if (o.ativo === true) {
                delete newOverrides[sku].inativoDesde;
                delete newOverrides[sku].motivoInativo;
            }
            return newOverrides;
        });
    };

    const updateOverridesBulk = (skus: string[], o: Partial<UserOverrides>) => {
        setOverridesGlobaisState(prev => {
            const newOverrides = { ...prev };
            skus.forEach(sku => {
                newOverrides[sku] = { ...(newOverrides[sku] || { ativo: true }), ...o };
                if (o.ativo === false && !newOverrides[sku].inativoDesde) {
                    newOverrides[sku].inativoDesde = new Date().toISOString();
                } else if (o.ativo === true) {
                    delete newOverrides[sku].inativoDesde;
                    delete newOverrides[sku].motivoInativo;
                }
            });
            return newOverrides;
        });
    };

    const recalcularAgora = () => {
        // Just trigger a re-save with new timestamp
        setLastUpdate(new Date());
    };

    const limparDados = () => {
        setProdutosRawState([]);
        setVendasRawState({});
        setSelectedSkusState([]);
        setLastUpdate(null);
        localStorage.removeItem("@SellerDock:ReposicaoFullShopee");
    };

    const limparTransito = () => {
        setProdutosRawState(prev => prev.map(p => ({
            ...p,
            emTransf: 0,
            estoqueFull: 0,
            shopeeItemId: "",
            shopeeModelId: ""
        })));
        setResetUploadTrigger(prev => prev + 1);
    };

    const setAgendamentoMap = (map: Record<string, number>) => {
        setAgendamentoMapState(map);
        setHasAgendamento(true);
    };

    const maxSalesDate = useMemo(() => getMaxDate(vendasRaw), [vendasRaw]);

    // Derived Processed Data
    const produtosProcessados = useMemo(() => {
        // 1. Process individual products
        const processed = produtosRaw.map(prod => {
            const sku = prod.sku;
            const vendas = vendasRaw[sku] || [];
            const overrides = overridesGlobais[sku] || { ativo: true };

            const shopeeItemId = String(prod.shopeeItemId || "").trim();
            let qtdeMaxPermitida: number | undefined = undefined;

            if (hasAgendamento) {
                qtdeMaxPermitida = agendamentoMap[shopeeItemId] || 0;
            }

            return processProduct({ ...prod, qtdeMaxPermitida }, vendas, parametros, overrides, maxSalesDate);
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
        const bySupplier: Record<string, typeof processed> = {};
        processed.forEach(p => {
            const s = p.fornecedor || "SEM FORNECEDOR";
            if (!bySupplier[s]) bySupplier[s] = [];
            bySupplier[s].push(p);
        });

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

        return processed.map(p => ({
            ...p,
            curvaABC: abcMapGlobal[p.sku] || "Z",
            curvaABCFornecedor: abcMapSupplier[p.sku] || "Z"
        }));

    }, [produtosRaw, vendasRaw, parametros, overridesGlobais, maxSalesDate, agendamentoMap, hasAgendamento]);

    const produtosFiltrados = useMemo(() => {
        return produtosProcessados.filter(item => {
            if (filtros.busca) {
                const query = filtros.busca.toLowerCase();
                const matchesSku = item.sku.toLowerCase().includes(query);
                const matchesDesc = item.descricao.toLowerCase().includes(query);
                const matchesEan = (item.ean || "").toLowerCase().includes(query);
                const matchesId = (item.shopeeItemId || "").toLowerCase().includes(query) || (item.shopeeModelId || "").toLowerCase().includes(query);
                if (!matchesSku && !matchesDesc && !matchesEan && !matchesId) return false;
            }
            if (filtros.status.length > 0) {
                if (!filtros.status.includes(item.status)) return false;
            }
            if (filtros.marca && item.marca !== filtros.marca) return false;
            if (filtros.fornecedor && item.fornecedor !== filtros.fornecedor) return false;
            if (filtros.giroMinimo > 0 && item.giroDiarioQtd < filtros.giroMinimo) return false;
            if (filtros.estoqueMax !== null && item.estoqueFull > filtros.estoqueMax) return false;
            if (filtros.reposicaoMin !== null && item.sugestaoReposicao < filtros.reposicaoMin) return false;
            return true;
        });
    }, [produtosProcessados, filtros]);

    if (!isLoaded) return null;

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
                isFetchingSales,

                setProdutosRaw,
                setVendasRaw,
                fetchProdutosDb,
                fetchVendasAnymarket,
                setParametros,
                setFiltros: (f) => setFiltrosState({ ...filtros, ...f }),
                updateOverride,
                updateOverridesBulk,
                recalcularAgora,
                limparDados,
                limparTransito,
                resetUploadTrigger,
                selectedSkus,
                setSelectedSkus: setSelectedSkusState,
                toggleSelecionarTodos: (skus) => {
                    if (selectedSkus.length === skus.length && skus.length > 0) {
                        setSelectedSkusState([]);
                    } else {
                        setSelectedSkusState(skus);
                    }
                },
                colunasVisiveis,
                setColunasVisiveis: (cols: string[]) => {
                    setColunasVisiveisState(ensureEanColumn(cols));
                },
                setAgendamentoMap,
                hasAgendamento,
                hasEstoqueShopee,
                setHasEstoqueShopee
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
