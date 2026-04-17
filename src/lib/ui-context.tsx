"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AlertModal, ModalType } from "@/components/AlertModal";

interface UIContextType {
    showAlert: (title: string, message: string, type?: ModalType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: ModalType;
        onConfirm?: () => void;
        confirmText?: string;
        cancelText?: string;
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info"
    });

    const showAlert = (title: string, message: string, type: ModalType = "info") => {
        setModal({
            isOpen: true,
            title,
            message,
            type,
            onConfirm: undefined
        });
    };

    const showConfirm = (
        title: string, 
        message: string, 
        onConfirm: () => void, 
        confirmText?: string, 
        cancelText?: string
    ) => {
        setModal({
            isOpen: true,
            title,
            message,
            type: "confirm",
            onConfirm,
            confirmText,
            cancelText
        });
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <UIContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <AlertModal 
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
                confirmText={modal.confirmText}
                cancelText={modal.cancelText}
            />
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
}
