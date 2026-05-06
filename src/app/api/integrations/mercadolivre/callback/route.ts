import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { MercadoLivreClient } from "@/server/integrations/mercadolivre/ml-client";
import { MLIntegrationData } from "@/server/integrations/mercadolivre/ml-types";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const code = searchParams.get("code");
        const accountId = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        const baseUrl = new URL(request.url).origin;
        // Adjust redirection URL as needed based on your frontend routing
        const redirectUrl = `${baseUrl}/integrations/mercadolivre?ml_status=`;

        if (error) {
            console.error(`ML OAuth Error: ${error} - ${errorDescription}`);
            return NextResponse.redirect(`${redirectUrl}error`);
        }

        if (!code || !accountId) {
            console.error("Missing code or state (accountId) in ML callback");
            return NextResponse.redirect(`${redirectUrl}invalid_params`);
        }

        const mlClient = new MercadoLivreClient();
        const tokenResponse = await mlClient.exchangeCode(code);

        const integrationData: MLIntegrationData & { provider: string, enabled: boolean } = {
            access_token: tokenResponse.access_token,
            refresh_token: tokenResponse.refresh_token,
            expires_at: Date.now() + (tokenResponse.expires_in * 1000),
            user_id: tokenResponse.user_id,
            updated_at: Date.now(),
            provider: 'mercadolivre',
            enabled: true
        };

        const integrationRef = adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("integrations")
            .doc("mercadolivre");

        await integrationRef.set(integrationData, { merge: true });

        return NextResponse.redirect(`${redirectUrl}success`);

    } catch (error: any) {
        console.error("Erro em Mercado Livre Callback API:", error);
        const baseUrl = new URL(request.url).origin;
        return NextResponse.redirect(`${baseUrl}/integrations/mercadolivre?ml_status=error`);
    }
}
