import { NextRequest, NextResponse } from "next/server";
import { getTrayAuthUrl } from "@/server/integrations/tray/tray-auth";
import { getTrayUserContext, isTrayIntegrationAdmin, resolveTrayAccountId } from "@/server/integrations/tray/tray-permissions";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "";
}

export async function GET(request: NextRequest) {
    try {
        const user = await getTrayUserContext(request);
        if (!isTrayIntegrationAdmin(user)) {
            return NextResponse.json({ error: "Permissao insuficiente" }, { status: 403 });
        }

        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accountId = resolveTrayAccountId(user, requestedAccountId);
        if (!accountId) {
            return NextResponse.json({ error: "Conta nao identificada" }, { status: 403 });
        }

        return NextResponse.json({ url: getTrayAuthUrl(accountId) });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message === "UNAUTHENTICATED") {
            return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
        }
        if (message === "USER_NOT_FOUND") {
            return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 403 });
        }
        if (message.startsWith("Configuracao Tray incompleta")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        console.error("Erro em Tray Auth API:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
