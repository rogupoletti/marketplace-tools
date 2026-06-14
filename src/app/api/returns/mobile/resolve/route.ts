import { NextRequest, NextResponse } from "next/server";
import { MobileScanType } from "@/lib/returns";
import { createMobileScan, resolveReturnByIdentifier } from "@/server/returns/mobile";
import { getReturnsAccess } from "@/server/returns/access";

function parseScanType(value: unknown): MobileScanType {
    if (value === "qr_code" || value === "barcode" || value === "manual") return value;
    return "manual";
}

export async function POST(request: NextRequest) {
    try {
        const requestedAccountId = request.nextUrl.searchParams.get("accountId");
        const accessResult = await getReturnsAccess(request, requestedAccountId);
        if ("response" in accessResult) return accessResult.response;

        const payload = await request.json();
        const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
        const rawValue = typeof data.rawValue === "string"
            ? data.rawValue
            : typeof data.code === "string"
                ? data.code
                : "";

        const scan = createMobileScan(rawValue, parseScanType(data.scanType));
        const result = await resolveReturnByIdentifier(accessResult.access.accountId, scan);

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Erro ao resolver devolucao mobile:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
