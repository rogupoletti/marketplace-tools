"use client";

import { useState, useMemo } from "react";
import { AMAZON_CATEGORIES, AMAZON_LOGISTICS, AMAZON_FBA_STORAGE_SIZES } from "@/data/amazonData";

export default function AmazonPage() {
    const [mode, setMode] = useState<"suggest" | "evaluate">("suggest");
    const [productCost, setProductCost] = useState<number | "">(150);
    const [targetMargin, setTargetMargin] = useState<number | "">(20);
    const [currentPrice, setCurrentPrice] = useState<number | "">(324.99);

    const [selectedCategory, setSelectedCategory] = useState(AMAZON_CATEGORIES[0]);
    const [plan, setPlan] = useState<"professional" | "individual">("professional");
    const [shippingChannel, setShippingChannel] = useState<"dba" | "fba" | "fba_onsite" | "seller">("dba");
    const [weight, setWeight] = useState<number | "">(1.0);
    const [productSize, setProductSize] = useState(AMAZON_FBA_STORAGE_SIZES[2]); // Default M
    const [storageDays, setStorageDays] = useState<number | "">(30);
    const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
    const [manualFreightCost, setManualFreightCost] = useState<number | "">(20);
    const [installments, setInstallments] = useState(true);

    // Advanced
    const [advancedEnabled, setAdvancedEnabled] = useState(true);
    const [adsPct, setAdsPct] = useState<number | "">(0);
    const [returnPct, setReturnPct] = useState<number | "">(0);
    const [erpPct, setErpPct] = useState<number | "">(0);
    const [taxesPct, setTaxesPct] = useState<number | "">(0);

    const calculateScenario = (price: number) => {
        const cost = Number(productCost) || 0;

        // Commission
        let commVal = 0;
        if (selectedCategory.tiers) {
            let remainingPrice = price;
            let lastLimit = 0;
            for (const tier of selectedCategory.tiers) {
                const tierWindow = tier.limit - lastLimit;
                const amountInTier = Math.min(remainingPrice, tierWindow);
                commVal += amountInTier * (tier.pct / 100);
                remainingPrice -= amountInTier;
                lastLimit = tier.limit;
                if (remainingPrice <= 0) break;
            }
        } else {
            const commPct = (selectedCategory.feePct || 0) / 100;
            commVal = price * commPct;
        }

        if (commVal < selectedCategory.minFee) commVal = selectedCategory.minFee;
        const effectiveCommPct = price > 0 ? (commVal / price) * 100 : 0;

        // Closing Fee (Individual Plan)
        const closingFee = plan === "individual" ? 2.00 : 0;

        // Logistics
        let shippingVal = 0;
        const w = Number(weight) || 0.1;

        if (shippingChannel === "dba") {
            shippingVal = AMAZON_LOGISTICS.dba.getCost(price, w);
        } else if (shippingChannel === "fba") {
            const days = Number(storageDays) || 30;
            const storageMonthly = AMAZON_LOGISTICS.fba.getStorage(productSize.volume);
            shippingVal = AMAZON_LOGISTICS.fba.getFulfillment(price, w) + ((storageMonthly / 30) * days);
        } else if (shippingChannel === "fba_onsite") {
            shippingVal = AMAZON_LOGISTICS.fbaOnsite.getCost(price, w);
        } else {
            shippingVal = Number(manualFreightCost) || 0;
        }

        // Installments (1.5% if price > 40)
        let installmentsVal = 0;
        if (installments && price > 40) {
            installmentsVal = price * 0.015;
        }

        // Advanced
        let adsVal = 0, returnVal = 0, erpVal = 0, taxesVal = 0;
        if (advancedEnabled) {
            adsVal = price * (Number(adsPct) / 100);
            returnVal = price * (Number(returnPct) / 100);
            erpVal = price * (Number(erpPct) / 100);
            taxesVal = price * (Number(taxesPct) / 100); // Taxes usually applied on price
        }

        const totalCost = cost + commVal + closingFee + shippingVal + installmentsVal + adsVal + returnVal + erpVal + taxesVal;
        const netProfit = price - totalCost;
        const netMargin = (price > 0) ? (netProfit / price) * 100 : 0;

        return {
            price,
            cost,
            commPct: effectiveCommPct / 100,
            commVal,
            closingFee,
            shippingVal,
            installmentsVal,
            adsVal, returnVal, erpVal, taxesVal,
            totalCost,
            netProfit,
            netMargin
        };
    };

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
    }, [mode, productCost, targetMargin, currentPrice, selectedCategory, plan, shippingChannel, weight, productSize, storageDays, manualFreightCost, installments, advancedEnabled, adsPct, returnPct, erpPct, taxesPct]);

    const fmtMoney = (val: number) => "R$ " + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const handleNumericInput = (val: string, setter: (v: number | "") => void) => {
        if (val === "") setter("");
        else setter(parseFloat(val));
    };

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Calculadora Amazon</h2>
                <p className="text-gray-500 mt-1">Simule seus lucros na Amazon com precisão.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Modo</h3>
                        <div className="grid grid-cols-2 gap-4 p-1 bg-gray-100 rounded-lg">
                            <button
                                onClick={() => setMode("suggest")}
                                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer ${mode === "suggest" ? "bg-white shadow-sm text-secondary" : "text-gray-500 hover:bg-white/50"}`}
                            >
                                Sugerir Preço
                            </button>
                            <button
                                onClick={() => setMode("evaluate")}
                                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer ${mode === "evaluate" ? "bg-white shadow-sm text-secondary" : "text-gray-500 hover:bg-white/50"}`}
                            >
                                Avaliar Preço
                            </button>
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Categoria e Plano</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
                                <select
                                    value={selectedCategory.name}
                                    onChange={(e) => {
                                        const cat = AMAZON_CATEGORIES.find(c => c.name === e.target.value);
                                        if (cat) setSelectedCategory(cat);
                                    }}
                                    className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
                                >
                                    {AMAZON_CATEGORIES.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Plano de Venda</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setPlan("professional")}
                                        className={`flex-1 py-2 rounded-md font-bold text-sm border-2 transition-all cursor-pointer ${plan === "professional" ? "border-secondary bg-secondary/10 text-secondary" : "border-gray-200 text-gray-400"}`}
                                    >
                                        Profissional
                                    </button>
                                    <button
                                        onClick={() => setPlan("individual")}
                                        className={`flex-1 py-2 rounded-md font-bold text-sm border-2 transition-all cursor-pointer ${plan === "individual" ? "border-secondary bg-secondary/10 text-secondary" : "border-gray-200 text-gray-400"}`}
                                    >
                                        Individual (+R$ 2)
                                    </button>
                                </div>
                            </div>
                        </div>
                        {((mode === "evaluate" && Number(currentPrice) > 40) || (mode === "suggest" && results.price > 40)) && (
                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="installments"
                                    checked={installments}
                                    onChange={(e) => setInstallments(e.target.checked)}
                                    className="rounded text-secondary focus:ring-secondary"
                                />
                                <label htmlFor="installments" className="text-sm text-gray-700 select-none cursor-pointer font-medium">
                                    Oferecer Parcelamento sem Juros (+1.5% taxa)
                                </label>
                            </div>
                        )}
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
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
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
                                                className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
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
                                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
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
                                    onChange={(e) => setShippingChannel(e.target.value as any)}
                                    className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
                                >
                                    <option value="dba">DBA - Delivery by Amazon</option>
                                    <option value="fba">FBA - Fulfillment by Amazon</option>
                                    <option value="fba_onsite">FBA Onsite</option>
                                    <option value="seller">Logística do Vendedor</option>
                                </select>
                            </div>
                            {shippingChannel === "seller" ? (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Frete Médio (R$)</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">R$</span>
                                        <input
                                            type="number"
                                            value={manualFreightCost}
                                            onChange={(e) => handleNumericInput(e.target.value, setManualFreightCost)}
                                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(shippingChannel === "fba" || shippingChannel === "dba" || shippingChannel === "fba_onsite") && (mode === "evaluate" ? Number(currentPrice) >= 79 : results.price >= 79) ? (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Peso Estimado (kg)</label>
                                            <input
                                                type="number"
                                                value={weight}
                                                onChange={(e) => handleNumericInput(e.target.value, setWeight)}
                                                className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
                                                step="0.1"
                                            />
                                        </div>
                                    ) : (
                                        (shippingChannel === "dba" || shippingChannel === "fba" || shippingChannel === "fba_onsite") && (
                                            <div className="flex items-center text-gray-500 text-sm italic pt-8">
                                                Custo logístico fixo por preço (abaixo de R$ 79)
                                            </div>
                                        )
                                    )}
                                    {shippingChannel === "fba" && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Tempo de Estoque (dias)</label>
                                            <input
                                                type="number"
                                                value={storageDays}
                                                onChange={(e) => handleNumericInput(e.target.value, setStorageDays)}
                                                className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm"
                                                min="1"
                                            />
                                        </div>
                                    )}
                                    {shippingChannel === "fba" && (
                                        <div className="col-span-full mt-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Tamanho do Produto (aproximado)</label>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
                                                    className="w-full flex flex-col p-4 rounded-xl border-2 text-left transition-all border-secondary bg-secondary/5 ring-1 ring-secondary cursor-pointer"
                                                >
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="text-sm font-bold text-secondary">
                                                            {productSize.name}
                                                        </span>
                                                        <svg className={`w-5 h-5 text-secondary transition-transform ${isSizeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                                        {productSize.ex}
                                                    </p>
                                                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100/50">
                                                        <span className="text-[10px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded shadow-sm">
                                                            {productSize.dims}
                                                        </span>
                                                        <span className="text-[10px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded shadow-sm">
                                                            ({productSize.label})
                                                        </span>
                                                    </div>
                                                </button>

                                                {isSizeDropdownOpen && (
                                                    <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-xl border-2 border-gray-100 shadow-xl overflow-hidden max-h-[400px] overflow-y-auto">
                                                        {AMAZON_FBA_STORAGE_SIZES.map((size) => (
                                                            <button
                                                                key={size.id}
                                                                onClick={() => {
                                                                    setProductSize(size);
                                                                    setIsSizeDropdownOpen(false);
                                                                }}
                                                                className={`w-full flex flex-col p-4 text-left transition-all hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer ${productSize.id === size.id ? 'bg-secondary/5' : ''}`}
                                                            >
                                                                <span className={`text-sm font-bold ${productSize.id === size.id ? 'text-secondary' : 'text-gray-800'}`}>
                                                                    {size.name}
                                                                </span>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    {size.ex}
                                                                </p>
                                                                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50/50">
                                                                    <span className="text-[10px] font-medium text-gray-400">
                                                                        {size.dims}
                                                                    </span>
                                                                    <span className="text-[10px] font-medium text-gray-400">
                                                                        ({size.label})
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Custos Avançados</h3>
                            <button
                                onClick={() => setAdvancedEnabled(!advancedEnabled)}
                                className={`relative inline-flex h-5 w-10 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${advancedEnabled ? 'bg-secondary' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${advancedEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${advancedEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Marketing (Ads %)</label>
                                <input type="number" value={adsPct} onChange={(e) => handleNumericInput(e.target.value, setAdsPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Taxa de Devolução (%)</label>
                                <input type="number" value={returnPct} onChange={(e) => handleNumericInput(e.target.value, setReturnPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Custos Operacionais / ERP (%)</label>
                                <input type="number" value={erpPct} onChange={(e) => handleNumericInput(e.target.value, setErpPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Impostos (%)</label>
                                <input type="number" value={taxesPct} onChange={(e) => handleNumericInput(e.target.value, setTaxesPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-secondary focus:border-secondary text-sm" />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Results Area */}
                <div className="lg:col-span-4 space-y-6 sticky top-24 self-start">
                    <div className="bg-white p-6 rounded-lg shadow-sm border-t-8 border-secondary">
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
                                className="w-full py-3 bg-secondary text-white font-bold rounded-lg hover:opacity-90 transition-colors cursor-pointer"
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
                                { label: `Comissão (${fmtPct(results.commPct * 100)})`, val: results.commVal, color: "text-red-500" },
                                { label: "Taxa Fixa (Individual)", val: results.closingFee, color: "text-red-500", hide: results.closingFee === 0 },
                                { label: "Logística", val: results.shippingVal, color: "text-red-500", hide: results.shippingVal === 0 },
                                { label: "Taxa Parcelamento (1.5%)", val: results.installmentsVal, color: "text-red-500", hide: results.installmentsVal === 0 },
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
