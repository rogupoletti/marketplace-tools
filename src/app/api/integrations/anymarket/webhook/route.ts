import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { AnymarketIntegrationStatus } from "@/server/integrations/anymarket/anymarket-types";
import { decryptToken } from "@/server/utils/crypto";
import { AnymarketClient } from "@/server/integrations/anymarket/anymarket-client";
import { normalizeOrder } from "@/server/integrations/anymarket/normalize-order";
import { saveSales } from "@/server/integrations/anymarket/save-sales";
import {
    normalizeAnyMarketReturnWebhookPayload,
    processAnyMarketReturnWebhook,
} from "@/server/integrations/anymarket/returns-webhook";

export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const accountId = url.searchParams.get("accountId");

        if (!accountId) {
            return NextResponse.json({ error: "Missing accountId parameter" }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const returnEvent = normalizeAnyMarketReturnWebhookPayload(body);

        if (returnEvent.isReturnEvent) {
            const result = await processAnyMarketReturnWebhook(accountId, body);
            console.log(`[Anymarket Webhook] Devolucao processada para accountId ${accountId}: ${result.processingMessage}`);
            return NextResponse.json(
                {
                    success: result.processingStatus !== "failed",
                    message: result.processingMessage,
                    ...result,
                },
                { status: result.processingStatus === "failed" ? 422 : result.createdReturn ? 201 : 200 }
            );
        }

        // A Anymarket pode enviar o ID de algumas formas diferentes dependendo do evento
        const orderId = body.id || body.content?.id || body.order?.id || body.content?.order?.id;

        if (!orderId) {
            // Nem todo webhook da Anymarket é sobre pedido. Se não tiver orderId, podemos ignorar em silêncio.
            console.log(`[Anymarket Webhook] Payload ignorado (sem orderId) para accountId ${accountId}`);
            return NextResponse.json({ message: "Ignored: No order ID" });
        }

        console.log(`[Anymarket Webhook] Recebido aviso de atualização do pedido ${orderId} para accountId ${accountId}`);

        // 1. Validar integração
        const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("anymarket");
        const doc = await integrationRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Anymarket integration not configured." }, { status: 404 });
        }

        const config = doc.data() as AnymarketIntegrationStatus;

        if (!config.enabled || !config.encryptedToken) {
            return NextResponse.json({ error: "Anymarket integration disabled." }, { status: 403 });
        }

        // 2. Descriptografar token e inicializar cliente
        const token = decryptToken(config.encryptedToken, config.tokenIv, config.tokenAuthTag);
        const client = new AnymarketClient(token);

        // 3. Buscar os dados atualizados e completos do pedido na API da Anymarket
        let order;
        try {
            order = await client.fetchOrderById(orderId);
        } catch (err: any) {
            console.error(`[Anymarket Webhook] Erro ao buscar pedido ${orderId}:`, err.message);
            return NextResponse.json({ error: "Failed to fetch order from Anymarket API" }, { status: 500 });
        }

        if (!order || !order.id) {
            return NextResponse.json({ error: "Order not found or invalid response" }, { status: 404 });
        }

        if (normalizeAnyMarketReturnWebhookPayload(order).isReturnEvent) {
            const result = await processAnyMarketReturnWebhook(accountId, order);
            console.log(`[Anymarket Webhook] Pedido ${orderId} identificado como devolucao e desviado do fluxo de vendas.`);
            return NextResponse.json(
                {
                    success: result.processingStatus !== "failed",
                    message: result.processingMessage,
                    ...result,
                },
                { status: result.processingStatus === "failed" ? 422 : result.createdReturn ? 201 : 200 }
            );
        }

        // 4. Normalizar o pedido para itens
        const normalizedItems = normalizeOrder(order);

        // 5. Processar salvamento e matemática do status
        await saveSales(accountId, [order], normalizedItems);

        console.log(`[Anymarket Webhook] Pedido ${orderId} processado com sucesso.`);

        return NextResponse.json({ success: true, message: `Order ${orderId} processed.` });

    } catch (error: any) {
        console.error("[Anymarket Webhook] Fatal error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
