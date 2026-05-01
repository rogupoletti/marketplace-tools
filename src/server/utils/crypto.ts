import crypto from 'crypto';
import "server-only";

const ENCRYPTION_KEY = process.env.ANYMARKET_ENCRYPTION_KEY; 

const ALGORITHM = 'aes-256-gcm';

export function encryptToken(text: string): { encrypted: string, iv: string, authTag: string } {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
        throw new Error("ANYMARKET_ENCRYPTION_KEY must be a 32 character string in env variables.");
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag
    };
}

export function decryptToken(encrypted: string, ivHex: string, authTagHex: string): string {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
        throw new Error("ANYMARKET_ENCRYPTION_KEY must be a 32 character string in env variables.");
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
