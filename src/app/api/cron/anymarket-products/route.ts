import { NextRequest, NextResponse } from "next/server";
import { runProductsSync } from "@/server/integrations/anymarket/products-sync";

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[CRON] Disparando sincronizacao de produtos da Anymarket...");
        runProductsSync().catch(console.error);

        return NextResponse.json({
            message: "Sincronizacao de produtos disparada com sucesso",
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        console.error("[CRON] Erro ao disparar sync de produtos:", getErrorMessage(error));
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
