import { MLItem, MLItemSearchResponse, MLMultigetResponse, MLTokenResponse } from './ml-types';

const ML_API_BASE_URL = 'https://api.mercadolibre.com';

export class MercadoLivreClient {
  private appId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.appId = process.env.ML_APP_ID || '';
    this.clientSecret = process.env.ML_CLIENT_SECRET || '';
    this.redirectUri = process.env.ML_REDIRECT_URI || '';
  }

  public getAuthUrl(accountId: string): string {
    // We pass accountId in the state parameter to know which account is connecting when the callback returns
    return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${this.appId}&redirect_uri=${this.redirectUri}&state=${accountId}`;
  }

  public async exchangeCode(code: string): Promise<MLTokenResponse> {
    const response = await fetch(`${ML_API_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.appId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    return response.json();
  }

  public async refreshToken(refreshToken: string): Promise<MLTokenResponse> {
    const response = await fetch(`${ML_API_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.appId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${errorText}`);
    }

    return response.json();
  }

  public async fetchAllUserItems(userId: number, token: string): Promise<string[]> {
    console.log(`[ML Client] Starting Deep Category Expansion for ${userId}...`);
    
    // 1. Descobrir categorias de Ativos e Pausados (amostra de 2000 itens)
    let sampleIds: string[] = [];
    const statuses = ['active', 'paused', 'not_specified', 'under_review'];
    
    for (const status of ['active', 'paused']) {
      console.log(`[ML Client] Sampling items from status: ${status}`);
      for (let offset = 0; offset < 1000; offset += 100) {
        const url = `${ML_API_BASE_URL}/users/${userId}/items/search?offset=${offset}&limit=100&logistic_type=fulfillment&status=${status}`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) break;
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          sampleIds = sampleIds.concat(data.results);
        } else {
          break;
        }
      }
    }

    // 2. Descobrir os IDs de categoria desses itens
    console.log(`[ML Client] Discovering categories from ${sampleIds.length} sample items...`);
    const itemDetails = await this.fetchItemDetails(sampleIds, token);
    const categoryIds = Array.from(new Set(itemDetails.map(item => item.category_id).filter(Boolean)));
    console.log(`[ML Client] Found ${categoryIds.length} distinct categories.`);

    // 3. Buscar todos os itens de cada categoria, desdobrando por status para furar o limite de 1000
    let allItemIds: string[] = [...sampleIds];
    
    for (const catId of categoryIds) {
      for (const status of statuses) {
        let offset = 0;
        let totalForBucket = 0;
        console.log(`[ML Client] Fetching category ${catId} with status ${status}`);
        
        do {
          const url = `${ML_API_BASE_URL}/users/${userId}/items/search?offset=${offset}&limit=100&logistic_type=fulfillment&category_id=${catId}&status=${status}`;
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) break;
          const data = await res.json();
          
          if (offset === 0) totalForBucket = data.paging.total;
          if (data.results && data.results.length > 0) {
            allItemIds = allItemIds.concat(data.results);
          } else {
            break;
          }

          offset += 100;
          if (offset >= 1000) {
            if (totalForBucket > 1000) {
              console.warn(`[ML Client] Bucket ${catId}/${status} has ${totalForBucket} items, but we can only fetch 1000.`);
            }
            break;
          }
          await new Promise(r => setTimeout(r, 20));
        } while (offset < totalForBucket);
      }
    }
    
    const uniqueIds = Array.from(new Set(allItemIds));
    console.log(`[ML Client] Expansion complete. Found ${uniqueIds.length} unique items.`);
    return uniqueIds;
  }

  public async fetchItemDetails(itemIds: string[], token: string): Promise<MLItem[]> {
    // ML API allows up to 20 items per multiget request
    const chunkSize = 20;
    const items: MLItem[] = [];

    for (let i = 0; i < itemIds.length; i += chunkSize) {
      const chunk = itemIds.slice(i, i + chunkSize);
      const idsParam = chunk.join(',');

      const response = await fetch(`${ML_API_BASE_URL}/items?ids=${idsParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch item details chunk ${i}: ${errorText}`);
      }

      const data: MLMultigetResponse[] = await response.json();
      
      data.forEach((itemResponse) => {
        if (itemResponse.code === 200) {
          items.push(itemResponse.body);
        }
      });

      // Small delay for rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return items;
  }
}
