import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");
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

        const { items } = await req.json();
        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        const prodCol = adminDb.collection("accounts").doc(accountId).collection("products");

        let batch = adminDb.batch();
        let count = 0;
        let totalUpdated = 0;
        let totalEncontrados = 0;

        // Fetch existing SKUs to only update products that are already in the DB
        const existingSnap = await prodCol.select("sku").get();
        const existingSkus = new Set<string>();
        existingSnap.docs.forEach(d => existingSkus.add(d.id));

        console.log(`[UploadCadastros] Recebeu ${items.length} itens do frontend. Exemplo:`, items[0]);
        console.log(`[UploadCadastros] Encontrados ${existingSkus.size} SKUs existentes no banco para a conta ${accountId}. Exemplo de SKUs no banco:`, Array.from(existingSkus).slice(0, 5));

        for (const item of items) {
            if (!item.sku) continue;

            const skuStr = String(item.sku).trim();
            if (!existingSkus.has(skuStr)) {
                // Tenta buscar case insensitive ou outras variações se precisar no futuro, mas por enquanto ignora
                continue;
            }

            totalEncontrados++;

            const docRef = prodCol.doc(skuStr);
            
            const updateData: any = {};
            if (item.marca !== undefined) updateData.marca = item.marca;
            if (item.fornecedor !== undefined) updateData.fornecedor = item.fornecedor;
            if (item.tamanhoCaixa !== undefined) updateData.tamanhoCaixa = item.tamanhoCaixa;

            if (Object.keys(updateData).length > 0) {
                batch.update(docRef, updateData);
                count++;
                totalUpdated++;
            } else {
                console.log(`[UploadCadastros] SKU ${item.sku} encontrado, mas sem dados para atualizar (marca/forn/tam.caixa vazios).`);
            }

            if (count >= 400) {
                await batch.commit();
                batch = adminDb.batch();
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        return NextResponse.json({ success: true, totalUpdated, totalEncontrados, totalPlanilha: items.length });

    } catch (err: any) {
        console.error("Upload Cadastros error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
