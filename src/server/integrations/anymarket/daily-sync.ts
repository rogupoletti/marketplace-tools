import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { syncOrders } from "./sync-orders";

export async function runDailySync() {
    console.log("[Anymarket Daily Sync] Iniciando processamento global...");
    
    try {
        // Busca todas as contas e confere a integração anymarket sem depender de índice collectionGroup
        const accountsSnapshot = await adminDb.collection("accounts").get();
        const activeAccounts = [];

        for (const accountDoc of accountsSnapshot.docs) {
            const integrationDoc = await accountDoc.ref.collection("integrations").doc("anymarket").get();
            const integration = integrationDoc.data();
            if (integrationDoc.exists && integration?.enabled) {
                activeAccounts.push(accountDoc.id);
            }
        }

        if (activeAccounts.length === 0) {
            console.log("[Anymarket Daily Sync] Nenhuma conta ativa encontrada.");
            return { processed: 0 };
        }

        console.log(`[Anymarket Daily Sync] Encontradas ${activeAccounts.length} contas para sincronizar.`);

        const results = [];
        for (const accountId of activeAccounts) {
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

        console.log("[Anymarket Daily Sync] Processamento concluído.");
        return { 
            total: activeAccounts.length,
            processed: results.length,
            results 
        };

    } catch (error: any) {
        console.error("[Anymarket Daily Sync] Erro fatal no job:", error);
        throw error;
    }
}
