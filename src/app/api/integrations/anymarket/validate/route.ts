import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { decryptToken } from "@/server/utils/crypto";
import { AnymarketClient } from "@/server/integrations/anymarket/anymarket-client";

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

        const accountId = userDoc.data()?.accountId;
        if (!accountId) {
            return NextResponse.json({ error: "Acesso negado. Account ID não encontrado." }, { status: 403 });
        }

        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
        const doc = await integrationRef.get();

        if (!doc.exists) {
            return NextResponse.json({ valid: false, error: "Integração não configurada" });
        }

        const config = doc.data();
        if (!config?.encryptedToken) {
            return NextResponse.json({ valid: false, error: "Token não encontrado" });
        }

        const token = decryptToken(config.encryptedToken, config.tokenIv, config.tokenAuthTag);
        const client = new AnymarketClient(token);
        
        const isValid = await client.validateToken();

        return NextResponse.json({ valid: isValid });

    } catch (error: any) {
        console.error("Erro ao validar token da Anymarket:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}
