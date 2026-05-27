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

        // Fetch all products for the account
        const productsSnapshot = await adminDb.collection("accounts").doc(accountId).collection("products").get();
        
        const products = productsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                sku: data.sku || doc.id,
                ean: data.ean || "",
                descricao: data.descricao || "",
                mlb: data.mlb || "",
                mlbCatalogo: data.mlbCatalogo || "",
                marca: data.marca || "",
                fornecedor: data.fornecedor || "",
                estoqueFull: data.estoqueFull || 0,
                estoqueEmpresa: data.estoqueEmpresa || 0,
                precoAtual: data.precoAtual || 0,
                custoAtual: data.custoAtual || 0,
                tamanhoCaixa: data.tamanhoCaixa || 1,
                emTransf: data.emTransf || 0,
                inativo: data.inativo || false,
                motivoInativo: data.motivoInativo || ""
            };
        });

        console.log(`[API Products] Retornando ${products.length} registros para accountId ${accountId}.`);

        return NextResponse.json({ products });

    } catch (error: unknown) {
        console.error("Erro ao buscar produtos:", error);
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({ error: "Erro interno: " + message }, { status: 500 });
    }
}
