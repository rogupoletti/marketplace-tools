"use client";

import React, { useMemo, useState } from "react";
import { ClipboardCheck, Flag, Send } from "lucide-react";
import {
    ReturnAnalysisDisposition,
    ReturnAnalysisItem,
    ReturnAnalysisSummaryData,
    ReturnPhoto,
    ReturnType,
} from "@/lib/returns";

interface ReturnAnalysisSummaryProps {
    items: ReturnAnalysisItem[];
    photos: ReturnPhoto[];
    returnType: ReturnType;
    isSaving?: boolean;
    formId?: string;
    showSubmitButton?: boolean;
    onFinalize: (disposition: ReturnAnalysisDisposition, generalNotes: string) => void;
}

const DISPOSITION_OPTIONS: Array<{ value: ReturnAnalysisDisposition; label: string }> = [
    { value: "resolve", label: "Resolvido / Finalizado" },
    { value: "dispute", label: "Pendente Contestação / Reembolso" },
    { value: "pending_return_invoice", label: "Pendente Nota Devolução" },
];

function summarize(items: ReturnAnalysisItem[], photos: ReturnPhoto[]): ReturnAnalysisSummaryData {
    return {
        expectedItems: items.filter((item) => !item.addedManually).length,
        okItems: items.filter((item) => item.status === "ok").length,
        problemItems: items.filter((item) => item.status === "problem" || item.status === "wrong_product" || item.status === "partial").length,
        notReceivedItems: items.filter((item) => item.status === "not_received").length,
        manuallyAddedItems: items.filter((item) => item.addedManually).length,
        photoCount: photos.length,
    };
}

function hasPendingIssue(items: ReturnAnalysisItem[]) {
    return items.some((item) => item.status !== "ok" || item.problemTypes.length > 0);
}

function suggestedDisposition(items: ReturnAnalysisItem[], returnType: ReturnType): ReturnAnalysisDisposition {
    if (hasPendingIssue(items)) return "dispute";
    if (returnType === "flex") return "pending_return_invoice";
    if (returnType === "full" || returnType === "full_meli_cd" || returnType === "full_shopee_cd") return "resolve";
    return "dispute";
}

export function ReturnAnalysisSummary({
    items,
    photos,
    returnType,
    isSaving,
    formId,
    showSubmitButton = true,
    onFinalize,
}: ReturnAnalysisSummaryProps) {
    const summary = useMemo(() => summarize(items, photos), [items, photos]);
    const defaultDisposition = useMemo(() => suggestedDisposition(items, returnType), [items, returnType]);
    const [manualDisposition, setManualDisposition] = useState<ReturnAnalysisDisposition | null>(null);
    const disposition = manualDisposition || defaultDisposition;
    const [generalNotes, setGeneralNotes] = useState("");

    const cards = [
        { label: "Itens esperados", value: summary.expectedItems },
        { label: "Recebidos OK", value: summary.okItems },
        { label: "Com problema", value: summary.problemItems },
        { label: "Não recebidos", value: summary.notReceivedItems },
        { label: "Adicionados", value: summary.manuallyAddedItems },
        { label: "Fotos", value: summary.photoCount },
    ];

    return (
        <form
            id={formId}
            onSubmit={(event) => {
                event.preventDefault();
                onFinalize(disposition, generalNotes);
            }}
            className="space-y-4 pb-24"
        >
            <section className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-extrabold text-gray-950">Resumo da análise</h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-bold text-gray-500">{card.label}</p>
                            <p className="mt-1 text-2xl font-extrabold text-gray-950">{card.value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
                <label className="block">
                    <span className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <Flag className="h-4 w-4 text-blue-600" />
                        Etapa no funil
                    </span>
                    <select
                        value={disposition}
                        onChange={(event) => setManualDisposition(event.target.value as ReturnAnalysisDisposition)}
                        className="mt-2 h-12 w-full rounded-lg border border-gray-200 bg-white px-3 text-base font-semibold outline-none focus:border-blue-500"
                    >
                        {DISPOSITION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <label className="mt-4 block">
                    <span className="text-sm font-bold text-gray-700">Observação geral</span>
                    <textarea
                        value={generalNotes}
                        onChange={(event) => setGeneralNotes(event.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-3 text-base font-semibold outline-none focus:border-blue-500"
                    />
                </label>
            </section>

            {showSubmitButton ? (
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                >
                    <Send className="h-5 w-5" />
                    {isSaving ? "Finalizando..." : "Concluir análise"}
                </button>
            ) : null}
        </form>
    );
}
