import { NextRequest, NextResponse } from "next/server";
import { finalizeReturnAnalysis } from "@/server/returns/mobile";
import { getReturnsAccess } from "@/server/returns/access";

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const payload = await request.json();
        const returnId = typeof payload?.returnId === "string" ? payload.returnId.trim() : "";
        if (!returnId) throw new Error("Devolucao obrigatoria");

        const result = await finalizeReturnAnalysis({
            accountId: accessResult.access.accountId,
            returnId,
            uid: accessResult.access.uid,
            email: accessResult.access.email,
            disposition: payload?.disposition,
            generalNotes: payload?.generalNotes,
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Erro ao concluir analise mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
