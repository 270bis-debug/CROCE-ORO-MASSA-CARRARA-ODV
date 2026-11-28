// Shared server-side authentication, strict CORS, and safe JSON body parsing
// Used by Vercel serverless routes (/api/push-send, /api/push-test, /api/[...slug])
import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import firebaseConfig from '../firebase-applet-config.json';

export interface VerifiedApiCaller {
  authorized: boolean;
  kind: 'firebase_operator' | 'pin_volunteer' | 'none';
  uid?: string;
  email?: string;
  volontarioId?: string;
  reason?: string;
}

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://www.croceoro.org',
  'https://croceoro.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function isAllowedOrigin(origin: string, hostHeader: string): boolean {
  if (!origin) return true; // same-origin navigation / non-CORS call
  const clean = origin.trim().replace(/\/$/, '');
  if (ALLOWED_EXACT_ORIGINS.has(clean)) return true;
  try {
    const parsed = new URL(clean);
    if (hostHeader && parsed.host.toLowerCase() === hostHeader.toLowerCase()) {
      return true;
    }
    const h = parsed.hostname.toLowerCase();
    if (
      h.endsWith('.croceoro.org') ||
      h.endsWith('.run.app') ||
      h.endsWith('.vercel.app') ||
      h === 'localhost' ||
      h === '127.0.0.1'
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function applyStrictCors(
  req: IncomingMessage,
  res: ServerResponse,
  allowedMethods: string = 'POST, OPTIONS'
): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const host = typeof req.headers.host === 'string' ? req.headers.host.trim() : '';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Croce-Oro-Vol-Id, X-Croce-Oro-Pin-Hash, X-Requested-With'
  );

  if (origin) {
    if (!isAllowedOrigin(origin, host)) {
      return false;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  return true;
}

export async function readJsonBody(
  req: IncomingMessage & { body?: any },
  maxBytes: number = 512_000
): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk || '');
      if (raw.length > maxBytes) {
        try {
          req.destroy();
        } catch {}
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// In-memory short TTL caches (warm serverless instance optimization)
const tokenCache = new Map<string, { uid: string; email: string; expMs: number }>();
let rosterCache: { entries: Map<string, string>; expMs: number } | null = null;

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length !== 64) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email: string } | null> {
  const clean = idToken.trim();
  if (clean.length < 20 || clean.length > 4096) return null;

  const cacheKey = crypto.createHash('sha256').update(clean).digest('hex');
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expMs > Date.now()) {
    return { uid: cached.uid, email: cached.email };
  }

  const apiKey = firebaseConfig?.apiKey;
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: clean }),
      }
    );
    if (!resp.ok) return null;
    const json: any = await resp.json().catch(() => null);
    const user = Array.isArray(json?.users) ? json.users[0] : null;
    if (!user?.localId || user.disabled) return null;
    const result = {
      uid: String(user.localId),
      email: String(user.email || ''),
    };
    tokenCache.set(cacheKey, { ...result, expMs: Date.now() + 60_000 });
    if (tokenCache.size > 100) {
      const oldest = tokenCache.keys().next().value;
      if (oldest) tokenCache.delete(oldest);
    }
    return result;
  } catch {
    return null;
  }
}

async function loadPublicRosterPinHashes(): Promise<Map<string, string>> {
  if (rosterCache && rosterCache.expMs > Date.now()) {
    return rosterCache.entries;
  }
  const map = new Map<string, string>();
  const projectId = firebaseConfig?.projectId;
  const dbId = firebaseConfig?.firestoreDatabaseId || '(default)';
  if (!projectId) return map;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/public_roster/volunteers_v1`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) return map;
    const doc: any = await resp.json().catch(() => null);
    const values = doc?.fields?.entries?.arrayValue?.values;
    if (Array.isArray(values)) {
      for (const item of values) {
        const f = item?.mapValue?.fields;
        const id = typeof f?.id?.stringValue === 'string' ? f.id.trim() : '';
        const pinHash = typeof f?.pinHash?.stringValue === 'string' ? f.pinHash.trim().toLowerCase() : '';
        if (id && /^[0-9a-f]{64}$/.test(pinHash)) {
          map.set(id, pinHash);
        }
      }
    }
    rosterCache = { entries: map, expMs: Date.now() + 60_000 };
  } catch {}
  return map;
}

export async function verifyApiCaller(req: IncomingMessage): Promise<VerifiedApiCaller> {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    if (verified) {
      return {
        authorized: true,
        kind: 'firebase_operator',
        uid: verified.uid,
        email: verified.email,
      };
    }
  }

  const volIdRaw = req.headers['x-croce-oro-vol-id'];
  const pinHashRaw = req.headers['x-croce-oro-pin-hash'];
  const volId = typeof volIdRaw === 'string' ? volIdRaw.trim() : '';
  const pinHash = typeof pinHashRaw === 'string' ? pinHashRaw.trim().toLowerCase() : '';

  if (volId && /^[a-zA-Z0-9_\-]{1,128}$/.test(volId) && /^[0-9a-f]{64}$/.test(pinHash)) {
    const roster = await loadPublicRosterPinHashes();
    const expected = roster.get(volId);
    if (expected && timingSafeHexEqual(pinHash, expected)) {
      return {
        authorized: true,
        kind: 'pin_volunteer',
        volontarioId: volId,
      };
    }
  }

  return {
    authorized: false,
    kind: 'none',
    reason: 'Autenticazione richiesta (sessione operatore o verifica PIN volontario).',
  };
}
