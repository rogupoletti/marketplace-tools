import { NextRequest, NextResponse } from "next/server";
import { runGlobalFullSync } from "@/server/integrations/mercadolivre/sync-full";

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Se o segredo estiver configurado, exigimos a validação
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[CRON] Disparando sincronização do Mercado Livre Full...");
        
        // Rodamos de forma assíncrona para não dar timeout no serviço de cron
        runGlobalFullSync().catch(console.error);
        
        return NextResponse.json({ 
            message: "Sincronização Mercado Livre Full disparada com sucesso",
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[CRON] Erro ao disparar sync ML Full:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
