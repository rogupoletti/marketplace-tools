import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { syncOrders } from "@/server/integrations/anymarket/sync-orders";

export async function POST(request: NextRequest) {
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
        const body = await request.json().catch(() => ({}));
        const requestedAccountId = body.accountId;

        let accountId = userData?.accountId;
        const isSuperAdmin = userData?.role === 'superadmin';
        const isAdmin = userData?.isAdmin === true || isSuperAdmin || userData?.role === 'account_admin';

        if (isSuperAdmin && requestedAccountId) {
            accountId = requestedAccountId;
        }

        if (!isAdmin || !accountId) {
            return NextResponse.json({ error: "Acesso negado ou conta não selecionada." }, { status: 403 });
        }

        // Executar a sincronização em background. 
        // OBS: Em serverless (Vercel), processos em background podem ser interrompidos quando a request principal responde.
        // Se a sincronização demorar muito, o ideal é usar Cloud Tasks ou Upstash QStash.
        // Para a carga inicial de 15 dias, pode rodar rápido. Vamos apenas invocar assincronamente e responder logo.
        // O frontend consultará o status do job em 'accounts/{accountId}/integrations/anymarket'.
        
        syncOrders(accountId, 90).catch(console.error);

        return NextResponse.json({ message: "Sincronização iniciada." });

    } catch (error: any) {
        console.error("Erro ao iniciar sync da Anymarket:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}
