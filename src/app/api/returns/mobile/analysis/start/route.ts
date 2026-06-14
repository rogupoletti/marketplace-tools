import { NextRequest, NextResponse } from "next/server";
import { startReturnAnalysis } from "@/server/returns/mobile";
import { getReturnsAccess } from "@/server/returns/access";

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const payload = await request.json();
        const returnId = typeof payload?.returnId === "string" ? payload.returnId.trim() : "";
        if (!returnId) throw new Error("Devolucao obrigatoria");

        const data = await startReturnAnalysis(accessResult.access.accountId, returnId);
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error("Erro ao iniciar analise mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
