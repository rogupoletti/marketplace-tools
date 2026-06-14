"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarcodeFormat, BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, Keyboard, ScanLine, StopCircle } from "lucide-react";
import { MobileReturnScan, MobileScanType } from "@/lib/returns";

interface MobileReturnScannerProps {
    onScan: (scan: MobileReturnScan) => void;
    disabled?: boolean;
}

function normalizeScan(rawValue: string, scanType: MobileScanType): MobileReturnScan {
    return {
        rawValue,
        normalizedValue: rawValue.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, "").trim().toUpperCase(),
        scanType,
        scannedAt: new Date().toISOString(),
        source: "mobile_return_analysis",
    };
}

export function MobileReturnScanner({ onScan, disabled }: MobileReturnScannerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const lastValueRef = useRef("");
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [manualValue, setManualValue] = useState("");
    const [lastCode, setLastCode] = useState("");

    const stopCamera = () => {
        controlsRef.current?.stop();
        controlsRef.current = null;
        setCameraOpen(false);
    };

    useEffect(() => () => {
        controlsRef.current?.stop();
        controlsRef.current = null;
    }, []);

    const startCamera = async () => {
        if (!videoRef.current) return;
        setCameraError("");
        setCameraOpen(true);
        lastValueRef.current = "";

        try {
            const reader = new BrowserMultiFormatReader();
            controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
                if (!result) return;
                const rawValue = result.getText();
                if (!rawValue || rawValue === lastValueRef.current) return;
                lastValueRef.current = rawValue;
                const scanType = result.getBarcodeFormat() === BarcodeFormat.QR_CODE ? "qr_code" : "barcode";
                const scan = normalizeScan(rawValue, scanType);
                setLastCode(scan.normalizedValue);
                onScan(scan);
                stopCamera();
            });
        } catch (error) {
            console.error("Erro ao abrir camera:", error);
            setCameraError("Não foi possível abrir a câmera. Use a digitação manual.");
            setCameraOpen(false);
        }
    };

    const submitManual = (event: React.FormEvent) => {
        event.preventDefault();
        const value = manualValue.trim();
        if (!value) return;
        const scan = normalizeScan(value, "manual");
        setLastCode(scan.normalizedValue);
        onScan(scan);
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
                <div className="relative aspect-[3/4] max-h-[520px] min-h-[340px]">
                    <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                    {!cameraOpen ? (
                        <div className="absolute inset-0 grid place-items-center bg-gray-950 px-6 text-center text-white">
                            <div>
                                <ScanLine className="mx-auto h-14 w-14 text-blue-300" />
                                <p className="mt-4 text-lg font-extrabold">Escanear devolução</p>
                                <p className="mt-2 text-sm text-gray-300">
                                    Aponte a câmera para o QR Code ou código de barras da etiqueta.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-lg border-2 border-blue-300 shadow-[0_0_0_999px_rgba(15,23,42,0.35)]" />
                    )}
                </div>
            </section>

            {cameraError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    {cameraError}
                </div>
            ) : null}

            {lastCode ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-bold text-blue-700">Código lido</p>
                    <p className="mt-1 break-all text-sm font-semibold text-blue-950">{lastCode}</p>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3">
                {!cameraOpen ? (
                    <button
                        type="button"
                        onClick={startCamera}
                        disabled={disabled}
                        className="flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 disabled:bg-gray-300"
                    >
                        <Camera className="h-5 w-5" />
                        Abrir câmera
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={stopCamera}
                        className="flex h-14 items-center justify-center gap-3 rounded-lg bg-gray-900 px-4 text-base font-extrabold text-white"
                    >
                        <StopCircle className="h-5 w-5" />
                        Parar câmera
                    </button>
                )}
            </div>

            <form onSubmit={submitManual} className="rounded-lg border border-gray-200 bg-white p-4">
                <label className="text-sm font-bold text-gray-700" htmlFor="manual-return-code">
                    Digitar código manualmente
                </label>
                <div className="mt-2 flex gap-2">
                    <input
                        id="manual-return-code"
                        value={manualValue}
                        onChange={(event) => setManualValue(event.target.value)}
                        placeholder="Rastreio reverso, QR ou código"
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-3 text-base font-semibold outline-none focus:border-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={disabled || !manualValue.trim()}
                        className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-gray-900 text-white disabled:bg-gray-300"
                        aria-label="Buscar código digitado"
                    >
                        <Keyboard className="h-5 w-5" />
                    </button>
                </div>
            </form>
        </div>
    );
}
