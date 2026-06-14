import { NextRequest, NextResponse } from "next/server";
import { deleteReturnAnalysisItem, parseAnalysisItemPayload, upsertReturnAnalysisItem } from "@/server/returns/mobile";
import { getReturnsAccess } from "@/server/returns/access";

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const payload = await request.json();
        const returnId = typeof payload?.returnId === "string" ? payload.returnId.trim() : "";
        if (!returnId) throw new Error("Devolucao obrigatoria");

        const item = parseAnalysisItemPayload(payload?.item || payload);
        const saved = await upsertReturnAnalysisItem({
            accountId: accessResult.access.accountId,
            returnId,
            uid: accessResult.access.uid,
            email: accessResult.access.email,
            item,
        });

        return NextResponse.json({ item: saved });
    } catch (error: unknown) {
        console.error("Erro ao salvar item de analise mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const payload = await request.json();
        const returnId = typeof payload?.returnId === "string" ? payload.returnId.trim() : "";
        const itemId = typeof payload?.itemId === "string" ? payload.itemId.trim() : "";
        if (!returnId) throw new Error("Devolucao obrigatoria");
        if (!itemId) throw new Error("Item obrigatorio");

        const result = await deleteReturnAnalysisItem({
            accountId: accessResult.access.accountId,
            returnId,
            itemId,
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Erro ao apagar item de analise mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
