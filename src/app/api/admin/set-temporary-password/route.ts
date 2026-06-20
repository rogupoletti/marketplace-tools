import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type UserRole = "superadmin" | "account_admin" | "account_user" | "subaccount_user";

function isCommonAccountUser(role?: UserRole) {
    return role === "account_user" || role === "subaccount_user";
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Erro desconhecido";
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const requesterUid = decodedToken.uid;

        const requesterDoc = await adminDb.collection("users").doc(requesterUid).get();
        if (!requesterDoc.exists) {
            return NextResponse.json({ error: "Usuário solicitante não encontrado" }, { status: 403 });
        }

        const requesterData = requesterDoc.data();
        const requesterRole = requesterData?.role as UserRole | undefined;
        const isSuper = requesterRole === "superadmin" || requesterData?.isAdmin === true;
        const isAccountAdmin = requesterRole === "account_admin";

        if (!isSuper && !isAccountAdmin) {
            return NextResponse.json({ error: "Apenas administradores podem definir senha provisória" }, { status: 403 });
        }

        const { uid, temporaryPassword } = await request.json();
        if (typeof uid !== "string" || !uid.trim()) {
            return NextResponse.json({ error: "UID do usuário é obrigatório" }, { status: 400 });
        }

        if (uid === requesterUid) {
            return NextResponse.json({ error: "Você não pode definir senha provisória para si mesmo" }, { status: 400 });
        }

        if (typeof temporaryPassword !== "string" || temporaryPassword.length < 6) {
            return NextResponse.json({ error: "A senha provisória deve ter pelo menos 6 caracteres" }, { status: 400 });
        }

        const targetDoc = await adminDb.collection("users").doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: "Usuário alvo não encontrado" }, { status: 404 });
        }

        const targetData = targetDoc.data();
        const targetRole = targetData?.role as UserRole | undefined;

        if (isAccountAdmin) {
            if (targetData?.accountId !== requesterData?.accountId) {
                return NextResponse.json({ error: "Você só pode alterar usuários da sua própria conta" }, { status: 403 });
            }

            if (!isCommonAccountUser(targetRole)) {
                return NextResponse.json({ error: "Admin da conta só pode alterar usuários comuns da conta" }, { status: 403 });
            }
        }

        await adminAuth.updateUser(uid, { password: temporaryPassword });
        await adminAuth.revokeRefreshTokens(uid);

        await adminDb.collection("users").doc(uid).update({
            requiresPasswordChange: true,
            temporaryPasswordSetAt: new Date().toISOString(),
            temporaryPasswordSetBy: requesterUid
        });

        return NextResponse.json({ message: "Senha provisória definida com sucesso" });
    } catch (error: unknown) {
        console.error("Erro ao definir senha provisória:", error);
        return NextResponse.json({ error: "Erro interno: " + getErrorMessage(error) }, { status: 500 });
    }
}
