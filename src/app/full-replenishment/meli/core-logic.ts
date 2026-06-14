import { ProdutoRaw, VendaRaw, ParametrosGlobais, UserOverrides, ProdutoProcessado, StatusReposicao } from "./types";

/**
 * Robust date parsing for strings or potential numeric formats.
 */
function parseDateRobust(val: any): number {
    if (!val) return NaN;
    if (val instanceof Date) return val.getTime();

    let d = new Date(val).getTime();
    if (!isNaN(d)) return d;

    // Try DD/MM/YYYY
    const parts = String(val).split('/');
    if (parts.length === 3) {
        // Assume DD/MM/YYYY order
        const [day, month, year] = parts;
        const normalizedYear = year.length === 2 ? `20${year}` : year;
        d = new Date(`${normalizedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).getTime();
    }
    return d;
}

/**
 * Gets the maximum date found in the sales data.
 * Handles potential invalid dates and future-dated records.
 */
export function getMaxDate(vendas: Record<string, VendaRaw[]>): Date | null {
    let maxTs = 0;
    const nowTs = new Date().getTime() + (1000 * 60 * 60 * 24 * 60); // 60 days buffer

    for (const sku in vendas) {
        const vendorSales = vendas[sku];
        if (!Array.isArray(vendorSales)) continue;

        for (const v of vendorSales) {
            if (!v || !v.data) continue;
            const ts = parseDateRobust(v.data);
            if (!isNaN(ts) && ts > maxTs && ts < nowTs) {
                maxTs = ts;
            }
        }
    }
    return maxTs > 0 ? new Date(maxTs) : null;
}

/**
 * Normalizes an MLB string by adding the "MLB" prefix if it's missing but numeric.
 */
export function normalizeMlb(mlb: string): string {
    const trimmed = String(mlb || "").trim();
    if (!trimmed) return "";
    // If it starts with 2-3 letters followed by numbers, it's already prefixed
    if (/^[A-Z]{2,3}\d+/i.test(trimmed)) {
        return trimmed.toUpperCase();
    }
    // If it's purely numeric and has 8-12 digits, it's likely an MLB ID missing the prefix
    if (/^\d{8,12}$/.test(trimmed)) {
        return `MLB${trimmed}`;
    }
    return trimmed.toUpperCase();
}

export function parseMLBs(mlbStr: string | number): string[] {
    if (!mlbStr) return [];
    const str = String(mlbStr);
    const tokens = str.split(/[,\;\s\n]+/).map(s => s.trim()).filter(Boolean);
    const normalized = tokens.map(normalizeMlb);
    return Array.from(new Set(normalized));
}

/**
 * Main calculation engine function.
 */
export function processProduct(
    produto: ProdutoRaw,
    vendas: VendaRaw[],
    parametros: ParametrosGlobais,
    overrides: UserOverrides,
    maxSalesDate: Date | null
): ProdutoProcessado {
    const { calculoGiroDias = 30, diasEstoquePadrao = 30, leadTime = 7, usarMediaGlobal = true } = parametros;

    let vendasQtdPeriodo = 0;
    let vendasValorLiquidoPeriodo = 0;
    let vendasValorBrutoPeriodo = 0;
    const diasComVendas = new Set<string>();

    // Important: we need a clear reference date. If missing, we fallback to today.
    const referenceDate = maxSalesDate || new Date();
    const maxTs = referenceDate.getTime();
    const minTs = maxTs - (Number(calculoGiroDias) * 86400000);

    if (Array.isArray(vendas)) {
        for (const v of vendas) {
            if (!v || !v.data) continue;

            const ts = parseDateRobust(v.data);
            if (isNaN(ts)) continue;

            if (ts > minTs && ts <= maxTs) {
                // Support legacy field names for backwards compatibility
                const qRaw = (v as any).vendaQtd ?? (v as any).vendaemquantidade ?? (v as any).vendaqtd ?? 0;
                const vLiqRaw = (v as any).vendaValorLiquido ?? (v as any).vendaemvalor ?? (v as any).valor ?? 0;
                const vBrutoRaw = (v as any).vendaValorBruto ?? (v as any).sales_amount ?? (v as any).salesamount ?? (v as any).valorbruto ?? 0;

                const qtd = Number(qRaw) || 0;
                vendasQtdPeriodo += qtd;
                vendasValorLiquidoPeriodo += Number(vLiqRaw) || 0;
                vendasValorBrutoPeriodo += Number(vBrutoRaw) || 0;

                if (qtd > 0) {
                    try {
                        const dateStr = new Date(ts).toISOString().split('T')[0];
                        diasComVendas.add(dateStr);
                    } catch (e) {
                        diasComVendas.add(String(v.data).split('T')[0]);
                    }
                }
            }
        }
    }

    let diasInativos = Math.max(0, calculoGiroDias - diasComVendas.size);
    let diasAtivos = Math.max(1, calculoGiroDias - diasInativos);
    const initialGiro = vendasQtdPeriodo / diasAtivos;
    const fullPeriodGiro = vendasQtdPeriodo / Math.max(1, calculoGiroDias);

    let giroDiarioQtd = initialGiro;

    // Regra para evitar falsos positivos de ruptura em produtos de baixo giro:
    // Se o giro nos dias ativos for baixo (< 5) E o giro total no mês for baixo (< 1),
    // consideramos que não houve ruptura (dias inativos = 0).
    if (initialGiro < 5 && fullPeriodGiro < 1) {
        diasInativos = 0;
        diasAtivos = Math.max(1, calculoGiroDias);
        giroDiarioQtd = fullPeriodGiro;
    }

    const giroDiarioValorLiquido = vendasValorLiquidoPeriodo / diasAtivos;
    const giroDiarioValorBruto = vendasValorBrutoPeriodo / diasAtivos;

    const vendaPerdidaLiquida = (vendasValorLiquidoPeriodo * diasInativos) / diasAtivos;
    const vendaPerdidaBruta = (vendasValorBrutoPeriodo * diasInativos) / diasAtivos;

    const diasEstoqueFull = giroDiarioQtd > 0 ? produto.estoqueFull / giroDiarioQtd : -1;
    const diasEstoqueTotal = giroDiarioQtd > 0 ? (produto.estoqueFull + produto.estoqueEmpresa) / giroDiarioQtd : -1;

    let diasDesejadoItem = diasEstoquePadrao;
    if (!usarMediaGlobal && overrides.diasEstoqueDesejado !== undefined) {
        diasDesejadoItem = overrides.diasEstoqueDesejado;
    }

    let sugestaoReposicao = 0;
    let estoqueAlvo = 0;
    let reposicaoBruta = 0;
    let necessidade = 0;

    // Prioritize override box size if available
    const caixa = Math.max(1, overrides.tamanhoCaixa ?? produto.tamanhoCaixa ?? 1);
    const emTransf = produto.emTransf ?? 0;

    if (giroDiarioQtd === 0) {
        necessidade = 2 * caixa;
        sugestaoReposicao = 2 * caixa;
    } else {
        estoqueAlvo = giroDiarioQtd * (diasDesejadoItem + leadTime);
        reposicaoBruta = estoqueAlvo - (produto.estoqueFull + emTransf);
        necessidade = Math.max(0, reposicaoBruta);
        sugestaoReposicao = Math.ceil(necessidade / caixa) * caixa;
    }

    // Cap suggestion by available local stock (estoqueEmpresa)
    sugestaoReposicao = Math.max(0, Math.min(sugestaoReposicao, produto.estoqueEmpresa));

    let status: StatusReposicao = "ATIVO / OK";

    const mlbCat = String(produto.mlbCatalogo || "").trim().toUpperCase();
    const mlbStd = String(produto.mlb || "").trim().toUpperCase();
    const isMlbEmpty = (val: string) => !val || val === "NULL" || val === "#N/D";

    // Respect inactivation from upload if not explicitly overridden by user
    const isAtivo = overrides.ativo !== undefined ? overrides.ativo : (produto.inativo === true ? false : true);

    if (!isAtivo) {
        status = "INATIVO";
        sugestaoReposicao = 0;
    } else if (isMlbEmpty(mlbCat) && isMlbEmpty(mlbStd)) {
        status = "NÃO CADASTRADO";
        sugestaoReposicao = 0;
    } else if (produto.estoqueFull <= 0 && produto.estoqueEmpresa <= 0) {
        status = "RUPTURA GERAL";
    } else if (produto.estoqueFull <= 0 && produto.estoqueEmpresa > 0) {
        status = "RUPTURA FULL";
    } else if (giroDiarioQtd === 0) {
        if (produto.estoqueFull > 0) {
            status = "ATIVO / SEM VENDAS";
        } else {
            status = "NOVO";
        }
    } else if (diasEstoqueFull > 0 && diasEstoqueFull < leadTime) {
        status = "ESTOQUE BAIXO";
    }

    // New calculated field: number of boxes
    const numCaixas = sugestaoReposicao / caixa;

    const asp = vendasQtdPeriodo > 0 ? vendasValorBrutoPeriodo / vendasQtdPeriodo : 0;
    const markup = produto.custoAtual > 0 ? asp / produto.custoAtual : 0;

    return {
        ...produto,
        mlbs: parseMLBs(`${produto.mlb || ""} ${produto.mlbCatalogo || ""}`),
        vendasQtdPeriodo,
        vendasValorLiquidoPeriodo,
        vendasValorBrutoPeriodo,
        giroDiarioQtd,
        giroDiarioValorLiquido,
        giroDiarioValorBruto,
        diasInativos,
        diasEstoqueFull,
        diasEstoqueTotal,
        diasDesejadoItem,
        estoqueAlvo,
        reposicaoBruta,
        sugestaoReposicao,
        necessidade,
        vendaPerdidaLiquida,
        vendaPerdidaBruta,
        asp,
        markup,
        numCaixas,
        emTransf,
        overrides,
        status
    };
}
