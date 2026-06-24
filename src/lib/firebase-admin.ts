import * as admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.appspot.com` : undefined);
const firebaseAdminConfig = {
  projectId,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Precisamos tratar as quebras de linha que às vezes se perdem em env vars
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    const isEmulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Local development with service account key
      admin.initializeApp({
        credential: admin.credential.cert(firebaseAdminConfig),
        storageBucket,
      });
      console.log("Firebase Admin initialized with service account certificate (Local/Env)");
    } else if (isEmulator) {
      // Initialize for local emulator without needing credentials
      admin.initializeApp({
        projectId,
        storageBucket,
      });
      console.log("Firebase Admin initialized for Emulator (Local)");
    } else {
      // Production on Google Cloud/Firebase: use Application Default Credentials (ADC)
      admin.initializeApp({ storageBucket });
      console.log("Firebase Admin initialized with Application Default Credentials (Production)");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error", error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorageBucket = storageBucket
  ? admin.storage().bucket(storageBucket)
  : admin.storage().bucket();
