import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { processAnyMarketReturnWebhook } from "@/server/integrations/anymarket/returns-webhook";

function safeEquals(a: string, b: string) {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) return false;
    return timingSafeEqual(aBuffer, bBuffer);
}

function getProvidedSecret(request: NextRequest) {
    const headerSecret = request.headers.get("x-webhook-secret");
    if (headerSecret) return headerSecret;

    const authorization = request.headers.get("authorization");
    if (authorization?.startsWith("Bearer ")) {
        return authorization.slice("Bearer ".length).trim();
    }

    return undefined;
}

export async function POST(request: NextRequest) {
    const expectedSecret = process.env.ANYMARKET_WEBHOOK_SECRET;
    if (!expectedSecret) {
        console.error("[Anymarket Returns Webhook] ANYMARKET_WEBHOOK_SECRET nao configurado.");
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const providedSecret = getProvidedSecret(request);
    if (!providedSecret || !safeEquals(providedSecret, expectedSecret)) {
        return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const accountId =
        request.nextUrl.searchParams.get("accountId") ||
        request.headers.get("x-account-id") ||
        (payload as Record<string, unknown>).accountId;

    if (typeof accountId !== "string" || !accountId.trim()) {
        return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    try {
        const result = await processAnyMarketReturnWebhook(accountId.trim(), payload);
        const status = result.processingStatus === "failed" ? 422 : result.createdReturn ? 201 : 200;

        return NextResponse.json(
            {
                success: result.processingStatus !== "failed",
                ...result,
            },
            { status }
        );
    } catch (error: unknown) {
        console.error("[Anymarket Returns Webhook] Erro fatal:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
