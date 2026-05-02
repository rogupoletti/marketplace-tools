"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import Header from "./Header";
import Footer from "./Footer";
import AuthenticatedLayout from "./AuthenticatedLayout";

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Carregando...</p>
                </div>
            </div>
        );
    }

    if (user) {
        return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
    }

    return (
        <>
            <Header />
            <main className="flex-grow">
                {children}
            </main>
            <Footer />
        </>
    );
}
