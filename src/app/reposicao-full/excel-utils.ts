import { read, utils } from 'xlsx';
import { ProdutoRaw, VendaRaw } from './types';

/**
 * Normalizes string keys by removing accents, spaces and converting to lowercase
 * e.g., "Descrição" -> "descricao", "Estoque Full" -> "estoquefull"
 */
function normalizeKey(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Normalizes Brazilian numbers (comma as decimal, dot as thousands)
 */
function parseBrazilianNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    // Remove dots (thousands) and replace comma with dot (decimal)
    const clean = str.replace(/\./g, '').replace(',', '.').replace(/[^\d\.-]/g, '');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converts Excel Serial Date to an ISO date string "YYYY-MM-DD"
 */
function excelSerialToDateString(serial: number | string | Date): string {
    if (serial instanceof Date) {
        if (isNaN(serial.getTime())) return new Date().toISOString().split('T')[0];
        return serial.toISOString().split('T')[0];
    }
    if (typeof serial === 'string') {
        const s = serial.trim();
        if (s.includes('/')) {
            const parts = s.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                const year = y.length === 2 ? `20${y}` : y;
                return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }
        return s;
    }
    if (typeof serial === 'number') {
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date = new Date(utc_value * 1000);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }
    return String(serial);
}

/**
 * Helper to process the Products/Stock Excel file
 */
export async function parseProdutosExcel(file: File): Promise<{ data: ProdutoRaw[], errors: string[] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = read(data, { type: 'binary', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Read as array of arrays to get headers
                const rawJson: any[][] = utils.sheet_to_json(worksheet, { header: 1 });
                if (rawJson.length < 2) return resolve({ data: [], errors: ["O arquivo parece estar vazio ou não possui cabeçalhos."] });

                const headers = rawJson[0].map(h => normalizeKey(String(h || '')));

                // Map required keys to our expected object model keys
                const keyMap: Record<string, keyof ProdutoRaw> = {
                    'sku': 'sku',
                    'descricao': 'descricao',
                    'mlb': 'mlb',
                    'mlbcatalogo': 'mlbCatalogo',
                    'marca': 'marca',
                    'fornecedor': 'fornecedor',
                    'estoquefull': 'estoqueFull',
                    'estoqueempresa': 'estoqueEmpresa',
                    'precoatual': 'precoAtual',
                    'custoatual': 'custoAtual',
                    'tamanhodacaixa': 'tamanhoCaixa',
                    'tamanhocaixa': 'tamanhoCaixa',
                    'tamcaixas': 'tamanhoCaixa',
                    'tamcaixa': 'tamanhoCaixa',
                    'caixa': 'tamanhoCaixa',
                    'inativo': 'inativo',
                    'motivoinativo': 'motivoInativo',
                    'emtransf': 'emTransf'
                };

                const unrecognizedHeaders = headers.filter(h => !keyMap[h]);
                console.log("[ExcelParse] Unrecognized headers (potential missing mappings):", unrecognizedHeaders);

                const requiredKeys = ['sku', 'descricao', 'estoquefull'];
                const missingKeys = requiredKeys.filter(k => !headers.includes(k));

                // Debug logs for diagnosis
                console.log("[ExcelParse] Headers found:", headers);
                console.log("[ExcelParse] KeyMap matches:", headers.filter(h => keyMap[h]).map(h => `${h}->${keyMap[h]}`));

                if (missingKeys.length > 0) {
                    return resolve({ data: [], errors: [`Colunas obrigatórias ausentes: ${missingKeys.join(', ')}`] });
                }

                // Process rows into our type Map
                const mapBySku = new Map<string, ProdutoRaw>();

                for (let i = 1; i < rawJson.length; i++) {
                    const row = rawJson[i];
                    if (!row || row.length === 0) continue;

                    const obj: Record<string, any> = {};
                    for (let j = 0; j < headers.length; j++) {
                        const cellValue = row[j];
                        const header = headers[j];
                        if (keyMap[header]) {
                            obj[keyMap[header]] = cellValue;
                        }
                    }

                    if (!obj.sku) continue; // skip empty skus

                    const sku = String(obj.sku).trim();
                    const existing = mapBySku.get(sku);

                    const currentMlb = String(obj.mlb || '').trim();
                    const currentTamCaixa = parseBrazilianNumber(obj.tamanhoCaixa);

                    // Small debug sample
                    if (i < 10) {
                        console.log(`[ExcelParse] Row ${i} (SKU: ${sku}):`, {
                            rawTamCaixa: obj.tamanhoCaixa,
                            parsedTamCaixa: currentTamCaixa
                        });
                    }

                    if (existing) {
                        // Consolidate stocks
                        existing.estoqueFull = (existing.estoqueFull || 0) + parseBrazilianNumber(obj.estoqueFull || 0);
                        existing.estoqueEmpresa = (existing.estoqueEmpresa || 0) + parseBrazilianNumber(obj.estoqueEmpresa || 0);
                        existing.emTransf = (existing.emTransf || 0) + parseBrazilianNumber(obj.emTransf || 0);

                        // Combine MLBs
                        const mlbSet = new Set([
                            ...existing.mlb.split(/[,;\s]+/).map(s => s.trim()),
                            ...currentMlb.split(/[,;\s]+/).map(s => s.trim())
                        ].filter(Boolean));
                        existing.mlb = Array.from(mlbSet).join(', ');

                        // If existing has no box size (is 1) and we found one > 1, update it
                        if (existing.tamanhoCaixa <= 1 && currentTamCaixa > 1) {
                            existing.tamanhoCaixa = currentTamCaixa;
                        }
                    } else {
                        // Boolean conversion for 'inativo'
                        let inativo = false;
                        if (obj.inativo !== undefined) {
                            const val = String(obj.inativo).toLowerCase().trim();
                            if (val === 'true' || val === '1' || val === 'sim' || val === 's' || val === 'inativo') {
                                inativo = true;
                            }
                        }

                        mapBySku.set(sku, {
                            sku: sku,
                            descricao: String(obj.descricao || ''),
                            mlb: currentMlb,
                            mlbCatalogo: String(obj.mlbCatalogo || ''),
                            marca: String(obj.marca || ''),
                            fornecedor: String(obj.fornecedor || ''),
                            estoqueFull: parseBrazilianNumber(obj.estoqueFull || 0),
                            estoqueEmpresa: parseBrazilianNumber(obj.estoqueEmpresa || 0),
                            precoAtual: parseBrazilianNumber(obj.precoAtual || 0),
                            custoAtual: parseBrazilianNumber(obj.custoAtual || 0),
                            tamanhoCaixa: currentTamCaixa > 0 ? currentTamCaixa : 1,
                            emTransf: parseBrazilianNumber(obj.emTransf || 0),
                            inativo: inativo,
                            motivoInativo: String(obj.motivoInativo || '')
                        });
                    }
                }

                resolve({ data: Array.from(mapBySku.values()), errors: [] });
            } catch (err: any) {
                resolve({ data: [], errors: ["Erro ao processar o arquivo de Produtos: " + err.message] });
            }
        };
        reader.onerror = () => resolve({ data: [], errors: ["Erro ao ler o arquivo de Produtos."] });
        reader.readAsBinaryString(file);
    });
}

/**
 * Helper to process the Daily Sales Excel file
 */
export async function parseVendasExcel(file: File): Promise<{ data: Record<string, VendaRaw[]>, errors: string[] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = read(data, { type: 'binary', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                const rawJson: any[][] = utils.sheet_to_json(worksheet, { header: 1 });
                if (rawJson.length < 2) return resolve({ data: {}, errors: ["O arquivo parece estar vazio ou não possui cabeçalhos."] });

                const headers = rawJson[0].map(h => normalizeKey(String(h || '')));

                const keyMap: Record<string, keyof VendaRaw> = {
                    'sku': 'sku',
                    'data': 'data',
                    'vendaemvalor': 'vendaValorLiquido',
                    'salesamount': 'vendaValorBruto',
                    'vendaemquantidade': 'vendaQtd',
                    'vendaqtd': 'vendaQtd',
                };

                const requiredKeys = ['sku', 'data', 'vendaemquantidade'];
                const missingKeys = requiredKeys.filter(k => !headers.includes(k) && !headers.includes('vendaqtd'));
                if (missingKeys.length > 0 && !(headers.includes('vendaqtd'))) {
                    return resolve({
                        data: {},
                        errors: [`Colunas obrigatórias ausentes no arquivo de vendas. Procure por: sku, data, venda (em quantidade).`]
                    });
                }

                const groupedVendas: Record<string, Map<string, VendaRaw>> = {};

                for (let i = 1; i < rawJson.length; i++) {
                    const row = rawJson[i];
                    if (!row || row.length === 0) continue;

                    const obj: Record<string, any> = {};
                    for (let j = 0; j < headers.length; j++) {
                        const header = headers[j];
                        if (keyMap[header]) {
                            obj[keyMap[header]] = row[j];
                        } else if (header.includes('quantidade')) {
                            obj['vendaQtd'] = row[j];
                        } else if (header === 'valor' || header === 'vendaemvalor' || header === 'valorliquido') {
                            obj['vendaValorLiquido'] = row[j];
                        } else if (header === 'salesamount' || header === 'valorbruto' || header === 'sales_amount') {
                            obj['vendaValorBruto'] = row[j];
                        }
                    }

                    if (!obj.sku || !obj.data) continue;

                    const sku = String(obj.sku).trim();
                    const dataStr = excelSerialToDateString(obj.data);

                    if (!groupedVendas[sku]) {
                        groupedVendas[sku] = new Map<string, VendaRaw>();
                    }

                    const skuValues = groupedVendas[sku];
                    const existing = skuValues.get(dataStr);

                    const qtd = parseBrazilianNumber(obj.vendaQtd);
                    const valLiq = parseBrazilianNumber(obj.vendaValorLiquido);
                    const valBruto = parseBrazilianNumber(obj.vendaValorBruto);

                    if (existing) {
                        existing.vendaQtd += qtd;
                        existing.vendaValorLiquido += valLiq;
                        existing.vendaValorBruto += valBruto;
                    } else {
                        skuValues.set(dataStr, {
                            sku: sku,
                            data: dataStr,
                            vendaQtd: qtd,
                            vendaValorLiquido: valLiq,
                            vendaValorBruto: valBruto
                        });
                    }
                }

                // Convert Map to Array
                const finalRecord: Record<string, VendaRaw[]> = {};
                for (const [sku, map] of Object.entries(groupedVendas)) {
                    finalRecord[sku] = Array.from(map.values());
                }

                resolve({ data: finalRecord, errors: [] });
            } catch (err: any) {
                resolve({ data: {}, errors: ["Erro ao processar o arquivo de Vendas: " + err.message] });
            }
        };
        reader.onerror = () => resolve({ data: {}, errors: ["Erro ao ler o arquivo de Vendas."] });
        reader.readAsBinaryString(file);
    });
}
