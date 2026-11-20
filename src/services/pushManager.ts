// Gestore Registrazione Service Worker e Sottoscrizione Notifiche Push
// Garantisce che il telefono riceva gli allarmi anche a schermo spento / app in background

import { realtime } from './realtime';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isRunningInEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

let currentPushEndpoint: string = '';

export function getCurrentPushEndpoint(): string {
  if (currentPushEndpoint) return currentPushEndpoint;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('CROCE_ORO_PUSH_ENDPOINT') || '';
      if (saved) {
        currentPushEndpoint = saved;
        return saved;
      }
    } catch {}
  }
  return '';
}

function saveCurrentPushEndpoint(endpoint: string) {
  currentPushEndpoint = endpoint || '';
  if (typeof window !== 'undefined') {
    try {
      if (endpoint) {
        localStorage.setItem('CROCE_ORO_PUSH_ENDPOINT', endpoint);
      } else {
        localStorage.removeItem('CROCE_ORO_PUSH_ENDPOINT');
      }
    } catch {}
  }
}

function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function getPushSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  inIframe: boolean;
  endpoint?: string;
}> {
  const inIframe = isRunningInEmbeddedIframe();
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return { supported: false, permission: 'denied', subscribed: false, inIframe };
  }
  const permission = Notification.permission;
  if (permission !== 'granted' || !('PushManager' in window)) {
    return { supported: 'PushManager' in window, permission, subscribed: false, inIframe };
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub?.endpoint) {
      saveCurrentPushEndpoint(sub.endpoint);
    }
    return { supported: true, permission, subscribed: Boolean(sub), inIframe, endpoint: sub?.endpoint };
  } catch {
    return { supported: true, permission, subscribed: false, inIframe };
  }
}

export async function attivaServiceWorkerEPush(
  ruolo: 'volontario' | 'admin',
  volontarioId?: string,
  volontarioNome?: string,
  options?: { silentOnly?: boolean }
): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  inIframe?: boolean;
  endpoint?: string;
  reason?: string;
}> {
  const inIframe = isRunningInEmbeddedIframe();
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'denied', subscribed: false, inIframe };
  }

  if (volontarioId) {
    try { localStorage.setItem('CROCE_ORO_SUBSCRIBED_VOL_ID', volontarioId); } catch {}
  }
  if (volontarioNome) {
    try { localStorage.setItem('CROCE_ORO_SUBSCRIBED_VOL_NOME', volontarioNome); } catch {}
  }
  const effectiveVolId = volontarioId || (typeof window !== 'undefined' ? localStorage.getItem('CROCE_ORO_SUBSCRIBED_VOL_ID') || undefined : undefined);
  const effectiveVolNome = volontarioNome || (typeof window !== 'undefined' ? localStorage.getItem('CROCE_ORO_SUBSCRIBED_VOL_NOME') || undefined : undefined);

  // 1. Verifica supporto Service Worker e Notifiche
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[Push] Service Worker o Notifiche non supportate su questo browser.');
    return { supported: false, permission: 'denied', subscribed: false, inIframe, reason: 'not_supported' };
  }

  // 2. Richiesta autorizzazione Notifiche se non già garantita (salta prompt se silentOnly)
  let permission = Notification.permission;
  if (permission !== 'granted' && !options?.silentOnly) {
    try {
      permission = await Notification.requestPermission();
    } catch (e) {
      console.error('[Push] Errore richiesta permesso notifiche:', e);
    }
  }

  if (permission !== 'granted') {
    return {
      supported: true,
      permission,
      subscribed: false,
      inIframe,
      reason: inIframe ? 'blocked_in_iframe' : 'permission_denied'
    };
  }

  try {
    // 3. Registra il Service Worker /sw.js
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    await navigator.serviceWorker.ready;

    // 4. Recupera la chiave pubblica VAPID dal backend Push (funziona anche da domini statici/Vercel e reti esterne)
    const pushBackendBase = realtime.getPushBackendBaseUrl();
    const candidateBases = Array.from(
      new Set([pushBackendBase, realtime.getApiBaseUrl(), ''].map((b) => String(b || '').replace(/\/$/, '')))
    );

    let vapidKey = '';
    let activePushBase = pushBackendBase;
    for (const base of candidateBases) {
      try {
        const res = await fetch(`${base}/api/vapid-public-key`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json.publicKey === 'string' && json.publicKey.length > 20) {
            vapidKey = json.publicKey;
            activePushBase = base;
            break;
          }
        }
      } catch {}
    }

    if (!vapidKey || !('PushManager' in window)) {
      return {
        supported: true,
        permission,
        subscribed: false,
        inIframe,
        reason: !('PushManager' in window) ? 'no_push_manager' : 'no_vapid_key'
      };
    }

    // 5. Verifica o crea la sottoscrizione Push (controllando che la chiave VAPID coincida!)
    const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        const existingKeyBuf = subscription.options?.applicationServerKey;
        if (existingKeyBuf) {
          const existingBytes = new Uint8Array(existingKeyBuf);
          if (!uint8ArraysEqual(existingBytes, convertedVapidKey)) {
            await subscription.unsubscribe().catch(() => {});
            subscription = null;
          }
        }
      } catch {}
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource
      });
    }

    // 6. Invia la sottoscrizione al backend Push (e al server locale se diverso)
    if (subscription) {
      saveCurrentPushEndpoint(subscription.endpoint);
      const subBody = JSON.stringify({
        role: ruolo,
        volontarioId: effectiveVolId,
        volontarioNome: effectiveVolNome,
        subscription: subscription.toJSON()
      });

      const registerTargets = Array.from(
        new Set([activePushBase, pushBackendBase, realtime.getApiBaseUrl()].filter((x) => typeof x === 'string'))
      );
      let registeredOk = false;
      for (const base of registerTargets) {
        try {
          const cleanBase = base.replace(/\/$/, '');
          const resp = await fetch(`${cleanBase}/api/push-subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: subBody,
            cache: 'no-store'
          });
          if (resp.ok) registeredOk = true;
        } catch {}
      }

      console.log(`[Push] Sottoscrizione Push registrata (${registeredOk ? 'OK' : 'WARN'}) per ruolo: ${ruolo}${effectiveVolId ? ` (volId: ${effectiveVolId})` : ''}`);
      return { supported: true, permission, subscribed: registeredOk, inIframe, endpoint: subscription.endpoint };
    }
  } catch (err) {
    console.error('[Push] Errore durante registrazione push:', err);
  }

  return { supported: true, permission, subscribed: false, inIframe, reason: 'subscribe_error' };
}

export async function inviaTestPushRadioLocale(): Promise<{ ok: boolean; error?: string }> {
  const endpoint = getCurrentPushEndpoint();
  if (!endpoint) {
    return { ok: false, error: 'Sottoscrizione Push non ancora registrata su questo dispositivo.' };
  }
  const pushBase = realtime.getPushBackendBaseUrl().replace(/\/$/, '');
  try {
    const res = await fetch(`${pushBase}/api/push-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || `Errore server Push (${res.status})` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Impossibile contattare il server Push.' };
  }
}

// Mostra una notifica nativa di sistema immediata
export function mostraNotificaNativa(titolo: string, opzioni?: any) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      // Se c'è un service worker attivo, usa showNotification (funziona anche in background)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(titolo, {
            icon: '/icon-192-v2.png',
            badge: '/icon-192-v2.png',
            vibrate: [600, 200, 600, 200, 1000],
            requireInteraction: true,
            ...opzioni
          } as any);
        });
      } else {
        new Notification(titolo, {
          icon: '/icon-192-v2.png',
          ...opzioni
        } as any);
      }
    } catch (e) {
      console.warn('[Notifica] Errore display notifica:', e);
    }
  }
}
