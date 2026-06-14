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
): Promise<{ data: Record<string, number>; errors: string[] }> {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = read(new Uint8Array(buffer), { type: 'array', cellDates: true });

                // Prefer "Resumo" sheet, fallback to first sheet
                const sheetName =
                    workbook.SheetNames.find((s) => s.toLowerCase().includes('resumo')) ||
                    workbook.SheetNames[0];
                const ws = workbook.Sheets[sheetName];

                if (!ws['!ref']) {
                    return resolve({ data: {}, errors: ['Planilha vazia.'] });
                }

                const range = utils.decode_range(ws['!ref']);
                console.log(`[TransitoParse] Sheet "${sheetName}", range: ${ws['!ref']}`);

                // ── Step 1: Find column indices by scanning header rows (rows 0-15) ──
                // We scan the worksheet cells directly to handle merged cells reliably.
                let skuCol = -1;
                let entradaPendenteCol = -1;
                let emTransferenciaCol = -1;
                let headerRow = -1;

                const maxScanRow = Math.min(15, range.e.r);
                const maxScanCol = Math.min(30, range.e.c);

                // Phase 1: Find the SKU column and its header row
                for (let r = 0; r <= maxScanRow; r++) {
                    for (let c = range.s.c; c <= maxScanCol; c++) {
                        const cell = ws[utils.encode_cell({ r, c })];
                        if (!cell) continue;
                        if (norm(cell.v) === 'sku') {
                            skuCol = c;
                            headerRow = r;
                            break;
                        }
                    }
                    if (skuCol >= 0) break;
                }

                // Phase 2: Find sub-headers ONLY near the header row (same row to +2)
                // This avoids matching summary text like "Entrada pendente" in the
                // info section at the top of the sheet.
                if (headerRow >= 0) {
                    for (let r = headerRow; r <= Math.min(headerRow + 2, range.e.r); r++) {
                        for (let c = range.s.c; c <= maxScanCol; c++) {
                            const cell = ws[utils.encode_cell({ r, c })];
                            if (!cell) continue;
                            const val = norm(cell.v);
                            if (val === 'entradapendente' && entradaPendenteCol === -1) {
                                entradaPendenteCol = c;
                            }
                            if (val === 'emtransferencia' && emTransferenciaCol === -1) {
                                emTransferenciaCol = c;
                            }
                        }
                    }
                }

                console.log(`[TransitoParse] Detected — SKU col: ${skuCol}, Entrada pendente col: ${entradaPendenteCol}, Em transferência col: ${emTransferenciaCol}, Header row: ${headerRow}`);

                if (skuCol === -1) {
                    return resolve({ data: {}, errors: ['Coluna "SKU" não encontrada nas primeiras linhas da planilha.'] });
                }

                // ── Step 2: Find the first data row ──
                // Data starts after headers/sub-headers. We scan from headerRow+1 downwards
                // and pick the first row where the SKU cell looks like an actual SKU value.
                const headerKeywords = new Set([
                    'sku', 'entradapendente', 'emtransferencia', 'devolvidas',
                    'aptas', 'extraviadas', 'naoaptas', 'emrevisao',
                    'temporariamentenaoaptas', 'vendascanceladas',
                    'devolvidaspelocomprador', 'aptasparavenda',
                    'naoaptas', 'noaptas',
                ]);

                let dataStartRow = -1;
                for (let r = headerRow + 1; r <= Math.min(headerRow + 5, range.e.r); r++) {
                    const cell = ws[utils.encode_cell({ r, c: skuCol })];
                    if (!cell || cell.v === undefined || cell.v === null) continue;

                    const cellNorm = norm(cell.v);
                    if (cellNorm && cellNorm !== '0' && !headerKeywords.has(cellNorm)) {
                        dataStartRow = r;
                        break;
                    }
                }

                if (dataStartRow === -1) {
                    return resolve({ data: {}, errors: ['Não foi possível localizar a primeira linha de dados após os cabeçalhos.'] });
                }

                console.log(`[TransitoParse] Data starts at row ${dataStartRow}`);

                // ── Step 3: Read data rows and aggregate emTransf by SKU ──
                const result: Record<string, number> = {};
                let processed = 0;

                for (let r = dataStartRow; r <= range.e.r; r++) {
                    const skuCell = ws[utils.encode_cell({ r, c: skuCol })];
                    if (!skuCell || skuCell.v === undefined || skuCell.v === null) continue;

                    const sku = String(skuCell.v).trim();
                    if (!sku || sku === '0') continue;

                    const nVal = entradaPendenteCol >= 0
                        ? parseNum(ws[utils.encode_cell({ r, c: entradaPendenteCol })]?.v)
                        : 0;
                    const oVal = emTransferenciaCol >= 0
                        ? parseNum(ws[utils.encode_cell({ r, c: emTransferenciaCol })]?.v)
                        : 0;

                    const sum = nVal + oVal;

                    if (!result[sku]) {
                        result[sku] = 0;
                    }
                    result[sku] += sum;
                    processed++;
                }

                if (processed === 0) {
                    return resolve({ data: {}, errors: ['Nenhum SKU encontrado no arquivo.'] });
                }

                const withTransit = Object.values(result).filter((v) => v > 0).length;
                console.log(`[TransitoParse] Processed ${processed} rows, ${withTransit} SKUs with items in transit`);

                resolve({ data: result, errors: [] });
            } catch (err: any) {
                resolve({ data: {}, errors: ['Erro ao processar Excel de trânsito: ' + err.message] });
            }
        };

        reader.onerror = () => resolve({ data: {}, errors: ['Erro ao ler o arquivo de trânsito.'] });
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

