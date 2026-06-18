import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { buildTrayIntegrationData, exchangeTrayCode } from "@/server/integrations/tray/tray-auth";

function getBaseUrl(request: NextRequest) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
    const baseUrl = getBaseUrl(request);
    const redirectUrl = `${baseUrl}/integrations/tray?tray_status=`;

    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get("code");
        const accountId = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
            console.error("Tray OAuth error:", error);
            return NextResponse.redirect(`${redirectUrl}error`);
        }

        if (!code || !accountId) {
            console.error("Missing code or state in Tray callback");
            return NextResponse.redirect(`${redirectUrl}invalid_params`);
        }

        const tokenResponse = await exchangeTrayCode(code);
        const integrationData = buildTrayIntegrationData(tokenResponse);
        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("tray");
        const current = await integrationRef.get();

        await integrationRef.set({
            ...integrationData,
            createdAt: current.exists ? current.data()?.createdAt : integrationData.createdAt,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        return NextResponse.redirect(`${redirectUrl}success`);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        console.error("Erro em Tray Callback API:", message);
        return NextResponse.redirect(`${redirectUrl}error`);
    }
}
