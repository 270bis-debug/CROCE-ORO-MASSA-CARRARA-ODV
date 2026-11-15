import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

export const BOOTSTRAPPED_ADMIN_EMAIL = '270bis@live.it';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory connection check on initial boot per Firebase integration spec
export async function testFirestoreConnection(): Promise<{ reachable: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { reachable: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client offline).');
      return { reachable: false, error: 'client_offline' };
    }
    // Permission-denied still indicates Firestore server responded cleanly
    return { reachable: true };
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}

export type FirebaseAuthAccessStatus =
  | 'signed_out'
  | 'unverified'
  | 'pending_approval'
  | 'authorized';

export interface FirebaseSessionState {
  ready: boolean;
  user: User | null;
  email: string | null;
  uid: string | null;
  displayName: string | null;
  isAdmin: boolean;
  isAuthorized: boolean;
  status: FirebaseAuthAccessStatus;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
}

export interface OperatorRequestRecord {
  uid: string;
  email: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  updatedAt?: any;
}

export interface ApprovedOperatorRecord {
  uid: string;
  email: string;
  displayName: string;
  active: boolean;
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export function sanitizeForFirestore<T>(input: T): T {
  if (input === undefined) return null as any;
  if (input === null) return input;
  if (typeof input === 'number') {
    return (Number.isFinite(input) ? input : 0) as any;
  }
  if (typeof input !== 'object') return input;
  if (input instanceof Date) return input.toISOString() as any;
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(input as Record<string, any>)) {
    if (val === undefined) continue;
    if (typeof val === 'function' || typeof val === 'symbol') continue;
    result[key] = sanitizeForFirestore(val);
  }
  return result as T;
}

let lastFirebaseAuthError: string | null = null;

export function getLastFirebaseAuthError(): string | null {
  return lastFirebaseAuthError;
}

export function formatFirebaseAuthError(error: unknown): string {
  const code = (error as any)?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    return `Dominio "${host}" non ancora autorizzato in Firebase Auth. Aggiungi "${host}" su Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Finestra di accesso Google chiusa prima del completamento.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup bloccato dal browser: riprova o usa il reindirizzamento Google.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Errore di rete durante la verifica con Google. Controlla la connessione Internet.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Richiesta di accesso già in corso, completa la finestra aperta.';
  }
  return msg || 'Errore autenticazione Google';
}

export async function signInWithGoogleCloudSync(): Promise<User | null> {
  lastFirebaseAuthError = null;
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (err: any) {
    const code = err?.code || '';
    const isStandalonePwa =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator as any)?.standalone === true);

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      (isStandalonePwa && code !== 'auth/popup-closed-by-user' && code !== 'auth/unauthorized-domain')
    ) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirErr: any) {
        const formatted = formatFirebaseAuthError(redirErr);
        lastFirebaseAuthError = formatted;
        throw new Error(formatted);
      }
    }

    const formatted = formatFirebaseAuthError(err);
    lastFirebaseAuthError = formatted;
    throw new Error(formatted);
  }
}

export async function signOutCloudSync(): Promise<void> {
  lastFirebaseAuthError = null;
  await signOut(auth);
}

export async function resolveUserAuthorization(user: User | null): Promise<FirebaseSessionState> {
  if (!user) {
    return {
      ready: true,
      user: null,
      email: null,
      uid: null,
      displayName: null,
      isAdmin: false,
      isAuthorized: false,
      status: 'signed_out',
      requestStatus: null,
    };
  }

  if (!user.emailVerified) {
    return {
      ready: true,
      user,
      email: user.email,
      uid: user.uid,
      displayName: user.displayName,
      isAdmin: false,
      isAuthorized: false,
      status: 'unverified',
      requestStatus: null,
    };
  }

  const emailLower = (user.email || '').trim().toLowerCase();
  let isAdmin = emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  if (!isAdmin) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (adminSnap.exists()) {
        isAdmin = true;
      }
    } catch {
      // Non-admin user receives permission-denied on missing doc or non-owner lookup
    }
  }

  if (isAdmin) {
    return {
      ready: true,
      user,
      email: user.email,
      uid: user.uid,
      displayName: user.displayName || user.email,
      isAdmin: true,
      isAuthorized: true,
      status: 'authorized',
      requestStatus: 'approved',
    };
  }

  try {
    const opSnap = await getDoc(doc(db, 'operators', user.uid));
    if (opSnap.exists() && opSnap.data()?.active === true) {
      return {
        ready: true,
        user,
        email: user.email,
        uid: user.uid,
        displayName: user.displayName || user.email,
        isAdmin: false,
        isAuthorized: true,
        status: 'authorized',
        requestStatus: 'approved',
      };
    }
  } catch {
    // Expected if not yet approved
  }

  let reqStatus: 'pending' | 'approved' | 'rejected' | null = null;
  try {
    const reqSnap = await getDoc(doc(db, 'operator_requests', user.uid));
    if (reqSnap.exists()) {
      const st = reqSnap.data()?.status;
      if (st === 'pending' || st === 'approved' || st === 'rejected') {
        reqStatus = st;
      }
    }
  } catch {
    // Ignore
  }

  return {
    ready: true,
    user,
    email: user.email,
    uid: user.uid,
    displayName: user.displayName || user.email,
    isAdmin: false,
    isAuthorized: false,
    status: 'pending_approval',
    requestStatus: reqStatus,
  };
}

export async function richiediAbilitazioneOperatore(): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('Autenticazione Google verificata richiesta prima di inviare la richiesta.');
  }
  const path = `operator_requests/${user.uid}`;
  const docRef = doc(db, 'operator_requests', user.uid);
  try {
    const existing = await getDoc(docRef);
    const displayName = (user.displayName || user.email || 'Operatore').slice(0, 120);
    const email = (user.email || 'operatore@croceoro.org').slice(0, 200);
    if (!existing.exists()) {
      await setDoc(docRef, {
        uid: user.uid,
        email,
        displayName,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchOperatorRequestsForAdmin(): Promise<OperatorRequestRecord[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = 'operator_requests';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as OperatorRequestRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchApprovedOperatorsForAdmin(): Promise<ApprovedOperatorRecord[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = 'operators';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as ApprovedOperatorRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function approvaOperatoreCloud(
  targetUid: string,
  email: string,
  displayName: string
): Promise<void> {
  const adminUser = auth.currentUser;
  if (!adminUser) throw new Error('Devi accedere come Amministratore Cloud.');

  const safeEmail = (email || 'operatore@croceoro.org').slice(0, 200);
  const safeName = (displayName || safeEmail).slice(0, 120);
  const opRef = doc(db, 'operators', targetUid);

  try {
    const opSnap = await getDoc(opRef);
    if (!opSnap.exists()) {
      await setDoc(opRef, {
        uid: targetUid,
        email: safeEmail,
        displayName: safeName,
        active: true,
        updatedByUid: adminUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(opRef, {
        email: safeEmail,
        displayName: safeName,
        active: true,
        updatedByUid: adminUser.uid,
        updatedAt: serverTimestamp(),
      });
    }

    const reqRef = doc(db, 'operator_requests', targetUid);
    const reqSnap = await getDoc(reqRef);
    if (reqSnap.exists()) {
      await updateDoc(reqRef, {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `operators/${targetUid}`);
  }
}

export async function revocaOperatoreCloud(targetUid: string): Promise<void> {
  const adminUser = auth.currentUser;
  if (!adminUser) throw new Error('Devi accedere come Amministratore Cloud.');
  try {
    await deleteDoc(doc(db, 'operators', targetUid));
    const reqRef = doc(db, 'operator_requests', targetUid);
    const reqSnap = await getDoc(reqRef);
    if (reqSnap.exists()) {
      await updateDoc(reqRef, {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `operators/${targetUid}`);
  }
}

export function subscribeToFirebaseAuth(callback: (state: FirebaseSessionState) => void): () => void {
  if (typeof window !== 'undefined') {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          lastFirebaseAuthError = null;
        }
      })
      .catch((err) => {
        lastFirebaseAuthError = formatFirebaseAuthError(err);
        console.warn('[Firebase] Errore completamento redirect auth:', lastFirebaseAuthError);
      });
  }

  return onAuthStateChanged(auth, async (user) => {
    const resolved = await resolveUserAuthorization(user);
    callback(resolved);
  });
}

export function listenShardDoc(
  shardId: string,
  onData: (exists: boolean, data: any, fromLocalPendingWrite: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `sync_shards/${shardId}`;
  return onSnapshot(
    doc(db, 'sync_shards', shardId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(false, null, snapshot.metadata.hasPendingWrites);
      } else {
        onData(true, snapshot.data(), snapshot.metadata.hasPendingWrites);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped: any) {
        onError?.(wrapped);
      }
    }
  );
}

export async function readShardDocFromServer(shardId: string): Promise<{ exists: boolean; data: any }> {
  const path = `sync_shards/${shardId}`;
  try {
    const snap = await getDocFromServer(doc(db, 'sync_shards', shardId));
    return {
      exists: snap.exists(),
      data: snap.exists() ? snap.data() : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

// Protezione limite 1 MiB di Firestore: se uno shard supera ~850KB (es. tante firme/foto storiche in archivio),
// alleggerisce gli allegati base64 più vecchi mantenendo intatti i più recenti e i dati strutturali.
function fitPayloadWithinFirestoreLimit(shardId: string, payload: Record<string, any>): Record<string, any> {
  const MAX_BYTES = 850000;
  try {
    if (JSON.stringify(payload).length <= MAX_BYTES) return payload;
  } catch {
    return payload;
  }

  const copy: Record<string, any> = { ...payload };
  if (shardId === 'servizi' && Array.isArray(copy.serviziArchivio)) {
    const list = copy.serviziArchivio.map((item: any, idx: number) => {
      if (!item || typeof item !== 'object' || idx < 5) return item;
      const lean = { ...item };
      if (typeof lean.firmaOperatoreCentrale === 'string' && lean.firmaOperatoreCentrale.length > 4000) {
        lean.firmaOperatoreCentrale = undefined;
      }
      if (lean.fotoDocumento) lean.fotoDocumento = undefined;
      if (lean.datiDestinazione?.firme) {
        lean.datiDestinazione = { ...lean.datiDestinazione, firme: undefined };
      }
      if (lean.datiProprietarioCentrale?.fotoDocumento) {
        lean.datiProprietarioCentrale = { ...lean.datiProprietarioCentrale, fotoDocumento: undefined };
      }
      return sanitizeForFirestore(lean);
    });
    copy.serviziArchivio = list;
  } else if (shardId === 'checklists' && Array.isArray(copy.checklistsCompilate)) {
    copy.checklistsCompilate = copy.checklistsCompilate.slice(0, 60);
  }
  return copy;
}

export async function writeShardDoc(
  shardId: string,
  payload: Record<string, any>,
  knownCurrentVersion: number,
  alreadyExists: boolean
): Promise<number> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('Utente non autenticato su Firebase Auth');
  }
  const path = `sync_shards/${shardId}`;
  const docRef = doc(db, 'sync_shards', shardId);
  const sanitizedPayload = fitPayloadWithinFirestoreLimit(shardId, sanitizeForFirestore(payload));
  const email = (user.email || 'operatore@croceoro.org').slice(0, 200);
  const nextVersion = Math.max(1, knownCurrentVersion + 1);

  try {
    if (!alreadyExists) {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
          shardId,
          version: nextVersion,
          payload: sanitizedPayload,
          updatedByUid: user.uid,
          updatedByEmail: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return nextVersion;
      } else {
        const existingVer = typeof snap.data()?.version === 'number' ? snap.data()!.version : 1;
        const bumpedVer = Math.max(nextVersion, existingVer + 1);
        await updateDoc(docRef, {
          payload: sanitizedPayload,
          version: bumpedVer,
          updatedByUid: user.uid,
          updatedByEmail: email,
          updatedAt: serverTimestamp(),
        });
        return bumpedVer;
      }
    }

    try {
      await updateDoc(docRef, {
        payload: sanitizedPayload,
        version: nextVersion,
        updatedByUid: user.uid,
        updatedByEmail: email,
        updatedAt: serverTimestamp(),
      });
      return nextVersion;
    } catch (firstErr: any) {
      // Retry una volta rileggendo versione/esistenza reale dal server in caso di conflitto multi-dispositivo
      const msg = firstErr?.message || '';
      const code = firstErr?.code || '';
      if (
        code === 'not-found' ||
        code === 'permission-denied' ||
        msg.includes('No document to update') ||
        msg.includes('Missing or insufficient permissions')
      ) {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            shardId,
            version: nextVersion,
            payload: sanitizedPayload,
            updatedByUid: user.uid,
            updatedByEmail: email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return nextVersion;
        } else {
          const existingVer = typeof snap.data()?.version === 'number' ? snap.data()!.version : 1;
          const bumpedVer = Math.max(nextVersion + 1, existingVer + 1);
          await updateDoc(docRef, {
            payload: sanitizedPayload,
            version: bumpedVer,
            updatedByUid: user.uid,
            updatedByEmail: email,
            updatedAt: serverTimestamp(),
          });
          return bumpedVer;
        }
      }
      throw firstErr;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
