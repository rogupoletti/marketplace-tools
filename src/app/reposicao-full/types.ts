export interface ProdutoRaw {
    sku: string;
    descricao: string;
    mlb: string; // From excel, raw string
    mlbCatalogo: string;
    marca: string;
    fornecedor: string;
    estoqueFull: number;
    estoqueEmpresa: number;
    precoAtual: number;
    custoAtual: number;
    tamanhoCaixa: number;
    emTransf?: number;
    inativo?: boolean;
    motivoInativo?: string;
}

export interface VendaRaw {
    sku: string;
    data: string; // ISO date string "YYYY-MM-DD"
    vendaValorLiquido: number; // From "vendasemvalor"
    vendaValorBruto: number;   // From "sales_amount"
    vendaQtd: number;
}

export type StatusReposicao =
    | "INATIVO"
    | "NÃO CADASTRADO"
    | "ATIVO / SEM VENDAS"
    | "RUPTURA GERAL"
    | "RUPTURA FULL"
    | "ESTOQUE BAIXO"
    | "ATIVO / OK"
    | "NOVO";

export type MotivoInativo =
    | "Baixo Giro"
    | "Fora de Linha"
    | "Bloqueado Indústria"
    | "Bloqueado Marketplace";

export interface UserOverrides {
    ativo: boolean;
    motivoInativo?: MotivoInativo | string;
    inativoDesde?: string; // ISO string 
    diasEstoqueDesejado?: number;
    tamanhoCaixa?: number;
}

export interface ProdutoProcessado extends ProdutoRaw {
    // Parsed MLBs
    mlbs: string[];

    // Calculated Vendas
    vendasQtdPeriodo: number;
    vendasValorLiquidoPeriodo: number;
    vendasValorBrutoPeriodo: number;
    giroDiarioQtd: number;
    giroDiarioValorLiquido: number;
    giroDiarioValorBruto: number;
    diasInativos: number;

    // Calculated Estoque
    diasEstoqueFull: number; 
    diasEstoqueTotal: number;

    // Calculated Reposicao
    diasDesejadoItem: number;
    estoqueAlvo: number;
    reposicaoBruta: number;
    sugestaoReposicao: number;
    vendaPerdidaLiquida: number;
    vendaPerdidaBruta: number;
    asp: number;
    markup: number;

    // New calculated fields
    numCaixas: number;
    emTransf: number;

    // Status and Overrides
    overrides: UserOverrides;
    status: StatusReposicao;
}

export interface ParametrosGlobais {
    diasEstoquePadrao: number;
    leadTime: number;
    calculoGiroDias: 7 | 14 | 30 | 60 | 90;
    usarMediaGlobal: boolean; // toggle: true = global, false = defined by item
}

export interface Filtros {
    busca: string;
    status: string[]; // "Ruptura Full", "Ruptura Geral", "Estoque Ativo", "Inativo"
    marca: string; // "" for all
    fornecedor: string; // "" for all
    giroMinimo: number;
    estoqueMax: number | null;
    reposicaoMin: number | null;
}
