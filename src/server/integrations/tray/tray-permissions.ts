import "server-only";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export interface TrayUserContext {
    uid: string;
    role?: string;
    isAdmin?: boolean;
    accountId?: string;
}

export async function getTrayUserContext(request: NextRequest): Promise<TrayUserContext> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("UNAUTHENTICATED");
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) {
        throw new Error("USER_NOT_FOUND");
    }

    return {
        uid: decodedToken.uid,
        ...userDoc.data(),
    } as TrayUserContext;
}

export function isTrayIntegrationAdmin(user: TrayUserContext) {
    return user.role === "superadmin" || user.role === "account_admin" || user.isAdmin === true;
}

export function isTraySuperadmin(user: TrayUserContext) {
    return user.role === "superadmin" || user.isAdmin === true;
}

export function resolveTrayAccountId(user: TrayUserContext, requestedAccountId?: string | null) {
    if (isTraySuperadmin(user) && requestedAccountId) return requestedAccountId;
    return user.accountId;
}
