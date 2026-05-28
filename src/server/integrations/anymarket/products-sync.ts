import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { syncProducts } from "./sync-products";

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runProductsSync() {
    console.log("[Anymarket Products Sync] Iniciando processamento global...");

    try {
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
            console.log("[Anymarket Products Sync] Nenhuma conta ativa encontrada.");
            return { processed: 0 };
        }

        console.log(`[Anymarket Products Sync] Encontradas ${activeAccounts.length} contas para sincronizar produtos.`);

        const results = [];
        for (const accountId of activeAccounts) {
            try {
                console.log(`[Anymarket Products Sync] Sincronizando produtos da conta: ${accountId}...`);
                await syncProducts(accountId);
                results.push({ accountId, status: "success" });
            } catch (err: unknown) {
                const errorMessage = getErrorMessage(err);
                console.error(`[Anymarket Products Sync] Erro na conta ${accountId}:`, errorMessage);
                results.push({ accountId, status: "error", error: errorMessage });
            }
        }

        console.log("[Anymarket Products Sync] Processamento concluido.");
        return {
            total: activeAccounts.length,
            processed: results.length,
            results
        };
    } catch (error: unknown) {
        console.error("[Anymarket Products Sync] Erro fatal no job:", error);
        throw error;
    }
}
