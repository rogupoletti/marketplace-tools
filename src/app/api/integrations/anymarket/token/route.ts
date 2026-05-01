import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { encryptToken } from "@/server/utils/crypto";

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
        const accountId = userData?.accountId;
        const isAdmin = userData?.isAdmin === true || userData?.role === 'superadmin' || userData?.role === 'account_admin';

        if (!isAdmin || !accountId) {
            return NextResponse.json({ error: "Acesso negado. Apenas administradores da conta podem configurar integrações." }, { status: 403 });
        }

        const { token } = await request.json();
        if (!token) {
            return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });
        }

        const encrypted = encryptToken(token);
        const tokenLast4 = token.slice(-4);

        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
        
        await integrationRef.set({
            enabled: true,
            tokenLast4,
            encryptedToken: encrypted.encrypted,
            tokenIv: encrypted.iv,
            tokenAuthTag: encrypted.authTag,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({ message: "Token salvo com sucesso", tokenLast4 });

    } catch (error: any) {
        console.error("Erro ao salvar token da Anymarket:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
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
        const accountId = userData?.accountId;
        const isAdmin = userData?.isAdmin === true || userData?.role === 'superadmin' || userData?.role === 'account_admin';

        if (!isAdmin || !accountId) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
        
        // Removemos o documento ou apenas desabilitamos. Vamos remover para limpar o token.
        await integrationRef.delete();

        return NextResponse.json({ message: "Integração removida com sucesso" });

    } catch (error: any) {
        console.error("Erro ao remover integração da Anymarket:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
