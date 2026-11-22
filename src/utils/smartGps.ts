import { PosizioneGPS } from '../components/MappaOperativa';
import { formatTimeItaly } from './italianTime';

export function isAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ può segnalare "Macintosh" con schermo touch
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

export type SmartGpsResult =
  | {
      ok: true;
      posizione: PosizioneGPS;
      isCoarseIos: boolean;
      usedFallback: boolean;
    }
  | {
      ok: false;
      code: number;
      error: string;
      isPermissionDenied: boolean;
    };

export interface SmartGpsOptions {
  /** Timeout massimo totale per la fase alta precisione (ms). Default: 14000 */
  timeoutMs?: number;
  /** Tempo massimo di raffinamento watchPosition dopo il primo fix valido (ms). Default: 3200 */
  refineMs?: number;
  /** Soglia di accuratezza (metri) raggiunta la quale risolviamo subito. Default: 30 */
  desiredAccuracyMeters?: number;
  /** Callback opzionale per aggiornare la UI appena arriva un fix intermedio */
  onIntermediate?: (pos: PosizioneGPS) => void;
}

function toPosizioneGPS(pos: GeolocationPosition): PosizioneGPS {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuratezza: Math.round(pos.coords.accuracy || 0),
    velocita: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
    orario: formatTimeItaly(undefined, true)
  };
}

export function formatGpsErrorMessage(code: number, rawMessage?: string): string {
  const isIos = isAppleMobileDevice();
  if (code === 1) {
    return isIos
      ? 'Permesso GPS negato su iPhone/iPad. Apri Impostazioni → Privacy e sicurezza → Localizzazione → Safari (o Siti web di Safari), imposta "Mentre usi l\'app" e attiva "Posizione esatta".'
      : 'Permesso di geolocalizzazione negato. Consenti l\'accesso alla posizione nelle impostazioni del browser o del telefono.';
  }
  if (code === 2) {
    return isIos
      ? 'Segnale GPS temporaneamente non disponibile su iPhone. Verifica che la Localizzazione e "Posizione esatta" siano attive in Impostazioni e riprova vicino a una finestra o all\'aperto.'
      : 'Posizione GPS temporaneamente non disponibile. Attiva il GPS/Localizzazione ad alta precisione sul dispositivo e riprova.';
  }
  if (code === 3) {
    return isIos
      ? 'Timeout acquisizione GPS su iPhone. Attendi qualche secondo con Wi-Fi attivo o avvicinati a una finestra, poi premi nuovamente "Rileva GPS".'
      : 'Tempo scaduto per la lettura GPS. Verifica la ricezione satellitare o attiva il Wi-Fi per velocizzare il fix e riprova.';
  }
  return rawMessage
    ? `Impossibile acquisire la posizione GPS (${rawMessage}).`
    : 'Impossibile acquisire la posizione GPS dal dispositivo.';
}

/**
 * Acquisizione GPS affidabile cross-platform (ottimizzata per Apple iOS Safari/PWA + Android).
 *
 * Su iPhone/iPad una singola `getCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 8000 })`
 * fallisce frequentemente al chiuso o con CoreLocation a freddo.
 * Questa funzione:
 *  1. Avvia una breve sessione `watchPosition` ad alta precisione per risvegliare CoreLocation e selezionare
 *     il fix con accuratezza migliore (risolve subito se <= 30m, oppure dopo ~3.2s dal primo fix).
 *  2. In caso di timeout o segnale satellitare debole al chiuso (code 2 o 3), esegue automaticamente un
 *     fallback a `enableHighAccuracy: false` (triangolazione Wi-Fi/rete CoreLocation su iOS).
 *  3. Rileva se su iPhone è disattivata "Posizione esatta" (`accuratezza > 250m`).
 */
export async function ottieniPosizioneGpsAffidabile(
  options?: SmartGpsOptions
): Promise<SmartGpsResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {
      ok: false,
      code: 0,
      error: 'Geolocalizzazione non supportata su questo browser/dispositivo.',
      isPermissionDenied: false
    };
  }

  const isIos = isAppleMobileDevice();
  const timeoutMs = options?.timeoutMs ?? (isIos ? 15000 : 12000);
  const refineMs = options?.refineMs ?? (isIos ? 3500 : 2500);
  const desiredAccuracy = options?.desiredAccuracyMeters ?? 30;

  // Fase 1: watchPosition ad alta precisione (risveglia CoreLocation su iOS ed evita fix stantii)
  const highAccAttempt = await new Promise<
    | { ok: true; posizione: PosizioneGPS }
    | { ok: false; code: number; message: string }
  >((resolve) => {
    let settled = false;
    let watchId: number | null = null;
    let bestPos: PosizioneGPS | null = null;
    let refineTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
        watchId = null;
      }
      if (refineTimer) {
        clearTimeout(refineTimer);
        refineTimer = null;
      }
      if (hardTimer) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
    };

    const finishOk = (pos: PosizioneGPS) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok: true, posizione: pos });
    };

    const finishErr = (code: number, message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (bestPos) {
        resolve({ ok: true, posizione: bestPos });
      } else {
        resolve({ ok: false, code, message });
      }
    };

    hardTimer = setTimeout(() => {
      if (bestPos) {
        finishOk(bestPos);
      } else {
        finishErr(3, 'Timeout GPS alta precisione');
      }
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (rawPos) => {
          const current = toPosizioneGPS(rawPos);
          const acc = current.accuratezza || 9999;

          if (!bestPos || acc < (bestPos.accuratezza || 9999)) {
            bestPos = current;
            options?.onIntermediate?.(current);
          }

          // Se abbiamo già una precisione ottima (<= desiredAccuracy), chiudi subito
          if (acc <= desiredAccuracy) {
            finishOk(bestPos);
            return;
          }

          // Altrimenti attendi brevemente un eventuale fix più preciso da CoreLocation
          if (!refineTimer) {
            refineTimer = setTimeout(() => {
              if (bestPos) finishOk(bestPos);
            }, refineMs);
          }
        },
        (err) => {
          // Se è permesso negato (code 1), interrompi subito
          if (err.code === 1) {
            finishErr(1, err.message);
            return;
          }
          // Se abbiamo già almeno un fix intermedio valido, usiamolo
          if (bestPos) {
            finishOk(bestPos);
            return;
          }
          finishErr(err.code || 2, err.message || 'Errore GPS');
        },
        {
          enableHighAccuracy: true,
          timeout: Math.max(timeoutMs - 500, 8000),
          maximumAge: 15000
        }
      );
    } catch (e: any) {
      finishErr(2, e?.message || 'Errore avvio watchPosition');
    }
  });

  if (highAccAttempt.ok) {
    const acc = highAccAttempt.posizione.accuratezza || 0;
    return {
      ok: true,
      posizione: highAccAttempt.posizione,
      isCoarseIos: isIos && acc > 250,
      usedFallback: false
    };
  }

  // Se l'utente ha negato esplicitamente il permesso, inutile fare fallback
  if (highAccAttempt.code === 1) {
    return {
      ok: false,
      code: 1,
      error: formatGpsErrorMessage(1, highAccAttempt.message),
      isPermissionDenied: true
    };
  }

  // Fase 2 (Fallback indoor iOS/Android): triangolazione Wi-Fi/rete CoreLocation (`enableHighAccuracy: false`)
  const fallbackAttempt = await new Promise<
    | { ok: true; posizione: PosizioneGPS }
    | { ok: false; code: number; message: string }
  >((resolve) => {
    let settled = false;
    const guard = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, code: 3, message: 'Timeout fallback Wi-Fi/rete' });
      }
    }, 10500);

    try {
      navigator.geolocation.getCurrentPosition(
        (rawPos) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          resolve({ ok: true, posizione: toPosizioneGPS(rawPos) });
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          resolve({ ok: false, code: err.code || 2, message: err.message || 'Fallback fallito' });
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } catch (e: any) {
      if (!settled) {
        settled = true;
        clearTimeout(guard);
        resolve({ ok: false, code: 2, message: e?.message || 'Errore fallback GPS' });
      }
    }
  });

  if (fallbackAttempt.ok) {
    const acc = fallbackAttempt.posizione.accuratezza || 0;
    return {
      ok: true,
      posizione: fallbackAttempt.posizione,
      isCoarseIos: isIos && acc > 250,
      usedFallback: true
    };
  }

  return {
    ok: false,
    code: fallbackAttempt.code,
    error: formatGpsErrorMessage(fallbackAttempt.code, fallbackAttempt.message),
    isPermissionDenied: fallbackAttempt.code === 1
  };
}
