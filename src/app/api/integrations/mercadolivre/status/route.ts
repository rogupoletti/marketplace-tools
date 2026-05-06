import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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
        
        if (userData?.role === 'superadmin' && requestedAccountId) {
            accountId = requestedAccountId;
        }

        if (!accountId) {
            return NextResponse.json({ error: "Account ID não encontrado" }, { status: 403 });
        }

        const integrationRef = adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("integrations")
            .doc("mercadolivre");
            
        const doc = await integrationRef.get();

        if (!doc.exists) {
            return NextResponse.json({ status: "disconnected", enabled: false });
        }

        const data = doc.data();
        
        return NextResponse.json({
            status: "connected",
            enabled: true,
            mlUserId: data?.user_id || null,
            lastSyncAt: data?.lastSyncAt || null,
            expiresAt: data?.expires_at || null,
            // Retorna se o access token atual está expirado (precisa de refresh na próxima chamada)
            tokenExpired: data?.expires_at ? Date.now() > data.expires_at : true,
        });

    } catch (error: any) {
        console.error("Erro em Mercado Livre Status API:", error);
        return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
    }
}
