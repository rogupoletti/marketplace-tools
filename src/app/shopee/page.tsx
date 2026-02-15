"use client";

import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { SHOPEE_RATES } from "@/data/shopeeData";


export default function ShopeePage() {
    const [mode, setMode] = useState<"suggest" | "evaluate">("suggest");
    const [productCost, setProductCost] = useState<number | "">(150);
    const [targetMargin, setTargetMargin] = useState<number | "">(20);
    const [currentPrice, setCurrentPrice] = useState<number | "">(324.99);

    // Logistics
    const [shippingChannel, setShippingChannel] = useState("xpress");
    const [manualFreightCost, setManualFreightCost] = useState<number | "">(0);

    // Advanced
    const [advancedEnabled, setAdvancedEnabled] = useState(true);
    const [adsPct, setAdsPct] = useState<number | "">(0);
    const [returnPct, setReturnPct] = useState<number | "">(0);
    const [erpPct, setErpPct] = useState<number | "">(0);
    const [taxesPct, setTaxesPct] = useState<number | "">(0);

    // Core Calculation Function
    const calculateScenario = (price: number) => {
        const cost = Number(productCost) || 0;
        const comm = SHOPEE_RATES.getCommission(price);
        const commPct = comm.pct;
        const commVal = comm.total;
        const commFixed = comm.fixed;
        const commVariable = price * commPct;

        let shippingVal = 0;
        if (shippingChannel === 'entrega_rapida') {
            shippingVal = Number(manualFreightCost) || 0;
        }

        let adsVal = 0, returnVal = 0, erpVal = 0, taxesVal = 0;
        if (advancedEnabled) {
            adsVal = price * (Number(adsPct) / 100);
            returnVal = price * (Number(returnPct) / 100);
            erpVal = price * (Number(erpPct) / 100);
            taxesVal = price * (Number(taxesPct) / 100);
        }

        const totalCost = cost + commVal + shippingVal + adsVal + returnVal + erpVal + taxesVal;
        const netProfit = price - totalCost;
        const netMargin = (price > 0) ? (netProfit / price) * 100 : 0;

        return {
            price,
            cost,
            commPct,
            commVal,
            commFixed,
            commVariable,
            shippingVal,
            adsVal,
            returnVal,
            erpVal,
            taxesVal,
            totalCost,
            netProfit,
            netMargin
        };
    };

    // Binary Search for Price
    const solvePriceForMargin = (target: number) => {
        let low = Number(productCost) || 0;
        let high = low * 20;
        if (high < 1000) high = 5000;
        let bestPrice = high;

        for (let i = 0; i < 50; i++) {
            const mid = (low + high) / 2;
            const res = calculateScenario(mid);
            const diff = res.netMargin - target;
            if (Math.abs(diff) < 0.01) {
                bestPrice = mid;
                break;
            }
            if (diff < 0) low = mid;
            else high = mid;
            bestPrice = mid;
        }
        return bestPrice;
    };

    const results = useMemo(() => {
        const price = mode === "suggest" ? solvePriceForMargin(Number(targetMargin) || 0) : Number(currentPrice) || 0;
        return calculateScenario(price);
    }, [mode, productCost, targetMargin, currentPrice, shippingChannel, manualFreightCost, advancedEnabled, adsPct, returnPct, erpPct, taxesPct]);

    const fmtMoney = (val: number) => "R$ " + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const handleNumericInput = (val: string, setter: (v: number | "") => void) => {
        if (val === "") setter("");
        else setter(parseFloat(val));
    };

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Calculadora Shopee</h2>
                <p className="text-gray-500 mt-1">Ajuste os parâmetros para encontrar o preço de venda ideal.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Config Area */}
                <div className="lg:col-span-8 space-y-6">
                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Modo</h3>
                        <div className="grid grid-cols-2 gap-4 p-1 bg-gray-100 rounded-lg">
                            <button
                                onClick={() => setMode("suggest")}
                                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer ${mode === "suggest" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:bg-white/50"}`}
                            >
                                Sugerir Preço
                            </button>
                            <button
                                onClick={() => setMode("evaluate")}
                                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer ${mode === "evaluate" ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:bg-white/50"}`}
                            >
                                Avaliar Preço
                            </button>
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Produto</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Custo do Produto (R$)</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">R$</span>
                                    <input
                                        type="number"
                                        value={productCost}
                                        onChange={(e) => handleNumericInput(e.target.value, setProductCost)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                {mode === "suggest" ? (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Margem Desejada (%)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={targetMargin}
                                                onChange={(e) => handleNumericInput(e.target.value, setTargetMargin)}
                                                className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                                            />
                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 text-sm font-bold">%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Preço de Venda (R$)</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">R$</span>
                                            <input
                                                type="number"
                                                value={currentPrice}
                                                onChange={(e) => handleNumericInput(e.target.value, setCurrentPrice)}
                                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Logística</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Canal de Envio</label>
                                <select
                                    value={shippingChannel}
                                    onChange={(e) => setShippingChannel(e.target.value)}
                                    className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                                >
                                    <option value="xpress">Shopee Xpress / Correios</option>
                                    <option value="entrega_rapida">Entrega Direta / Logística do Vendedor</option>
                                    <option value="full">Shopee Full</option>
                                </select>
                            </div>
                            {shippingChannel === "entrega_rapida" && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Frete Médio (R$)</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">R$</span>
                                        <input
                                            type="number"
                                            value={manualFreightCost}
                                            onChange={(e) => handleNumericInput(e.target.value, setManualFreightCost)}
                                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Custos Avançados</h3>
                            <button
                                onClick={() => setAdvancedEnabled(!advancedEnabled)}
                                className={`relative inline-flex h-5 w-10 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${advancedEnabled ? 'bg-primary' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${advancedEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${advancedEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Marketing (Ads %)</label>
                                <input type="number" value={adsPct} onChange={(e) => handleNumericInput(e.target.value, setAdsPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Taxa de Devolução (%)</label>
                                <input type="number" value={returnPct} onChange={(e) => handleNumericInput(e.target.value, setReturnPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Custos Operacionais / ERP (%)</label>
                                <input type="number" value={erpPct} onChange={(e) => handleNumericInput(e.target.value, setErpPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Impostos (%)</label>
                                <input type="number" value={taxesPct} onChange={(e) => handleNumericInput(e.target.value, setTaxesPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm" />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Results Area */}
                <div className="lg:col-span-4 space-y-6 sticky top-24 self-start">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{mode === "suggest" ? "Preço Sugerido" : "Preço Simulado"}</p>
                        <div className="flex items-baseline gap-2 mb-6">
                            <span className="text-2xl font-bold text-gray-800">R$</span>
                            <span className="text-5xl font-extrabold text-gray-900 tracking-tight">{results.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#f0f9f4] p-3 rounded-lg">
                                <p className="text-[10px] font-bold text-success uppercase mb-1">Lucro</p>
                                <p className="text-xl font-bold text-success">{fmtMoney(results.netProfit)}</p>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Margem</p>
                                <p className={`text-xl font-bold ${results.netMargin < 5 ? 'text-red-500' : results.netMargin < 15 ? 'text-yellow-600' : 'text-blue-700'}`}>{fmtPct(results.netMargin)}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(results.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                    alert("Preço copiado!");
                                }}
                                className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-[#d44327] transition-colors cursor-pointer"
                            >
                                Copiar Preço
                            </button>
                            <button
                                onClick={() => {
                                    const rounded = Math.floor(results.price) + 0.99;
                                    if (mode === 'suggest') {
                                        setCurrentPrice(rounded);
                                        setMode('evaluate');
                                    } else {
                                        setCurrentPrice(rounded);
                                    }
                                }}
                                className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                Arredondar para .99
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">Detalhamento</h3>
                        <div className="space-y-3 text-sm">
                            {[
                                { label: "Custo do Produto", val: results.cost, color: "text-gray-500" },
                                { label: `Comissão Variável (${fmtPct(results.commPct * 100)})`, val: results.commVariable, color: "text-red-500" },
                                { label: "Adicional por Item", val: results.commFixed, color: "text-red-500" },
                                { label: "Logística", val: results.shippingVal, color: "text-red-500", hide: results.shippingVal === 0 },
                                { label: `Marketing (${fmtPct(Number(adsPct || 0))})`, val: results.adsVal, color: "text-red-500", hide: !advancedEnabled || results.adsVal === 0 },
                                { label: `Devolução (${fmtPct(Number(returnPct || 0))})`, val: results.returnVal, color: "text-red-500", hide: !advancedEnabled || results.returnVal === 0 },
                                { label: `ERP/Operacional (${fmtPct(Number(erpPct || 0))})`, val: results.erpVal, color: "text-red-500", hide: !advancedEnabled || results.erpVal === 0 },
                                { label: `Impostos (${fmtPct(Number(taxesPct || 0))})`, val: results.taxesVal, color: "text-red-500", hide: !advancedEnabled || results.taxesVal === 0 },
                            ].filter(item => !item.hide).map((item, idx) => (
                                <div key={idx} className={`flex justify-between items-center ${item.color}`}>
                                    <span className="text-gray-500 flex-1">{item.label}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-gray-400 w-16 text-right">
                                            {fmtPct((item.val / results.price) * 100)}
                                        </span>
                                        <span className={`font-semibold w-24 text-right ${item.color === 'text-gray-500' ? 'text-gray-700' : ''}`}>
                                            {fmtMoney(item.val)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
