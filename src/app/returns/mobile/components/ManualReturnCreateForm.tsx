"use client";

import React, { useMemo, useState } from "react";
import { Save } from "lucide-react";
import {
    MobileReturnScan,
    ReturnMarketplace,
    ReturnType,
    RETURN_TYPE_LABELS,
} from "@/lib/returns";

export interface ManualReturnFormPayload {
    scan: MobileReturnScan;
    marketplace: ReturnMarketplace;
    returnType: ReturnType;
    trackingCode: string;
    labelBarcode: string;
    labelQrPayload: string;
    operatorNotes: string;
    products: [];
}

interface ManualReturnCreateFormProps {
    scan: MobileReturnScan;
    labelPhoto?: File | null;
    onSubmit: (payload: ManualReturnFormPayload) => void;
    isSaving?: boolean;
    formId?: string;
    showSubmitButton?: boolean;
}

const MARKETPLACE_OPTIONS: Array<{ value: ReturnMarketplace; label: string }> = [
    { value: "mercado_livre", label: "Mercado Livre" },
    { value: "shopee", label: "Shopee" },
    { value: "amazon", label: "Amazon" },
    { value: "magalu", label: "Magalu" },
    { value: "ecommerce", label: "E-commerce" },
    { value: "other", label: "Outro" },
    { value: "unknown", label: "Não identificado" },
];

const RETURN_TYPE_OPTIONS: ReturnType[] = [
    "full_meli_cd",
    "full_shopee_cd",
    "full",
    "flex",
    "ecommerce",
    "other",
];

function normalizeTrackingHint(value: string) {
    return value.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, "").trim().toUpperCase();
}

function suggestManualReturnContext(value: string): { marketplace: ReturnMarketplace; returnType: ReturnType } {
    const code = normalizeTrackingHint(value);
    if (code.startsWith("BR")) return { marketplace: "shopee", returnType: "full_shopee_cd" };
    if (/^\d+$/.test(code)) return { marketplace: "mercado_livre", returnType: "full_meli_cd" };

    const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (text.includes("shopee")) return { marketplace: "shopee", returnType: "full_shopee_cd" };
    if (text.includes("mercado livre") || text.includes("mercadolivre") || text.includes("meli") || text.includes("pack id")) {
        return { marketplace: "mercado_livre", returnType: "full_meli_cd" };
    }
    if (text.includes("amazon")) return { marketplace: "amazon", returnType: "other" };
    if (text.includes("magalu") || text.includes("magazine luiza")) return { marketplace: "magalu", returnType: "other" };
    return { marketplace: "unknown", returnType: "other" };
}

export function ManualReturnCreateForm({
    scan,
    onSubmit,
    isSaving,
    formId,
    showSubmitButton = true,
}: ManualReturnCreateFormProps) {
    const initialTrackingCode = scan.scanType === "barcode" || scan.scanType === "manual" ? scan.normalizedValue : "";
    const suggestedContext = useMemo(
        () => suggestManualReturnContext(initialTrackingCode || scan.normalizedValue || scan.rawValue),
        [initialTrackingCode, scan.normalizedValue, scan.rawValue]
    );
    const [marketplace, setMarketplace] = useState<ReturnMarketplace>(suggestedContext.marketplace);
    const [returnType, setReturnType] = useState<ReturnType>(suggestedContext.returnType);
    const [trackingCode, setTrackingCode] = useState(initialTrackingCode);
    const [operatorNotes, setOperatorNotes] = useState("");
    const [autoSuggest, setAutoSuggest] = useState(true);

    const updateTrackingCode = (value: string) => {
        setTrackingCode(value);
        if (!autoSuggest) return;

        const nextSuggestion = suggestManualReturnContext(value || scan.normalizedValue || scan.rawValue);
        setMarketplace(nextSuggestion.marketplace);
        setReturnType(nextSuggestion.returnType);
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit({
            scan,
            marketplace,
            returnType,
            trackingCode,
            labelBarcode: scan.scanType === "barcode" ? scan.rawValue : "",
            labelQrPayload: scan.scanType === "qr_code" ? scan.rawValue : "",
            operatorNotes,
            products: [],
        });
    };

    return (
        <form id={formId} onSubmit={submit} className="space-y-4 pb-24">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-base font-extrabold text-gray-950">Dados identificados automaticamente</h2>
                <div className="mt-4 space-y-3">
                    <label className="block">
                        <span className="text-sm font-bold text-gray-700">Marketplace</span>
                        <select
                            value={marketplace}
                            onChange={(event) => {
                                setMarketplace(event.target.value as ReturnMarketplace);
                                setAutoSuggest(false);
                            }}
                            className="mt-2 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base font-semibold outline-none focus:border-blue-500"
                        >
                            {MARKETPLACE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-sm font-bold text-gray-700">Tipo</span>
                        <select
                            value={returnType}
                            onChange={(event) => {
                                setReturnType(event.target.value as ReturnType);
                                setAutoSuggest(false);
                            }}
                            className="mt-2 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base font-semibold outline-none focus:border-blue-500"
                        >
                            {RETURN_TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>{RETURN_TYPE_LABELS[type]}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="text-sm font-bold text-gray-700">Código lido</span>
                        <input
                            value={scan.normalizedValue}
                            readOnly
                            className="mt-2 h-12 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-base font-semibold text-gray-700"
                        />
                    </label>
                </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="text-base font-extrabold text-gray-950">Dados para preenchimento manual</h2>
                <div className="mt-4 space-y-3">
                    <label className="block">
                        <span className="text-sm font-bold text-gray-700">Código de rastreio</span>
                        <input
                            value={trackingCode}
                            onChange={(event) => updateTrackingCode(event.target.value)}
                            className="mt-2 h-12 w-full rounded-lg border border-gray-200 px-3 text-base font-semibold outline-none focus:border-blue-500"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-bold text-gray-700">Observação do operador</span>
                        <textarea
                            value={operatorNotes}
                            onChange={(event) => setOperatorNotes(event.target.value)}
                            rows={3}
                            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-3 text-base font-semibold outline-none focus:border-blue-500"
                        />
                    </label>
                </div>
            </section>

            {showSubmitButton ? (
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                >
                    <Save className="h-5 w-5" />
                    {isSaving ? "Salvando..." : "Salvar e analisar itens"}
                </button>
            ) : null}
        </form>
    );
}
