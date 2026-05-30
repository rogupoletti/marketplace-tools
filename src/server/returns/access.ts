import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

interface ReturnsAccess {
    uid: string;
    email?: string;
    accountId: string;
    userData: FirebaseFirestore.DocumentData;
}

export async function getReturnsAccess(
    request: NextRequest,
    requestedAccountId?: string | null
): Promise<{ access: ReturnsAccess } | { response: NextResponse }> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { response: NextResponse.json({ error: "Nao autorizado" }, { status: 401 }) };
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        return { response: NextResponse.json({ error: "Usuario nao encontrado" }, { status: 403 }) };
    }

    const userData = userDoc.data() || {};
    const role = userData.role;
    const isSuper = role === "superadmin" || userData.isAdmin === true;

    if (role === "subaccount_user") {
        return { response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
    }

    let accountId = userData.accountId;
    if (isSuper && requestedAccountId) {
        accountId = requestedAccountId;
    }

    if (!isSuper && requestedAccountId && requestedAccountId !== userData.accountId) {
        return { response: NextResponse.json({ error: "Acesso negado para esta conta" }, { status: 403 }) };
    }

    if (!accountId) {
        return { response: NextResponse.json({ error: "Account ID nao encontrado" }, { status: 403 }) };
    }

    return {
        access: {
            uid,
            email: decodedToken.email || userData.email,
            accountId,
            userData,
        },
    };
}
