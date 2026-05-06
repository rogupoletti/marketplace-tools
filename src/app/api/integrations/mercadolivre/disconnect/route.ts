import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
    try {
        // Verificar autenticação
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // Pegar accountId da query ou do token do usuário
        const searchParams = request.nextUrl.searchParams;
        const targetAccountId = searchParams.get("accountId");

        // Buscar dados do usuário para validar permissão na conta
        const userDoc = await adminDb.collection("users").doc(userId).get();
        const userData = userDoc.data();

        if (!userData) {
            return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
        }

        // Se não for superadmin, ele só pode desconectar a própria conta
        const accountId = userData.role === 'superadmin' && targetAccountId 
            ? targetAccountId 
            : userData.accountId;

        if (!accountId) {
            return NextResponse.json({ error: "Conta não identificada" }, { status: 400 });
        }

        // Validar se o usuário tem permissão (superadmin ou admin da conta)
        if (userData.role !== 'superadmin' && userData.role !== 'account_admin') {
            return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
        }

        // Se for admin de conta, validar se a conta que ele quer apagar é a dele
        if (userData.role === 'account_admin' && accountId !== userData.accountId) {
            return NextResponse.json({ error: "Acesso negado a esta conta" }, { status: 403 });
        }

        // Deletar o documento de integração
        await adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("integrations")
            .doc("mercadolivre")
            .delete();

        console.log(`[ML Integration] Account ${accountId} disconnected by user ${userId}`);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Erro ao desconectar Mercado Livre:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
