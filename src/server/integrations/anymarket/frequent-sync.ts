import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { syncStock } from "./sync-stock";

export async function runFrequentSync() {
    console.log("[Anymarket Frequent Sync] Iniciando processamento de estoque...");
    
    try {
        // Busca todas as integrações anymarket ativas no sistema
        const snapshot = await adminDb.collectionGroup("integrations")
            .where("enabled", "==", true)
            .get();

        if (snapshot.empty) {
            console.log("[Anymarket Frequent Sync] Nenhuma conta ativa encontrada.");
            return { processed: 0 };
        }

        console.log(`[Anymarket Frequent Sync] Encontradas ${snapshot.size} contas para sincronizar estoque.`);

        const results = [];
        for (const doc of snapshot.docs) {
            // O caminho é accounts/{accountId}/integrations/anymarket
            const accountId = doc.ref.parent.parent?.id;
            
            if (accountId) {
                try {
                    console.log(`[Anymarket Frequent Sync] Sincronizando estoque da conta: ${accountId}...`);
                    await syncStock(accountId);
                    results.push({ accountId, status: "success" });
                } catch (err: any) {
                    console.error(`[Anymarket Frequent Sync] Erro na conta ${accountId}:`, err.message);
                    results.push({ accountId, status: "error", error: err.message });
                }
            }
        }

        console.log("[Anymarket Frequent Sync] Processamento concluído.");
        return { 
            total: snapshot.size,
            processed: results.length,
            results 
        };

    } catch (error: any) {
        console.error("[Anymarket Frequent Sync] Erro fatal no job:", error);
        throw error;
    }
}
