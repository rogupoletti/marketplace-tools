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
    let allItemIds: string[] = [];
    let offset = 0;
    const limit = 50;
    let total = 0;

    do {
      const response = await fetch(
        `${ML_API_BASE_URL}/users/${userId}/items/search?offset=${offset}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user items at offset ${offset}: ${errorText}`);
      }

      const data: MLItemSearchResponse = await response.json();
      
      if (offset === 0) {
        total = data.paging.total;
      }

      allItemIds = allItemIds.concat(data.results);
      offset += limit;

      // Small delay to respect rate limits if needed (optional but recommended)
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (offset < total);

    return allItemIds;
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
