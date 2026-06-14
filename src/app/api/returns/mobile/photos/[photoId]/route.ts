import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorageBucket } from "@/lib/firebase-admin";
import { ReturnPhoto } from "@/lib/returns";

interface RouteContext {
    params: Promise<{ photoId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { photoId } = await context.params;
        const accountId = request.nextUrl.searchParams.get("accountId")?.trim();
        const returnId = request.nextUrl.searchParams.get("returnId")?.trim();
        const token = request.nextUrl.searchParams.get("token")?.trim();

        if (!accountId || !returnId || !token) {
            return NextResponse.json({ error: "Foto invalida" }, { status: 400 });
        }

        const photoDoc = await adminDb
            .collection("accounts")
            .doc(accountId)
            .collection("returns")
            .doc(returnId)
            .collection("photos")
            .doc(photoId)
            .get();

        if (!photoDoc.exists) {
            return NextResponse.json({ error: "Foto nao encontrada" }, { status: 404 });
        }

        const photo = photoDoc.data() as ReturnPhoto;
        if (photo.downloadToken !== token || !photo.storagePath) {
            return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
        }

        const [buffer] = await adminStorageBucket.file(photo.storagePath).download();
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Cache-Control": "private, max-age=3600",
                "Content-Type": photo.contentType || "image/jpeg",
            },
        });
    } catch (error: unknown) {
        console.error("Erro ao carregar foto de devolucao:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
