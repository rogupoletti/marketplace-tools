"use client";

import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { MELI_CATEGORIES, MELI_LOGISTICS, getMeliFlatFee, MELI_FULL_STORAGE_SIZES, MELI_SUPER_STORAGE_SIZES } from "@/data/meliData";

const FLAT_FEE_THRESHOLD = 79.00;

export default function MeliPage() {
    const [mode, setMode] = useState<"suggest" | "evaluate">("suggest");
    const [productCost, setProductCost] = useState<number | "">(150);
    const [targetMargin, setTargetMargin] = useState<number | "">(20);
    const [currentPrice, setCurrentPrice] = useState<number | "">(324.99);

    const [commissionClassic, setCommissionClassic] = useState<number | "">(12);
    const [specialCategory, setSpecialCategory] = useState("none");
    const [adType, setAdType] = useState<"classic" | "premium">("classic");

    // Logistics
    const [shippingChannel, setShippingChannel] = useState("full");
    const [weight, setWeight] = useState<number | "">(1.5);
    const [manualFreight, setManualFreight] = useState(false);
    const [manualFreightCost, setManualFreightCost] = useState<number | "">(25);
    const [flexFreightCost, setFlexFreightCost] = useState<number | "">(15);
    const [offerFreeShipping, setOfferFreeShipping] = useState(false);
    const [isSuperCategory, setIsSuperCategory] = useState(false); // Only used for Full
    const [storageDays, setStorageDays] = useState<number | "">(30);
    const [productSizeFull, setProductSizeFull] = useState(MELI_FULL_STORAGE_SIZES[0]);
    const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);

    // Advanced
    const [advancedEnabled, setAdvancedEnabled] = useState(true);
    const [adsPct, setAdsPct] = useState<number | "">(0);
    const [returnPct, setReturnPct] = useState<number | "">(0);
    const [erpPct, setErpPct] = useState<number | "">(0);
    const [taxesPct, setTaxesPct] = useState<number | "">(0);

    const calculateScenario = (price: number, type: "classic" | "premium") => {
        const cost = Number(productCost) || 0;
        const baseComm = Number(commissionClassic) || 0;
        const commPct = (type === "classic" ? baseComm : baseComm + 5) / 100;
        const commVal = price * commPct;

        const effectiveSpecialCategory = (shippingChannel === "full" && isSuperCategory) ? "super" : specialCategory;

        const flatFeeVal = getMeliFlatFee(price, effectiveSpecialCategory);

        let shippingVal = 0;
        if (shippingChannel === "flex") {
            shippingVal = Number(flexFreightCost) || 0;
        } else if (manualFreight) {
            shippingVal = Number(manualFreightCost) || 0;
        } else {
            const isFreeShippingOptional = price < FLAT_FEE_THRESHOLD;
            const isSuper = shippingChannel === "full" && isSuperCategory;
            const shouldApplyShippingCost = isSuper || !isFreeShippingOptional || offerFreeShipping;
            shippingVal = shouldApplyShippingCost ? MELI_LOGISTICS.full_coletas.getCost(price, Number(weight) || 0, effectiveSpecialCategory) : 0;

            // Storage cost for Full
            if (shippingChannel === "full") {
                const sDays = Number(storageDays) || 0;
                // Use correct storage sizes list based on Super
                const storageSizes = isSuperCategory ? MELI_SUPER_STORAGE_SIZES : MELI_FULL_STORAGE_SIZES;
                const sizeData = storageSizes.find(s => s.id === productSizeFull.id) || storageSizes[0];
                shippingVal += sizeData.dailyCost * sDays;
            }
        }

        let adsVal = 0, returnVal = 0, erpVal = 0, taxesVal = 0;
        if (advancedEnabled) {
            adsVal = price * (Number(adsPct) / 100);
            returnVal = price * (Number(returnPct) / 100);
            erpVal = price * (Number(erpPct) / 100);
            taxesVal = price * (Number(taxesPct) / 100);
        }

        const totalCost = cost + commVal + flatFeeVal + shippingVal + adsVal + returnVal + erpVal + taxesVal;
        const netProfit = price - totalCost;
        const netMargin = (price > 0) ? (netProfit / price) * 100 : 0;

        return {
            price,
            cost,
            commPct,
            commVal,
            flatFeeVal,
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

    const solvePriceForMargin = (target: number, type: "classic" | "premium") => {
        let low = Number(productCost) || 0;
        let high = low * 20;
        if (high < 1000) high = 5000;
        let bestPrice = high;

        for (let i = 0; i < 50; i++) {
            const mid = (low + high) / 2;
            const res = calculateScenario(mid, type);
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
        const price = mode === "suggest" ? solvePriceForMargin(Number(targetMargin) || 0, adType) : Number(currentPrice) || 0;
        return calculateScenario(price, adType);
    }, [mode, productCost, targetMargin, currentPrice, commissionClassic, specialCategory, adType, shippingChannel, flexFreightCost, weight, manualFreight, manualFreightCost, offerFreeShipping, isSuperCategory, advancedEnabled, adsPct, returnPct, erpPct, taxesPct, storageDays, productSizeFull]);

    const fmtMoney = (val: number) => "R$ " + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const handleNumericInput = (val: string, setter: (v: number | "") => void) => {
        if (val === "") setter("");
        else setter(parseFloat(val));
    };

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Calculadora Mercado Livre</h2>
                <p className="text-gray-500 mt-1">Simule seus lucros no Mercado Livre com precisão.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Modo</h3>
                        <div className="grid grid-cols-2 gap-4 p-1 bg-gray-100 rounded-lg">
                            <button
                                onClick={() => setMode("suggest")}
                                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer ${mode === "suggest" ? "bg-white shadow-sm text-meli-secondary" : "text-gray-500 hover:bg-white/50"}`}
                            >
                                Sugerir Preço
                            </button>
                            <button
                                onClick={() => setMode("evaluate")}
                                className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-sm transition-all cursor-pointer ${mode === "evaluate" ? "bg-white shadow-sm text-meli-secondary" : "text-gray-500 hover:bg-white/50"}`}
                            >
                                Avaliar Preço
                            </button>
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Configuração do Anúncio</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">Comissão Clássico (%)</label>
                                    <a
                                        href="https://www.mercadolivre.com.br/landing/custos-de-venda/tarifas-de-venda"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-meli-secondary hover:underline flex items-center gap-1"
                                    >
                                        Consultar Taxas <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={commissionClassic}
                                        onChange={(e) => handleNumericInput(e.target.value, setCommissionClassic)}
                                        className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
                                    />
                                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 text-sm font-bold">%</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">O Premium será calculado automaticamente (+5%).</p>
                            </div>
                            <div className="flex flex-col">
                                <div className="h-[22px] mb-2" /> {/* Space to match label height */}
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setAdType("classic")}
                                        className={`flex-1 py-2 rounded-md font-bold text-sm border-2 transition-all cursor-pointer ${adType === "classic" ? "border-meli-secondary bg-meli-secondary/5 text-meli-secondary" : "border-gray-200 text-gray-400"}`}
                                    >
                                        Clássico ({commissionClassic}%)
                                    </button>
                                    <button
                                        onClick={() => setAdType("premium")}
                                        className={`flex-1 py-2 rounded-md font-bold text-sm border-2 transition-all cursor-pointer ${adType === "premium" ? "border-meli-secondary bg-meli-secondary/5 text-meli-secondary" : "border-gray-200 text-gray-400"}`}
                                    >
                                        Premium ({(Number(commissionClassic) || 0) + 5}%)
                                    </button>
                                </div>
                                <div className="h-[15px] mt-1" /> {/* Space to match hint height */}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria Especial</label>
                            <div className="relative">
                                <select
                                    value={specialCategory}
                                    onChange={(e) => setSpecialCategory(e.target.value)}
                                    className="appearance-none block w-full py-2 pl-3 pr-10 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm bg-white cursor-pointer"
                                >
                                    <option value="none">Não está em categoria especial</option>
                                    <option value="books">Livros</option>
                                    <option value="pets">Alimentos de Animais</option>
                                    <option value="used">Produtos Usados</option>
                                    <option value="others_special">Outras categorias especiais</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
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
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
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
                                                className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
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
                                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
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
                                    className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
                                >
                                    <option value="full">Full</option>
                                    <option value="coleta">Coleta</option>
                                    <option value="flex">Flex</option>
                                </select>
                            </div>
                            <div>
                                {shippingChannel === "flex" ? (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Valor Médio do Frete (R$)</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm">R$</span>
                                            <input
                                                type="number"
                                                value={flexFreightCost}
                                                onChange={(e) => handleNumericInput(e.target.value, setFlexFreightCost)}
                                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Peso (kg)</label>
                                        <input
                                            type="number"
                                            value={weight}
                                            onChange={(e) => handleNumericInput(e.target.value, setWeight)}
                                            className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {shippingChannel === "full" && (
                                    <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
                                        <div>
                                            <p className="text-sm font-bold text-green-700">Produtos de Supermercado?</p>
                                            <p className="text-[10px] text-green-600">Considera isenção de taxa fixa e tabela Super</p>
                                        </div>
                                        <button
                                            onClick={() => setIsSuperCategory(!isSuperCategory)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isSuperCategory ? "bg-green-500" : "bg-gray-200"}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSuperCategory ? "translate-x-6" : "translate-x-1"}`} />
                                        </button>
                                    </div>
                                )}

                                {shippingChannel !== "flex" && (!isSuperCategory || shippingChannel !== "full") && results.price < FLAT_FEE_THRESHOLD && (
                                    <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                        <div>
                                            <p className="text-sm font-bold text-meli-secondary">Oferecer Frete Grátis</p>
                                            <p className="text-[10px] text-gray-400">Obrigatório apenas para produtos ≥ R$ 79,00</p>
                                        </div>
                                        <button
                                            onClick={() => setOfferFreeShipping(!offerFreeShipping)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${offerFreeShipping ? "bg-meli-secondary" : "bg-gray-200"}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${offerFreeShipping ? "translate-x-6" : "translate-x-1"}`} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {shippingChannel === "full" && (
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tempo de Estoque (dias)</label>
                                        <input
                                            type="number"
                                            value={storageDays}
                                            onChange={(e) => handleNumericInput(e.target.value, setStorageDays)}
                                            className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tamanho do Produto (Full)</label>
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
                                                className="w-full flex flex-col p-3 rounded-lg border border-gray-300 text-left transition-all hover:border-meli-secondary bg-white cursor-pointer"
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="text-sm font-bold text-gray-700">
                                                        {productSizeFull.name}
                                                    </span>
                                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isSizeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                                                    {productSizeFull.ex} • {productSizeFull.dims} • R$ {(isSuperCategory ? MELI_SUPER_STORAGE_SIZES : MELI_FULL_STORAGE_SIZES).find(s => s.id === productSizeFull.id)?.dailyCost.toFixed(3) || "0.000"}/dia
                                                </p>
                                            </button>

                                            {isSizeDropdownOpen && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                                    {(isSuperCategory ? MELI_SUPER_STORAGE_SIZES : MELI_FULL_STORAGE_SIZES).map((size) => (
                                                        <button
                                                            key={size.id}
                                                            onClick={() => {
                                                                setProductSizeFull(size);
                                                                setIsSizeDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex flex-col p-3 text-left transition-all hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer ${productSizeFull.id === size.id ? 'bg-meli-secondary/5' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className={`text-sm font-bold ${productSizeFull.id === size.id ? 'text-meli-secondary' : 'text-gray-700'}`}>
                                                                    {size.name}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-gray-400">R$ {size.dailyCost.toFixed(3)}/dia</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-500 mt-1">
                                                                {size.ex} • {size.dims} • {size.weight}
                                                            </p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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
                                className={`relative inline-flex h-5 w-10 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${advancedEnabled ? 'bg-meli-secondary' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${advancedEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${advancedEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Marketing (Ads %)</label>
                                <input type="number" value={adsPct} onChange={(e) => handleNumericInput(e.target.value, setAdsPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Taxa de Devolução (%)</label>
                                <input type="number" value={returnPct} onChange={(e) => handleNumericInput(e.target.value, setReturnPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Custos Operacionais / ERP (%)</label>
                                <input type="number" value={erpPct} onChange={(e) => handleNumericInput(e.target.value, setErpPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Impostos (%)</label>
                                <input type="number" value={taxesPct} onChange={(e) => handleNumericInput(e.target.value, setTaxesPct)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-meli-secondary focus:border-meli-secondary text-sm" />
                            </div>
                        </div>
                    </section>
                </div>

                <div className="lg:col-span-4 space-y-6 sticky top-24 self-start">
                    <div className="bg-white p-6 rounded-lg shadow-sm border-t-8 border-meli-primary">
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
                                <p className="text-[10px] font-bold text-meli-secondary uppercase mb-1">Margem</p>
                                <p className={`text-xl font-bold ${results.netMargin < 5 ? 'text-red-500' : results.netMargin < 15 ? 'text-yellow-600' : 'text-meli-secondary'}`}>{fmtPct(results.netMargin)}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(results.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                                    alert("Preço copiado!");
                                }}
                                className="w-full py-3 bg-meli-secondary text-white font-bold rounded-lg hover:opacity-90 transition-colors cursor-pointer"
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
                                { label: "Tarifa Fixa (< R$ 79,00)", val: results.flatFeeVal, color: "text-red-500", hide: results.flatFeeVal === 0 },
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
