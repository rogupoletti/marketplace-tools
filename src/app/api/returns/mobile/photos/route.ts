import { NextRequest, NextResponse } from "next/server";
import {
    assertReturnCanBeEdited,
    parsePhotoUploadPayload,
    uploadReturnPhotoBuffer,
} from "@/server/returns/mobile";
import { getReturnsAccess } from "@/server/returns/access";

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId, uid, email } = accessResult.access;
        const formData = await request.formData();
        const payload = parsePhotoUploadPayload(formData);
        await assertReturnCanBeEdited(accountId, payload.returnId);

        const photo = await uploadReturnPhotoBuffer({
            accountId,
            returnId: payload.returnId,
            itemId: payload.itemId,
            type: payload.type,
            fileName: payload.file.name || "foto.jpg",
            contentType: payload.file.type || "image/jpeg",
            buffer: Buffer.from(await payload.file.arrayBuffer()),
            createdBy: email || uid,
        });

        return NextResponse.json({ photo }, { status: 201 });
    } catch (error: unknown) {
        console.error("Erro ao enviar foto de devolucao:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
