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

export function parseMLBs(mlbStr: string | number): string[] {
    if (!mlbStr) return [];
    const str = String(mlbStr);
    return Array.from(new Set(str.split(/[,\;\s\n]+/).map(s => s.trim()).filter(Boolean)));
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

    const diasInativos = Math.max(0, calculoGiroDias - diasComVendas.size);
    const diasAtivos = Math.max(1, calculoGiroDias - diasInativos);

    const giroDiarioQtd = vendasQtdPeriodo / diasAtivos;
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

    // Prioritize override box size if available
    const caixa = Math.max(1, overrides.tamanhoCaixa ?? produto.tamanhoCaixa ?? 1);
    const emTransf = produto.emTransf ?? 0;

    if (giroDiarioQtd === 0) {
        sugestaoReposicao = 2 * caixa;
    } else {
        estoqueAlvo = giroDiarioQtd * (diasDesejadoItem + leadTime);
        reposicaoBruta = estoqueAlvo - (produto.estoqueFull + emTransf);
        sugestaoReposicao = Math.ceil(Math.max(0, reposicaoBruta) / caixa) * caixa;
    }

    // Cap suggestion by available local stock (estoqueEmpresa)
    sugestaoReposicao = Math.min(sugestaoReposicao, produto.estoqueEmpresa);

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
        mlbs: parseMLBs(produto.mlb || produto.mlbCatalogo),
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
