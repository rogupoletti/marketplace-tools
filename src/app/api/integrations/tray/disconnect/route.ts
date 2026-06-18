import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getTrayUserContext, isTrayIntegrationAdmin, resolveTrayAccountId } from "@/server/integrations/tray/tray-permissions";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "";
}

export async function POST(request: NextRequest) {
    try {
        const user = await getTrayUserContext(request);
        if (!isTrayIntegrationAdmin(user)) {
            return NextResponse.json({ error: "Permissao insuficiente" }, { status: 403 });
        }

        const accountId = resolveTrayAccountId(user, request.nextUrl.searchParams.get("accountId"));
        if (!accountId) {
            return NextResponse.json({ error: "Conta nao identificada" }, { status: 403 });
        }

        await adminDb.collection("accounts").doc(accountId).collection("integrations").doc("tray").delete();
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message === "UNAUTHENTICATED") {
            return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
        }
        if (message === "USER_NOT_FOUND") {
            return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 403 });
        }
        console.error("Erro ao desconectar Tray:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
