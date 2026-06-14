import { NextRequest, NextResponse } from "next/server";
import {
    createManualReturnFromScan,
    parseManualReturnCreatePayload,
    startReturnAnalysis,
} from "@/server/returns/mobile";
import { getReturnsAccess } from "@/server/returns/access";

function parseJsonPayload(value: FormDataEntryValue | null) {
    if (typeof value !== "string") throw new Error("Payload obrigatorio");
    return JSON.parse(value);
}

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const { accountId, uid, email } = accessResult.access;
        const formData = await request.formData();
        const payload = parseManualReturnCreatePayload(parseJsonPayload(formData.get("payload")));
        const labelPhotoFile = formData.get("labelPhoto");
        const labelPhoto = labelPhotoFile instanceof File
            ? {
                fileName: labelPhotoFile.name || "etiqueta.jpg",
                contentType: labelPhotoFile.type || "image/jpeg",
                buffer: Buffer.from(await labelPhotoFile.arrayBuffer()),
            }
            : undefined;

        const result = await createManualReturnFromScan({
            accountId,
            uid,
            email,
            payload,
            labelPhoto,
        });
        const analysis = await startReturnAnalysis(accountId, result.return.id);

        return NextResponse.json({ ...result, ...analysis }, { status: 201 });
    } catch (error: unknown) {
        console.error("Erro ao criar devolucao mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
