import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { MercadoLivreClient } from "@/server/integrations/mercadolivre/ml-client";

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "Usuário não encontrado" }, { status: 403 });
        }

        const userData = userDoc.data();
        const searchParams = request.nextUrl.searchParams;
        const requestedAccountId = searchParams.get("accountId");
        
        let accountId = userData?.accountId;
        
        // Se for superadmin e passar um accountId, permite usar esse accountId
        if (userData?.role === 'superadmin' && requestedAccountId) {
            accountId = requestedAccountId;
        }

        if (!accountId) {
            return NextResponse.json({ error: "Account ID não encontrado" }, { status: 403 });
        }

        const mlClient = new MercadoLivreClient();
        const authUrl = mlClient.getAuthUrl(accountId);

        return NextResponse.json({ url: authUrl });

    } catch (error: any) {
        console.error("Erro em Mercado Livre Auth API:", error);
        return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
    }
}
