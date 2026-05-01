import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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
        const accountId = userDoc.data()?.accountId;

        if (!accountId) {
            return NextResponse.json({ error: "Conta não encontrada" }, { status: 403 });
        }

        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
        
        await integrationRef.update({
            lastSyncStatus: 'none',
            syncProgress: 0,
            syncOffset: 0,
            totalOrders: 0,
            lastSyncError: null
        });

        return NextResponse.json({ message: "Sincronização interrompida com sucesso" });

    } catch (error: any) {
        console.error("Erro ao resetar sync da Anymarket:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
