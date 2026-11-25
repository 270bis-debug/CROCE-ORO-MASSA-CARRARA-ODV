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
  initializeFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { buildEmailResetHash, buildPinResetHash } from '../utils/hashReset';

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
let firestoreDbInstance: ReturnType<typeof getFirestore>;
try {
  // Su iPhone iOS Safari / PWA / Private Relay il trasporto WebChannel può bloccarsi silenziosamente:
  // experimentalAutoDetectLongPolling attiva automaticamente il fallback HTTP Long Polling quando necessario.
  firestoreDbInstance = initializeFirestore(
    app,
    { experimentalAutoDetectLongPolling: true },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreDbInstance;
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

export interface PinResetTicketRecord {
  tokenId: string;
  volunteerId: string;
  displayName: string;
  qualifica: string;
  pinProvvisorio: string;
  pinProvvisorioVerifica: string;
  status: 'pending' | 'completed' | 'applied';
  nuovoPin: string;
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
}

export interface PinResetProfileRecord {
  volunteerId: string;
  emailHash: string;
  pinHash: string;
  tokenId: string;
  status: 'ready' | 'pending' | 'completed' | 'applied';
  verifyingProofHash: string;
  nuovoPin: string;
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
}

export interface ShiftSignupRecord {
  signupId: string;
  turnoId: string;
  sedeNome: string;
  turnoData: string;
  turnoOrario: string;
  volontarioId: string;
  volontarioNome: string;
  qualificaVolontario: string;
  ruoloRichiesto:
    | 'autista'
    | 'caposervizio'
    | 'soccorritore2'
    | 'terzoSoccorritore'
    | 'operatoreCentrale'
    | 'centralinista'
    | 'osservatore';
  note: string;
  dataRichiesta: string;
  status: 'pending' | 'applied';
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

function getUtf8JsonByteLength(obj: any): number {
  try {
    const json = JSON.stringify(obj);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length * 2;
  } catch {
    return 0;
  }
}

function stripHeavyMediaRecursive(value: any, maxDataUrlLen: number): any {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') {
    if (value.length > maxDataUrlLen) {
      const trimmed = value.trim();
      const looksLikeDataUri = /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+/i.test(trimmed);
      const looksLikeRawBase64 = trimmed.length > 2048 && !/\s/.test(trimmed) && /^[A-Za-z0-9+/=_-]+$/.test(trimmed.slice(0, 256));
      if (looksLikeDataUri || looksLikeRawBase64) {
        return undefined;
      }
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripHeavyMediaRecursive(item, maxDataUrlLen))
      .filter((item) => item !== undefined);
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const isMediaKey = /(base64|fotofronte|fotoretro|filebase64|firmabase64|allegatobase64|pdffirmato|pdfbase64)/i.test(k);
    if (isMediaKey && typeof v === 'string' && v.length > maxDataUrlLen) {
      continue;
    }
    const cleaned = stripHeavyMediaRecursive(v, maxDataUrlLen);
    if (cleaned !== undefined) {
      out[k] = cleaned;
    }
  }
  return out;
}

// Protezione limite 1 MiB (1.048.576 byte) di Firestore: misura in byte UTF-8 con margine di sicurezza
// per l'overhead dei metadati Firestore e rimuove progressivamente i blob binari base64 più pesanti
// preservando al 100% anagrafiche, PIN, ruoli, permessi, documenti testuali e dati strutturali.
function fitPayloadWithinFirestoreLimit(shardId: string, payload: Record<string, any>): Record<string, any> {
  const MAX_BYTES = 620000;
  if (getUtf8JsonByteLength(payload) <= MAX_BYTES) return payload;

  let copy: Record<string, any> = { ...payload };
  if (shardId === 'volontari' && Array.isArray(copy.volontari)) {
    // 1. Rimuove prima gli allegati PDF/documenti firmati pesanti (>8KB) mantenendo i metadati
    let list = copy.volontari.map((v: any) => {
      if (!v || typeof v !== 'object') return v;
      const lean: any = { ...v };
      if (lean.vestiario?.documentoFirmato?.fileBase64 && String(lean.vestiario.documentoFirmato.fileBase64).length > 8000) {
        lean.vestiario = {
          ...lean.vestiario,
          documentoFirmato: {
            ...lean.vestiario.documentoFirmato,
            fileBase64: undefined,
          },
        };
      }
      if (lean.domandaIscrizioneFirmata?.fileBase64 && String(lean.domandaIscrizioneFirmata.fileBase64).length > 8000) {
        lean.domandaIscrizioneFirmata = {
          ...lean.domandaIscrizioneFirmata,
          fileBase64: undefined,
        };
      }
      return sanitizeForFirestore(lean);
    });
    copy.volontari = list;

    // 2. Se supera ancora il limite, alleggerisce foto documenti fronte/retro (>12KB)
    if (getUtf8JsonByteLength(copy) > MAX_BYTES) {
      list = list.map((v: any) => {
        if (!v || typeof v !== 'object') return v;
        const lean: any = { ...v };
        if (lean.documentoIdentita) {
          lean.documentoIdentita = {
            ...lean.documentoIdentita,
            fotoFronte:
              typeof lean.documentoIdentita.fotoFronte === 'string' && lean.documentoIdentita.fotoFronte.length > 12000
                ? undefined
                : lean.documentoIdentita.fotoFronte,
            fotoRetro:
              typeof lean.documentoIdentita.fotoRetro === 'string' && lean.documentoIdentita.fotoRetro.length > 12000
                ? undefined
                : lean.documentoIdentita.fotoRetro,
          };
        }
        if (lean.patente) {
          lean.patente = {
            ...lean.patente,
            fotoFronte:
              typeof lean.patente.fotoFronte === 'string' && lean.patente.fotoFronte.length > 12000
                ? undefined
                : lean.patente.fotoFronte,
            fotoRetro:
              typeof lean.patente.fotoRetro === 'string' && lean.patente.fotoRetro.length > 12000
                ? undefined
                : lean.patente.fotoRetro,
          };
        }
        return sanitizeForFirestore(lean);
      });
      copy.volontari = list;
    }

    // 3. Alleggerisce foto profilo/firme (>10KB)
    if (getUtf8JsonByteLength(copy) > MAX_BYTES) {
      copy.volontari = list.map((v: any) => {
        if (!v || typeof v !== 'object') return v;
        const lean: any = { ...v };
        if (typeof lean.fotoBase64 === 'string' && lean.fotoBase64.length > 10000) {
          lean.fotoBase64 = undefined;
        }
        if (typeof lean.firmaBase64 === 'string' && lean.firmaBase64.length > 10000) {
          lean.firmaBase64 = undefined;
        }
        return sanitizeForFirestore(lean);
      });
    }
  } else if (shardId === 'servizi' && Array.isArray(copy.serviziArchivio)) {
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

  // 4. Passaggio universale su qualsiasi shard/campo annidato: rimuove eventuali altri allegati base64/dataURL > 4KB
  if (getUtf8JsonByteLength(copy) > MAX_BYTES) {
    copy = sanitizeForFirestore(stripHeavyMediaRecursive(copy, 4000));
  }

  // 5. Salvaguardia estrema: rimuove qualunque base64/dataURL > 512B (anche se sommati tra decine di schede)
  if (getUtf8JsonByteLength(copy) > MAX_BYTES) {
    copy = sanitizeForFirestore(stripHeavyMediaRecursive(copy, 512));
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
  const rawEmail = (user.email || 'operatore@croceoro.org').trim();
  const email = (rawEmail.length >= 3 ? rawEmail : 'operatore@croceoro.org').slice(0, 200);
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
        const snapData = snap.data();
        const existingVer = typeof snapData?.version === 'number' ? snapData.version : 1;
        const bumpedVer = Math.max(nextVersion, existingVer + 1);
        if (!snapData?.createdAt || snapData?.shardId !== shardId) {
          await setDoc(docRef, {
            shardId,
            version: bumpedVer,
            payload: sanitizedPayload,
            updatedByUid: user.uid,
            updatedByEmail: email,
            createdAt: snapData?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(docRef, {
            payload: sanitizedPayload,
            version: bumpedVer,
            updatedByUid: user.uid,
            updatedByEmail: email,
            updatedAt: serverTimestamp(),
          });
        }
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
      // Retry rileggendo versione/esistenza reale dal server in caso di conflitto multi-dispositivo o errore transitorio
      const msg = firstErr?.message || '';
      const code = firstErr?.code || '';
      if (
        code === 'not-found' ||
        code === 'permission-denied' ||
        code === 'aborted' ||
        code === 'unavailable' ||
        code === 'failed-precondition' ||
        code === 'already-exists' ||
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
          const snapData = snap.data();
          const existingVer = typeof snapData?.version === 'number' ? snapData.version : 1;
          const bumpedVer = Math.max(nextVersion + 1, existingVer + 1);
          if (!snapData?.createdAt || snapData?.shardId !== shardId) {
            await setDoc(docRef, {
              shardId,
              version: bumpedVer,
              payload: sanitizedPayload,
              updatedByUid: user.uid,
              updatedByEmail: email,
              createdAt: snapData?.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(docRef, {
              payload: sanitizedPayload,
              version: bumpedVer,
              updatedByUid: user.uid,
              updatedByEmail: email,
              updatedAt: serverTimestamp(),
            });
          }
          return bumpedVer;
        }
      }
      throw firstErr;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

const PIN_RESET_TOKEN_REGEX = /^rst-[a-zA-Z0-9_\-]+$/;

export function isValidPinResetTokenFormat(tokenId: string): boolean {
  const t = (tokenId || '').trim();
  return t.length >= 12 && t.length <= 96 && PIN_RESET_TOKEN_REGEX.test(t);
}

export function generaTokenResetPinSicuro(): string {
  const ts = Date.now().toString(36);
  let rand = '';
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      rand = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
    }
  } catch {
    // fallback below
  }
  if (!rand) {
    rand = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 16);
  }
  return `rst-${ts}-${rand}`.slice(0, 64);
}

export async function creaTicketResetPinFirestore(params: {
  tokenId: string;
  volunteerId: string;
  displayName: string;
  qualifica: string;
  pinProvvisorio: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const tokenId = (params.tokenId || '').trim();
  const volunteerId = (params.volunteerId || '').trim();
  const pinProvv = String(params.pinProvvisorio || '').trim();
  if (!isValidPinResetTokenFormat(tokenId) || !volunteerId || !/^\d{4}$/.test(pinProvv)) {
    return false;
  }

  const displayName = (params.displayName || 'Volontario Croce Oro').trim().slice(0, 120) || 'Volontario Croce Oro';
  const qualifica = (params.qualifica || 'Soccorritore').trim().slice(0, 80) || 'Soccorritore';
  const path = `pin_resets/${tokenId}`;

  try {
    await setDoc(doc(db, 'pin_resets', tokenId), {
      tokenId,
      volunteerId,
      displayName,
      qualifica,
      pinProvvisorio: pinProvv,
      pinProvvisorioVerifica: '----',
      status: 'pending',
      nuovoPin: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function verificaTicketResetPinFirestore(
  tokenId: string
): Promise<{ found: boolean; ticket: PinResetTicketRecord | null }> {
  const tokenPulito = (tokenId || '').trim();
  if (!isValidPinResetTokenFormat(tokenPulito)) {
    return { found: false, ticket: null };
  }
  const path = `pin_resets/${tokenPulito}`;
  try {
    const snap = await getDocFromServer(doc(db, 'pin_resets', tokenPulito));
    if (!snap.exists()) {
      return { found: false, ticket: null };
    }
    return {
      found: true,
      ticket: snap.data() as PinResetTicketRecord,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function completaTicketResetPinFirestore(
  tokenId: string,
  pinProvvisorioVerifica: string,
  nuovoPin: string
): Promise<void> {
  const tokenPulito = (tokenId || '').trim();
  const pinProvv = String(pinProvvisorioVerifica || '').trim();
  const pinNuovo = String(nuovoPin || '').trim();

  if (!isValidPinResetTokenFormat(tokenPulito)) {
    throw new Error('Link di attivazione non valido o incompleto.');
  }
  if (!/^\d{4}$/.test(pinProvv)) {
    throw new Error('Inserisci il PIN provvisorio a 4 cifre ricevuto nella email.');
  }
  if (!/^\d{4}$/.test(pinNuovo) || pinNuovo === '4451') {
    throw new Error('Il nuovo PIN deve essere di 4 cifre numeriche e non riservato.');
  }
  if (pinNuovo === pinProvv) {
    throw new Error('Il nuovo PIN deve essere diverso dal PIN provvisorio assegnato.');
  }

  const path = `pin_resets/${tokenPulito}`;
  try {
    await updateDoc(doc(db, 'pin_resets', tokenPulito), {
      status: 'completed',
      nuovoPin: pinNuovo,
      pinProvvisorioVerifica: pinProvv,
      updatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function segnaTicketResetApplicatoFirestore(tokenId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const tokenPulito = (tokenId || '').trim();
  if (!isValidPinResetTokenFormat(tokenPulito)) return;
  const path = `pin_resets/${tokenPulito}`;
  try {
    await updateDoc(doc(db, 'pin_resets', tokenPulito), {
      status: 'applied',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

const VALID_DOC_ID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const syncedResetProfileSignatures = new Map<string, string>();
let profileSyncChain: Promise<void> = Promise.resolve();

export function resetPinProfileSyncCache(volunteerId?: string): void {
  if (volunteerId) {
    syncedResetProfileSignatures.delete(volunteerId);
  } else {
    syncedResetProfileSignatures.clear();
  }
}

export function syncPinResetProfilesFirestore(
  volontari: Array<{
    id?: string;
    email?: string;
    pin?: string;
    resetToken?: string;
    richiedeResetPassword?: boolean;
  }>,
  skipIds?: Set<string>
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !Array.isArray(volontari)) {
    return Promise.resolve();
  }

  profileSyncChain = profileSyncChain
    .then(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;

      for (const v of volontari) {
        const volId = String(v?.id || '').trim();
        if (!volId || !VALID_DOC_ID_REGEX.test(volId)) continue;
        if (volId === 'vol-admin' || String(v?.pin || '').trim() === '4451') continue;
        if (skipIds?.has(volId)) continue;

        const emailHash = buildEmailResetHash(v?.email);
        const pinHash = buildPinResetHash(volId, v?.pin);
        if (!emailHash && !pinHash) continue;

        const tokenId = v?.resetToken && isValidPinResetTokenFormat(String(v.resetToken))
          ? String(v.resetToken).trim()
          : '';
        const desiredStatus: 'ready' | 'pending' = v?.richiedeResetPassword ? 'pending' : 'ready';
        const sig = `${emailHash}:${pinHash}:${tokenId}:${desiredStatus}`;

        if (syncedResetProfileSignatures.get(volId) === sig) continue;

        const docRef = doc(db, 'pin_reset_profiles', volId);
        try {
          const snap = await getDoc(docRef);
          if (!snap.exists()) {
            await setDoc(docRef, {
              volunteerId: volId,
              emailHash,
              pinHash,
              tokenId,
              status: desiredStatus,
              verifyingProofHash: '----',
              nuovoPin: '',
              updatedByUid: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              completedAt: serverTimestamp(),
            });
            syncedResetProfileSignatures.set(volId, sig);
          } else {
            const existing = snap.data() as PinResetProfileRecord;
            if (existing?.status === 'completed' && /^\d{4}$/.test(String(existing?.nuovoPin || ''))) {
              // Non sovrascrivere un reset appena completato dal volontario prima della riconciliazione
              continue;
            }
            const needsUpdate =
              existing.emailHash !== emailHash ||
              existing.pinHash !== pinHash ||
              (existing.tokenId || '') !== tokenId ||
              (existing.status === 'pending') !== (desiredStatus === 'pending') ||
              existing.verifyingProofHash !== '----' ||
              Boolean(existing.nuovoPin);
            if (needsUpdate) {
              await updateDoc(docRef, {
                emailHash,
                pinHash,
                tokenId,
                status: desiredStatus,
                verifyingProofHash: '----',
                nuovoPin: '',
                updatedByUid: currentUser.uid,
                updatedAt: serverTimestamp(),
              });
            }
            syncedResetProfileSignatures.set(volId, sig);
          }
        } catch {
          // Ignora fallimenti transitori sul singolo profilo (verrà ritentato al prossimo sync)
        }
      }
    })
    .catch(() => {});

  return profileSyncChain;
}

export async function completaResetPinProfiloFirestore(
  volunteerId: string,
  verifyingProofHash: string,
  nuovoPin: string
): Promise<{ ok: boolean; code?: string; message?: string }> {
  const volId = (volunteerId || '').trim();
  const proof = (verifyingProofHash || '').trim().toLowerCase();
  const pinNuovo = String(nuovoPin || '').trim();

  if (!VALID_DOC_ID_REGEX.test(volId) || !SHA256_HEX_REGEX.test(proof)) {
    return { ok: false, code: 'invalid-argument', message: 'Dati di verifica non validi.' };
  }
  if (!/^\d{4}$/.test(pinNuovo) || pinNuovo === '4451') {
    return { ok: false, code: 'invalid-pin', message: 'Il nuovo PIN deve essere di 4 cifre numeriche e non riservato.' };
  }

  try {
    await updateDoc(doc(db, 'pin_reset_profiles', volId), {
      status: 'completed',
      nuovoPin: pinNuovo,
      verifyingProofHash: proof,
      updatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err: any) {
    const code = String(err?.code || '');
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: code || 'unknown', message: msg };
  }
}

export async function fetchCompletedPinResetProfilesFirestore(): Promise<PinResetProfileRecord[]> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return [];
  const path = 'pin_reset_profiles';
  try {
    const q = query(collection(db, path), where('status', '==', 'completed'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PinResetProfileRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export function listenCompletedPinResetProfilesFirestore(
  onCompleted: (profiles: PinResetProfileRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'pin_reset_profiles';
  const q = query(collection(db, path), where('status', '==', 'completed'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as PinResetProfileRecord);
      onCompleted(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped: any) {
        onError?.(wrapped);
      }
    }
  );
}

export async function segnaProfiloResetApplicatoFirestore(
  volunteerId: string,
  newPin: string,
  email?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const volId = (volunteerId || '').trim();
  if (!VALID_DOC_ID_REGEX.test(volId)) return;

  const pinHash = buildPinResetHash(volId, newPin);
  const emailHash = buildEmailResetHash(email);
  const patch: Record<string, any> = {
    status: 'applied',
    pinHash,
    tokenId: '',
    verifyingProofHash: '----',
    nuovoPin: '',
    updatedByUid: user.uid,
    updatedAt: serverTimestamp(),
  };
  if (emailHash) {
    patch.emailHash = emailHash;
  }

  const path = `pin_reset_profiles/${volId}`;
  try {
    await updateDoc(doc(db, 'pin_reset_profiles', volId), patch);
    syncedResetProfileSignatures.set(volId, `${emailHash}:${pinHash}::ready`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

const VALID_SIGNUP_ID_REGEX = /^cand-[a-zA-Z0-9_\-]+$/;
const ALLOWED_RUOLI_TURNO = new Set([
  'autista',
  'caposervizio',
  'soccorritore2',
  'terzoSoccorritore',
  'operatoreCentrale',
  'centralinista',
  'osservatore',
]);

function normalizeFirestoreDocIdToken(raw: string, fallbackPrefix: string): string {
  const clean = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 120);
  return clean || `${fallbackPrefix}-${Date.now()}`;
}

export async function salvaCandidaturaTurnoFirestore(params: {
  signupId: string;
  turnoId: string;
  sedeNome: string;
  turnoData: string;
  turnoOrario: string;
  volontarioId: string;
  volontarioNome: string;
  qualificaVolontario?: string;
  ruoloRichiesto: string;
  note?: string;
  dataRichiesta: string;
}): Promise<{ ok: boolean; error?: string }> {
  const rawId = normalizeFirestoreDocIdToken(params.signupId, 'cand');
  const signupId = VALID_SIGNUP_ID_REGEX.test(rawId)
    ? rawId.slice(0, 96)
    : `cand-${rawId}`.slice(0, 96);
  const turnoId = normalizeFirestoreDocIdToken(params.turnoId, 'turno');
  const volontarioId = normalizeFirestoreDocIdToken(params.volontarioId, 'vol');
  const ruolo = ALLOWED_RUOLI_TURNO.has(params.ruoloRichiesto)
    ? (params.ruoloRichiesto as ShiftSignupRecord['ruoloRichiesto'])
    : 'soccorritore2';
  const turnoData = /^\d{4}-\d{2}-\d{2}$/.test(String(params.turnoData || '').trim())
    ? String(params.turnoData).trim()
    : '2026-01-01';

  const record = {
    signupId,
    turnoId,
    sedeNome: (String(params.sedeNome || 'Sede Operativa').trim() || 'Sede Operativa').slice(0, 120),
    turnoData,
    turnoOrario: (String(params.turnoOrario || '08:00-14:00').trim() || '08:00-14:00').slice(0, 32),
    volontarioId,
    volontarioNome: (String(params.volontarioNome || 'Volontario').trim() || 'Volontario').slice(0, 120),
    qualificaVolontario: (String(params.qualificaVolontario || 'Volontario').trim() || 'Volontario').slice(0, 80),
    ruoloRichiesto: ruolo,
    note: String(params.note || '').trim().slice(0, 300),
    dataRichiesta: (String(params.dataRichiesta || 'Oggi').trim() || 'Oggi').slice(0, 40),
    status: 'pending' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'shift_signups', signupId), record);
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function listenPendingShiftSignupsFirestore(
  onPending: (signups: ShiftSignupRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'shift_signups';
  const q = query(collection(db, path), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as ShiftSignupRecord);
      onPending(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped: any) {
        onError?.(wrapped);
      }
    }
  );
}

export async function segnaCandidaturaTurnoApplicataFirestore(signupId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const cleanId = (signupId || '').trim();
  if (!VALID_SIGNUP_ID_REGEX.test(cleanId)) return;
  const path = `shift_signups/${cleanId}`;
  try {
    await updateDoc(doc(db, 'shift_signups', cleanId), {
      status: 'applied',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ============================================================================
// RADIO WALKIE-TALKIE RING BUFFER (radio_slots) & PUSH SUBSCRIPTIONS (Firestore)
// ============================================================================

export const RADIO_RING_SLOT_IDS = [
  'slot_0',
  'slot_1',
  'slot_2',
  'slot_3',
  'slot_4',
  'slot_5',
  'slot_6',
  'slot_7',
  'slot_8',
  'slot_9',
  'slot_10',
  'slot_11',
] as const;

export type RadioSlotId = 'live_state' | 'last_tx' | (typeof RADIO_RING_SLOT_IDS)[number];

export interface FirestorePushSubRecord {
  subId: string;
  scope: 'croce_oro_push';
  role: 'admin' | 'centrale' | 'volontario' | 'all';
  volontarioId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  ownerUid: string;
}

export function listenRadioSlotDoc(
  slotId: RadioSlotId,
  onData: (exists: boolean, data: any, fromLocalPendingWrite: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `radio_slots/${slotId}`;
  return onSnapshot(
    doc(db, 'radio_slots', slotId),
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

export async function readRadioSlotDoc(slotId: RadioSlotId): Promise<{ exists: boolean; data: any }> {
  const path = `radio_slots/${slotId}`;
  try {
    const snap = await getDocFromServer(doc(db, 'radio_slots', slotId));
    return {
      exists: snap.exists(),
      data: snap.exists() ? snap.data() : null,
    };
  } catch (err) {
    try {
      const snap = await getDoc(doc(db, 'radio_slots', slotId));
      return {
        exists: snap.exists(),
        data: snap.exists() ? snap.data() : null,
      };
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.GET, path);
    }
  }
}

export async function writeRadioSlotDoc(params: {
  slotId: RadioSlotId;
  txId: string;
  channelId: string;
  payload: Record<string, any>;
  sentAtMs?: number;
  knownExists?: boolean;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return false;
  const cleanPayload = sanitizeForFirestore(params.payload || {});
  const ref = doc(db, 'radio_slots', params.slotId);
  const safeTxId = String(params.txId || '').slice(0, 96);
  const safeChannelId = (String(params.channelId || 'general').trim() || 'general').slice(0, 96);
  const safeSentAtMs = typeof params.sentAtMs === 'number' && Number.isFinite(params.sentAtMs) && params.sentAtMs >= 0
    ? Math.floor(params.sentAtMs)
    : Date.now();

  if (params.knownExists) {
    try {
      await updateDoc(ref, {
        txId: safeTxId,
        channelId: safeChannelId,
        payload: cleanPayload,
        sentAtMs: safeSentAtMs,
        updatedByUid: user.uid,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code !== 'not-found' && !String(err?.message || '').includes('No document to update')) {
        return false;
      }
    }
  }

  try {
    await setDoc(ref, {
      slotId: params.slotId,
      scope: 'croce_oro_radio',
      txId: safeTxId,
      channelId: safeChannelId,
      payload: cleanPayload,
      sentAtMs: safeSentAtMs,
      updatedByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err: any) {
    // Se il documento esisteva già (race tra due trasmettitori), ritenta con updateDoc
    try {
      await updateDoc(ref, {
        txId: safeTxId,
        channelId: safeChannelId,
        payload: cleanPayload,
        sentAtMs: safeSentAtMs,
        updatedByUid: user.uid,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch {
      return false;
    }
  }
}

function hashStringSimpleHex(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).slice(0, 16);
}

export async function savePushSubscriptionFirestore(params: {
  role: 'admin' | 'centrale' | 'volontario' | 'all';
  volontarioId?: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return false;
  const endpoint = String(params.endpoint || '').trim();
  const p256dh = String(params.p256dh || '').trim();
  const authKey = String(params.authKey || '').trim();
  if (!endpoint.startsWith('https://') || p256dh.length < 16 || authKey.length < 8) return false;

  const safeRole: 'admin' | 'centrale' | 'volontario' | 'all' =
    params.role === 'admin' || params.role === 'centrale' || params.role === 'volontario' ? params.role : 'all';
  const safeVolId = String(params.volontarioId || '').trim().slice(0, 128);
  const cleanUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  const subId = `sub_${cleanUid}_${hashStringSimpleHex(endpoint)}`;
  const ref = doc(db, 'push_subscriptions', subId);

  try {
    await updateDoc(ref, {
      role: safeRole,
      volontarioId: safeVolId,
      endpoint: endpoint.slice(0, 1024),
      p256dh: p256dh.slice(0, 256),
      auth: authKey.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch {
    try {
      await setDoc(ref, {
        subId,
        scope: 'croce_oro_push',
        role: safeRole,
        volontarioId: safeVolId,
        endpoint: endpoint.slice(0, 1024),
        p256dh: p256dh.slice(0, 256),
        auth: authKey.slice(0, 128),
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function fetchPushSubscriptionsFirestore(): Promise<FirestorePushSubRecord[]> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return [];
  try {
    const q = query(collection(db, 'push_subscriptions'), where('scope', '==', 'croce_oro_push'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as FirestorePushSubRecord)
      .filter((r) => r && typeof r.endpoint === 'string' && r.endpoint.startsWith('https://'));
  } catch {
    return [];
  }
}

// ============================================================================
// ZERO-PII PUBLIC VOLUNTEER LOGIN ROSTER (public_roster/volunteers_v1)
// Consente ai nuovi smartphone/iPhone (non ancora loggati su Google Cloud Sync)
// di caricare in tempo reale tutti i nominativi reali dei volontari e verificare
// il PIN tramite digest SHA-256, senza esporre alcun dato personale (PII).
// ============================================================================

export const PUBLIC_VOLUNTEER_ROSTER_DOC_ID = 'volunteers_v1';

export interface PublicVolunteerRosterEntry {
  id: string;
  nome: string;
  cognome: string;
  qualifica: string;
  mansione?: string;
  mansioni?: string[];
  matricola?: string;
  pinHash: string;
  pinIsEmergency: boolean;
  hasFirma: boolean;
  approvato: boolean;
  profiloCentrale: boolean;
  caricaConsiglioDirettivo?: string;
  macroCategorieAbilitate?: string[];
  sottosezioniAbilitate?: Record<string, string[]>;
  pulsantiStrumentiAbilitati?: string[];
  sediTurniAbilitate?: string[];
  bloccatoPerTentativi?: boolean;
  tentativiErrati?: number;
  richiedeResetPassword?: boolean;
}

export interface PublicVolunteerRosterDoc {
  rosterId: 'volunteers_v1';
  version: number;
  entries: PublicVolunteerRosterEntry[];
  deletedIds: string[];
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export function buildPublicVolunteerRosterEntries(volontari: any[]): PublicVolunteerRosterEntry[] {
  if (!Array.isArray(volontari)) return [];
  const seen = new Set<string>();
  const entries: PublicVolunteerRosterEntry[] = [];

  for (const v of volontari) {
    if (!v || typeof v !== 'object') continue;
    const id = String(v.id || '').trim();
    if (!id || id.length > 128 || seen.has(id)) continue;

    const nome = String(v.nome || '').trim().slice(0, 80);
    const cognome = String(v.cognome || '').trim().slice(0, 80);
    const cleanPin = String(v.pin || '').trim();
    if (
      id === 'vol-admin' ||
      id === 'admin-centrale-root' ||
      cleanPin === '4451' ||
      nome.toLowerCase().includes('amministratore') ||
      cognome.toLowerCase().includes('amministratore')
    ) {
      continue;
    }
    if (!nome && !cognome) continue;

    seen.add(id);

    const computedHash = /^\d{4}$/.test(cleanPin)
      ? buildPinResetHash(id, cleanPin)
      : (typeof v.pinHash === 'string' && SHA256_HEX_REGEX.test(v.pinHash) ? v.pinHash : '');

    const pinIsEmergency = cleanPin
      ? cleanPin === '0000'
      : Boolean(v.pinIsEmergency);

    const hasFirma =
      (typeof v.firmaBase64 === 'string' && v.firmaBase64.trim().length >= 20) ||
      Boolean(v.hasFirma);

    const entry: PublicVolunteerRosterEntry = {
      id,
      nome: nome || 'Volontario',
      cognome,
      qualifica: String(v.qualifica || 'Soccorritore').trim().slice(0, 80) || 'Soccorritore',
      pinHash: computedHash,
      pinIsEmergency,
      hasFirma,
      approvato: Boolean(v.approvato),
      profiloCentrale: Boolean(v.profiloCentrale),
    };

    if (typeof v.mansione === 'string' && v.mansione.trim()) {
      entry.mansione = v.mansione.trim().slice(0, 80);
    }
    if (Array.isArray(v.mansioni) && v.mansioni.length > 0) {
      entry.mansioni = v.mansioni
        .filter((m: any) => typeof m === 'string' && m.trim())
        .map((m: string) => m.trim().slice(0, 80))
        .slice(0, 12);
    }
    if (typeof v.matricola === 'string' && v.matricola.trim()) {
      entry.matricola = v.matricola.trim().slice(0, 40);
    }
    if (typeof v.caricaConsiglioDirettivo === 'string' && v.caricaConsiglioDirettivo.trim()) {
      entry.caricaConsiglioDirettivo = v.caricaConsiglioDirettivo.trim().slice(0, 80);
    }
    if (Array.isArray(v.macroCategorieAbilitate) && v.macroCategorieAbilitate.length > 0) {
      entry.macroCategorieAbilitate = v.macroCategorieAbilitate
        .filter((c: any) => typeof c === 'string' && c.trim())
        .map((c: string) => c.trim().slice(0, 40))
        .slice(0, 20);
    }
    if (v.sottosezioniAbilitate && typeof v.sottosezioniAbilitate === 'object' && !Array.isArray(v.sottosezioniAbilitate)) {
      const cleanSubs: Record<string, string[]> = {};
      for (const [k, arr] of Object.entries(v.sottosezioniAbilitate as Record<string, any>)) {
        if (!k || !Array.isArray(arr)) continue;
        cleanSubs[String(k).slice(0, 40)] = arr
          .filter((x: any) => typeof x === 'string' && x.trim())
          .map((x: string) => x.trim().slice(0, 40))
          .slice(0, 25);
      }
      if (Object.keys(cleanSubs).length > 0) {
        entry.sottosezioniAbilitate = cleanSubs;
      }
    }
    if (Array.isArray(v.pulsantiStrumentiAbilitati) && v.pulsantiStrumentiAbilitati.length > 0) {
      entry.pulsantiStrumentiAbilitati = v.pulsantiStrumentiAbilitati
        .filter((b: any) => typeof b === 'string' && b.trim())
        .map((b: string) => b.trim().slice(0, 32))
        .slice(0, 10);
    }
    if (Array.isArray(v.sediTurniAbilitate) && v.sediTurniAbilitate.length > 0) {
      entry.sediTurniAbilitate = v.sediTurniAbilitate
        .filter((s: any) => typeof s === 'string' && s.trim())
        .map((s: string) => s.trim().slice(0, 64))
        .slice(0, 20);
    }
    if (v.bloccatoPerTentativi) {
      entry.bloccatoPerTentativi = true;
    }
    if (typeof v.tentativiErrati === 'number' && v.tentativiErrati > 0) {
      entry.tentativiErrati = Math.min(3, Math.floor(v.tentativiErrati));
    }
    if (v.richiedeResetPassword) {
      entry.richiedeResetPassword = true;
    }

    entries.push(entry);
    if (entries.length >= 400) break;
  }

  return entries;
}

export function convertPublicRosterEntriesToVolontari(entries: PublicVolunteerRosterEntry[]): any[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && e.id.trim().length > 0)
    .map((e) => ({
      id: String(e.id).trim(),
      nome: String(e.nome || '').trim() || 'Volontario',
      cognome: String(e.cognome || '').trim(),
      qualifica: String(e.qualifica || 'Soccorritore').trim() || 'Soccorritore',
      ...(e.mansione ? { mansione: e.mansione } : {}),
      ...(Array.isArray(e.mansioni) ? { mansioni: e.mansioni } : {}),
      ...(e.matricola ? { matricola: e.matricola } : {}),
      telefono: '',
      email: '',
      pin: '',
      pinHash: typeof e.pinHash === 'string' ? e.pinHash : '',
      pinIsEmergency: Boolean(e.pinIsEmergency),
      hasFirma: Boolean(e.hasFirma),
      isPublicRosterOnly: true,
      dataRegistrazione: '',
      inTurno: false,
      approvato: Boolean(e.approvato),
      profiloCentrale: Boolean(e.profiloCentrale),
      ...(e.caricaConsiglioDirettivo ? { caricaConsiglioDirettivo: e.caricaConsiglioDirettivo } : {}),
      ...(Array.isArray(e.macroCategorieAbilitate) ? { macroCategorieAbilitate: e.macroCategorieAbilitate } : {}),
      ...(e.sottosezioniAbilitate && typeof e.sottosezioniAbilitate === 'object'
        ? { sottosezioniAbilitate: e.sottosezioniAbilitate }
        : {}),
      ...(Array.isArray(e.pulsantiStrumentiAbilitati)
        ? { pulsantiStrumentiAbilitati: e.pulsantiStrumentiAbilitati }
        : {}),
      ...(Array.isArray(e.sediTurniAbilitate) ? { sediTurniAbilitate: e.sediTurniAbilitate } : {}),
      ...(e.bloccatoPerTentativi ? { bloccatoPerTentativi: true } : {}),
      ...(typeof e.tentativiErrati === 'number' ? { tentativiErrati: e.tentativiErrati } : {}),
      ...(e.richiedeResetPassword ? { richiedeResetPassword: true } : {}),
    }));
}

let lastPublishedPublicRosterSig = '';
let publicRosterSyncChain: Promise<void> = Promise.resolve();

export function resetPublicRosterSyncCache(): void {
  lastPublishedPublicRosterSig = '';
}

export function syncPublicVolunteerRosterFirestore(
  volontari: any[],
  deletedIds?: string[]
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !Array.isArray(volontari)) {
    return Promise.resolve();
  }

  const entries = buildPublicVolunteerRosterEntries(volontari);
  if (entries.length === 0) return Promise.resolve();

  const cleanDeleted = Array.isArray(deletedIds)
    ? Array.from(
        new Set(
          deletedIds
            .filter((id) => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.trim().slice(0, 128))
        )
      ).slice(-300)
    : [];

  const sig = JSON.stringify({ entries, cleanDeleted });
  if (sig === lastPublishedPublicRosterSig) {
    return Promise.resolve();
  }

  publicRosterSyncChain = publicRosterSyncChain
    .then(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;
      if (sig === lastPublishedPublicRosterSig) return;

      const docRef = doc(db, 'public_roster', PUBLIC_VOLUNTEER_ROSTER_DOC_ID);
      const sanitizedEntries = sanitizeForFirestore(entries);
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            rosterId: PUBLIC_VOLUNTEER_ROSTER_DOC_ID,
            version: 1,
            entries: sanitizedEntries,
            deletedIds: cleanDeleted,
            updatedByUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const snapData = snap.data() as Partial<PublicVolunteerRosterDoc> | undefined;
          const prevVer = typeof snapData?.version === 'number' && snapData.version >= 1 ? snapData.version : 1;
          await updateDoc(docRef, {
            version: prevVer + 1,
            entries: sanitizedEntries,
            deletedIds: cleanDeleted,
            updatedByUid: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
        lastPublishedPublicRosterSig = sig;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `public_roster/${PUBLIC_VOLUNTEER_ROSTER_DOC_ID}`);
        } catch {
          // Non bloccare il sync principale se la pubblicazione del roster pubblico fallisce temporaneamente
        }
      }
    })
    .catch(() => {});

  return publicRosterSyncChain;
}

export async function publishPublicVolunteerRosterNow(
  volontari: any[],
  deletedIds?: string[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return {
      ok: false,
      count: 0,
      error: 'Devi essere connesso con Google Cloud Sync come Amministratore/Operatore.',
    };
  }

  const entries = buildPublicVolunteerRosterEntries(volontari);
  if (entries.length === 0) {
    return { ok: false, count: 0, error: 'Nessun volontario valido presente da pubblicare.' };
  }

  const cleanDeleted = Array.isArray(deletedIds)
    ? Array.from(
        new Set(
          deletedIds
            .filter((id) => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.trim().slice(0, 128))
        )
      ).slice(-300)
    : [];

  const docRef = doc(db, 'public_roster', PUBLIC_VOLUNTEER_ROSTER_DOC_ID);
  const sanitizedEntries = sanitizeForFirestore(entries);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        rosterId: PUBLIC_VOLUNTEER_ROSTER_DOC_ID,
        version: 1,
        entries: sanitizedEntries,
        deletedIds: cleanDeleted,
        updatedByUid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const snapData = snap.data() as Partial<PublicVolunteerRosterDoc> | undefined;
      const prevVer = typeof snapData?.version === 'number' && snapData.version >= 1 ? snapData.version : 1;
      await updateDoc(docRef, {
        version: prevVer + 1,
        entries: sanitizedEntries,
        deletedIds: cleanDeleted,
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
    }
    lastPublishedPublicRosterSig = JSON.stringify({ entries, cleanDeleted });
    return { ok: true, count: entries.length };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      handleFirestoreError(err, OperationType.WRITE, `public_roster/${PUBLIC_VOLUNTEER_ROSTER_DOC_ID}`);
    } catch {}
    return { ok: false, count: 0, error: msg };
  }
}

function decodeFirestoreRestValue(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return String(val.stringValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    const arr = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return arr.map((item: any) => decodeFirestoreRestValue(item));
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields && typeof val.mapValue.fields === 'object' ? val.mapValue.fields : {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreRestValue(v);
    }
    return out;
  }
  return undefined;
}

/**
 * Lettura diretta HTTPS REST API del documento pubblico zero-PII `public_roster/volunteers_v1`.
 * Completa in ~150ms su tutti gli iPhone (iOS Safari / PWA / iCloud Private Relay)
 * evitando qualsiasi blocco o ritardo del canale WebChannel dell'SDK Firestore.
 */
async function readPublicVolunteerRosterViaRest(): Promise<{
  exists: boolean;
  data: PublicVolunteerRosterDoc | null;
  status: 'ok' | 'not_found' | 'error';
}> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/public_roster/${PUBLIC_VOLUNTEER_ROSTER_DOC_ID}?key=${encodeURIComponent(
    firebaseConfig.apiKey
  )}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.status === 404) {
      return { exists: false, data: null, status: 'not_found' };
    }
    if (!res.ok) {
      return { exists: false, data: null, status: 'error' };
    }
    const json = await res.json();
    const decoded = decodeFirestoreRestValue({ mapValue: { fields: json?.fields || {} } });
    if (!decoded || !Array.isArray(decoded.entries)) {
      return { exists: false, data: null, status: 'not_found' };
    }
    return {
      exists: true,
      data: {
        rosterId: 'volunteers_v1',
        version: typeof decoded.version === 'number' ? decoded.version : 1,
        entries: decoded.entries as PublicVolunteerRosterEntry[],
        deletedIds: Array.isArray(decoded.deletedIds) ? decoded.deletedIds : [],
        updatedByUid: String(decoded.updatedByUid || ''),
        createdAt: decoded.createdAt,
        updatedAt: decoded.updatedAt,
      },
      status: 'ok',
    };
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return { exists: false, data: null, status: 'error' };
  }
}

export function listenPublicVolunteerRosterFirestore(
  onData: (exists: boolean, docData: PublicVolunteerRosterDoc | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `public_roster/${PUBLIC_VOLUNTEER_ROSTER_DOC_ID}`;
  return onSnapshot(
    doc(db, 'public_roster', PUBLIC_VOLUNTEER_ROSTER_DOC_ID),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(false, null);
      } else {
        onData(true, snapshot.data() as PublicVolunteerRosterDoc);
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

export async function readPublicVolunteerRosterFromServer(): Promise<{
  exists: boolean;
  data: PublicVolunteerRosterDoc | null;
  status?: 'ok' | 'not_found' | 'error';
}> {
  // 1. Canale primario ultra-rapido HTTPS REST (100% immune da blocchi WebChannel/IndexedDB su iPhone Safari)
  const restRes = await readPublicVolunteerRosterViaRest();
  if (restRes.status === 'ok' || restRes.status === 'not_found') {
    return restRes;
  }

  // 2. Fallback SDK Firestore
  const path = `public_roster/${PUBLIC_VOLUNTEER_ROSTER_DOC_ID}`;
  try {
    const snap = await getDocFromServer(doc(db, 'public_roster', PUBLIC_VOLUNTEER_ROSTER_DOC_ID));
    return {
      exists: snap.exists(),
      data: snap.exists() ? (snap.data() as PublicVolunteerRosterDoc) : null,
      status: snap.exists() ? 'ok' : 'not_found',
    };
  } catch {
    try {
      const snap = await getDoc(doc(db, 'public_roster', PUBLIC_VOLUNTEER_ROSTER_DOC_ID));
      return {
        exists: snap.exists(),
        data: snap.exists() ? (snap.data() as PublicVolunteerRosterDoc) : null,
        status: snap.exists() ? 'ok' : 'not_found',
      };
    } catch (innerErr) {
      try {
        handleFirestoreError(innerErr, OperationType.GET, path);
      } catch {
        return { exists: false, data: null, status: 'error' };
      }
    }
  }
}

// =============================================================================
// ZERO-PII PUBLIC SHIFT BOARD (public_board/shifts_v1)
// Consente alla Modalità Monitor (senza login) e ai dispositivi volontari
// non autenticati su Google Cloud Sync di visualizzare in tempo reale OGNI turno
// pubblicato (di qualsiasi tipologia) su entrambi i link di destinazione.
// =============================================================================
const PUBLIC_BOARD_DOC_ID = 'shifts_v1';

export interface PublicBoardDoc {
  boardId: 'shifts_v1';
  version: number;
  turni: any[];
  sedi: any[];
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

function sanitizeCrewMemberPublic(member: any): { id: string; nome: string; ruoloSpecifico?: string } | undefined {
  if (!member || typeof member !== 'object') return undefined;
  const id = typeof member.id === 'string' ? member.id.trim().slice(0, 128) : '';
  const nome = typeof member.nome === 'string' ? member.nome.trim().slice(0, 120) : '';
  if (!id && !nome) return undefined;
  return {
    id: id || nome,
    nome: nome || 'Volontario',
    ...(typeof member.ruoloSpecifico === 'string' && member.ruoloSpecifico.trim()
      ? { ruoloSpecifico: member.ruoloSpecifico.trim().slice(0, 80) }
      : {}),
  };
}

export function buildPublicBoardTurni(turni: any[]): any[] {
  if (!Array.isArray(turni)) return [];
  const out: any[] = [];
  for (const t of turni) {
    if (!t || typeof t !== 'object') continue;
    const id = typeof t.id === 'string' ? t.id.trim().slice(0, 128) : '';
    if (!id) continue;
    const clean: Record<string, any> = {
      id,
      sedeId: typeof t.sedeId === 'string' ? t.sedeId.trim().slice(0, 128) : '',
      sedeNome: typeof t.sedeNome === 'string' ? t.sedeNome.trim().slice(0, 140) : '',
      data: typeof t.data === 'string' ? t.data.trim().slice(0, 16) : '',
      fasciaOraria: typeof t.fasciaOraria === 'string' ? t.fasciaOraria.trim().slice(0, 80) : '',
      orarioInizio: typeof t.orarioInizio === 'string' ? t.orarioInizio.trim().slice(0, 16) : '',
      orarioFine: typeof t.orarioFine === 'string' ? t.orarioFine.trim().slice(0, 16) : '',
      statoCopertura: typeof t.statoCopertura === 'string' ? t.statoCopertura.trim().slice(0, 32) : 'Scoperto',
    };
    if (typeof t.serieId === 'string' && t.serieId.trim()) clean.serieId = t.serieId.trim().slice(0, 128);
    if (typeof t.nomeTurno === 'string' && t.nomeTurno.trim()) clean.nomeTurno = t.nomeTurno.trim().slice(0, 120);
    if (typeof t.tipoTurnoId === 'string' && t.tipoTurnoId.trim()) clean.tipoTurnoId = t.tipoTurnoId.trim().slice(0, 128);
    if (typeof t.tipoTurnoNome === 'string' && t.tipoTurnoNome.trim()) clean.tipoTurnoNome = t.tipoTurnoNome.trim().slice(0, 120);
    if (typeof t.mezzoAssegnato === 'string' && t.mezzoAssegnato.trim()) clean.mezzoAssegnato = t.mezzoAssegnato.trim().slice(0, 64);
    if (typeof t.checklistObbligatoria === 'boolean') clean.checklistObbligatoria = t.checklistObbligatoria;
    if (typeof t.visibileInModalitaMonitor === 'boolean') clean.visibileInModalitaMonitor = t.visibileInModalitaMonitor;
    if (typeof t.note === 'string' && t.note.trim()) clean.note = t.note.trim().slice(0, 300);

    if (Array.isArray(t.mansioniRichieste) && t.mansioniRichieste.length > 0) {
      clean.mansioniRichieste = t.mansioniRichieste.slice(0, 16).map((m: any) => ({
        id: typeof m?.id === 'string' ? m.id.slice(0, 80) : '',
        mansioneCatalogoId: typeof m?.mansioneCatalogoId === 'string' ? m.mansioneCatalogoId.slice(0, 80) : '',
        nome: typeof m?.nome === 'string' ? m.nome.slice(0, 80) : '',
        ruoloTurno: typeof m?.ruoloTurno === 'string' ? m.ruoloTurno.slice(0, 40) : '',
        obbligatoria: Boolean(m?.obbligatoria),
        minimo: typeof m?.minimo === 'number' ? m.minimo : 0,
        massimo: typeof m?.massimo === 'number' ? m.massimo : 1,
        ...(typeof m?.ordine === 'number' ? { ordine: m.ordine } : {}),
      }));
    }

    const cs = sanitizeCrewMemberPublic(t.capoServizioBadge);
    if (cs) clean.capoServizioBadge = cs;
    const aut = sanitizeCrewMemberPublic(t.autista);
    if (aut) clean.autista = aut;
    const s2 = sanitizeCrewMemberPublic(t.soccorritore2);
    if (s2) clean.soccorritore2 = s2;
    const s3 = sanitizeCrewMemberPublic(t.terzoSoccorritore);
    if (s3) clean.terzoSoccorritore = s3;
    const oc = sanitizeCrewMemberPublic(t.operatoreCentrale);
    if (oc) clean.operatoreCentrale = oc;
    const cent = sanitizeCrewMemberPublic(t.centralinista);
    if (cent) clean.centralinista = cent;
    const oss = sanitizeCrewMemberPublic(t.osservatore);
    if (oss) clean.osservatore = oss;

    if (Array.isArray(t.richiesteIscrizione) && t.richiesteIscrizione.length > 0) {
      clean.richiesteIscrizione = t.richiesteIscrizione.slice(0, 16).map((r: any) => ({
        id: typeof r?.id === 'string' ? r.id.slice(0, 96) : '',
        volontarioId: typeof r?.volontarioId === 'string' ? r.volontarioId.slice(0, 128) : '',
        volontarioNome: typeof r?.volontarioNome === 'string' ? r.volontarioNome.slice(0, 120) : '',
        qualificaVolontario: typeof r?.qualificaVolontario === 'string' ? r.qualificaVolontario.slice(0, 80) : '',
        ruoloRichiesto: typeof r?.ruoloRichiesto === 'string' ? r.ruoloRichiesto.slice(0, 40) : '',
        stato: typeof r?.stato === 'string' ? r.stato.slice(0, 32) : 'In Attesa',
        dataRichiesta: typeof r?.dataRichiesta === 'string' ? r.dataRichiesta.slice(0, 40) : '',
      }));
    }

    out.push(clean);
    if (out.length >= 1450) break;
  }

  // Protezione limite 1 MiB di Firestore: se i turni storici sono moltissimi,
  // mantiene i turni più recenti/futuri senza mai sforare il limite documento.
  let capped = out;
  if (getUtf8JsonByteLength(capped) > 720000) {
    const sortedDesc = [...capped].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    const trimmed: any[] = [];
    for (const item of sortedDesc) {
      trimmed.push(item);
      if (trimmed.length >= 900 || (trimmed.length % 50 === 0 && getUtf8JsonByteLength(trimmed) > 680000)) {
        break;
      }
    }
    capped = trimmed;
  }
  return capped;
}

export function buildPublicBoardSedi(sedi: any[]): any[] {
  if (!Array.isArray(sedi)) return [];
  const out: any[] = [];
  for (const s of sedi) {
    if (!s || typeof s !== 'object') continue;
    const id = typeof s.id === 'string' ? s.id.trim().slice(0, 128) : '';
    const nome = typeof s.nome === 'string' ? s.nome.trim().slice(0, 160) : '';
    if (!id || !nome) continue;
    out.push({
      id,
      nome,
      ...(typeof s.codiceSede === 'string' && s.codiceSede.trim() ? { codiceSede: s.codiceSede.trim().slice(0, 32) } : {}),
      ...(typeof s.tipologia === 'string' && s.tipologia.trim() ? { tipologia: s.tipologia.trim().slice(0, 64) } : {}),
      ...(typeof s.comune === 'string' && s.comune.trim() ? { comune: s.comune.trim().slice(0, 80) } : {}),
      ...(typeof s.provincia === 'string' && s.provincia.trim() ? { provincia: s.provincia.trim().slice(0, 16) } : {}),
      ...(Array.isArray(s.mezziAssegnati)
        ? {
            mezziAssegnati: s.mezziAssegnati
              .filter((m: any) => typeof m === 'string' && m.trim().length > 0)
              .map((m: string) => m.trim().slice(0, 48))
              .slice(0, 40),
          }
        : {}),
    });
    if (out.length >= 60) break;
  }
  return out;
}

let lastPublishedPublicBoardSig = '';
let publicBoardSyncChain: Promise<void> = Promise.resolve();

export function resetPublicBoardSyncCache(): void {
  lastPublishedPublicBoardSig = '';
}

export function syncPublicBoardFirestore(turni: any[], sedi: any[]): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return Promise.resolve();
  }
  const cleanTurni = buildPublicBoardTurni(Array.isArray(turni) ? turni : []);
  const cleanSedi = buildPublicBoardSedi(Array.isArray(sedi) ? sedi : []);
  if (cleanTurni.length === 0 && cleanSedi.length === 0) {
    return Promise.resolve();
  }

  const sig = JSON.stringify({ cleanTurni, cleanSedi });
  if (sig === lastPublishedPublicBoardSig) {
    return Promise.resolve();
  }

  publicBoardSyncChain = publicBoardSyncChain
    .then(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;
      if (sig === lastPublishedPublicBoardSig) return;

      const docRef = doc(db, 'public_board', PUBLIC_BOARD_DOC_ID);
      const sanitizedTurni = sanitizeForFirestore(cleanTurni);
      const sanitizedSedi = sanitizeForFirestore(cleanSedi);
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            boardId: PUBLIC_BOARD_DOC_ID,
            version: 1,
            turni: sanitizedTurni,
            sedi: sanitizedSedi,
            updatedByUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const snapData = snap.data() as Partial<PublicBoardDoc> | undefined;
          const prevVer = typeof snapData?.version === 'number' && snapData.version >= 1 ? snapData.version : 1;
          await updateDoc(docRef, {
            version: prevVer + 1,
            turni: sanitizedTurni,
            sedi: sanitizedSedi,
            updatedByUid: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
        lastPublishedPublicBoardSig = sig;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `public_board/${PUBLIC_BOARD_DOC_ID}`);
        } catch {
          // Non bloccare il sync principale se la pubblicazione del tabellone pubblico fallisce temporaneamente
        }
      }
    })
    .catch(() => {});

  return publicBoardSyncChain;
}

async function readPublicBoardViaRest(): Promise<{
  exists: boolean;
  data: PublicBoardDoc | null;
  status: 'ok' | 'not_found' | 'error';
}> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/public_board/${PUBLIC_BOARD_DOC_ID}?key=${encodeURIComponent(
    firebaseConfig.apiKey
  )}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.status === 404) {
      return { exists: false, data: null, status: 'not_found' };
    }
    if (!res.ok) {
      return { exists: false, data: null, status: 'error' };
    }
    const json = await res.json();
    const decoded = decodeFirestoreRestValue({ mapValue: { fields: json?.fields || {} } });
    if (!decoded || (!Array.isArray(decoded.turni) && !Array.isArray(decoded.sedi))) {
      return { exists: false, data: null, status: 'not_found' };
    }
    return {
      exists: true,
      data: {
        boardId: 'shifts_v1',
        version: typeof decoded.version === 'number' ? decoded.version : 1,
        turni: Array.isArray(decoded.turni) ? decoded.turni : [],
        sedi: Array.isArray(decoded.sedi) ? decoded.sedi : [],
        updatedByUid: String(decoded.updatedByUid || ''),
        createdAt: decoded.createdAt,
        updatedAt: decoded.updatedAt,
      },
      status: 'ok',
    };
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return { exists: false, data: null, status: 'error' };
  }
}

export function listenPublicBoardFirestore(
  onData: (exists: boolean, docData: PublicBoardDoc | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `public_board/${PUBLIC_BOARD_DOC_ID}`;
  return onSnapshot(
    doc(db, 'public_board', PUBLIC_BOARD_DOC_ID),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(false, null);
      } else {
        onData(true, snapshot.data() as PublicBoardDoc);
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

export async function readPublicBoardFromServer(): Promise<{
  exists: boolean;
  data: PublicBoardDoc | null;
  status?: 'ok' | 'not_found' | 'error';
}> {
  const restRes = await readPublicBoardViaRest();
  if (restRes.status === 'ok' || restRes.status === 'not_found') {
    return restRes;
  }
  const path = `public_board/${PUBLIC_BOARD_DOC_ID}`;
  try {
    const snap = await getDocFromServer(doc(db, 'public_board', PUBLIC_BOARD_DOC_ID));
    return {
      exists: snap.exists(),
      data: snap.exists() ? (snap.data() as PublicBoardDoc) : null,
      status: snap.exists() ? 'ok' : 'not_found',
    };
  } catch {
    try {
      const snap = await getDoc(doc(db, 'public_board', PUBLIC_BOARD_DOC_ID));
      return {
        exists: snap.exists(),
        data: snap.exists() ? (snap.data() as PublicBoardDoc) : null,
        status: snap.exists() ? 'ok' : 'not_found',
      };
    } catch (innerErr) {
      try {
        handleFirestoreError(innerErr, OperationType.GET, path);
      } catch {
        return { exists: false, data: null, status: 'error' };
      }
    }
  }
}

// =============================================================================
// ZERO-PII PUBLIC RASPBERRY SECTION DISPLAY BOARD (public_raspberry/display_v1)
// Consente ai monitor collegati a Raspberry Pi nelle singole sezioni (senza login)
// di visualizzare in tempo reale:
// 1. Bacheca Associativa (Sede Centrale)
// 2. Bacheca di Sezione (Singola Sezione)
// 3. Volontari presenti di turno (badgiato ingresso) e usciti (ingresso + uscita)
// =============================================================================
const PUBLIC_RASPBERRY_DOC_ID = 'display_v1';

export interface PublicRaspberryBoardDoc {
  boardId: 'display_v1';
  version: number;
  sedi: any[];
  bacheca: any[];
  timbrature: any[];
  config: Record<string, any>;
  updatedByUid: string;
  createdAt?: any;
  updatedAt?: any;
}

export function buildPublicRaspberryBacheca(bacheca: any[]): any[] {
  if (!Array.isArray(bacheca)) return [];
  const activeOnly = bacheca
    .filter((c) => c && typeof c === 'object' && c.attiva !== false)
    .sort((a, b) => {
      if (Boolean(a.evidenziata) !== Boolean(b.evidenziata)) return a.evidenziata ? -1 : 1;
      const dtA = `${a.dataPubblicazione || ''} ${a.oraPubblicazione || ''}`;
      const dtB = `${b.dataPubblicazione || ''} ${b.oraPubblicazione || ''}`;
      return dtB.localeCompare(dtA);
    });

  const out: any[] = [];
  for (const c of activeOnly) {
    const id = typeof c.id === 'string' ? c.id.trim().slice(0, 128) : '';
    const titolo = typeof c.titolo === 'string' ? c.titolo.trim().slice(0, 220) : '';
    if (!id || !titolo) continue;
    out.push({
      id,
      titolo,
      contenuto: typeof c.contenuto === 'string' ? c.contenuto.trim().slice(0, 1800) : '',
      sezioneTargetId: typeof c.sezioneTargetId === 'string' ? c.sezioneTargetId.trim().slice(0, 128) : 'tutte',
      sezioneTargetNome: typeof c.sezioneTargetNome === 'string' ? c.sezioneTargetNome.trim().slice(0, 160) : 'Tutte le Sezioni',
      priorita: typeof c.priorita === 'string' ? c.priorita.trim().slice(0, 32) : 'Ordinaria',
      categoria: typeof c.categoria === 'string' ? c.categoria.trim().slice(0, 64) : 'Comunicazione Generale',
      dataPubblicazione: typeof c.dataPubblicazione === 'string' ? c.dataPubblicazione.trim().slice(0, 24) : '',
      oraPubblicazione: typeof c.oraPubblicazione === 'string' ? c.oraPubblicazione.trim().slice(0, 16) : '',
      autore: typeof c.autore === 'string' ? c.autore.trim().slice(0, 120) : 'Direzione',
      attiva: true,
      evidenziata: Boolean(c.evidenziata),
      ...(typeof c.updatedAt === 'number' ? { updatedAt: c.updatedAt } : {}),
    });
    if (out.length >= 140) break;
  }
  return out;
}

export function buildPublicRaspberryTimbrature(timbrature: any[]): any[] {
  if (!Array.isArray(timbrature)) return [];
  const openItems: any[] = [];
  const closedItems: any[] = [];
  const nowMs = Date.now();

  for (const t of timbrature) {
    if (!t || typeof t !== 'object') continue;
    const hasExit = typeof t.orarioUscita === 'string' && t.orarioUscita.trim().length > 0;
    const isAutoClosed = t.autoChiusuraNfc24h === true;
    const isNfc =
      t.metodoTimbratura === 'nfc' ||
      String(t.note || '').toLowerCase().includes('[nfc]') ||
      String(t.note || '').toLowerCase().includes('lettore nfc');

    if (!hasExit) {
      if (isAutoClosed) continue;
      if (isNfc && typeof t.data === 'string' && typeof t.orarioIngresso === 'string') {
        const timeClean = t.orarioIngresso.trim().length === 5 ? `${t.orarioIngresso.trim()}:00` : t.orarioIngresso.trim().slice(0, 8);
        const startMs = new Date(`${t.data.trim().slice(0, 10)}T${timeClean}`).getTime();
        if (!Number.isNaN(startMs) && nowMs - startMs >= 24 * 3600 * 1000) {
          continue;
        }
      }
      openItems.push(t);
    } else if (!isAutoClosed) {
      closedItems.push(t);
    }
  }

  closedItems.sort((a, b) => {
    const dtA = `${a.dataUscita || a.data || ''} ${a.orarioUscita || a.orarioIngresso || ''}`;
    const dtB = `${b.dataUscita || b.data || ''} ${b.orarioUscita || b.orarioIngresso || ''}`;
    return dtB.localeCompare(dtA);
  });

  openItems.sort((a, b) => {
    const dtA = `${a.data || ''} ${a.orarioIngresso || ''}`;
    const dtB = `${b.data || ''} ${b.orarioIngresso || ''}`;
    return dtB.localeCompare(dtA);
  });

  // Garantisce almeno gli ultimi 15 usciti per ogni singola sede (così ogni display ha sempre gli ultimi 10 completi)
  const perSedeCount = new Map<string, number>();
  const balancedClosed: any[] = [];
  const overflowClosed: any[] = [];
  for (const item of closedItems) {
    const key = String(item.sede || item.sedeUscita || 'altro').trim().toLowerCase();
    const cur = perSedeCount.get(key) || 0;
    if (cur < 15) {
      perSedeCount.set(key, cur + 1);
      balancedClosed.push(item);
    } else {
      overflowClosed.push(item);
    }
  }

  const combined = [...openItems, ...balancedClosed, ...overflowClosed];
  const out: any[] = [];

  for (const t of combined) {
    const id = typeof t.id === 'string' ? t.id.trim().slice(0, 128) : '';
    const volontarioNome = typeof t.volontarioNome === 'string' ? t.volontarioNome.trim().slice(0, 120) : '';
    if (!id || !volontarioNome) continue;
    const clean: Record<string, any> = {
      id,
      volontarioNome,
      qualifica: typeof t.qualifica === 'string' ? t.qualifica.trim().slice(0, 80) : 'Volontario',
      data: typeof t.data === 'string' ? t.data.trim().slice(0, 16) : '',
      orarioIngresso: typeof t.orarioIngresso === 'string' ? t.orarioIngresso.trim().slice(0, 16) : '',
      sede: typeof t.sede === 'string' ? t.sede.trim().slice(0, 160) : '',
    };
    if (typeof t.dataUscita === 'string' && t.dataUscita.trim()) {
      clean.dataUscita = t.dataUscita.trim().slice(0, 16);
    }
    if (typeof t.orarioUscita === 'string' && t.orarioUscita.trim()) {
      clean.orarioUscita = t.orarioUscita.trim().slice(0, 16);
    }
    if (typeof t.sedeUscita === 'string' && t.sedeUscita.trim()) {
      clean.sedeUscita = t.sedeUscita.trim().slice(0, 160);
    }
    if (typeof t.oreTotali === 'number' && Number.isFinite(t.oreTotali)) {
      clean.oreTotali = Math.round(t.oreTotali * 100) / 100;
    }
    if (typeof t.oreEMinuti === 'string' && t.oreEMinuti.trim()) {
      clean.oreEMinuti = t.oreEMinuti.trim().slice(0, 32);
    }
    if (typeof t.mezzoAssegnato === 'string' && t.mezzoAssegnato.trim()) {
      clean.mezzoAssegnato = t.mezzoAssegnato.trim().slice(0, 64);
    }
    if (typeof t.attivitaSvolta === 'string' && t.attivitaSvolta.trim()) {
      clean.attivitaSvolta = t.attivitaSvolta.trim().slice(0, 160);
    }
    if (typeof t.tipoAttivita === 'string' && t.tipoAttivita.trim()) {
      clean.tipoAttivita = t.tipoAttivita.trim().slice(0, 32);
    }
    if (t.metodoTimbratura === 'nfc' || t.metodoTimbratura === 'app' || t.metodoTimbratura === 'manuale') {
      clean.metodoTimbratura = t.metodoTimbratura;
    }
    out.push(clean);
    if (out.length >= 320) break;
  }

  return out;
}

let lastPublishedPublicRaspberrySig = '';
let publicRaspberrySyncChain: Promise<void> = Promise.resolve();

export function resetPublicRaspberrySyncCache(): void {
  lastPublishedPublicRaspberrySig = '';
}

export function syncPublicRaspberryBoardFirestore(
  sedi: any[],
  bacheca: any[],
  timbrature: any[],
  config: Record<string, any>
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return Promise.resolve();
  }
  const cleanSedi = buildPublicBoardSedi(Array.isArray(sedi) ? sedi : []);
  const cleanBacheca = buildPublicRaspberryBacheca(Array.isArray(bacheca) ? bacheca : []);
  const cleanTimbrature = buildPublicRaspberryTimbrature(Array.isArray(timbrature) ? timbrature : []);
  const cleanConfig = config && typeof config === 'object' ? sanitizeForFirestore(config) : {};

  if (cleanSedi.length === 0 && cleanBacheca.length === 0 && cleanTimbrature.length === 0) {
    return Promise.resolve();
  }

  const sig = JSON.stringify({ cleanSedi, cleanBacheca, cleanTimbrature, cleanConfig });
  if (sig === lastPublishedPublicRaspberrySig) {
    return Promise.resolve();
  }

  publicRaspberrySyncChain = publicRaspberrySyncChain
    .then(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) return;
      if (sig === lastPublishedPublicRaspberrySig) return;

      const docRef = doc(db, 'public_raspberry', PUBLIC_RASPBERRY_DOC_ID);
      const sanitizedSedi = sanitizeForFirestore(cleanSedi);
      const sanitizedBacheca = sanitizeForFirestore(cleanBacheca);
      const sanitizedTimbrature = sanitizeForFirestore(cleanTimbrature);
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            boardId: PUBLIC_RASPBERRY_DOC_ID,
            version: 1,
            sedi: sanitizedSedi,
            bacheca: sanitizedBacheca,
            timbrature: sanitizedTimbrature,
            config: cleanConfig,
            updatedByUid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const snapData = snap.data() as Partial<PublicRaspberryBoardDoc> | undefined;
          const prevVer = typeof snapData?.version === 'number' && snapData.version >= 1 ? snapData.version : 1;
          await updateDoc(docRef, {
            version: prevVer + 1,
            sedi: sanitizedSedi,
            bacheca: sanitizedBacheca,
            timbrature: sanitizedTimbrature,
            config: cleanConfig,
            updatedByUid: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
        lastPublishedPublicRaspberrySig = sig;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `public_raspberry/${PUBLIC_RASPBERRY_DOC_ID}`);
        } catch {
          // Non bloccare il sync principale se la pubblicazione Raspberry fallisce temporaneamente
        }
      }
    })
    .catch(() => {});

  return publicRaspberrySyncChain;
}

async function readPublicRaspberryBoardViaRest(): Promise<{
  exists: boolean;
  data: PublicRaspberryBoardDoc | null;
  status: 'ok' | 'not_found' | 'error';
}> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/public_raspberry/${PUBLIC_RASPBERRY_DOC_ID}?key=${encodeURIComponent(
    firebaseConfig.apiKey
  )}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.status === 404) {
      return { exists: false, data: null, status: 'not_found' };
    }
    if (!res.ok) {
      return { exists: false, data: null, status: 'error' };
    }
    const json = await res.json();
    const decoded = decodeFirestoreRestValue({ mapValue: { fields: json?.fields || {} } });
    if (!decoded) {
      return { exists: false, data: null, status: 'not_found' };
    }
    return {
      exists: true,
      data: {
        boardId: 'display_v1',
        version: typeof decoded.version === 'number' ? decoded.version : 1,
        sedi: Array.isArray(decoded.sedi) ? decoded.sedi : [],
        bacheca: Array.isArray(decoded.bacheca) ? decoded.bacheca : [],
        timbrature: Array.isArray(decoded.timbrature) ? decoded.timbrature : [],
        config: decoded.config && typeof decoded.config === 'object' ? decoded.config : {},
        updatedByUid: String(decoded.updatedByUid || ''),
        createdAt: decoded.createdAt,
        updatedAt: decoded.updatedAt,
      },
      status: 'ok',
    };
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return { exists: false, data: null, status: 'error' };
  }
}

export function listenPublicRaspberryBoardFirestore(
  onData: (exists: boolean, docData: PublicRaspberryBoardDoc | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `public_raspberry/${PUBLIC_RASPBERRY_DOC_ID}`;
  return onSnapshot(
    doc(db, 'public_raspberry', PUBLIC_RASPBERRY_DOC_ID),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(false, null);
      } else {
        onData(true, snapshot.data() as PublicRaspberryBoardDoc);
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

export async function readPublicRaspberryBoardFromServer(): Promise<{
  exists: boolean;
  data: PublicRaspberryBoardDoc | null;
  status?: 'ok' | 'not_found' | 'error';
}> {
  const restRes = await readPublicRaspberryBoardViaRest();
  if (restRes.status === 'ok' || restRes.status === 'not_found') {
    return restRes;
  }
  const path = `public_raspberry/${PUBLIC_RASPBERRY_DOC_ID}`;
  try {
    const snap = await getDocFromServer(doc(db, 'public_raspberry', PUBLIC_RASPBERRY_DOC_ID));
    return {
      exists: snap.exists(),
      data: snap.exists() ? (snap.data() as PublicRaspberryBoardDoc) : null,
      status: snap.exists() ? 'ok' : 'not_found',
    };
  } catch {
    try {
      const snap = await getDoc(doc(db, 'public_raspberry', PUBLIC_RASPBERRY_DOC_ID));
      return {
        exists: snap.exists(),
        data: snap.exists() ? (snap.data() as PublicRaspberryBoardDoc) : null,
        status: snap.exists() ? 'ok' : 'not_found',
      };
    } catch (innerErr) {
      try {
        handleFirestoreError(innerErr, OperationType.GET, path);
      } catch {
        return { exists: false, data: null, status: 'error' };
      }
    }
  }
}

// ============================================================================
// PUBLIC COURSE CARDS & WRITE-ONLY EXTERNAL GUEST CHECK-INS (AULA DIDATTICA)
// ============================================================================
export interface PublicCourseLezioneDoc {
  id: string;
  data: string;
  orarioInizio: string;
  orarioFine: string;
  argomento: string;
  aulaNome?: string;
  aulaIndirizzo?: string;
  coordinate?: { lat: number; lng: number };
  raggioMetri?: number;
}

export interface PublicCourseDoc {
  tokenId: string;
  corsoId: string;
  titolo: string;
  categoria: string;
  dataInizio: string;
  dataFine: string;
  oreTotaliRichieste: number;
  aulaNome: string;
  aulaIndirizzo: string;
  coordinate: { lat: number; lng: number };
  raggioMetri: number;
  lezioni: PublicCourseLezioneDoc[];
  attivo: boolean;
  updatedByUid?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CourseGuestCheckinRecord {
  checkinId: string;
  scope: 'croce_oro_course_guest';
  tokenId: string;
  corsoId: string;
  lezioneId: string;
  nome: string;
  cognome: string;
  telefono: string;
  tipo: 'entrata' | 'uscita';
  dataOra: string;
  aulaNome: string;
  distanzaMetri: number;
  status: 'pending' | 'applied';
  createdAt?: any;
  updatedAt?: any;
}

export async function publishPublicCourseFirestore(payload: Omit<PublicCourseDoc, 'updatedByUid' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return false;
  const tokenId = String(payload.tokenId || '').trim();
  if (!/^crs-[a-zA-Z0-9_\-]{6,92}$/.test(tokenId)) return false;

  const docRef = doc(db, 'public_courses', tokenId);
  const cleanLezioni: PublicCourseLezioneDoc[] = Array.isArray(payload.lezioni)
    ? payload.lezioni.slice(0, 40).map((l) => ({
        id: String(l?.id || '').slice(0, 80),
        data: String(l?.data || '').slice(0, 20),
        orarioInizio: String(l?.orarioInizio || '').slice(0, 12),
        orarioFine: String(l?.orarioFine || '').slice(0, 12),
        argomento: String(l?.argomento || '').slice(0, 160),
        ...(l?.aulaNome ? { aulaNome: String(l.aulaNome).slice(0, 140) } : {}),
        ...(l?.aulaIndirizzo ? { aulaIndirizzo: String(l.aulaIndirizzo).slice(0, 200) } : {}),
        ...(l?.coordinate && Number.isFinite(Number(l.coordinate.lat)) && Number.isFinite(Number(l.coordinate.lng))
          ? { coordinate: { lat: Number(l.coordinate.lat), lng: Number(l.coordinate.lng) } }
          : {}),
        ...(typeof l?.raggioMetri === 'number' && Number.isFinite(l.raggioMetri)
          ? { raggioMetri: Math.max(10, Math.min(2000, Math.round(l.raggioMetri))) }
          : {}),
      }))
    : [];

  const cleanDoc = {
    tokenId,
    corsoId: String(payload.corsoId || '').trim().slice(0, 128),
    titolo: String(payload.titolo || 'Corso di Formazione').trim().slice(0, 180),
    categoria: String(payload.categoria || 'Formazione').trim().slice(0, 80),
    dataInizio: String(payload.dataInizio || '2026-01-01').trim().slice(0, 24),
    dataFine: String(payload.dataFine || '').trim().slice(0, 24),
    oreTotaliRichieste: Math.max(0, Math.min(2000, Number(payload.oreTotaliRichieste) || 0)),
    aulaNome: String(payload.aulaNome || 'Aula Didattica').trim().slice(0, 160),
    aulaIndirizzo: String(payload.aulaIndirizzo || '').trim().slice(0, 220),
    coordinate: {
      lat: Number(payload.coordinate?.lat) || 44.0361,
      lng: Number(payload.coordinate?.lng) || 10.1415,
    },
    raggioMetri: Math.max(10, Math.min(2000, Math.round(Number(payload.raggioMetri) || 120))),
    lezioni: sanitizeForFirestore(cleanLezioni),
    attivo: Boolean(payload.attivo),
    updatedByUid: user.uid,
  };

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...cleanDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        ...cleanDoc,
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.WRITE, `public_courses/${tokenId}`);
    } catch {
      return false;
    }
    return false;
  }
}

async function readPublicCourseViaRest(tokenId: string): Promise<{
  exists: boolean;
  data: PublicCourseDoc | null;
  status: 'ok' | 'not_found' | 'error';
}> {
  const cleanToken = String(tokenId || '').trim();
  if (!/^crs-[a-zA-Z0-9_\-]{6,92}$/.test(cleanToken)) {
    return { exists: false, data: null, status: 'not_found' };
  }
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(
    firebaseConfig.firestoreDatabaseId
  )}/documents/public_courses/${encodeURIComponent(cleanToken)}?key=${encodeURIComponent(
    firebaseConfig.apiKey
  )}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (res.status === 404) return { exists: false, data: null, status: 'not_found' };
    if (!res.ok) return { exists: false, data: null, status: 'error' };
    const json = await res.json();
    const decoded = decodeFirestoreRestValue({ mapValue: { fields: json?.fields || {} } });
    if (!decoded) return { exists: false, data: null, status: 'not_found' };
    return {
      exists: true,
      data: {
        tokenId: String(decoded.tokenId || cleanToken),
        corsoId: String(decoded.corsoId || ''),
        titolo: String(decoded.titolo || ''),
        categoria: String(decoded.categoria || 'Formazione'),
        dataInizio: String(decoded.dataInizio || ''),
        dataFine: String(decoded.dataFine || ''),
        oreTotaliRichieste: Number(decoded.oreTotaliRichieste) || 0,
        aulaNome: String(decoded.aulaNome || 'Aula Didattica'),
        aulaIndirizzo: String(decoded.aulaIndirizzo || ''),
        coordinate: {
          lat: Number(decoded.coordinate?.lat) || 44.0361,
          lng: Number(decoded.coordinate?.lng) || 10.1415,
        },
        raggioMetri: Number(decoded.raggioMetri) || 120,
        lezioni: Array.isArray(decoded.lezioni) ? decoded.lezioni : [],
        attivo: Boolean(decoded.attivo),
      },
      status: 'ok',
    };
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    return { exists: false, data: null, status: 'error' };
  }
}

export async function readPublicCourseFromServer(tokenId: string): Promise<{
  exists: boolean;
  data: PublicCourseDoc | null;
  status: 'ok' | 'not_found' | 'error';
}> {
  const restRes = await readPublicCourseViaRest(tokenId);
  if (restRes.status === 'ok' || restRes.status === 'not_found') {
    return restRes;
  }
  const cleanToken = String(tokenId || '').trim();
  try {
    const snap = await getDocFromServer(doc(db, 'public_courses', cleanToken));
    return {
      exists: snap.exists(),
      data: snap.exists() ? (snap.data() as PublicCourseDoc) : null,
      status: snap.exists() ? 'ok' : 'not_found',
    };
  } catch {
    try {
      const snap = await getDoc(doc(db, 'public_courses', cleanToken));
      return {
        exists: snap.exists(),
        data: snap.exists() ? (snap.data() as PublicCourseDoc) : null,
        status: snap.exists() ? 'ok' : 'not_found',
      };
    } catch {
      return { exists: false, data: null, status: 'error' };
    }
  }
}

export async function submitCourseGuestCheckinFirestore(input: {
  tokenId: string;
  corsoId: string;
  lezioneId?: string;
  nome: string;
  cognome: string;
  telefono: string;
  tipo: 'entrata' | 'uscita';
  dataOra: string;
  aulaNome: string;
  distanzaMetri: number;
}): Promise<{ ok: boolean; checkinId?: string; error?: string }> {
  const tokenId = String(input.tokenId || '').trim();
  const corsoId = String(input.corsoId || '').trim().slice(0, 128);
  const nome = String(input.nome || '').trim().slice(0, 80);
  const cognome = String(input.cognome || '').trim().slice(0, 80);
  const telefono = String(input.telefono || '').trim().slice(0, 32);
  if (!/^crs-[a-zA-Z0-9_\-]{6,92}$/.test(tokenId) || !corsoId || !nome || !cognome || telefono.length < 5) {
    return { ok: false, error: 'Dati di timbratura non validi o incompleti.' };
  }

  const checkinId = `chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const docRef = doc(db, 'course_guest_checkins', checkinId);
  const record = {
    checkinId,
    scope: 'croce_oro_course_guest' as const,
    tokenId,
    corsoId,
    lezioneId: String(input.lezioneId || '').trim().slice(0, 128),
    nome,
    cognome,
    telefono,
    tipo: input.tipo === 'uscita' ? 'uscita' : 'entrata',
    dataOra: String(input.dataOra || '').trim().slice(0, 40),
    aulaNome: String(input.aulaNome || 'Aula Didattica').trim().slice(0, 160),
    distanzaMetri: Math.max(0, Math.min(50000, Math.round(Number(input.distanzaMetri) || 0))),
    status: 'pending' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, record);
    return { ok: true, checkinId };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Errore salvataggio timbratura su cloud.' };
  }
}

export function listenPendingCourseGuestCheckinsFirestore(
  onItems: (items: CourseGuestCheckinRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'course_guest_checkins'),
    where('scope', '==', 'croce_oro_course_guest')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CourseGuestCheckinRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as CourseGuestCheckinRecord;
        if (d && d.status === 'pending') {
          items.push(d);
        }
      });
      onItems(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'course_guest_checkins');
      } catch (wrapped: any) {
        onError?.(wrapped);
      }
    }
  );
}

export async function markCourseGuestCheckinAppliedFirestore(checkinId: string): Promise<void> {
  const cleanId = String(checkinId || '').trim();
  if (!/^chk-[a-zA-Z0-9_\-]+$/.test(cleanId)) return;
  try {
    await updateDoc(doc(db, 'course_guest_checkins', cleanId), {
      status: 'applied',
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non bloccare l'UI se il record è già stato applicato da un altro terminale
  }
}

