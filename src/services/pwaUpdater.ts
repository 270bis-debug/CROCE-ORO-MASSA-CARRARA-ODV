import { useState, useEffect } from 'react';
import { APP_VERSION } from '../version';
import { BUILD_INFO } from '../buildInfo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface VersionInfo {
  version: string;
  buildId?: string;
  buildTimestamp?: number;
  builtAt?: string;
}

let isCheckInProgress = false;
let isUpdating = false;
let pendingUpdateInfo: VersionInfo | null = null;

const STORAGE_LAST_RELOAD_TIME = 'CROCE_ORO_PWA_LAST_RELOAD_TIME';
const STORAGE_LAST_RELOAD_VERSION = 'CROCE_ORO_PWA_LAST_RELOAD_VERSION';
const STORAGE_LAST_APPLIED_BUILD = 'CROCE_ORO_PWA_LAST_APPLIED_BUILD';

/**
 * Confronta due versioni semantiche X.Y.Z in modo rigorosamente numerico.
 * Ritorna: > 0 se `a > b`, < 0 se `a < b`, 0 se uguali.
 */
export function compareSemver(a: string, b: string): number {
  const pa = String(a || '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').trim().split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < maxLen; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * Verifica se la Centrale Operativa o il Terminale di Bordo sono impegnati
 * in operazioni critiche (compilazione scheda missione, firma su canvas, modale aperta o sirena attiva).
 * In questi casi il ricaricamento forzato viene sospeso per non interrompere il servizio di soccorso.
 */
export function isOperazioneCriticaAttiva(): boolean {
  if (typeof document === 'undefined') return false;

  try {
    // 1. Utente sta digitando su un input, textarea o form attivo
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
      return true;
    }

    // 2. Modali di dialogo aperte (scheda viaggio, checklist, firma, etc.)
    const dialogs = document.querySelectorAll('[role="dialog"], .modal-active');
    if (dialogs.length > 0) {
      return true;
    }

    // 3. Canvas di firma operatore o cittadino in corso
    const canvasFirma = document.querySelector('canvas');
    if (canvasFirma && canvasFirma.getAttribute('data-signing') === 'true') {
      return true;
    }

    // 4. Sirena di emergenza in riproduzione o allarme rosso attivo
    if ((window as any).__CROCE_ORO_ALLARME_IN_CORSO__ === true) {
      return true;
    }
  } catch (e) {
    console.warn('[PWA Updater] Errore verifica operazione critica:', e);
  }

  return false;
}

/**
 * Recupera le informazioni della versione pubblicata sul server o CDN Vercel.
 * Include gestione fallback a /version.json ed esclude tassativamente errori di rete o 404
 * come falsi positivi di aggiornamento.
 */
export async function fetchPublishedVersion(): Promise<VersionInfo | null> {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const endpoints = [
    `/api/version?t=${nonce}`,
    `/version.json?t=${nonce}`
  ];

  let bestInfo: VersionInfo | null = null;

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      // Gestione 404 e codici HTTP diversi da 200: non considerare come aggiornamento riuscito!
      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json') && !contentType.includes('text/plain')) {
        continue;
      }

      const data = await response.json();
      if (data && typeof data.version === 'string' && /^\d+\.\d+\.\d+/.test(data.version)) {
        const candidate: VersionInfo = {
          version: data.version,
          buildId: data.buildId,
          buildTimestamp: data.buildTimestamp,
          builtAt: data.builtAt
        };
        if (!bestInfo) {
          bestInfo = candidate;
        } else {
          const cmp = compareSemver(candidate.version, bestInfo.version);
          if (cmp > 0 || (cmp === 0 && Number(candidate.buildTimestamp || 0) > Number(bestInfo.buildTimestamp || 0))) {
            bestInfo = candidate;
          }
        }
        // Se questo endpoint restituisce già una versione >= APP_VERSION, non serve interrogare oltre
        if (compareSemver(candidate.version, APP_VERSION) >= 0) {
          return bestInfo;
        }
      }
    } catch {
      // Prosegui al fallback successivo
    }
  }

  return bestInfo;
}

/**
 * Esegue la pulizia selettiva ESCLUSIVAMENTE delle vecchie cache dell'applicazione.
 * NON tocca mai IndexedDB, LocalStorage, sessioni utente, PIN, o dati missioni operative!
 */
export async function pulisciCacheObsolete(targetVersion: string, purgeAllAppCaches: boolean = false) {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const keys = await caches.keys();
    const currentCacheName = `croce-oro-cache-v${targetVersion}`;

    const obsoleteKeys = keys.filter(
      (k) => k.startsWith('croce-oro-cache-') && (purgeAllAppCaches || k !== currentCacheName)
    );

    if (obsoleteKeys.length > 0) {
      console.log(`[PWA Updater] Rimozione selettiva di ${obsoleteKeys.length} cache obsolete:`, obsoleteKeys);
      await Promise.all(obsoleteKeys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('[PWA Updater] Errore pulizia selettiva cache:', err);
  }
}

/**
 * Applica l'aggiornamento dell'applicazione in sicurezza, evitando loop di reload
 * e senza interrompere operazioni attive in Centrale Operativa.
 */
export async function applicaAggiornamento(targetVersion: string, forzato: boolean = false): Promise<boolean> {
  if (isUpdating) return false;

  // Blocco tassativo anti-downgrade: non applicare MAI una versione precedente a quella già installata
  const isBuildIdKey = targetVersion.startsWith('croce-oro-');
  if (!isBuildIdKey && /^\d+\.\d+\.\d+/.test(targetVersion) && compareSemver(targetVersion, APP_VERSION) < 0) {
    console.log(`[PWA Updater] Bloccato tentativo di downgrade v${targetVersion} < locale v${APP_VERSION}.`);
    return false;
  }

  // Protezione anti-loop di reload (minimo 45 secondi tra due ricaricamenti automatici)
  try {
    const lastTime = Number(sessionStorage.getItem(STORAGE_LAST_RELOAD_TIME) || 0);
    const lastVersion = sessionStorage.getItem(STORAGE_LAST_RELOAD_VERSION) || '';
    const now = Date.now();

    if (!forzato && lastVersion === targetVersion && (now - lastTime) < 45000) {
      console.log(`[PWA Updater] Versione v${targetVersion} già ricaricata di recente. Evitato reload loop.`);
      return false;
    }
  } catch {}

  // Se c'è un'operazione attiva e non è forzato, posponi al completamento
  if (!forzato && isOperazioneCriticaAttiva()) {
    console.log(`[PWA Updater] Operazione critica in corso in Centrale/Mezzo. Aggiornamento a v${targetVersion} posticipato.`);
    return false;
  }

  isUpdating = true;
  console.log(`[PWA Updater] Applicazione aggiornamento a v${targetVersion}...`);

  try {
    sessionStorage.setItem(STORAGE_LAST_RELOAD_TIME, String(Date.now()));
    sessionStorage.setItem(STORAGE_LAST_RELOAD_VERSION, targetVersion);
    if (isBuildIdKey) {
      sessionStorage.setItem(STORAGE_LAST_APPLIED_BUILD, targetVersion);
    }
  } catch {}

  // Pulizia selettiva delle cache dell'applicazione (svuota tutte le cache app se cambio build a parità di versione)
  await pulisciCacheObsolete(isBuildIdKey ? APP_VERSION : targetVersion, isBuildIdKey);

  // Forza skipWaiting sul Service Worker se presente
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch {}
  }

  // Ricarica la finestra
  setTimeout(() => {
    window.location.reload();
  }, 250);

  return true;
}

/**
 * Verifica se sul server o Vercel è stata rilasciata una nuova versione.
 */
export async function checkForAppUpdate(): Promise<boolean> {
  if (typeof window === 'undefined' || isCheckInProgress || isUpdating) return false;

  isCheckInProgress = true;

  try {
    // 1. Chiedi al Service Worker di verificare eventuali byte-changes su /sw.js
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      } catch {}
    }

    // 2. Interroga l'endpoint di versione pubblicato
    const info = await fetchPublishedVersion();

    // Se l'endpoint non risponde o dà 404 o errore di rete, NON considerare aggiornamento riuscito!
    if (!info) {
      isCheckInProgress = false;
      return false;
    }

    const versionCmp = compareSemver(info.version, APP_VERSION);

    // Se l'endpoint/CDN ha restituito una versione PRECEDENTE (stale cache o build non sincronizzato),
    // ignorala tassativamente: non invitare mai il dispositivo a tornare indietro di versione!
    if (versionCmp < 0) {
      console.log(
        `[PWA Updater] Ignorata risposta con versione precedente v${info.version} rispetto alla locale v${APP_VERSION}.`
      );
      isCheckInProgress = false;
      return false;
    }

    let lastAppliedBuild = '';
    try {
      lastAppliedBuild = sessionStorage.getItem(STORAGE_LAST_APPLIED_BUILD) || '';
    } catch {}

    const hasNewVersion = versionCmp > 0;
    const hasNewSameVersionBuild = Boolean(
      !import.meta.env.DEV &&
      versionCmp === 0 &&
      info.buildId &&
      BUILD_INFO.buildId &&
      info.buildId !== BUILD_INFO.buildId &&
      info.buildId !== lastAppliedBuild &&
      Number(info.buildTimestamp || 0) > Number(BUILD_INFO.buildTimestamp || 0) + 15000
    );

    if (hasNewVersion || hasNewSameVersionBuild) {
      const targetKey = hasNewVersion ? info.version : (info.buildId || info.version);
      console.log(
        `[PWA Updater] Rilevata nuova release v${info.version} (build ${info.buildId || '-'} vs locale v${APP_VERSION} / ${BUILD_INFO.buildId}).`
      );
      pendingUpdateInfo = info;

      // Invia un evento Custom su window affinché l'interfaccia possa mostrare un badge discreto se desiderato
      window.dispatchEvent(
        new CustomEvent('croce-oro-nuova-release', {
          detail: info
        })
      );

      const applicato = await applicaAggiornamento(targetKey, false);
      isCheckInProgress = false;
      return applicato;
    }
  } catch (err) {
    console.warn('[PWA Updater] Errore durante il controllo versione:', err);
  } finally {
    isCheckInProgress = false;
  }

  return false;
}

/**
 * Inizializza il gestore del Service Worker e dell'auto-aggiornamento per PWA
 */
export function initPWAUpdater() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          // Controllo aggiornamento all'avvio
          registration.update().catch(() => {});

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA Updater] Nuovo Service Worker installato, richiesta attivazione...');
                  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                }
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA Updater] Registrazione Service Worker non riuscita:', err);
        });

      // Gestione controllerchange: quando il nuovo worker prende il controllo
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing || isUpdating) return;

        // Se è in corso un'operazione critica in Centrale, attendi
        if (isOperazioneCriticaAttiva()) {
          console.log('[PWA Updater] Nuovo Service Worker attivato, ma operazione critica in corso: reload posticipato.');
          return;
        }

        refreshing = true;
        console.log('[PWA Updater] Nuovo controller attivo. Ricaricamento applicazione...');
        window.location.reload();
      });

      // Ascolto messaggi inviati da /sw.js
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_VERSION_ACTIVATED') {
          console.log(`[PWA Updater] Service Worker versione attivata: ${event.data.version}`);
        }
      });
      // Controllo versione immediato subito dopo l'avvio (fondamentale su iPhone/Android PWA)
      setTimeout(() => {
        checkForAppUpdate();
      }, 1500);
    });

    // Controllo quando l'utente riprende l'app (risveglio schermo, cambio app, ritorno da background su iOS/Android)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdate();
      }
    });

    window.addEventListener('focus', () => {
      checkForAppUpdate();
    });

    // Controllo periodico programmato ogni 10 minuti
    setInterval(() => {
      checkForAppUpdate();
    }, 10 * 60 * 1000);
  }
}

/**
 * Hook per gestire l'installazione in-app sia su Android che su Apple iOS
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
    pendingUpdate: pendingUpdateInfo
  };
}
