import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getReturnsAccess } from "@/server/returns/access";

function normalizeProduct(doc: FirebaseFirestore.QueryDocumentSnapshot) {
    const data = doc.data() || {};
    return {
        sku: String(data.sku || doc.id),
        ean: String(data.ean || ""),
        descricao: String(data.descricao || ""),
    };
}

export async function GET(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const productsSnapshot = await adminDb
            .collection("accounts")
            .doc(accessResult.access.accountId)
            .collection("products")
            .get();

        const products = productsSnapshot.docs.map(normalizeProduct);
        return NextResponse.json({ products });
    } catch (error: unknown) {
        console.error("Erro ao buscar produtos para devolucoes mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
