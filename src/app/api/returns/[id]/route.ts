import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
    ReturnAnalysisItem,
    MarketplaceReturn,
    ReturnHistoryAction,
    ReturnHistoryEvent,
    ReturnPhoto,
    RETURN_DISPUTE_OUTCOME_LABELS,
    RETURN_DISPUTE_REJECTION_REASON_LABELS,
    RETURN_STATUS_LABELS,
} from "@/lib/returns";
import { getReturnsAccess } from "@/server/returns/access";
import { normalizeReturnIdentifier } from "@/server/returns/mobile";
import { parseReturnUpdatePayload } from "@/server/returns/validation";

function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    ) as T;
}

interface RouteContext {
    params: Promise<{ id: string }>;
}

function identifierDocId(normalizedCode: string) {
    if (!normalizedCode.includes("/") && normalizedCode.length <= 900) return normalizedCode;
    return `sha256_${createHash("sha256").update(normalizedCode).digest("hex")}`;
}

function isManualReturn(data: MarketplaceReturn) {
    return !data.source || data.source === "manual" || data.source === "manual_mobile_creation" || data.createdManually === true;
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

        const [historySnapshot, analysisItemsSnapshot, photosSnapshot] = await Promise.all([
            returnRef
                .collection("history")
                .orderBy("createdAt", "desc")
                .get(),
            returnRef
                .collection("analysisItems")
                .orderBy("createdAt", "asc")
                .get(),
            returnRef
                .collection("photos")
                .orderBy("createdAt", "asc")
                .get(),
        ]);

        const history = historySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as ReturnHistoryEvent[];
        const analysisItems = analysisItemsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as ReturnAnalysisItem[];
        const photos = photosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as ReturnPhoto[];

        return NextResponse.json({
            return: { id: returnDoc.id, ...returnDoc.data() } as MarketplaceReturn,
            history,
            analysisItems,
            photos,
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
        const isDisputeResolutionStatus = newStatus === "resolved" || newStatus === "pending_return_invoice";
        const isResolvingDispute = previousStatus === "waiting_dispute_or_refund" && statusChanged && isDisputeResolutionStatus;

        if (isResolvingDispute) {
            const disputeOutcome = update.disputeOutcome || current.disputeOutcome;
            const disputeRejectionReason = update.disputeRejectionReason || current.disputeRejectionReason;
            const disputeRejectionReasonDetail = update.disputeRejectionReasonDetail || current.disputeRejectionReasonDetail;

            if (!disputeOutcome) {
                return NextResponse.json({ error: "Informe o resultado da contestacao antes de resolver" }, { status: 400 });
            }

            if (disputeOutcome === "rejected") {
                if (!disputeRejectionReason) {
                    return NextResponse.json({ error: "Informe o motivo da contestacao rejeitada" }, { status: 400 });
                }

                if (disputeRejectionReason === "other" && !disputeRejectionReasonDetail?.trim()) {
                    return NextResponse.json({ error: "Descreva o motivo da contestacao rejeitada" }, { status: 400 });
                }
            }
        }

        const updateData = withoutUndefined({
            ...update,
            disputeResolvedAt: isResolvingDispute ? now : undefined,
            disputeResolvedByUid: isResolvingDispute ? uid : undefined,
            disputeResolvedByEmail: isResolvingDispute ? email : undefined,
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

            if (isResolvingDispute) {
                const outcome = update.disputeOutcome || current.disputeOutcome;
                const rejectionReason = update.disputeRejectionReason || current.disputeRejectionReason;
                const outcomeLabel = outcome ? RETURN_DISPUTE_OUTCOME_LABELS[outcome] : "Contestação resolvida";
                const reasonLabel = rejectionReason ? RETURN_DISPUTE_REJECTION_REASON_LABELS[rejectionReason] : "";
                note = reasonLabel ? `${outcomeLabel}. Motivo: ${reasonLabel}.` : outcomeLabel;
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
        if (!isManualReturn(data)) {
            return NextResponse.json({ error: "Apenas devoluções manuais podem ser apagadas" }, { status: 403 });
        }

        const [historySnapshot, analysisItemsSnapshot, photosSnapshot] = await Promise.all([
            returnRef.collection("history").get(),
            returnRef.collection("analysisItems").get(),
            returnRef.collection("photos").get(),
        ]);
        let batch = adminDb.batch();
        let count = 0;

        const commitIfNeeded = async () => {
            if (count >= 400) {
                await batch.commit();
                batch = adminDb.batch();
                count = 0;
            }
        };

        const queueDelete = async (docRef: FirebaseFirestore.DocumentReference) => {
            batch.delete(docRef);
            count++;
            await commitIfNeeded();
        };

        for (const historyDoc of historySnapshot.docs) {
            await queueDelete(historyDoc.ref);
        }

        for (const itemDoc of analysisItemsSnapshot.docs) {
            await queueDelete(itemDoc.ref);
        }

        for (const photoDoc of photosSnapshot.docs) {
            await queueDelete(photoDoc.ref);
        }

        const normalizedIdentifiers = Array.from(
            new Set((data.identifiers || []).map(normalizeReturnIdentifier).filter(Boolean))
        );

        for (const identifier of normalizedIdentifiers) {
            const indexRef = adminDb
                .collection("accounts")
                .doc(accountId)
                .collection("returnIdentifierIndex")
                .doc(identifierDocId(identifier));
            const indexDoc = await indexRef.get();
            if (!indexDoc.exists) continue;

            const indexData = indexDoc.data() || {};
            const currentMatches = Array.isArray(indexData.matches) ? indexData.matches : [];
            const nextMatches = currentMatches.filter((match) => match?.returnId !== id);

            if (nextMatches.length === 0) {
                await queueDelete(indexRef);
            } else if (nextMatches.length !== currentMatches.length) {
                batch.set(indexRef, {
                    matches: nextMatches,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
                count++;
                await commitIfNeeded();
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
