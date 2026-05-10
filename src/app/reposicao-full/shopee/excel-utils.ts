import { read, utils } from 'xlsx';

/**
 * Parses a numeric value, handling Brazilian formatting (comma as decimal).
 */
function parseNum(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    const clean = str.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
}

/**
 * Normalizes a header string for comparison: lowercase, no accents, no spaces.
 */
function norm(s: any): string {
    return String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '');
}

/**
 * Parses the Mercado Livre Full stock report (Excel) to extract "Em Trânsito" data.
 *
 * Expected Excel layout (sheet "Resumo"):
 *   - Row 10 (0-indexed row 9): Main headers — "Código ML", "SKU", "Produto", etc.
 *   - Row 11 (0-indexed row 10): Sub-headers — "Entrada pendente" (col N), "Em transferência" (col O)
 *   - Row 13+ (0-indexed row 12+): Data rows
 *   - Column D: SKU
 *
 * The function sums columns N (Entrada pendente) and O (Em transferência) per SKU.
 *
 * Returns a map of { sku: emTransf }.
 * This import ONLY provides data for the "Em Transf" column — no other fields are touched.
 */
export async function parseTransitoExcel(
    file: File
): Promise<{ data: Record<string, { estoqueFull: number; emTransf: number; shopeeItemId: string; shopeeModelId: string }>; errors: string[] }> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = read(new Uint8Array(buffer), { type: 'array', cellDates: true });

                const sheetName = workbook.SheetNames[0];
                const ws = workbook.Sheets[sheetName];

                if (!ws['!ref']) {
                    return resolve({ data: {}, errors: ['Planilha vazia.'] });
                }

                const range = utils.decode_range(ws['!ref']);
                let skuCol = -1; // Seller SKU ID (Col D)
                let sellableCol = -1; // Sellable (Col L)
                let pendingCol = -1; // Pending ASN Inbound (Col K)
                let shopSkuCol = -1; // Shop SKU ID (Col F)
                let headerRow = -1;

                const maxScanRow = Math.min(15, range.e.r);
                const maxScanCol = Math.min(30, range.e.c);

                // Find headers
                for (let r = 0; r <= maxScanRow; r++) {
                    for (let c = range.s.c; c <= maxScanCol; c++) {
                        const cell = ws[utils.encode_cell({ r, c })];
                        if (!cell) continue;
                        const val = norm(cell.v);
                        if (val === 'sellerskuid') skuCol = c;
                        else if (val === 'sellable') sellableCol = c;
                        else if (val === 'pendingasninbound') pendingCol = c;
                        else if (val === 'shopskuid') shopSkuCol = c;
                    }
                    if (skuCol >= 0) {
                        headerRow = r;
                        break;
                    }
                }

                if (skuCol === -1) {
                    return resolve({ data: {}, errors: ['Coluna "Seller SKU ID" não encontrada.'] });
                }

                const result: Record<string, { estoqueFull: number; emTransf: number; shopeeItemId: string; shopeeModelId: string }> = {};
                let processed = 0;

                for (let r = headerRow + 1; r <= range.e.r; r++) {
                    const skuCell = ws[utils.encode_cell({ r, c: skuCol })];
                    if (!skuCell || skuCell.v === undefined || skuCell.v === null) continue;

                    const sku = String(skuCell.v).trim();
                    if (!sku || sku === '0') continue;

                    const sellable = sellableCol >= 0 ? parseNum(ws[utils.encode_cell({ r, c: sellableCol })]?.v) : 0;
                    const pending = pendingCol >= 0 ? parseNum(ws[utils.encode_cell({ r, c: pendingCol })]?.v) : 0;

                    let shopeeItemId = '';
                    let shopeeModelId = '';

                    if (shopSkuCol >= 0) {
                        const shopSkuCell = ws[utils.encode_cell({ r, c: shopSkuCol })];
                        if (shopSkuCell && shopSkuCell.v !== undefined) {
                            const shopSkuStr = String(shopSkuCell.v).trim();
                            const parts = shopSkuStr.split('_');
                            if (parts.length > 0) shopeeItemId = parts[0];
                            if (parts.length > 1) shopeeModelId = parts[1];
                        }
                    }

                    result[sku.toUpperCase()] = {
                        estoqueFull: sellable,
                        emTransf: pending,
                        shopeeItemId,
                        shopeeModelId
                    };
                    processed++;
                }

                if (processed === 0) {
                    return resolve({ data: {}, errors: ['Nenhum SKU encontrado no arquivo.'] });
                }

                resolve({ data: result, errors: [] });
            } catch (err: any) {
                resolve({ data: {}, errors: ['Erro ao processar Excel: ' + err.message] });
            }
        };

        reader.onerror = () => resolve({ data: {}, errors: ['Erro ao ler o arquivo.'] });
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parses an Excel file for Cadastros to extract MARCA, FORNECEDOR, and TAM. CAIXA.
 * Expected columns: SKU, MARCA, FORNECEDOR, TAM. CAIXA (or TAMANHO CAIXA, etc).
 */
export async function parseCadastrosExcel(
    file: File
): Promise<{ data: Array<{ sku: string; marca?: string; fornecedor?: string; tamanhoCaixa?: number }>; errors: string[] }> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = read(new Uint8Array(buffer), { type: 'array', cellDates: true });
                const ws = workbook.Sheets[workbook.SheetNames[0]];

                if (!ws['!ref']) {
                    return resolve({ data: [], errors: ['Planilha vazia.'] });
                }

                const range = utils.decode_range(ws['!ref']);
                let skuCol = -1;
                let marcaCol = -1;
                let fornecedorCol = -1;
                let tamCaixaCol = -1;
                let headerRow = -1;

                // Find headers
                const maxScanRow = Math.min(10, range.e.r);
                for (let r = 0; r <= maxScanRow; r++) {
                    for (let c = range.s.c; c <= range.e.c; c++) {
                        const cell = ws[utils.encode_cell({ r, c })];
                        if (!cell) continue;
                        const val = norm(cell.v);
                        if (val === 'sku') skuCol = c;
                        else if (val === 'marca' || val === 'brand') marcaCol = c;
                        else if (val === 'fornecedor' || val === 'industry') fornecedorCol = c;
                        else if ((val.includes('tam') && val.includes('caixa')) || val === 'quantity_per_crate' || val === 'quantitypercrate') tamCaixaCol = c;
                    }
                    if (skuCol !== -1) {
                        headerRow = r;
                        break;
                    }
                }

                if (skuCol === -1) {
                    return resolve({ data: [], errors: ['Coluna "SKU" não encontrada.'] });
                }

                if (marcaCol === -1 && fornecedorCol === -1 && tamCaixaCol === -1) {
                    return resolve({ data: [], errors: ['Nenhuma das colunas adicionais encontrada. Certifique-se de que a planilha contenha pelo menos uma destas colunas: "MARCA", "FORNECEDOR" ou "TAM. CAIXA".'] });
                }

                const result: Array<{ sku: string; marca?: string; fornecedor?: string; tamanhoCaixa?: number }> = [];

                for (let r = headerRow + 1; r <= range.e.r; r++) {
                    const skuCell = ws[utils.encode_cell({ r, c: skuCol })];
                    if (!skuCell || skuCell.v === undefined || skuCell.v === null) continue;

                    const sku = String(skuCell.v).trim();
                    if (!sku || sku === '0') continue;

                    const item: { sku: string; marca?: string; fornecedor?: string; tamanhoCaixa?: number } = { sku };

                    if (marcaCol !== -1) {
                        const mCell = ws[utils.encode_cell({ r, c: marcaCol })];
                        if (mCell && mCell.v !== undefined) item.marca = String(mCell.v).trim();
                    }
                    if (fornecedorCol !== -1) {
                        const fCell = ws[utils.encode_cell({ r, c: fornecedorCol })];
                        if (fCell && fCell.v !== undefined) item.fornecedor = String(fCell.v).trim();
                    }
                    if (tamCaixaCol !== -1) {
                        const tCell = ws[utils.encode_cell({ r, c: tamCaixaCol })];
                        if (tCell && tCell.v !== undefined) item.tamanhoCaixa = parseNum(tCell.v);
                    }

                    result.push(item);
                }

                resolve({ data: result, errors: [] });
            } catch (err: any) {
                resolve({ data: [], errors: ['Erro ao processar Excel: ' + err.message] });
            }
        };

        reader.onerror = () => resolve({ data: [], errors: ['Erro ao ler o arquivo.'] });
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parses the Shopee Agendamento Full report.
 * Expected columns:
 * - Item ID (Col C)
 * - Qtd a Solicitar - Semana Atual (Col L)
 * 
 * Returns a record of { itemId: maxQty }.
 */
export async function parseAgendamentoExcel(
    file: File
): Promise<{ data: Record<string, number>; errors: string[] }> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = read(new Uint8Array(buffer), { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];

                if (!ws['!ref']) {
                    return resolve({ data: {}, errors: ['Planilha vazia.'] });
                }

                const range = utils.decode_range(ws['!ref']);
                let itemIdCol = -1;
                let qtdCol = -1;
                let headerRow = -1;

                // Scan for headers "Item ID" and "Qtd a Solicitar"
                const maxScanRow = Math.min(20, range.e.r);
                for (let r = 0; r <= maxScanRow; r++) {
                    for (let c = range.s.c; c <= range.e.c; c++) {
                        const cell = ws[utils.encode_cell({ r, c })];
                        if (!cell) continue;
                        const val = norm(cell.v);
                        if (val === 'itemid') itemIdCol = c;
                        else if (val.includes('qtdasolicitar')) qtdCol = c;
                    }
                    if (itemIdCol !== -1 && qtdCol !== -1) {
                        headerRow = r;
                        break;
                    }
                }

                // Fallback to C and L if headers not found by name
                if (itemIdCol === -1) itemIdCol = 2; // Col C
                if (qtdCol === -1) qtdCol = 11; // Col L
                if (headerRow === -1) headerRow = 0;

                const result: Record<string, number> = {};
                let processed = 0;

                for (let r = headerRow + 1; r <= range.e.r; r++) {
                    const idCell = ws[utils.encode_cell({ r, c: itemIdCol })];
                    if (!idCell || idCell.v === undefined || idCell.v === null) continue;

                    const itemId = String(idCell.v).trim();
                    if (!itemId || itemId === '0') continue;

                    const qtd = parseNum(ws[utils.encode_cell({ r, c: qtdCol })]?.v);
                    
                    result[itemId] = qtd;
                    processed++;
                }

                if (processed === 0) {
                    return resolve({ data: {}, errors: ['Nenhum item encontrado no arquivo.'] });
                }

                resolve({ data: result, errors: [] });
            } catch (err: any) {
                resolve({ data: {}, errors: ['Erro ao processar Excel: ' + err.message] });
            }
        };

        reader.onerror = () => resolve({ data: {}, errors: ['Erro ao ler o arquivo.'] });
        reader.readAsArrayBuffer(file);
    });
}
