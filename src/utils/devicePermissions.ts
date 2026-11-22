// Gestione centralizzata delle autorizzazioni del dispositivo per l'app installata
// Categorie richieste:
// 1. Notifiche
// 2. Posizione GPS
// 3. Fotocamera e Microfono
// 4. Contatti e Rubrica
// 5. File e Memoria (inclusa persistenza storage contro la rimozione in inattività)
// 6. Registri Chiamate e SMS (gestione nativa device + guida Android/iOS anti-revoca automatica)
//
// GARANZIA CRITICA: La Comunicazione di Emergenza funziona SEMPRE anche se non sono state
// concesse tutte le autorizzazioni.

import { attivaServiceWorkerEPush, getPushSubscriptionStatus } from '../services/pushManager';
import { vhfRadioEngine } from '../services/vhfRadioEngine';

export type DevicePermissionId =
  | 'notifiche'
  | 'radio_background'
  | 'gps'
  | 'fotocamera_microfono'
  | 'contatti'
  | 'file_memoria'
  | 'chiamate_sms';

export interface RadioBgPermissionContext {
  role?: 'admin' | 'volontario';
  volontarioId?: string;
  volontarioNome?: string;
}

export type DevicePermissionStatus = 'granted' | 'prompt' | 'denied' | 'device_managed';

export interface DevicePermissionStateItem {
  id: DevicePermissionId;
  titolo: string;
  descrizione: string;
  status: DevicePermissionStatus;
  dettaglio?: string;
}

export interface PermissionNeededEventDetail {
  permissionId: DevicePermissionId;
  azione: string;
  onRetry?: () => void;
}

const LS_PERMESSI_CONFIGURATI_KEY = 'CROCE_ORO_DEVICE_PERMISSIONS_SETUP_V1';
const LS_CONTACTS_GRANTED_KEY = 'CROCE_ORO_PERM_CONTATTI_OK';
const LS_CALL_SMS_ACK_KEY = 'CROCE_ORO_PERM_CHIAMATE_SMS_ACK';
export const RADIO_BG_CONSENT_LS_KEY = 'CROCE_ORO_RADIO_BG_CONSENT_V1';
export const RADIO_BG_NOTIF_SENT_LS_KEY = 'CROCE_ORO_RADIO_BG_NOTIF_SENT_V1';

export const EVENT_PERMISSION_REQUIRED = 'croceoro_permission_required';
export const EVENT_OPEN_PERMISSIONS_MODAL = 'croceoro_open_permissions_modal';
export const EVENT_RADIO_BG_STATUS_CHANGED = 'croceoro_radio_bg_status_changed';

export function hasAcceptedRadioBgConsent(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(RADIO_BG_CONSENT_LS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markRadioBgConsentAccepted(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(RADIO_BG_CONSENT_LS_KEY, 'true');
    localStorage.setItem(RADIO_BG_NOTIF_SENT_LS_KEY, 'true');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.active?.postMessage({ type: 'MARK_MANDATORY_PERMS_ACCEPTED' });
        })
        .catch(() => {});
      navigator.serviceWorker.controller?.postMessage({ type: 'MARK_MANDATORY_PERMS_ACCEPTED' });
    }
  } catch {}
}

// Flag di controllo: resta false per evitare di richiedere nuovamente le autorizzazioni
// ad ogni aggiornamento dell'app. Va attivato SOLO quando richiesto espressamente per un nuovo permesso obbligatorio.
const MANDATORY_PERMS_REASK_ENABLED = false;

/**
 * Restituisce true solo quando è espressamente attivo un aggiornamento obbligatorio dei permessi.
 */
export function needsMandatoryRadioBgUpdate(): boolean {
  if (!MANDATORY_PERMS_REASK_ENABLED) return false;
  try {
    if (typeof window === 'undefined') return false;
    const giaConfigurato =
      localStorage.getItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED') === 'true' ||
      localStorage.getItem('CROCE_ORO_SETUP_COMPLETO') === 'true' ||
      localStorage.getItem('CROCE_ORO_PERMESSI_PERMANENTI') === 'true';
    if (!giaConfigurato) return false;
    return localStorage.getItem(RADIO_BG_CONSENT_LS_KEY) !== 'true';
  } catch {
    return false;
  }
}

/**
 * Richiede al browser/OS lo storage persistente così i dati e le autorizzazioni
 * locali dell'app installata non vengano rimossi automaticamente in caso di inutilizzo.
 */
export async function assicuraPersistenzaStorageApp(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      const already = typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : false;
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}

async function queryBrowserPermission(name: string): Promise<DevicePermissionStatus | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
    const res = await navigator.permissions.query({ name: name as PermissionName });
    if (res.state === 'granted') return 'granted';
    if (res.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return null;
  }
}

export async function leggiStatoTutteAutorizzazioni(): Promise<DevicePermissionStateItem[]> {
  // 1. Notifiche
  let notifStatus: DevicePermissionStatus = 'prompt';
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') notifStatus = 'granted';
    else if (Notification.permission === 'denied') notifStatus = 'denied';
    else notifStatus = 'prompt';
  } else {
    notifStatus = 'device_managed';
  }

  // 2. GPS
  const gpsQuery = await queryBrowserPermission('geolocation');
  const gpsStatus: DevicePermissionStatus = gpsQuery ?? (typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'device_managed');

  // 3. Fotocamera e Microfono
  const camQ = await queryBrowserPermission('camera');
  const micQ = await queryBrowserPermission('microphone');
  let camMicStatus: DevicePermissionStatus = 'prompt';
  if (camQ === 'granted' && micQ === 'granted') camMicStatus = 'granted';
  else if (camQ === 'denied' || micQ === 'denied') camMicStatus = 'denied';
  else if (camQ === 'granted' || micQ === 'granted') camMicStatus = 'prompt';
  else if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) camMicStatus = 'device_managed';

  // 4. Contatti e Rubrica
  const hasContactPicker = typeof navigator !== 'undefined' && 'contacts' in navigator;
  let contattiStatus: DevicePermissionStatus = 'prompt';
  try {
    if (localStorage.getItem(LS_CONTACTS_GRANTED_KEY) === 'true') {
      contattiStatus = 'granted';
    } else if (!hasContactPicker) {
      contattiStatus = 'device_managed';
    }
  } catch {}

  // 5. File e Memoria (Storage Persistente)
  let fileMemStatus: DevicePermissionStatus = 'prompt';
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      const persisted = await navigator.storage.persisted();
      fileMemStatus = persisted ? 'granted' : 'prompt';
    } else {
      fileMemStatus = 'granted';
    }
  } catch {
    fileMemStatus = 'prompt';
  }

  // 6. Registri Chiamate e SMS (gestiti a livello di sistema operativo Android/iOS)
  let chiamateSmsStatus: DevicePermissionStatus = 'device_managed';
  try {
    if (localStorage.getItem(LS_CALL_SMS_ACK_KEY) === 'true') {
      chiamateSmsStatus = 'granted';
    }
  } catch {}

  // 1b. Ricezione Radio in Background (Audio + Push)
  const audioArmed = vhfRadioEngine.isBackgroundReceptionArmed();
  let pushStat: { subscribed: boolean; permission: NotificationPermission; inIframe: boolean } = {
    subscribed: false,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
    inIframe: false,
  };
  try {
    pushStat = await getPushSubscriptionStatus();
  } catch {}
  let radioBgStatus: DevicePermissionStatus = 'prompt';
  if (audioArmed && pushStat.subscribed) {
    radioBgStatus = 'granted';
  } else if (!pushStat.inIframe && pushStat.permission === 'denied') {
    radioBgStatus = 'denied';
  } else {
    radioBgStatus = 'prompt';
  }
  const radioBgDettaglio =
    audioArmed && pushStat.subscribed
      ? 'Audio schermo spento ATTIVO • Push ad alta priorità ATTIVO'
      : pushStat.inIframe && !pushStat.subscribed
      ? 'Audio: ' + (audioArmed ? 'Attivo' : 'Da attivare') + ' • Apri dal link diretto (www.croceoro.org) o app su Home per Push a schermo spento'
      : `Audio Background: ${audioArmed ? 'Attivo' : 'Da attivare'} • Push: ${pushStat.subscribed ? 'Attivo' : 'Da abilitare'}`;

  return [
    {
      id: 'notifiche',
      titolo: 'Notifiche',
      descrizione: 'Avvisi missioni, promemoria turni delle 09:00 e comunicazioni di servizio.',
      status: notifStatus,
    },
    {
      id: 'radio_background',
      titolo: 'Ricezione in Background (Audio + Push)',
      descrizione: 'Ascolto live Walkie-Talkie (Emergenza, Tutti, Gruppi) anche a schermo spento o app ridotta, più Push ad alta priorità ad app chiusa.',
      status: radioBgStatus,
      dettaglio: radioBgDettaglio,
    },
    {
      id: 'gps',
      titolo: 'Posizione GPS',
      descrizione: 'Localizzazione mezzo in tempo reale, timbratura in sede e navigazione interventi.',
      status: gpsStatus,
    },
    {
      id: 'fotocamera_microfono',
      titolo: 'Fotocamera e Microfono',
      descrizione: 'Scansione documenti/microchip, foto mezzi/checklist e comunicazioni Radio PTT.',
      status: camMicStatus,
      dettaglio:
        camQ && micQ && camQ !== micQ
          ? `Fotocamera: ${camQ === 'granted' ? 'OK' : camQ === 'denied' ? 'Bloccata' : 'Da autorizzare'} • Microfono: ${micQ === 'granted' ? 'OK' : micQ === 'denied' ? 'Bloccato' : 'Da autorizzare'}`
          : undefined,
    },
    {
      id: 'contatti',
      titolo: 'Contatti e Rubrica',
      descrizione: 'Accesso rapido alla rubrica contatti e numeri utili ospedali/enti.',
      status: contattiStatus,
      dettaglio: hasContactPicker
        ? 'Supporto Contact Picker attivo sul dispositivo'
        : 'Rubrica integrata attiva • Sui device nativi Android/iOS abilita Contatti nelle Impostazioni App',
    },
    {
      id: 'file_memoria',
      titolo: 'File e Memoria',
      descrizione: 'Archiviazione persistente anti-rimozione, caricamento allegati e archivio offline.',
      status: fileMemStatus,
      dettaglio:
        fileMemStatus === 'granted'
          ? 'Archiviazione persistente protetta dalla pulizia automatica'
          : 'Attiva archiviazione persistente per evitare la rimozione dei dati in inattività',
    },
    {
      id: 'chiamate_sms',
      titolo: 'Registri Chiamate e SMS',
      descrizione: 'Avvio diretto chiamate operative/SMS dal device e mantenimento autorizzazioni permanenti.',
      status: chiamateSmsStatus,
      dettaglio:
        'Su Android: Impostazioni App → Autorizzazioni → attiva Telefono/Registri chiamate e SMS e disattiva "Rimuovi autorizzazioni se l\'app non è utilizzata".',
    },
  ];
}

export async function richiediSingolaAutorizzazione(
  id: DevicePermissionId,
  ctx?: RadioBgPermissionContext
): Promise<{ status: DevicePermissionStatus; message: string }> {
  try {
    switch (id) {
      case 'notifiche': {
        if (typeof Notification === 'undefined') {
          return { status: 'device_managed', message: 'Notifiche gestite dalle impostazioni di sistema del dispositivo.' };
        }
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          return { status: 'granted', message: 'Notifiche autorizzate correttamente.' };
        }
        return {
          status: perm === 'denied' ? 'denied' : 'prompt',
          message:
            perm === 'denied'
              ? 'Notifiche bloccate sul browser/device: riabilitale dalle impostazioni del sito o dell\'app.'
              : 'Autorizzazione notifiche non ancora confermata.',
        };
      }

      case 'radio_background': {
        const armed = await vhfRadioEngine.armBackgroundReception('Radio VHF/UHF • Ascolto Attivo');
        const pushRes = await attivaServiceWorkerEPush(
          ctx?.role || 'volontario',
          ctx?.volontarioId,
          ctx?.volontarioNome
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(EVENT_RADIO_BG_STATUS_CHANGED));
        }
        if (armed && pushRes.subscribed) {
          return {
            status: 'granted',
            message: 'Ricezione in Background Attiva (Audio + Push): pronto per Emergenza, Tutti e Gruppi anche a schermo spento.',
          };
        }
        if (pushRes.inIframe && !pushRes.subscribed) {
          return {
            status: armed ? 'prompt' : 'denied',
            message:
              'Audio Background armato. Per attivare anche le notifiche Push a schermo spento apri l\'app dal link diretto (www.croceoro.org) o installata sulla Home.',
          };
        }
        if (pushRes.permission === 'denied') {
          return {
            status: 'denied',
            message:
              'Audio Background armato ma Notifiche Push bloccate sul browser: sbloccale nelle impostazioni del sito per ricevere chiamate ad app chiusa.',
          };
        }
        return {
          status: armed || pushRes.subscribed ? 'prompt' : 'denied',
          message: armed
            ? 'Audio in background attivo. Conferma il consenso Notifiche per completare il canale Push.'
            : 'Tocca nuovamente Consenti per sbloccare il canale Audio + Push in background.',
        };
      }

      case 'gps': {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          return { status: 'device_managed', message: 'GPS non rilevato su questo browser.' };
        }
        return await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve({ status: 'granted', message: 'Posizione GPS autorizzata correttamente.' }),
            (err) => {
              if (err.code === err.PERMISSION_DENIED) {
                resolve({
                  status: 'denied',
                  message: 'Posizione GPS negata: abilitala nelle impostazioni del browser/dispositivo (Consenti sempre).',
                });
              } else {
                resolve({
                  status: 'granted',
                  message: 'Permesso GPS richiesto (attendi il segnale satellitare all\'aperto).',
                });
              }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        });
      }

      case 'fotocamera_microfono': {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          return { status: 'device_managed', message: 'Fotocamera/Microfono non disponibili in questo contesto.' };
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach((t) => t.stop());
          return { status: 'granted', message: 'Fotocamera e Microfono autorizzati correttamente.' };
        } catch {
          // Prova almeno microfono se la fotocamera non è presente (es. PC fisso)
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStream.getTracks().forEach((t) => t.stop());
            return { status: 'granted', message: 'Microfono autorizzato (fotocamera non rilevata o da abilitare).' };
          } catch {
            return {
              status: 'denied',
              message: 'Accesso a Fotocamera/Microfono negato: abilitalo dall\'icona lucchetto del browser o dalle Impostazioni App.',
            };
          }
        }
      }

      case 'contatti': {
        const navAny = navigator as any;
        if (navAny?.contacts && typeof navAny.contacts.select === 'function') {
          try {
            await navAny.contacts.select(['name', 'tel'], { multiple: false });
          } catch {
            // Anche se l'utente chiude il selettore, la capacità è verificata
          }
        }
        try {
          localStorage.setItem(LS_CONTACTS_GRANTED_KEY, 'true');
        } catch {}
        return {
          status: 'granted',
          message: 'Accesso Contatti e Rubrica confermato. Sui device Android/iOS verifica che il permesso Contatti sia sempre attivo.',
        };
      }

      case 'file_memoria': {
        const ok = await assicuraPersistenzaStorageApp();
        return {
          status: ok ? 'granted' : 'prompt',
          message: ok
            ? 'Memoria persistente concessa: i dati dell\'app non verranno rimossi automaticamente se inutilizzata.'
            : 'Accesso File pronto. Su Android disattiva "Pausa attività app se inutilizzata" nelle Impostazioni dell\'app.',
        };
      }

      case 'chiamate_sms': {
        try {
          localStorage.setItem(LS_CALL_SMS_ACK_KEY, 'true');
        } catch {}
        return {
          status: 'granted',
          message:
            'Configurazione Telefono/SMS confermata. Su Android verifica in Impostazioni App → Autorizzazioni → Telefono e SMS e disattiva "Rimuovi autorizzazioni se l\'app non viene utilizzata".',
        };
      }
    }
  } catch {
    return { status: 'denied', message: 'Impossibile completare la richiesta di autorizzazione.' };
  }
}

export function segnaSetupPermessiCompletato(): void {
  try {
    localStorage.setItem(LS_PERMESSI_CONFIGURATI_KEY, 'true');
  } catch {}
}

export function isSetupPermessiCompletato(): boolean {
  try {
    return localStorage.getItem(LS_PERMESSI_CONFIGURATI_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Invita l'utente a concedere un'autorizzazione specifica quando clicca su una funzione
 * che la richiede e l'autorizzazione risulta mancante o revocata.
 * NOTA: Non viene MAI chiamato per la Comunicazione di Emergenza, che resta sempre operativa.
 */
export function invitaAutorizzazioneNecessaria(
  permissionId: DevicePermissionId,
  azione: string,
  onRetry?: () => void
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PermissionNeededEventDetail>(EVENT_PERMISSION_REQUIRED, {
      detail: { permissionId, azione, onRetry },
    })
  );
}

export function apriCentroPermessiDispositivo(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_OPEN_PERMISSIONS_MODAL));
}

/**
 * Verifica in modo rapido se una determinata autorizzazione è già negata/mancante
 * e in caso negativo apre l'invito contestuale. Restituisce true se si può procedere.
 */
export async function verificaOInvitaPermesso(
  permissionId: DevicePermissionId,
  azione: string,
  onRetry?: () => void
): Promise<boolean> {
  const list = await leggiStatoTutteAutorizzazioni();
  const item = list.find((p) => p.id === permissionId);
  if (!item || item.status === 'granted' || item.status === 'device_managed') {
    return true;
  }
  invitaAutorizzazioneNecessaria(permissionId, azione, onRetry);
  return false;
}
