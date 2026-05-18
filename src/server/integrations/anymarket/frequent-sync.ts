import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { syncStock } from "./sync-stock";

export async function runFrequentSync() {
    console.log("[Anymarket Frequent Sync] Iniciando processamento de estoque...");
    
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
            console.log("[Anymarket Frequent Sync] Nenhuma conta ativa encontrada.");
            return { processed: 0 };
        }

        console.log(`[Anymarket Frequent Sync] Encontradas ${activeAccounts.length} contas para sincronizar estoque.`);

        const results = [];
        for (const accountId of activeAccounts) {
            try {
                console.log(`[Anymarket Frequent Sync] Sincronizando estoque da conta: ${accountId}...`);
                await syncStock(accountId);
                results.push({ accountId, status: "success" });
            } catch (err: any) {
                console.error(`[Anymarket Frequent Sync] Erro na conta ${accountId}:`, err.message);
                results.push({ accountId, status: "error", error: err.message });
            }
        }

        console.log("[Anymarket Frequent Sync] Processamento concluído.");
        return { 
            total: activeAccounts.length,
            processed: results.length,
            results 
        };

    } catch (error: any) {
        console.error("[Anymarket Frequent Sync] Erro fatal no job:", error);
        throw error;
    }
}
