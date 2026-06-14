"use client";

import React from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

interface MobileStepLayoutProps {
    title: string;
    subtitle?: string;
    stepLabel?: string;
    onBack?: () => void;
    isBusy?: boolean;
    toast?: { type: "success" | "error" | "info"; message: string } | null;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export function MobileStepLayout({
    title,
    subtitle,
    stepLabel,
    onBack,
    isBusy,
    toast,
    children,
    footer,
}: MobileStepLayoutProps) {
    return (
        <div className="min-h-dvh bg-[#f5f7fa] text-gray-900">
            <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
                <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
                    <div className="flex items-center gap-3">
                        {onBack ? (
                            <button
                                type="button"
                                onClick={onBack}
                                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-gray-200 bg-white text-gray-700"
                                aria-label="Voltar"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        ) : null}
                        <div className="min-w-0 flex-1">
                            {stepLabel ? (
                                <p className="text-xs font-bold uppercase text-blue-600">{stepLabel}</p>
                            ) : null}
                            <h1 className="text-lg font-extrabold leading-tight text-gray-950">{title}</h1>
                            {subtitle ? <p className="mt-1 text-sm leading-snug text-gray-500">{subtitle}</p> : null}
                        </div>
                        {isBusy ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : null}
                    </div>
                </header>

                {toast ? (
                    <div className="px-4 pt-3">
                        <div
                            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
                                toast.type === "error"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : toast.type === "success"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}
                        >
                            {toast.message}
                        </div>
                    </div>
                ) : null}

                <main className="flex-1 px-4 py-4">{children}</main>

                {footer ? (
                    <footer className="sticky bottom-0 z-20 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]">
                        {footer}
                    </footer>
                ) : null}
            </div>
        </div>
    );
}
