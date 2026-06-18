import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { decryptToken, encryptToken } from "@/server/utils/crypto";
import { TrayClient } from "./tray-client";
import { TrayIntegrationData, TrayTokenResponse } from "./tray-types";

type JsonRecord = Record<string, unknown>;
interface TrayAppConfig {
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
    redirectUri: string;
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
    if (value === undefined || value === null || String(value).trim() === "") return undefined;
    return String(value);
}

function numberValue(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function getAuthUrl() {
    return process.env.TRAY_AUTH_URL || "";
}

function getClientId() {
    return process.env.TRAY_CLIENT_ID || "";
}

function getClientSecret() {
    return process.env.TRAY_CLIENT_SECRET || "";
}

function getRedirectUri() {
    return process.env.TRAY_REDIRECT_URI || "";
}

function getTokenUrl() {
    return process.env.TRAY_TOKEN_URL || "";
}

function getTrayAppConfig(requireSecret = false): TrayAppConfig {
    const appConfig: TrayAppConfig = {
        clientId: getClientId(),
        clientSecret: getClientSecret(),
        authUrl: getAuthUrl(),
        tokenUrl: getTokenUrl(),
        redirectUri: getRedirectUri(),
    };

    const missing: string[] = [];
    if (!appConfig.authUrl) missing.push("TRAY_AUTH_URL");
    if (!appConfig.tokenUrl) missing.push("TRAY_TOKEN_URL");
    if (!appConfig.clientId) missing.push("TRAY_CLIENT_ID");
    if (!appConfig.redirectUri) missing.push("TRAY_REDIRECT_URI");
    if (requireSecret && !appConfig.clientSecret) missing.push("TRAY_CLIENT_SECRET");

    if (missing.length > 0) {
        throw new Error(`Configuracao Tray incompleta. Defina: ${missing.join(", ")}.`);
    }

    return appConfig;
}

function buildTokenExpiresAt(expiresIn?: number): string | undefined {
    if (!expiresIn || Number.isNaN(Number(expiresIn))) return undefined;
    return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}

function normalizeApiBaseUrl(tokenResponse: TrayTokenResponse): string | undefined {
    return tokenResponse.api_address || tokenResponse.api_host || tokenResponse.api_url || process.env.TRAY_API_BASE_URL;
}

function normalizeTokenResponse(data: unknown): TrayTokenResponse {
    const root = asRecord(data);
    const source = asRecord(root.data || root.response || data);
    return {
        access_token: stringValue(source.access_token || source.accessToken || source.token) || "",
        refresh_token: stringValue(source.refresh_token || source.refreshToken),
        expires_in: numberValue(source.expires_in || source.expires || source.expiresIn),
        token_type: stringValue(source.token_type || source.tokenType),
        scope: stringValue(source.scope),
        store_id: stringValue(source.store_id || source.storeId || source.shop_id || source.shopId),
        seller_id: stringValue(source.seller_id || source.sellerId || source.user_id || source.userId),
        user_id: stringValue(source.user_id || source.userId),
        api_address: stringValue(source.api_address || source.apiAddress),
        api_host: stringValue(source.api_host || source.apiHost),
        api_url: stringValue(source.api_url || source.apiUrl),
    };
}

export function getTrayAuthUrl(accountId: string): string {
    const appConfig = getTrayAppConfig(false);
    const authUrl = new URL(appConfig.authUrl);

    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", appConfig.clientId);
    authUrl.searchParams.set("consumer_key", appConfig.clientId);
    authUrl.searchParams.set("redirect_uri", appConfig.redirectUri);
    authUrl.searchParams.set("state", accountId);

    return authUrl.toString();
}

export async function exchangeTrayCode(code: string): Promise<TrayTokenResponse> {
    const appConfig = getTrayAppConfig(true);
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: appConfig.clientId,
        client_secret: appConfig.clientSecret,
        consumer_key: appConfig.clientId,
        consumer_secret: appConfig.clientSecret,
        code,
        redirect_uri: appConfig.redirectUri,
    });

    const response = await fetch(appConfig.tokenUrl, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error(`Falha ao conectar Tray: HTTP ${response.status}`);
    }

    const data = normalizeTokenResponse(await response.json());
    if (!data.access_token) {
        throw new Error("A Tray nao retornou access_token.");
    }

    return data;
}

export async function refreshTrayToken(config: TrayIntegrationData): Promise<TrayIntegrationData> {
    if (!config.encryptedRefreshToken || !config.refreshTokenIv || !config.refreshTokenAuthTag) {
        throw new Error("Refresh token da Tray nao encontrado.");
    }

    const refreshToken = decryptToken(config.encryptedRefreshToken, config.refreshTokenIv, config.refreshTokenAuthTag);
    const appConfig = getTrayAppConfig(true);
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: appConfig.clientId,
        client_secret: appConfig.clientSecret,
        consumer_key: appConfig.clientId,
        consumer_secret: appConfig.clientSecret,
        refresh_token: refreshToken,
    });

    const response = await fetch(appConfig.tokenUrl, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error(`Falha ao renovar token Tray: HTTP ${response.status}`);
    }

    const tokenResponse = normalizeTokenResponse(await response.json());
    if (!tokenResponse.access_token) {
        throw new Error("A Tray nao retornou access_token ao renovar.");
    }

    const access = encryptToken(tokenResponse.access_token);
    const nextRefreshToken = tokenResponse.refresh_token || refreshToken;
    const refresh = encryptToken(nextRefreshToken);
    const updatedAt = new Date().toISOString();

    return {
        ...config,
        enabled: true,
        status: "connected",
        encryptedAccessToken: access.encrypted,
        accessTokenIv: access.iv,
        accessTokenAuthTag: access.authTag,
        encryptedRefreshToken: refresh.encrypted,
        refreshTokenIv: refresh.iv,
        refreshTokenAuthTag: refresh.authTag,
        tokenExpiresAt: buildTokenExpiresAt(tokenResponse.expires_in),
        storeId: String(tokenResponse.store_id || config.storeId || "default"),
        sellerId: tokenResponse.seller_id ? String(tokenResponse.seller_id) : config.sellerId,
        apiBaseUrl: normalizeApiBaseUrl(tokenResponse) || config.apiBaseUrl,
        updatedAt,
    };
}

export function buildTrayIntegrationData(tokenResponse: TrayTokenResponse): TrayIntegrationData {
    const access = encryptToken(tokenResponse.access_token);
    const refresh = tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : undefined;
    const now = new Date().toISOString();

    return {
        provider: "tray",
        enabled: true,
        status: "connected",
        storeId: String(tokenResponse.store_id || tokenResponse.user_id || "default"),
        sellerId: tokenResponse.seller_id ? String(tokenResponse.seller_id) : undefined,
        apiBaseUrl: normalizeApiBaseUrl(tokenResponse),
        encryptedAccessToken: access.encrypted,
        accessTokenIv: access.iv,
        accessTokenAuthTag: access.authTag,
        encryptedRefreshToken: refresh?.encrypted,
        refreshTokenIv: refresh?.iv,
        refreshTokenAuthTag: refresh?.authTag,
        tokenExpiresAt: buildTokenExpiresAt(tokenResponse.expires_in),
        lastSyncStatus: "none",
        lastSyncError: null,
        createdAt: now,
        updatedAt: now,
    };
}

export async function getAuthenticatedTrayClient(accountId: string): Promise<{ client: TrayClient; config: TrayIntegrationData }> {
    const integrationRef = adminDb.collection("accounts").doc(accountId).collection("integrations").doc("tray");
    const snapshot = await integrationRef.get();

    if (!snapshot.exists) {
        throw new Error("Integracao Tray nao configurada para esta conta.");
    }

    let config = snapshot.data() as TrayIntegrationData;
    if (!config.enabled || !config.encryptedAccessToken || !config.accessTokenIv || !config.accessTokenAuthTag) {
        throw new Error("Integracao Tray desativada ou sem credenciais.");
    }

    const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt).getTime() : 0;
    if (expiresAt && expiresAt - Date.now() < 60_000) {
        config = await refreshTrayToken(config);
        await integrationRef.set(config, { merge: true });
    }

    if (!config.encryptedAccessToken || !config.accessTokenIv || !config.accessTokenAuthTag) {
        throw new Error("Credenciais Tray incompletas.");
    }

    const accessToken = decryptToken(config.encryptedAccessToken, config.accessTokenIv, config.accessTokenAuthTag);
    return {
        client: new TrayClient({
            accessToken,
            apiBaseUrl: config.apiBaseUrl,
        }),
        config,
    };
}
