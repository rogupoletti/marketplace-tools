"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useRef } from "react";
import { ProdutoRaw, VendaRaw, ParametrosGlobais, UserOverrides, Filtros, ProdutoProcessado } from "./types";
import { processProduct, getMaxDate, normalizeMlb, parseMLBs } from "./core-logic";
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
    isFetchingMl: boolean;

    // Actions
    setProdutosRaw: (p: ProdutoRaw[]) => void;
    setVendasRaw: (v: Record<string, VendaRaw[]>) => void;
    fetchProdutosDb: () => Promise<void>;
    fetchVendasAnymarket: () => Promise<void>;
    fetchMlInventory: () => Promise<void>;
    setParametros: (p: Partial<ParametrosGlobais>) => void;
    setFiltros: (f: Partial<Filtros>) => void;
    updateOverride: (sku: string, o: Partial<UserOverrides>) => Promise<void>;
    updateOverridesBulk: (skus: string[], o: Partial<UserOverrides>) => Promise<void>;
    recalcularAgora: () => void;
    limparDados: () => void;
    limparTransito: () => void;
    selectedSkus: string[];
    setSelectedSkus: (skus: string[]) => void;
    toggleSelecionarTodos: (skus: string[]) => void;
    colunasVisiveis: string[];
    setColunasVisiveis: (cols: string[]) => void;
}

interface SaleApiItem {
    marketplace?: string;
    sku?: string;
    date?: string;
    vendaQtd?: number;
    vendaValorLiquido?: number;
    vendaValorBruto?: number;
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
    'sku', 'curvaABC', 'curvaABCFornecedor', 'ean', 'mlbs', 'estoqueFull', 'emTransf', 'tamanhoCaixa', 'numCaixas', 'status', 'diasInativos', 'giroDiarioQtd', 'necessidade', 'sugestaoReposicao'
];

const ALLOWED_VISIBLE_COLUMNS = new Set([
    'sku',
    'descricao',
    'ean',
    'curvaABC',
    'curvaABCFornecedor',
    'mlbs',
    'mlbCatalogo',
    'estoqueFull',
    'status',
    'diasInativos',
    'giroDiarioQtd',
    'vendasQtdPeriodo',
    'vendasValorLiquidoPeriodo',
    'vendasValorBrutoPeriodo',
    'vendaPerdidaLiquida',
    'vendaPerdidaBruta',
    'diasEstoqueFull',
    'diasEstoqueTotal',
    'emTransf',
    'tamanhoCaixa',
    'numCaixas',
    'sugestaoReposicao',
    'necessidade',
    'asp',
    'markup',
]);

function sanitizeVisibleColumns(cols: unknown): string[] {
    if (!Array.isArray(cols)) return DEFAULT_VISIBLE_COLUMNS;

    const sanitized = cols.filter((col): col is string => (
        typeof col === "string" && ALLOWED_VISIBLE_COLUMNS.has(col)
    ));

    if (sanitized.length === 0) return DEFAULT_VISIBLE_COLUMNS;

    if (!sanitized.includes("ean")) {
        const insertAfter = sanitized.indexOf("curvaABCFornecedor");
        sanitized.splice(insertAfter >= 0 ? insertAfter + 1 : 1, 0, "ean");
    }

    return sanitized;
}

function getMeliOverride(prod: ProdutoRaw): UserOverrides {
    const config = prod.marketplaceConfig?.mercadolivre;
    return {
        ativo: config?.ativo !== false,
        motivoInativo: config?.motivoInativo,
        inativoDesde: config?.inativoDesde,
        diasEstoqueDesejado: config?.diasEstoqueDesejado,
    };
}

function buildOverridesFromProducts(products: ProdutoRaw[]) {
    return products.reduce<Record<string, UserOverrides>>((acc, prod) => {
        acc[prod.sku] = getMeliOverride(prod);
        return acc;
    }, {});
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
    const [mlInventory, setMlInventory] = useState<Record<string, number>>({});
    const [mlInventoryHistory, setMlInventoryHistory] = useState<Record<string, Record<string, number>>>({});
    const [isFetchingMl, setIsFetchingMl] = useState(false);
    const [isFetchingSales, setIsFetchingSales] = useState(false);

    // Load from LocalStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem("@SellerDock:ReposicaoFull");
            if (stored) {
                const data = JSON.parse(stored);
                if (data.produtosRaw) setProdutosRawState(data.produtosRaw);
                // vendasRaw is no longer stored in localStorage due to size limits
                if (data.parametros) setParametrosState(data.parametros);
                if (data.lastUpdate) setLastUpdate(new Date(data.lastUpdate));
                if (data.colunasVisiveis) setColunasVisiveisState(sanitizeVisibleColumns(data.colunasVisiveis));
                console.log("[ReposicaoState] Initial state loaded from localStorage");
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
            localStorage.setItem("@SellerDock:ReposicaoFull", JSON.stringify({
                produtosRaw,
                // vendasRaw is excluded because it's too large for localStorage
                parametros,
                lastUpdate: now.toISOString(),
                colunasVisiveis: sanitizeVisibleColumns(colunasVisiveis),
            }));
        } catch (e) {
            console.error("Failed to save state to localStorage (likely quota exceeded)", e);
        }
    }, [produtosRaw, vendasRaw, parametros, colunasVisiveis, isLoaded]);

    // Auto-fetch data from DB when user is logged in
    useEffect(() => {
        if (user && isLoaded) {
            fetchProdutosDb().catch(() => {});
            fetchVendasAnymarket().catch(() => {});
            fetchMlInventory().catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const res = await fetch("/api/catalog/products", {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao buscar produtos");

            if (data.products && Array.isArray(data.products)) {
                console.log(`[ReposicaoState] Loaded ${data.products.length} products from DB`);
                setProdutosRawState(data.products);
                setOverridesGlobaisState(buildOverridesFromProducts(data.products));
            } else {
                console.warn("[ReposicaoState] API returned success but products array is missing or empty", data);
            }
        } catch (e) {
            console.error("Erro ao buscar produtos do DB:", e);
        }
    };

    const fetchMlInventory = async () => {
        if (!user || isFetchingMl) return;
        setIsFetchingMl(true);
        try {
            console.log("[Reposicao] Fetching ML inventory and history from API...");
            const idToken = await user.getIdToken();
            const res = await fetch("/api/integrations/mercadolivre/inventory?days=90", {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Erro ao buscar inventário");

            console.log(`[Reposicao] Loaded inventory for ${Object.keys(data.inventory || {}).length} MLBs and history for ${Object.keys(data.inventoryHistory || {}).length} MLBs from API`);
            setMlInventory(data.inventory || {});
            setMlInventoryHistory(data.inventoryHistory || {});
        } catch (e) {
            console.error("Erro ao buscar inventário do ML via API:", e);
        } finally {
            setIsFetchingMl(false);
        }
    };

    const fetchVendasAnymarket = async () => {
        if (!user || isFetchingSales) return;
        setIsFetchingSales(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/full-replenishment/sales", {
                headers: { "Authorization": `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao buscar vendas");

            const novasVendas: Record<string, VendaRaw[]> = {};
            const sales = (data.sales || []) as SaleApiItem[];
            
            sales.forEach((sale) => {
                // User feedback: check specifically for "MERCADO_LIVRE"
                const marketplace = (sale.marketplace || "").toUpperCase();
                const isMeli = marketplace === "MERCADO_LIVRE";
                if (!isMeli) return;

                const sku = sale.sku;
                if (!sku) return;

                if (!novasVendas[sku]) {
                    novasVendas[sku] = [];
                }
                
                novasVendas[sku].push({
                    sku,
                    data: sale.date || "",
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

    const updateOverride = async (sku: string, o: Partial<UserOverrides>) => {
        const current = overridesGlobais[sku] || { ativo: true };
        const next: UserOverrides = { ...current, ...o };
        if (o.ativo === false && !next.inativoDesde) {
            next.inativoDesde = new Date().toISOString();
        } else if (o.ativo === true) {
            delete next.inativoDesde;
            delete next.motivoInativo;
        }

        if (user) {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/catalog/products", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    sku,
                    tamanhoCaixa: o.tamanhoCaixa,
                    marketplaceConfig: {
                        mercadolivre: {
                            ativo: next.ativo,
                            motivoInativo: next.motivoInativo,
                            inativoDesde: next.inativoDesde,
                            diasEstoqueDesejado: next.diasEstoqueDesejado ?? null,
                        },
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao atualizar produto");
        }

        setOverridesGlobaisState(prev => ({ ...prev, [sku]: next }));
        setProdutosRawState(prev => prev.map(prod => prod.sku === sku ? {
            ...prod,
            tamanhoCaixa: o.tamanhoCaixa !== undefined ? Number(o.tamanhoCaixa) : prod.tamanhoCaixa,
            marketplaceConfig: {
                mercadolivre: next,
                shopee: prod.marketplaceConfig?.shopee || { ativo: true },
            },
        } : prod));
    };

    const updateOverridesBulk = async (skus: string[], o: Partial<UserOverrides>) => {
        const now = new Date().toISOString();
        const updates = skus.map(sku => {
            const current = overridesGlobais[sku] || { ativo: true };
            const next: UserOverrides = { ...current, ...o };
            if (o.ativo === false && !next.inativoDesde) {
                next.inativoDesde = now;
            } else if (o.ativo === true) {
                delete next.inativoDesde;
                delete next.motivoInativo;
            }
            return {
                sku,
                tamanhoCaixa: o.tamanhoCaixa,
                marketplaceConfig: {
                    mercadolivre: {
                        ativo: next.ativo,
                        motivoInativo: next.motivoInativo,
                        inativoDesde: next.inativoDesde,
                        diasEstoqueDesejado: o.diasEstoqueDesejado !== undefined ? next.diasEstoqueDesejado : undefined,
                    },
                },
                __next: next,
            };
        });

        if (user) {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/catalog/products", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    items: updates.map((update) => ({
                        sku: update.sku,
                        tamanhoCaixa: update.tamanhoCaixa,
                        marketplaceConfig: update.marketplaceConfig,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao atualizar produtos");
        }

        setOverridesGlobaisState(prev => {
            const newOverrides = { ...prev };
            updates.forEach(update => {
                newOverrides[update.sku] = update.__next;
            });
            return newOverrides;
        });
        setProdutosRawState(prev => prev.map(prod => {
            const update = updates.find(item => item.sku === prod.sku);
            if (!update) return prod;
            return {
                ...prod,
                tamanhoCaixa: o.tamanhoCaixa !== undefined ? Number(o.tamanhoCaixa) : prod.tamanhoCaixa,
                marketplaceConfig: {
                    mercadolivre: update.__next,
                    shopee: prod.marketplaceConfig?.shopee || { ativo: true },
                },
            };
        }));
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
        localStorage.removeItem("@SellerDock:ReposicaoFull");
    };

    const limparTransito = () => {
        const updated = produtosRaw.map(p => ({ ...p, emTransf: 0 }));
        setProdutosRawState(updated);
    };

    const maxSalesDate = useMemo(() => getMaxDate(vendasRaw), [vendasRaw]);

    // Derived Processed Data
    const produtosProcessados = useMemo(() => {
        // 1. Process individual products
        const processed = produtosRaw.map(prod => {
            const sku = prod.sku;
            const vendas = vendasRaw[sku] || [];
            const overrides = getMeliOverride(prod);
            
            const combinedMlbStr = `${prod.mlb || ""} ${prod.mlbCatalogo || ""}`;
            const rawMlbs = parseMLBs(combinedMlbStr);
            
            let maxEstoqueApi = 0;
            let foundInApi = false;
            rawMlbs.forEach(normalized => {
                let stockVal = mlInventory[normalized];
                if (stockVal === undefined) {
                    // Try non-normalized just in case
                    const original = combinedMlbStr.split(/[,\;\s\n]+/).find(s => normalizeMlb(s.trim()) === normalized);
                    if (original && mlInventory[original] !== undefined) {
                        stockVal = mlInventory[original];
                    }
                }

                if (stockVal !== undefined) {
                    maxEstoqueApi = Math.max(maxEstoqueApi, stockVal);
                    foundInApi = true;
                }
            });

            const prodWithUpdatedStock = {
                ...prod,
                estoqueFull: foundInApi ? maxEstoqueApi : prod.estoqueFull 
            };

            // Merge histories of associated MLBs (if multiple)
            let mergedHistory: Record<string, number> | undefined = undefined;
            rawMlbs.forEach(normalized => {
                let itemHistory = mlInventoryHistory[normalized];
                if (!itemHistory) {
                    const original = combinedMlbStr.split(/[,\;\s\n]+/).find(s => normalizeMlb(s.trim()) === normalized);
                    if (original) {
                        itemHistory = mlInventoryHistory[original];
                    }
                }
                if (itemHistory) {
                    if (!mergedHistory) mergedHistory = {};
                    for (const dateStr in itemHistory) {
                        const stockVal = itemHistory[dateStr];
                        mergedHistory[dateStr] = Math.max(mergedHistory[dateStr] || 0, stockVal);
                    }
                }
            });

            return processProduct(prodWithUpdatedStock, vendas, parametros, overrides, maxSalesDate, mergedHistory);
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

    }, [produtosRaw, vendasRaw, parametros, maxSalesDate, mlInventory, mlInventoryHistory]);

    const produtosFiltrados = useMemo(() => {
        return produtosProcessados.filter(item => {
            if (filtros.busca) {
                const query = filtros.busca.toLowerCase();
                const matchesSku = item.sku.toLowerCase().includes(query);
                const matchesEan = (item.ean || "").toLowerCase().includes(query);
                const matchesDesc = item.descricao.toLowerCase().includes(query);
                const matchesMlb = item.mlbs.some(mlb => mlb.toLowerCase().includes(query));
                if (!matchesSku && !matchesEan && !matchesDesc && !matchesMlb) return false;
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
                isFetchingMl,

                setProdutosRaw,
                setVendasRaw,
                fetchProdutosDb,
                fetchVendasAnymarket,
                fetchMlInventory,
                setParametros,
                setFiltros: (f) => setFiltrosState({ ...filtros, ...f }),
                updateOverride,
                updateOverridesBulk,
                recalcularAgora,
                limparDados,
                limparTransito,
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
                    setColunasVisiveisState(sanitizeVisibleColumns(cols));
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
