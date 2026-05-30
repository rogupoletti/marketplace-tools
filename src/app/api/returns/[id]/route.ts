import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
    MarketplaceReturn,
    ReturnHistoryAction,
    ReturnHistoryEvent,
    RETURN_STATUS_LABELS,
} from "@/lib/returns";
import { getReturnsAccess } from "@/server/returns/access";
import { parseReturnUpdatePayload } from "@/server/returns/validation";

function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    ) as T;
}

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId } = accessResult.access;
        const returnRef = adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("returns")
            .doc(id);

        const returnDoc = await returnRef.get();
        if (!returnDoc.exists) {
            return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
        }

        const historySnapshot = await returnRef
            .collection("history")
            .orderBy("createdAt", "desc")
            .get();

        const history = historySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as ReturnHistoryEvent[];

        return NextResponse.json({
            return: { id: returnDoc.id, ...returnDoc.data() } as MarketplaceReturn,
            history,
        });
    } catch (error: unknown) {
        console.error("Erro ao buscar devolucao:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId, uid, email } = accessResult.access;
        const payload = await request.json();
        const update = parseReturnUpdatePayload(payload);

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: "Nenhum dado para atualizar" }, { status: 400 });
        }

        const returnRef = adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("returns")
            .doc(id);

        const currentDoc = await returnRef.get();
        if (!currentDoc.exists) {
            return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
        }

        const current = currentDoc.data() as MarketplaceReturn;
        const previousStatus = current.status;
        const newStatus = update.status || previousStatus;
        const statusChanged = Boolean(update.status && update.status !== previousStatus);
        const now = new Date().toISOString();

        const updateData = withoutUndefined({
            ...update,
            updatedAt: now,
            updatedByUid: uid,
            updatedByEmail: email,
        });

        let action: ReturnHistoryAction = "updated";
        let note = "Dados da devolução atualizados";

        if (statusChanged) {
            action = "status_changed";
            note = `Status alterado de "${RETURN_STATUS_LABELS[previousStatus]}" para "${RETURN_STATUS_LABELS[newStatus]}"`;

            if (newStatus === "cancelled") {
                action = "cancelled";
                note = "Devolução cancelada";
            } else if (newStatus === "resolved") {
                action = "resolved";
                note = "Devolução finalizada";
            }
        } else if (Object.keys(update).length === 1 && "notes" in update) {
            note = "Observação atualizada";
        } else if (Object.keys(update).length === 1 && "pendingIssue" in update) {
            note = update.pendingIssue ? "Pendência atualizada" : "Pendência removida";
        }

        if (typeof payload.historyNote === "string" && payload.historyNote.trim()) {
            note = payload.historyNote.trim();
        }

        const historyRef = returnRef.collection("history").doc();
        const historyData = withoutUndefined({
            returnId: id,
            action,
            previousStatus: statusChanged ? previousStatus : undefined,
            newStatus: statusChanged ? newStatus : undefined,
            note,
            createdAt: now,
            createdByUid: uid,
            createdByEmail: email,
        });

        const batch = adminDb.batch();
        batch.update(returnRef, updateData);
        batch.set(historyRef, historyData);
        await batch.commit();

        return NextResponse.json({
            return: {
                ...current,
                ...updateData,
                id,
            },
        });
    } catch (error: unknown) {
        console.error("Erro ao atualizar devolucao:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId } = accessResult.access;
        const returnRef = adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("returns")
            .doc(id);

        const returnDoc = await returnRef.get();
        if (!returnDoc.exists) {
            return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
        }

        const data = returnDoc.data() as MarketplaceReturn;
        if (data.source && data.source !== "manual") {
            return NextResponse.json({ error: "Apenas devoluções manuais podem ser apagadas" }, { status: 403 });
        }

        const historySnapshot = await returnRef.collection("history").get();
        let batch = adminDb.batch();
        let count = 0;

        for (const historyDoc of historySnapshot.docs) {
            batch.delete(historyDoc.ref);
            count++;
            if (count >= 400) {
                await batch.commit();
                batch = adminDb.batch();
                count = 0;
            }
        }

        batch.delete(returnRef);
        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Erro ao apagar devolução:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
