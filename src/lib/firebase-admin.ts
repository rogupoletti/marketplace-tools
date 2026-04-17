import * as admin from 'firebase-admin';

const firebaseAdminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Precisamos tratar as quebras de linha que às vezes se perdem em env vars
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Local development with service account key
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Replace escaped newlines occasionally lost in env vars
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
      console.log("Firebase Admin initialized with service account certificate (Local/Env)");
    } else {
      // Production on Google Cloud/Firebase: use Application Default Credentials (ADC)
      admin.initializeApp();
      console.log("Firebase Admin initialized with Application Default Credentials (Production)");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error", error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
