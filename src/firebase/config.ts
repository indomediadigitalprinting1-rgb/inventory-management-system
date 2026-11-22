import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export function getFirebaseConsoleUrls(
  projectId = FIREBASE_PROJECT_ID,
  databaseId = FIREBASE_DATABASE_ID
): { usageUrl: string; upgradeUrl: string } {
  const safeProject = encodeURIComponent(projectId);
  const safeDb = encodeURIComponent(databaseId || '(default)');
  return {
    usageUrl: `https://console.firebase.google.com/project/${safeProject}/firestore/databases/${safeDb}/usage`,
    upgradeUrl: `https://console.firebase.google.com/project/${safeProject}/firestore/databases/${safeDb}/data?openUpgradeDialog=true`,
  };
}

export function isFirestoreQuotaError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    msg.includes('quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('free daily read units') ||
    msg.includes('resource_exhausted')
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  quotaExceeded?: boolean;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const quotaExceeded = isFirestoreQuotaError(error);
  const rawMessage = error instanceof Error ? error.message : String(error);
  const friendlyMessage = quotaExceeded
    ? 'Kuota harian Firebase Firestore telah tercapai. Kuota akan di-reset otomatis keesokan harinya, atau tingkatkan paket melalui Firebase Console.'
    : rawMessage;
  const errInfo: FirestoreErrorInfo = {
    error: friendlyMessage,
    ...(quotaExceeded ? { quotaExceeded: true } : {}),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
      return false;
    }
    return true;
  }
}
