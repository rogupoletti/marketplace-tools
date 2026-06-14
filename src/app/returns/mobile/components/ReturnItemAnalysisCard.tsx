"use client";

import React, { useMemo, useState } from "react";
import { Camera, Check, Minus, Plus, Trash2 } from "lucide-react";
import {
    ReturnAnalysisItem,
    ReturnAnalysisItemStatus,
    ReturnPhoto,
    ReturnPhotoType,
    ReturnProblemType,
} from "@/lib/returns";

interface ReturnItemAnalysisCardProps {
    item: ReturnAnalysisItem;
    index: number;
    total: number;
    photos: ReturnPhoto[];
    disabled?: boolean;
    onChange: (item: ReturnAnalysisItem) => void;
    onDelete?: (item: ReturnAnalysisItem) => void;
    onPhotoUpload: (item: ReturnAnalysisItem, file: File, type: ReturnPhotoType) => void;
    isPhotoUploading?: boolean;
}

const STATUS_OPTIONS: Array<{ value: ReturnAnalysisItemStatus; label: string }> = [
    { value: "ok", label: "Recebido OK" },
    { value: "problem", label: "Recebido com problema" },
    { value: "not_received", label: "Não recebido" },
];

const PROBLEM_OPTIONS: Array<{ value: ReturnProblemType; label: string }> = [
    { value: "damaged", label: "Avariado" },
    { value: "package_violated", label: "Embalagem violada" },
    { value: "missing_part", label: "Faltando peça/acessório" },
    { value: "used_product", label: "Produto usado" },
    { value: "wrong_product", label: "Produto errado" },
    { value: "expired_product", label: "Produto vencido" },
    { value: "partial_quantity", label: "Quantidade parcial" },
    { value: "not_resellable", label: "Sem condições de revenda" },
    { value: "other", label: "Outro" },
];

function needsPhoto(status: ReturnAnalysisItemStatus) {
    return status === "problem";
}

export function ReturnItemAnalysisCard({
    item,
    index,
    total,
    photos,
    disabled,
    onChange,
    onDelete,
    onPhotoUpload,
    isPhotoUploading,
}: ReturnItemAnalysisCardProps) {
    const [draftState, setDraftState] = useState({
        itemId: item.id,
        updatedAt: item.updatedAt,
        value: item,
    });
    const itemPhotos = useMemo(() => photos.filter((photo) => photo.itemId === item.id), [item.id, photos]);
    const draft = draftState.itemId === item.id && draftState.updatedAt === item.updatedAt ? draftState.value : item;
    const setDraft = (update: ReturnAnalysisItem | ((current: ReturnAnalysisItem) => ReturnAnalysisItem)) => {
        setDraftState((current) => {
            const currentValue = current.itemId === item.id && current.updatedAt === item.updatedAt ? current.value : item;
            const nextValue = typeof update === "function" ? update(currentValue) : update;
            onChange(nextValue);
            return {
                itemId: item.id,
                updatedAt: item.updatedAt,
                value: nextValue,
            };
        });
    };
    const hasProblemPhoto = itemPhotos.length > 0;

    const setReceivedQty = (nextQty: number) => {
        const receivedQty = Math.max(0, nextQty);
        setDraft((current) => ({
            ...current,
            receivedQty,
            status: receivedQty === 0 ? "not_received" : current.status === "not_received" ? "ok" : current.status,
        }));
    };

    const toggleProblem = (problemType: ReturnProblemType) => {
        setDraft((current) => ({
            ...current,
            problemTypes: current.problemTypes.includes(problemType)
                ? current.problemTypes.filter((itemType) => itemType !== problemType)
                : [...current.problemTypes, problemType],
        }));
    };

    return (
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-600">Produto {index + 1} de {total}</p>
                    <h2 className="mt-1 break-words text-lg font-extrabold text-gray-950">
                        {draft.productName || "Produto sem descrição"}
                    </h2>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-500">SKU: {draft.sku || "-"}</p>
                    {draft.ean ? <p className="mt-1 text-sm text-gray-500">EAN: {draft.ean}</p> : null}
                </div>
                {!draft.addedManually ? (
                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                        <p className="text-xs font-bold text-gray-500">Esperado</p>
                        <p className="text-lg font-extrabold text-gray-950">{draft.expectedQty}</p>
                    </div>
                ) : null}
            </div>

            {draft.addedManually ? (
                <div className="mt-4 space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-extrabold text-blue-950">Produto adicionado manualmente</p>
                        {item.id && onDelete ? (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onDelete(item)}
                                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-white text-rose-700 disabled:text-gray-300"
                                aria-label="Apagar item manual"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>
                    <input
                        value={draft.productName}
                        disabled={disabled}
                        onChange={(event) => setDraft((current) => ({ ...current, productName: event.target.value }))}
                        placeholder="Nome do produto"
                        className="h-11 w-full rounded-lg border border-blue-100 bg-white px-3 font-semibold outline-none focus:border-blue-500"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            value={draft.sku}
                            disabled={disabled}
                            onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))}
                            placeholder="SKU"
                            className="h-11 min-w-0 rounded-lg border border-blue-100 bg-white px-3 font-semibold outline-none focus:border-blue-500"
                        />
                        <input
                            value={draft.ean || ""}
                            disabled={disabled}
                            onChange={(event) => setDraft((current) => ({ ...current, ean: event.target.value }))}
                            placeholder="EAN"
                            className="h-11 min-w-0 rounded-lg border border-blue-100 bg-white px-3 font-semibold outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            ) : null}

            <div className="mt-4">
                <p className="text-sm font-bold text-gray-700">Quantidade recebida</p>
                <div className="mt-2 grid grid-cols-[48px_1fr_48px] items-center gap-2">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setReceivedQty(draft.receivedQty - 1)}
                        className="grid h-12 place-items-center rounded-lg border border-gray-200 bg-white text-gray-800"
                        aria-label="Diminuir quantidade recebida"
                    >
                        <Minus className="h-5 w-5" />
                    </button>
                    <div className="grid h-12 place-items-center rounded-lg bg-gray-50 text-xl font-extrabold text-gray-950">
                        {draft.receivedQty}
                    </div>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setReceivedQty(draft.receivedQty + 1)}
                        className="grid h-12 place-items-center rounded-lg border border-gray-200 bg-white text-gray-800"
                        aria-label="Aumentar quantidade recebida"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="mt-4">
                <p className="text-sm font-bold text-gray-700">Status</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                    {STATUS_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => setDraft((current) => ({
                                ...current,
                                status: option.value,
                                receivedQty: option.value === "not_received" ? 0 : Math.max(1, current.receivedQty),
                            }))}
                            className={`flex min-h-12 items-center justify-between rounded-lg border px-3 text-left text-sm font-extrabold ${
                                draft.status === option.value
                                    ? "border-blue-600 bg-blue-50 text-blue-800"
                                    : "border-gray-200 bg-white text-gray-700"
                            }`}
                        >
                            {option.label}
                            {draft.status === option.value ? <Check className="h-5 w-5" /> : null}
                        </button>
                    ))}
                </div>
            </div>

            {needsPhoto(draft.status) ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-extrabold text-amber-950">Tipos de problema</p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                        {PROBLEM_OPTIONS.map((option) => (
                            <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 text-sm font-bold text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={draft.problemTypes.includes(option.value)}
                                    onChange={() => toggleProblem(option.value)}
                                    className="h-5 w-5"
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                    <label
                        className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 font-extrabold ${
                            hasProblemPhoto ? "bg-emerald-600 text-white" : "bg-gray-900 text-white"
                        }`}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={disabled || isPhotoUploading}
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) onPhotoUpload(draft, file, "problem");
                            }}
                        />
                        <Camera className="h-5 w-5" />
                        {isPhotoUploading ? "Salvando foto..." : hasProblemPhoto ? `${itemPhotos.length} foto(s) anexada(s)` : "Tirar foto"}
                    </label>
                </div>
            ) : null}

            <label className="mt-4 block">
                <span className="text-sm font-bold text-gray-700">Observação</span>
                <textarea
                    value={draft.notes || ""}
                    disabled={disabled}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-3 text-base font-semibold outline-none focus:border-blue-500 disabled:bg-gray-50"
                />
            </label>
        </article>
    );
}
