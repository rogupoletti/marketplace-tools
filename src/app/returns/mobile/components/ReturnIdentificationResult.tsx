"use client";

import React from "react";
import { CalendarClock, CheckCircle2, Clipboard, PlusCircle, RotateCcw, Search } from "lucide-react";
import { MarketplaceReturn, MobileReturnScan } from "@/lib/returns";

interface ReturnIdentificationResultProps {
    mode: "not_found" | "multiple" | "found";
    scan: MobileReturnScan;
    matches?: MarketplaceReturn[];
    onSelectReturn?: (item: MarketplaceReturn) => void;
    onManualSearch: () => void;
    onCreateManual: () => void;
    onRescan: () => void;
}

function formatScanType(scan: MobileReturnScan) {
    if (scan.scanType === "qr_code") return "QR Code";
    if (scan.scanType === "barcode") return "Código de barras";
    return "Manual";
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function returnTitle(item: MarketplaceReturn) {
    return item.marketplaceOrderId || item.orderNumber || item.externalReturnId || item.id;
}

function uniqueReturnsById(items: MarketplaceReturn[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function ReturnIdentificationResult({
    mode,
    scan,
    matches = [],
    onSelectReturn,
    onManualSearch,
    onCreateManual,
    onRescan,
}: ReturnIdentificationResultProps) {
    const uniqueMatches = uniqueReturnsById(matches);

    if (mode === "multiple") {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                        <Clipboard className="mt-0.5 h-5 w-5 text-blue-700" />
                        <div>
                            <h2 className="text-lg font-extrabold text-blue-950">Encontramos mais de uma devolução</h2>
                            <p className="mt-1 text-sm text-blue-800">Escolha a devolução correta para continuar.</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-3">
                    {uniqueMatches.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectReturn?.(item)}
                            className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm"
                        >
                            <p className="text-sm font-bold text-gray-500">{item.marketplace || item.channel}</p>
                            <p className="mt-1 break-words text-base font-extrabold text-gray-950">{returnTitle(item)}</p>
                            <p className="mt-2 text-sm text-gray-500">
                                Rastreio: {item.reverseTrackingCode || item.trackingCode || item.identifiers?.[0] || "-"}
                            </p>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={onRescan}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 font-extrabold text-gray-800"
                >
                    <RotateCcw className="h-5 w-5" />
                    Escanear outro código
                </button>
            </div>
        );
    }

    if (mode === "found") {
        return (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                    <div>
                        <h2 className="text-lg font-extrabold text-emerald-950">Devolução identificada</h2>
                        <p className="mt-1 text-sm text-emerald-800">Abrindo a análise dos itens.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-xl font-extrabold text-amber-950">Devolução não encontrada</h2>
                <p className="mt-2 text-sm font-medium text-amber-800">
                    Não encontramos uma devolução vinculada a este código.
                </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-bold text-gray-500">Código lido</p>
                <p className="mt-1 break-all text-base font-extrabold text-gray-950">{scan.normalizedValue}</p>
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-600" />
                        {formatScanType(scan)}
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-blue-600" />
                        {formatDateTime(scan.scannedAt)}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <button
                    type="button"
                    onClick={onManualSearch}
                    className="flex h-14 items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 text-base font-extrabold text-gray-800"
                >
                    <Search className="h-5 w-5" />
                    Buscar manualmente
                </button>
                <button
                    type="button"
                    onClick={onCreateManual}
                    className="flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20"
                >
                    <PlusCircle className="h-5 w-5" />
                    Criar devolução manual
                </button>
                <button
                    type="button"
                    onClick={onRescan}
                    className="flex h-14 items-center justify-center gap-3 rounded-lg bg-gray-900 px-4 text-base font-extrabold text-white"
                >
                    <RotateCcw className="h-5 w-5" />
                    Escanear outro código
                </button>
            </div>
        </div>
    );
}
