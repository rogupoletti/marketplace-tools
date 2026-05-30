import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { MarketplaceReturn } from "@/lib/returns";
import { getReturnsAccess } from "@/server/returns/access";
import { parseReturnCreatePayload } from "@/server/returns/validation";

function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    ) as T;
}

export async function GET(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId } = accessResult.access;
        const snapshot = await adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("returns")
            .orderBy("updatedAt", "desc")
            .get();

        const returns = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as MarketplaceReturn[];

        return NextResponse.json({ returns });
    } catch (error: unknown) {
        console.error("Erro ao listar devolucoes:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId, uid, email } = accessResult.access;
        const payload = await request.json();
        const formData = parseReturnCreatePayload(payload);
        const now = new Date().toISOString();

        const returnRef = adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("returns")
            .doc();

        const returnData = withoutUndefined({
            accountId,
            source: "manual",
            ...formData,
            status: "on_the_way",
            createdAt: now,
            updatedAt: now,
            createdByUid: uid,
            createdByEmail: email,
            updatedByUid: uid,
            updatedByEmail: email,
        });

        const historyRef = returnRef.collection("history").doc();
        const historyData = withoutUndefined({
            returnId: returnRef.id,
            action: "created",
            newStatus: "on_the_way",
            note: "Devolução criada",
            createdAt: now,
            createdByUid: uid,
            createdByEmail: email,
        });

        const batch = adminDb.batch();
        batch.set(returnRef, returnData);
        batch.set(historyRef, historyData);
        await batch.commit();

        return NextResponse.json(
            { return: { id: returnRef.id, ...returnData } },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Erro ao criar devolucao:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
