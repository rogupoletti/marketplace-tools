import React from "react";
import type { Metadata } from "next";
import { ReposicaoProvider } from "./useReposicaoState";
import { ReposicaoFullContent } from "./ReposicaoFullContent";

export const metadata: Metadata = {
    title: "Reposição Full – Mercado Livre | Marketplace Tools",
    description: "Otimize seu estoque no Full com base no giro diário e lead time.",
};

export default function ReposicaoFullPage() {
    return (
        <ReposicaoProvider>
            <ReposicaoFullContent />
        </ReposicaoProvider>
    );
}
