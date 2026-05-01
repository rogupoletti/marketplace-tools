import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { syncOrders } from "./sync-orders";

export async function runDailySync() {
    console.log("[Anymarket Daily Sync] Iniciando processamento global...");
    
    try {
        // Busca todas as integrações anymarket ativas no sistema
        const snapshot = await adminDb.collectionGroup("integrations")
            .where("enabled", "==", true)
            .get();

        if (snapshot.empty) {
            console.log("[Anymarket Daily Sync] Nenhuma conta ativa encontrada.");
            return { processed: 0 };
        }

        console.log(`[Anymarket Daily Sync] Encontradas ${snapshot.size} contas para sincronizar.`);

        const results = [];
        for (const doc of snapshot.docs) {
            // O caminho é accounts/{accountId}/integrations/anymarket
            const accountId = doc.ref.parent.parent?.id;
            
            if (accountId) {
                try {
                    console.log(`[Anymarket Daily Sync] Sincronizando conta: ${accountId}...`);
                    // Chamamos o syncOrders. Como ele agora é resiliente (retry/resumable), 
                    // ele vai lidar bem com o volume.
                    // Para o diário, poderíamos passar um parâmetro de dias, 
                    // mas por enquanto ele usa o padrão de 3 dias que definimos para teste.
                    // No futuro, podemos parametrizar o syncOrders(accountId, days).
                    await syncOrders(accountId, 2); // Busca apenas os últimos 2 dias no job diário
                    results.push({ accountId, status: "success" });
                } catch (err: any) {
                    console.error(`[Anymarket Daily Sync] Erro na conta ${accountId}:`, err.message);
                    results.push({ accountId, status: "error", error: err.message });
                }
            }
        }

        console.log("[Anymarket Daily Sync] Processamento concluído.");
        return { 
            total: snapshot.size,
            processed: results.length,
            results 
        };

    } catch (error: any) {
        console.error("[Anymarket Daily Sync] Erro fatal no job:", error);
        throw error;
    }
}
