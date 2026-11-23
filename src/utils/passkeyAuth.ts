import { formatDateTimeItaly } from './italianTime';
import { getEffectiveSimulatedDevice } from './deviceSimulation';

export interface PasskeyRecord {
  id: string;
  credentialIdB64: string;
  label: string;
  accountId: string;
  accountName: string;
  roleScope: 'volontario' | 'centrale' | 'admin';
  createdAt: string;
  lastUsedAt?: string;
  deviceHint?: string;
  transports?: string[];
}

export const PASSKEYS_LOCAL_STORAGE_KEY = 'CROCE_ORO_PASSKEYS_LOCAL_V1';

export function getNotificationEmailForVolontario(
  v?: { email?: string; emailNotifiche?: string } | null
): string {
  const custom = typeof v?.emailNotifiche === 'string' ? v.emailNotifiche.trim() : '';
  if (custom && custom.includes('@')) return custom;
  const base = typeof v?.email === 'string' ? v.email.trim() : '';
  return base;
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToUint8Array(base64url: string): Uint8Array {
  const normalized = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generateRandomChallenge(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.isSecureContext &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function'
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {}
  return false;
}

export function detectDeviceHint(): string {
  const simulated = getEffectiveSimulatedDevice();
  if (simulated === 'apple') return 'iPhone (Face ID / Touch ID)';
  if (simulated === 'android') return 'Smartphone Android (Impronta / Viso)';
  if (typeof navigator === 'undefined') return 'Questo Dispositivo';
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) return 'iPhone (Face ID / Touch ID)';
  if (/iPad/i.test(ua)) return 'iPad (Face ID / Touch ID)';
  if (/Android/i.test(ua)) return 'Smartphone Android (Impronta / Viso)';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac (Touch ID / Passkey)';
  if (/Windows/i.test(ua)) return 'PC Windows (Windows Hello)';
  if (/Linux/i.test(ua)) return 'Dispositivo Linux (Passkey)';
  return 'Questo Dispositivo';
}

export function getLocalPasskeys(): PasskeyRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASSKEYS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PasskeyRecord =>
        Boolean(item && typeof item.credentialIdB64 === 'string' && typeof item.accountId === 'string')
    );
  } catch {
    return [];
  }
}

export function saveLocalPasskeys(records: PasskeyRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PASSKEYS_LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function upsertLocalPasskey(record: PasskeyRecord): PasskeyRecord[] {
  const existing = getLocalPasskeys();
  const filtered = existing.filter((r) => r.credentialIdB64 !== record.credentialIdB64);
  const next = [record, ...filtered];
  saveLocalPasskeys(next);
  return next;
}

export function removeLocalPasskey(credentialIdB64: string): PasskeyRecord[] {
  const existing = getLocalPasskeys();
  const next = existing.filter((r) => r.credentialIdB64 !== credentialIdB64);
  saveLocalPasskeys(next);
  return next;
}

export function getPasskeysForAccount(
  accountId: string,
  syncedPasskeys?: PasskeyRecord[]
): PasskeyRecord[] {
  const byCred = new Map<string, PasskeyRecord>();
  const synced = Array.isArray(syncedPasskeys) ? syncedPasskeys : [];
  for (const rec of synced) {
    if (rec?.credentialIdB64) {
      byCred.set(rec.credentialIdB64, { ...rec, accountId: rec.accountId || accountId });
    }
  }
  const local = getLocalPasskeys().filter((r) => r.accountId === accountId);
  for (const rec of local) {
    const prev = byCred.get(rec.credentialIdB64);
    byCred.set(rec.credentialIdB64, prev ? { ...prev, ...rec } : rec);
  }
  return Array.from(byCred.values());
}

export function getAllKnownPasskeys(
  volontari?: Array<{ id: string; nome?: string; cognome?: string; passkeys?: PasskeyRecord[] }>
): PasskeyRecord[] {
  const byCred = new Map<string, PasskeyRecord>();
  if (Array.isArray(volontari)) {
    for (const v of volontari) {
      if (!v || !Array.isArray(v.passkeys)) continue;
      const fullName = `${v.nome || ''} ${v.cognome || ''}`.trim() || v.id;
      for (const rec of v.passkeys) {
        if (rec?.credentialIdB64) {
          byCred.set(rec.credentialIdB64, {
            ...rec,
            accountId: rec.accountId || v.id,
            accountName: rec.accountName || fullName,
          });
        }
      }
    }
  }
  for (const rec of getLocalPasskeys()) {
    const prev = byCred.get(rec.credentialIdB64);
    byCred.set(rec.credentialIdB64, prev ? { ...prev, ...rec } : rec);
  }
  return Array.from(byCred.values());
}

function parseClientDataJSON(buffer: ArrayBuffer): {
  type?: string;
  challenge?: string;
  origin?: string;
} | null {
  try {
    const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function registerAccountPasskey(params: {
  accountId: string;
  accountName: string;
  roleScope: 'volontario' | 'centrale' | 'admin';
  label?: string;
  existingCredentialIds?: string[];
}): Promise<{ ok: true; record: PasskeyRecord } | { ok: false; error: string }> {
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error:
        'Questo browser o contesto non supporta le Passkey WebAuthn (richiede HTTPS e un browser aggiornato).',
    };
  }

  const rpId = window.location.hostname;
  const challengeBytes = generateRandomChallenge();
  const expectedChallengeB64 = uint8ArrayToBase64Url(challengeBytes);
  const userIdBytes = new TextEncoder().encode(`croceoro:${params.accountId}`).slice(0, 64);

  const excludeCredentials: PublicKeyCredentialDescriptor[] = (params.existingCredentialIds || [])
    .filter(Boolean)
    .map((idB64) => ({
      type: 'public-key',
      id: toArrayBuffer(base64UrlToUint8Array(idB64)),
    }));

  const buildCreationOptions = (preferPlatform: boolean): CredentialCreationOptions => ({
    publicKey: {
      challenge: toArrayBuffer(challengeBytes),
      rp: {
        name: 'Croce Oro Massa Carrara ODV',
        id: rpId,
      },
      user: {
        id: toArrayBuffer(userIdBytes),
        name: `${params.accountName} (${params.accountId})`,
        displayName: params.accountName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      excludeCredentials,
      authenticatorSelection: preferPlatform
        ? {
            authenticatorAttachment: 'platform',
            residentKey: 'preferred',
            userVerification: 'required',
          }
        : {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
      timeout: 60000,
      attestation: 'none',
    },
  });

  let cred: Credential | null = null;
  try {
    cred = await navigator.credentials.create(buildCreationOptions(true));
  } catch (err: any) {
    const errName = String(err?.name || '');
    // Se il dispositivo non dispone di sensore biometrico locale, riprova con passkey sincronizzate / chiave esterna
    if (errName === 'NotSupportedError' || errName === 'ConstraintError' || errName === 'SecurityError') {
      try {
        cred = await navigator.credentials.create(buildCreationOptions(false));
      } catch (err2: any) {
        return { ok: false, error: formatWebAuthnError(err2, 'registrazione') };
      }
    } else {
      return { ok: false, error: formatWebAuthnError(err, 'registrazione') };
    }
  }

  if (!cred || cred.type !== 'public-key') {
    return { ok: false, error: 'Creazione Passkey annullata o non completata.' };
  }

  const pkCred = cred as PublicKeyCredential;
  const response = pkCred.response as AuthenticatorAttestationResponse;
  const clientData = parseClientDataJSON(response.clientDataJSON);

  if (
    !clientData ||
    clientData.type !== 'webauthn.create' ||
    clientData.origin !== window.location.origin ||
    clientData.challenge !== expectedChallengeB64
  ) {
    return {
      ok: false,
      error: 'Verifica crittografica della nuova Passkey non superata. Riprova.',
    };
  }

  const credentialIdB64 = uint8ArrayToBase64Url(new Uint8Array(pkCred.rawId));
  const transports =
    typeof response.getTransports === 'function' ? response.getTransports() : undefined;
  const deviceHint = detectDeviceHint();
  const cleanLabel = (params.label || '').trim() || deviceHint;

  const record: PasskeyRecord = {
    id: `pk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    credentialIdB64,
    label: cleanLabel,
    accountId: params.accountId,
    accountName: params.accountName,
    roleScope: params.roleScope,
    createdAt: formatDateTimeItaly(undefined, false),
    deviceHint,
    transports,
  };

  upsertLocalPasskey(record);
  return { ok: true, record };
}

export async function authenticateWithPasskey(params: {
  allowedRecords: PasskeyRecord[];
  expectedAccountId?: string;
}): Promise<{ ok: true; record: PasskeyRecord } | { ok: false; error: string }> {
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error: 'Il browser attuale non supporta l\'accesso con Passkey (Impronta / Face ID).',
    };
  }

  const candidates = params.expectedAccountId
    ? params.allowedRecords.filter((r) => r.accountId === params.expectedAccountId)
    : params.allowedRecords;

  if (candidates.length === 0) {
    return {
      ok: false,
      error:
        'Nessuna Passkey configurata per questo account. Accedi prima con il PIN e crea una Passkey in Strumenti → Profilo.',
    };
  }

  const challengeBytes = generateRandomChallenge();
  const expectedChallengeB64 = uint8ArrayToBase64Url(challengeBytes);

  const allowCredentials: PublicKeyCredentialDescriptor[] = candidates.map((rec) => ({
    type: 'public-key',
    id: toArrayBuffer(base64UrlToUint8Array(rec.credentialIdB64)),
    ...(Array.isArray(rec.transports) && rec.transports.length > 0
      ? { transports: rec.transports as AuthenticatorTransport[] }
      : {}),
  }));

  let assertion: Credential | null = null;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge: toArrayBuffer(challengeBytes),
        rpId: window.location.hostname,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000,
      },
    });
  } catch (err: any) {
    return { ok: false, error: formatWebAuthnError(err, 'accesso') };
  }

  if (!assertion || assertion.type !== 'public-key') {
    return { ok: false, error: 'Verifica biometrica annullata.' };
  }

  const pkAssertion = assertion as PublicKeyCredential;
  const response = pkAssertion.response as AuthenticatorAssertionResponse;
  const clientData = parseClientDataJSON(response.clientDataJSON);

  if (
    !clientData ||
    clientData.type !== 'webauthn.get' ||
    clientData.origin !== window.location.origin ||
    clientData.challenge !== expectedChallengeB64
  ) {
    return {
      ok: false,
      error: 'Verifica di sicurezza Passkey non valida per questo dominio.',
    };
  }

  const returnedCredIdB64 = uint8ArrayToBase64Url(new Uint8Array(pkAssertion.rawId));
  const matched = candidates.find((r) => r.credentialIdB64 === returnedCredIdB64);

  if (!matched) {
    return {
      ok: false,
      error: 'La Passkey utilizzata non corrisponde a nessun account abilitato.',
    };
  }

  const updated: PasskeyRecord = {
    ...matched,
    lastUsedAt: formatDateTimeItaly(undefined, false),
  };
  upsertLocalPasskey(updated);

  return { ok: true, record: updated };
}

function formatWebAuthnError(err: any, fase: 'registrazione' | 'accesso'): string {
  const name = String(err?.name || '');
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return fase === 'registrazione'
      ? 'Creazione Passkey annullata o scaduta. Conferma con Impronta Digitale / Face ID quando richiesto dal dispositivo.'
      : 'Verifica biometrica annullata o non riconosciuta. Riprova oppure accedi con il PIN.';
  }
  if (name === 'InvalidStateError') {
    return 'Una Passkey per questo account è già registrata su questo dispositivo.';
  }
  if (name === 'SecurityError') {
    return 'Passkey non disponibile in questo contesto di rete (richiede connessione protetta HTTPS).';
  }
  return `Operazione Passkey non completata (${err?.message || name || 'errore sconosciuto'}).`;
}

export async function saveCredentialsToPasswordManager(
  username: string,
  password: string,
  displayName?: string
): Promise<'saved' | 'unsupported'> {
  if (typeof window === 'undefined' || !username.trim() || !password.trim()) {
    return 'unsupported';
  }
  try {
    const PasswordCredentialCtor = (window as any).PasswordCredential;
    if (
      typeof PasswordCredentialCtor === 'function' &&
      navigator.credentials &&
      typeof navigator.credentials.store === 'function'
    ) {
      const cred = new PasswordCredentialCtor({
        id: username.trim(),
        password: password.trim(),
        name: displayName?.trim() || username.trim(),
      });
      await navigator.credentials.store(cred);
      return 'saved';
    }
  } catch {
    // Alcuni browser (es. Safari/Firefox) usano solo il prompt nativo su submit <form>
  }
  return 'unsupported';
}
