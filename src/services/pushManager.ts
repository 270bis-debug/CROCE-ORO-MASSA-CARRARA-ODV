// Gestore Registrazione Service Worker e Sottoscrizione Notifiche Push
// Garantisce che il telefono riceva gli allarmi anche a schermo spento / app in background

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

export async function attivaServiceWorkerEPush(
  ruolo: 'volontario' | 'admin',
  volontarioId?: string,
  volontarioNome?: string
): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  if (typeof window === 'undefined') {
    return { supported: false, permission: 'denied', subscribed: false };
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
    return { supported: false, permission: 'denied', subscribed: false };
  }

  // 2. Richiesta autorizzazione Notifiche se non già garantita
  let permission = Notification.permission;
  if (permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch (e) {
      console.error('[Push] Errore richiesta permesso notifiche:', e);
    }
  }

  if (permission !== 'granted') {
    return { supported: true, permission, subscribed: false };
  }

  try {
    // 3. Registra il Service Worker /sw.js
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    await navigator.serviceWorker.ready;

    // 4. Recupera la chiave pubblica VAPID dal server
    let vapidKey = '';
    try {
      const res = await fetch('/api/vapid-public-key');
      if (res.ok) {
        const json = await res.json();
        vapidKey = json.publicKey;
      }
    } catch (e) {
      console.warn('[Push] Impossibile recuperare chiave VAPID dal server:', e);
    }

    if (!vapidKey || !('PushManager' in window)) {
      return { supported: true, permission, subscribed: false };
    }

    // 5. Verifica o crea la sottoscrizione Push
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource
      });
    }

    // 6. Invia la sottoscrizione al server Express
    if (subscription) {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: ruolo,
          volontarioId: effectiveVolId,
          volontarioNome: effectiveVolNome,
          subscription: subscription.toJSON()
        })
      });
      console.log(`[Push] Sottoscrizione Push registrata con successo sul server per ruolo: ${ruolo}${effectiveVolId ? ` (volId: ${effectiveVolId})` : ''}`);
      return { supported: true, permission, subscribed: true };
    }
  } catch (err) {
    console.error('[Push] Errore durante registrazione push:', err);
  }

  return { supported: true, permission, subscribed: false };
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
