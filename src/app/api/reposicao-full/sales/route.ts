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

        const accountId = userDoc.data()?.accountId;
        if (!accountId) {
            return NextResponse.json({ error: "Acesso negado. Account ID não encontrado." }, { status: 403 });
        }

        // Busca as vendas consolidadas (salesDaily)
        // Isso é muito mais rápido para grandes volumes de dados.
        const salesSnapshot = await adminDb.collection("accounts").doc(accountId).collection("salesDaily").get();
        
        const sales = salesSnapshot.docs.map(doc => doc.data());

        console.log(`[API Sales] Retornando ${sales.length} registros diários consolidados.`);

        return NextResponse.json({ sales });

    } catch (error: any) {
        console.error("Erro ao buscar vendas:", error);
        return NextResponse.json({ error: "Erro interno: " + error.message }, { status: 500 });
    }
}
