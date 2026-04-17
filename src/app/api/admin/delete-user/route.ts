import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
    try {
        // 1. Verificar Token do Solicitante
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const requesterUid = decodedToken.uid;

        // 2. Buscar Dados do Solicitante no Firestore para checar papel (role)
        const requesterDoc = await adminDb.collection("users").doc(requesterUid).get();
        if (!requesterDoc.exists) {
            return NextResponse.json({ error: "Usuário solicitante não encontrado" }, { status: 403 });
        }

        const requesterData = requesterDoc.data();
        const isAdmin = requesterData?.isAdmin === true || requesterData?.role === 'superadmin' || requesterData?.role === 'account_admin';

        if (!isAdmin) {
            return NextResponse.json({ error: "Apenas administradores podem excluir usuários" }, { status: 403 });
        }

        // 3. Pegar o UID do usuário a ser excluído
        const { uid } = await request.json();
        if (!uid) {
            return NextResponse.json({ error: "UID do usuário é obrigatório" }, { status: 400 });
        }

        // Evitar auto-exclusão por segurança adicional na API
        if (uid === requesterUid) {
            return NextResponse.json({ error: "Você não pode excluir a si mesmo" }, { status: 400 });
        }

        // 4. Buscar usuário alvo para verificar accountId (se o solicitante for account_admin)
        const targetDoc = await adminDb.collection("users").doc(uid).get();
        if (!targetDoc.exists) {
            // Se o doc no firestore jà sumiu, ainda tentamos apagar no Auth por segurança
            try {
                await adminAuth.deleteUser(uid);
                return NextResponse.json({ message: "Usuário removido do Auth (doc já não existia)" });
            } catch (e: any) {
                return NextResponse.json({ error: "Usuário não encontrado no Firestore e erro ao remover do Auth: " + e.message }, { status: 404 });
            }
        }

        const targetData = targetDoc.data();

        // Travas de Segurança Granular
        if (requesterData?.role === 'account_admin') {
            if (targetData?.accountId !== requesterData?.accountId) {
                return NextResponse.json({ error: "Você só pode excluir usuários da sua própria conta" }, { status: 403 });
            }
        }

        // 5. Exclusão em Transação/Sequencial
        // Primeiro no Auth (mais crítico)
        await adminAuth.deleteUser(uid);
        
        // Depois no Firestore
        await adminDb.collection("users").doc(uid).delete();

        return NextResponse.json({ message: "Usuário excluído com sucesso (Auth + Firestore)" });

    } catch (error: any) {
        console.error("Erro na API de exclusão de usuário:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}
