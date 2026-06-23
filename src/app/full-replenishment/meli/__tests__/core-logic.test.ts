import { describe, it, expect } from "vitest";
import { processProduct } from "../core-logic";
import { ProdutoRaw, VendaRaw, ParametrosGlobais, UserOverrides } from "../types";

describe("Mercado Livre Full Replenishment Core Logic", () => {
    // Shared parameters
    const parametros: ParametrosGlobais = {
        calculoGiroDias: 10, // 10 days period for easy calculation
        diasEstoquePadrao: 10,
        leadTime: 3,
        usarMediaGlobal: true
    };

    const overrides: UserOverrides = {
        ativo: true
    };

    const maxSalesDate = new Date("2026-06-23T12:00:00.000Z"); // Set max sales date to match mock reference

    it("should calculate correct stockout days and daily rate for SKU-TEST-01 (Low Turnover - Adjustment triggers)", () => {
        const produto: ProdutoRaw = {
            sku: "SKU-TEST-01",
            descricao: "Produto Teste 01 (Baixo Giro)",
            mlb: "MLB1001",
            mlbCatalogo: "",
            marca: "Marca Teste",
            fornecedor: "Fornecedor Teste",
            estoqueFull: 2,
            estoqueEmpresa: 10,
            precoAtual: 50.00,
            custoAtual: 20.00,
            tamanhoCaixa: 1
        };

        const vendas: VendaRaw[] = [
            { sku: "SKU-TEST-01", data: "2026-06-19", vendaQtd: 2, vendaValorBruto: 100, vendaValorLiquido: 80 },
            { sku: "SKU-TEST-01", data: "2026-06-21", vendaQtd: 3, vendaValorBruto: 150, vendaValorLiquido: 120 },
            { sku: "SKU-TEST-01", data: "2026-06-23", vendaQtd: 3, vendaValorBruto: 150, vendaValorLiquido: 120 }
        ];

        const history: Record<string, number> = {
            "2026-06-14": 5,
            "2026-06-15": 4,
            "2026-06-16": 0,
            "2026-06-17": 0,
            "2026-06-18": 2
        };

        const result = processProduct(produto, vendas, parametros, overrides, maxSalesDate, history);

        // EXPECTATIONS:
        // Passo 1 (Standard rule):
        // Dates:
        // - 14, 15, 18: active (qty > 0)
        // - 16, 17: inactive (qty = 0)
        // - 19, 21, 23: active (no snapshot, sold > 0)
        // - 20, 22: inactive (no snapshot, sold = 0)
        // Inactive: 16, 17, 20, 22 = 4 days
        // Active: 6 days. Sales = 8 units. initialGiro = 8 / 6 = 1.33. fullPeriodGiro = 8 / 10 = 0.8.
        // Passo 2 (Low turnover trigger):
        // initialGiro (1.33) < 5 and fullPeriodGiro (0.8) < 1. True!
        // Adjustment: days without snapshots and without sales (20, 22) become active.
        // Final Inactive: 2 days (16, 17 - confirmed snapshot stockout).
        // Final Active: 8 days.
        // Final Giro: 8 / 8 = 1.0.

        expect(result.diasInativos).toBe(2);
        expect(result.giroDiarioQtd).toBe(1.0);
        expect(result.diasEstoqueFull).toBe(2 / 1.0); // estoqueFull / giro
        expect(result.vendasQtdPeriodo).toBe(8);
    });

    it("should calculate correct stockout days and daily rate for SKU-TEST-02 (High Turnover - Adjustment does not trigger)", () => {
        const produto: ProdutoRaw = {
            sku: "SKU-TEST-02",
            descricao: "Produto Teste 02 (Alto Giro)",
            mlb: "MLB1002",
            mlbCatalogo: "",
            marca: "Marca Teste",
            fornecedor: "Fornecedor Teste",
            estoqueFull: 15,
            estoqueEmpresa: 50,
            precoAtual: 50.00,
            custoAtual: 20.00,
            tamanhoCaixa: 1
        };

        const vendas: VendaRaw[] = [
            { sku: "SKU-TEST-02", data: "2026-06-19", vendaQtd: 10, vendaValorBruto: 500, vendaValorLiquido: 400 },
            { sku: "SKU-TEST-02", data: "2026-06-21", vendaQtd: 20, vendaValorBruto: 1000, vendaValorLiquido: 800 },
            { sku: "SKU-TEST-02", data: "2026-06-23", vendaQtd: 30, vendaValorBruto: 1500, vendaValorLiquido: 1200 }
        ];

        const history: Record<string, number> = {
            "2026-06-14": 10,
            "2026-06-15": 5,
            "2026-06-16": 0,
            "2026-06-17": 0,
            "2026-06-18": 15
        };

        const result = processProduct(produto, vendas, parametros, overrides, maxSalesDate, history);

        // EXPECTATIONS:
        // Inactive: 16, 17, 20, 22 = 4 days
        // Active: 6 days. Sales = 60 units. initialGiro = 60 / 6 = 10.0. fullPeriodGiro = 60 / 10 = 6.0.
        // Passo 2 (Low turnover trigger):
        // initialGiro (10.0) >= 5. False!
        // No adjustment.
        // Final Inactive: 4 days.
        // Final Active: 6 days.
        // Final Giro: 60 / 6 = 10.0.

        expect(result.diasInativos).toBe(4);
        expect(result.giroDiarioQtd).toBe(10.0);
        expect(result.diasEstoqueFull).toBe(15 / 10.0);
        expect(result.vendasQtdPeriodo).toBe(60);
    });

    it("should calculate correct stockout days using sales fallback for SKU-TEST-03 (No snapshot history)", () => {
        const produto: ProdutoRaw = {
            sku: "SKU-TEST-03",
            descricao: "Produto Teste 03 (Fallback)",
            mlb: "MLB9999",
            mlbCatalogo: "",
            marca: "Marca Teste",
            fornecedor: "Fornecedor Teste",
            estoqueFull: 0,
            estoqueEmpresa: 0,
            precoAtual: 50.00,
            custoAtual: 20.00,
            tamanhoCaixa: 1
        };

        const vendas: VendaRaw[] = [
            { sku: "SKU-TEST-03", data: "2026-06-15", vendaQtd: 2, vendaValorBruto: 100, vendaValorLiquido: 80 },
            { sku: "SKU-TEST-03", data: "2026-06-17", vendaQtd: 2, vendaValorBruto: 100, vendaValorLiquido: 80 },
            { sku: "SKU-TEST-03", data: "2026-06-19", vendaQtd: 2, vendaValorBruto: 100, vendaValorLiquido: 80 },
            { sku: "SKU-TEST-03", data: "2026-06-21", vendaQtd: 2, vendaValorBruto: 100, vendaValorLiquido: 80 },
            { sku: "SKU-TEST-03", data: "2026-06-23", vendaQtd: 2, vendaValorBruto: 100, vendaValorLiquido: 80 }
        ];

        // Pass undefined or empty history
        const result = processProduct(produto, vendas, parametros, overrides, maxSalesDate, undefined);

        // EXPECTATIONS:
        // No snapshots. All 10 days fall back to sales check.
        // Active days (has sales): 15, 17, 19, 21, 23 (5 days)
        // Inactive days (no sales): 14, 16, 18, 20, 22 (5 days)
        // Total Inactive = 5 days.
        // Total Active = 5 days.
        // initialGiro = 10 / 5 = 2.0.
        // fullPeriodGiro = 10 / 10 = 1.0.
        // Low turnover check: initialGiro (2.0) < 5 and fullPeriodGiro (1.0) < 1. False (fullPeriodGiro is not < 1, it is 1).
        // No adjustment.
        // Final Inactive: 5 days.
        // Final Giro: 10 / 5 = 2.0.

        expect(result.diasInativos).toBe(5);
        expect(result.giroDiarioQtd).toBe(2.0);
        expect(result.vendasQtdPeriodo).toBe(10);
    });
});
