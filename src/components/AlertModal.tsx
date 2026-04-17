"use client";

import React, { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info, Loader2 } from "lucide-react";

export type ModalType = "info" | "success" | "error" | "warning" | "confirm";

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type: ModalType;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type,
    onConfirm,
    confirmText = "Confirmar",
    cancelText = "Cancelar"
}: AlertModalProps) {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        } else {
            const timer = setTimeout(() => setIsAnimating(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !isAnimating) return null;

    const icons = {
        success: <CheckCircle2 className="w-12 h-12 text-green-500" />,
        error: <XCircle className="w-12 h-12 text-red-500" />,
        warning: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
        info: <Info className="w-12 h-12 text-blue-500" />,
        confirm: <AlertTriangle className="w-12 h-12 text-orange-500" />
    };

    const buttonColors = {
        success: "bg-green-600 hover:bg-green-700 shadow-green-200",
        error: "bg-red-600 hover:bg-red-700 shadow-red-200",
        warning: "bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200",
        info: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
        confirm: "bg-orange-600 hover:bg-orange-700 shadow-orange-200"
    };

    return (
        <div className={`fixed inset-0 z-[999] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
            {/* Overlay */}
            <div 
                className={`absolute inset-0 bg-black/40 backdrop-blur-md transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
                onClick={type !== 'confirm' ? onClose : undefined}
            />
            
            {/* Modal Card */}
            <div className={`
                relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 overflow-hidden transition-all duration-300 transform
                ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}
            `}>
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center">
                    <div className="flex justify-center mb-6 animate-bounce-short">
                        <div className="p-4 bg-gray-50 rounded-2xl">
                            {icons[type]}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>
                    <p className="text-gray-500 text-sm leading-relaxed mb-8">{message}</p>

                    <div className="flex gap-4">
                        {type === 'confirm' ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm?.();
                                        onClose();
                                    }}
                                    className={`flex-1 px-6 py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${buttonColors[type]}`}
                                >
                                    {confirmText}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className={`w-full px-6 py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${buttonColors[type]}`}
                            >
                                OK
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
