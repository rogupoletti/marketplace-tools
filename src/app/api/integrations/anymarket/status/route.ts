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
        
        // Se for superadmin e passar um accountId, permite usar esse accountId
        if (userData?.role === 'superadmin' && requestedAccountId) {
            accountId = requestedAccountId;
        }

        if (!accountId) {
            return NextResponse.json({ error: "Account ID não encontrado" }, { status: 403 });
        }

        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
        const doc = await integrationRef.get();

        if (!doc.exists) {
            return NextResponse.json({ enabled: false });
        }

        const data = doc.data();
        
        // Retornamos apenas dados seguros
        return NextResponse.json({
            enabled: data?.enabled || false,
            tokenLast4: data?.tokenLast4 || "",
            lastInitialSyncAt: data?.lastInitialSyncAt || null,
            lastSuccessfulSyncAt: data?.lastSuccessfulSyncAt || null,
            lastSyncStatus: data?.lastSyncStatus || 'none',
            lastSyncError: data?.lastSyncError || null,
            stockLastSyncAt: data?.stockLastSyncAt || null,
            stockLastSyncStatus: data?.stockLastSyncStatus || 'none',
            stockLastSyncError: data?.stockLastSyncError || null,
            stockLastSyncSkuCount: data?.stockLastSyncSkuCount || 0,
            syncProgress: data?.syncProgress || 0,
            syncOffset: data?.syncOffset || 0,
            totalOrders: data?.totalOrders || 0
        });

    } catch (error: unknown) {
        console.error("CRITICAL ERROR in Anymarket Status API:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
