import { NextRequest, NextResponse } from "next/server";
import { syncTraySalesLastDays } from "@/server/integrations/tray/tray-sync";
import { getTrayUserContext, isTraySuperadmin, resolveTrayAccountId } from "@/server/integrations/tray/tray-permissions";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "";
}

export async function POST(request: NextRequest) {
    try {
        const user = await getTrayUserContext(request);
        if (!isTraySuperadmin(user)) {
            return NextResponse.json({ success: false, provider: "tray", error: "Apenas superadmin pode carregar vendas Tray." }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const accountId = resolveTrayAccountId(user, body.accountId);
        if (!accountId) {
            return NextResponse.json({ success: false, provider: "tray", error: "Conta nao selecionada." }, { status: 403 });
        }

        const result = await syncTraySalesLastDays(accountId, 90);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message === "UNAUTHENTICATED") {
            return NextResponse.json({ success: false, provider: "tray", error: "Nao autorizado" }, { status: 401 });
        }
        if (message === "USER_NOT_FOUND") {
            return NextResponse.json({ success: false, provider: "tray", error: "Usuario nao encontrado" }, { status: 403 });
        }

        console.error("Erro ao sincronizar vendas Tray:", error);
        return NextResponse.json({
            success: false,
            provider: "tray",
            error: message || "Erro ao carregar vendas da Tray.",
        }, { status: 500 });
    }
}
