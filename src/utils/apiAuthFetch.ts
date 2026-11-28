// Automatic authenticated headers for same-origin /api/* calls
// Attaches either Firebase Auth ID Token (Bearer) OR PIN-verified Volunteer headers
// (X-Croce-Oro-Vol-Id + X-Croce-Oro-Pin-Hash) so serverless email & Web Push routes
// authenticate both Centrale/Admin operators and PIN-only volunteer smartphones.

import { auth, getCachedVolunteerPinHashes } from '../services/firebase';

let interceptorInstalled = false;

function readActiveVolunteerIdFromStorage(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    // 1. Active volunteer profile stored by App.tsx
    const rawActive = localStorage.getItem('CROCE_ORO_VOLONTARIO_LOGGATO');
    if (rawActive) {
      const parsed = JSON.parse(rawActive);
      const id = String(parsed?.id || '').trim();
      if (id && id !== 'vol-admin' && id !== 'admin-centrale-root') return id;
    }
  } catch {}
  try {
    const rawSub = String(localStorage.getItem('CROCE_ORO_SUBSCRIBED_VOL_ID') || '').trim();
    if (rawSub && rawSub !== 'vol-admin' && rawSub !== 'admin-centrale-root') return rawSub;
  } catch {}
  return '';
}

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // 1. Firebase Auth ID Token (for Google-signed Admin / Centrale Operator terminals)
  try {
    const user = auth.currentUser;
    if (user && user.emailVerified) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        return headers;
      }
    }
  } catch {}

  // 2. PIN-verified volunteer credentials (for PIN-only smartphones)
  try {
    const volId = readActiveVolunteerIdFromStorage();
    if (volId) {
      const hashes = getCachedVolunteerPinHashes(volId);
      if (hashes.length > 0) {
        headers['X-Croce-Oro-Vol-Id'] = volId;
        headers['X-Croce-Oro-Pin-Hash'] = hashes[0];
      }
    }
  } catch {}

  return headers;
}

function isProtectedSameOriginApiRequest(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (!rawUrl) return false;
    const parsed = new URL(rawUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) return false;
    return parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const nativeFetch = window.fetch.bind(window);
  if (!isProtectedSameOriginApiRequest(input)) {
    return nativeFetch(input, init);
  }
  try {
    const existingHeaders = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    const alreadyHasAuth =
      existingHeaders.has('Authorization') ||
      (existingHeaders.has('X-Croce-Oro-Vol-Id') && existingHeaders.has('X-Croce-Oro-Pin-Hash'));

    if (!alreadyHasAuth) {
      const authHeaders = await getApiAuthHeaders();
      for (const [k, v] of Object.entries(authHeaders)) {
        if (v && !existingHeaders.has(k)) {
          existingHeaders.set(k, v);
        }
      }
    }

    const nextInit: RequestInit = {
      ...(init || {}),
      headers: existingHeaders,
    };
    return nativeFetch(input, nextInit);
  } catch {
    return nativeFetch(input, init);
  }
}

export function installApiAuthFetchInterceptor(): void {
  if (typeof window === 'undefined' || interceptorInstalled || typeof window.fetch !== 'function') {
    return;
  }
  interceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  const wrappedFetch: typeof window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    if (!isProtectedSameOriginApiRequest(input)) {
      return originalFetch(input, init);
    }

    try {
      const existingHeaders = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      const alreadyHasAuth =
        existingHeaders.has('Authorization') ||
        (existingHeaders.has('X-Croce-Oro-Vol-Id') && existingHeaders.has('X-Croce-Oro-Pin-Hash'));

      if (!alreadyHasAuth) {
        const authHeaders = await getApiAuthHeaders();
        for (const [k, v] of Object.entries(authHeaders)) {
          if (v && !existingHeaders.has(k)) {
            existingHeaders.set(k, v);
          }
        }
      }

      const nextInit: RequestInit = {
        ...(init || {}),
        headers: existingHeaders,
      };
      return originalFetch(input, nextInit);
    } catch {
      return originalFetch(input, init);
    }
  };

  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (desc && !desc.writable) {
      if (desc.configurable) {
        Object.defineProperty(window, 'fetch', {
          value: wrappedFetch,
          configurable: true,
          writable: true,
          enumerable: desc.enumerable ?? true,
        });
      }
      // Se window.fetch è non-writable e non-configurable (es. sandbox WebView), non bloccare mai l'avvio
      return;
    }
    window.fetch = wrappedFetch;
  } catch {
    try {
      Object.defineProperty(window, 'fetch', {
        value: wrappedFetch,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fallback silenzioso: non interrompere mai il boot dell'app
    }
  }
}
