import { NextRequest, NextResponse } from "next/server";
import { runFrequentSync } from "@/server/integrations/anymarket/frequent-sync";

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Se o segredo estiver configurado, exigimos a validação
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[CRON] Disparando sincronização frequente (estoque) da Anymarket...");
        // Rodamos de forma assíncrona para não dar timeout no serviço de cron
        runFrequentSync().catch(console.error);
        
        return NextResponse.json({ 
            message: "Sincronização frequente (estoque) disparada com sucesso",
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[CRON] Erro ao disparar sync frequente:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
