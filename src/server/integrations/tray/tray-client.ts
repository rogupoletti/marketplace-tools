import "server-only";

interface TrayClientOptions {
    accessToken: string;
    apiBaseUrl?: string;
}

const DEFAULT_TRAY_API_BASE_URL = "https://api.tray.com.br";

function stripTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

function safeErrorText(text: string) {
    return text.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]").slice(0, 500);
}

export class TrayClient {
    private accessToken: string;
    private apiBaseUrl: string;

    constructor(options: TrayClientOptions) {
        this.accessToken = options.accessToken;
        this.apiBaseUrl = stripTrailingSlash(options.apiBaseUrl || process.env.TRAY_API_BASE_URL || DEFAULT_TRAY_API_BASE_URL);
    }

    public async fetchApi(endpoint: string, options: RequestInit = {}, retries = 3): Promise<unknown> {
        const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const url = new URL(`${this.apiBaseUrl}${path}`);

        if (!url.searchParams.has("access_token")) {
            url.searchParams.set("access_token", this.accessToken);
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(url.toString(), {
                    ...options,
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${this.accessToken}`,
                        ...(options.headers || {}),
                    },
                });

                if (response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 3000));
                    continue;
                }

                if (!response.ok) {
                    const errorText = safeErrorText(await response.text().catch(() => ""));
                    throw new Error(`Tray API error: HTTP ${response.status}${errorText ? ` - ${errorText}` : ""}`);
                }

                return response.json();
            } catch (error) {
                if (attempt === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        throw new Error("Falha inesperada ao chamar API Tray.");
    }

    public async validateConnection(): Promise<boolean> {
        try {
            await this.fetchApi("/orders?limit=1&page=1");
            return true;
        } catch {
            return false;
        }
    }
}
