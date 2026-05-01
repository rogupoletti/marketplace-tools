import "server-only";
import { AnymarketOrderPage } from "./anymarket-types";

const ANYMARKET_BASE_URL = "https://api.anymarket.com.br/v2";

export class AnymarketClient {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    private async fetchApi(endpoint: string, options: RequestInit = {}, retries = 3) {
        const url = `${ANYMARKET_BASE_URL}${endpoint}`;
        
        for (let i = 0; i < retries; i++) {
            console.log(`[Anymarket API] Request: ${url} (Tentativa ${i + 1})`);
            const start = Date.now();
            
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        "Content-Type": "application/json",
                        "gumgaToken": this.token,
                        ...(options.headers || {})
                    }
                });

                console.log(`[Anymarket API] Response: ${response.status} in ${Date.now() - start}ms`);

                if (response.status === 429) {
                    const waitTime = (i + 1) * 5000; // 5s, 10s, 15s...
                    console.warn(`[Anymarket API] Rate limit atingido. Aguardando ${waitTime}ms para tentar novamente...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                if (!response.ok) {
                    const errorText = await response.text().catch(() => "Unknown error");
                    throw new Error(`Anymarket API error: ${response.status} ${response.statusText} - ${errorText}`);
                }

                return await response.json();
            } catch (error: any) {
                if (i === retries - 1) {
                    console.error(`[Anymarket API] Failed after ${retries} retries: ${url}`, error);
                    throw error;
                }
                // Se for erro de rede, espera um pouco e tenta de novo
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    /**
     * Valida o token fazendo uma requisição simples
     */
    public async validateToken(): Promise<boolean> {
        try {
            // Usando categorias para validar, pois é um endpoint mais leve que o de pedidos
            await this.fetchApi("/categories?limit=5");
            return true;
        } catch (error) {
            console.error("Token validation failed:", error);
            return false;
        }
    }

    /**
     * Busca pedidos criados após uma data específica, paginados.
     * @param createdAfter Data no formato ISO 8601
     * @param offset Número da página (começando de 0)
     * @param limit Limite por página (padrão 50)
     */
    public async fetchOrders(createdAfter: string, offset: number = 0, limit: number = 50): Promise<AnymarketOrderPage> {
        // A Anymarket geralmente usa parâmetros na URL. createdAfter pode requerer formatação.
        // Vamos formatar para a API. A documentação indica que o filtro de data pode ser ?createdAfter=YYYY-MM-DDTHH:mm:ssZ
        const queryParams = new URLSearchParams({
            createdAfter,
            offset: offset.toString(),
            limit: limit.toString()
        });

        return this.fetchApi(`/orders?${queryParams.toString()}`);
    }

    /**
     * Busca um pedido específico pelo ID
     * @param id ID do pedido na Anymarket
     */
    public async fetchOrderById(id: number | string): Promise<any> {
        return this.fetchApi(`/orders/${id}`);
    }
}
