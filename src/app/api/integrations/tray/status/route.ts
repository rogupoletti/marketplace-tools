import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
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

        const accountId = resolveTrayAccountId(user, request.nextUrl.searchParams.get("accountId"));
        if (!accountId) {
            return NextResponse.json({ error: "Conta nao identificada" }, { status: 403 });
        }

        const doc = await adminDb.collection("accounts").doc(accountId).collection("integrations").doc("tray").get();
        if (!doc.exists) {
            return NextResponse.json({ provider: "tray", enabled: false, status: "disconnected" });
        }

        const data = doc.data();
        return NextResponse.json({
            provider: "tray",
            enabled: data?.enabled === true,
            status: data?.status || (data?.enabled ? "connected" : "disconnected"),
            storeId: data?.storeId || null,
            sellerId: data?.sellerId || null,
            apiBaseUrl: data?.apiBaseUrl || null,
            tokenExpiresAt: data?.tokenExpiresAt || null,
            lastSyncAt: data?.lastSyncAt || null,
            lastSuccessfulSyncAt: data?.lastSuccessfulSyncAt || null,
            lastSyncStatus: data?.lastSyncStatus || "none",
            lastSyncError: data?.lastSyncError || null,
            lastSyncCreated: data?.lastSyncCreated || 0,
            lastSyncUpdated: data?.lastSyncUpdated || 0,
            lastSyncSkipped: data?.lastSyncSkipped || 0,
            lastSyncErrors: data?.lastSyncErrors || 0,
            syncProgress: data?.syncProgress || 0,
            totalOrders: data?.totalOrders || 0,
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message === "UNAUTHENTICATED") {
            return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
        }
        if (message === "USER_NOT_FOUND") {
            return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 403 });
        }
        console.error("Erro em Tray Status API:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
