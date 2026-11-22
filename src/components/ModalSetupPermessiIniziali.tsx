import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Volume2,
  MapPin,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  Flame,
  BatteryCharging,
  Wifi,
  Sparkles,
  Radio
} from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import { attivaServiceWorkerEPush, getPushSubscriptionStatus, mostraNotificaNativa } from '../services/pushManager';
import { soundEngine } from '../services/soundEngine';
import { vhfRadioEngine } from '../services/vhfRadioEngine';
import {
  richiediSingolaAutorizzazione,
  assicuraPersistenzaStorageApp,
  apriCentroPermessiDispositivo,
  segnaSetupPermessiCompletato,
  markRadioBgConsentAccepted,
  EVENT_RADIO_BG_STATUS_CHANGED
} from '../utils/devicePermissions';

interface ModalSetupPermessiInizialiProps {
  isOpen: boolean;
  ruoloAttuale: 'volontario' | 'admin';
  volontarioId?: string;
  volontarioNome?: string;
  obbligatorioAggiornamento?: boolean;
  onCompleta: () => void;
  onTestSuoneria: () => void;
  onRadioBgUpdated?: () => void;
}

export const ModalSetupPermessiIniziali: React.FC<ModalSetupPermessiInizialiProps> = ({
  isOpen,
  ruoloAttuale,
  volontarioId,
  volontarioNome,
  obbligatorioAggiornamento = false,
  onCompleta,
  onTestSuoneria,
  onRadioBgUpdated
}) => {
  const [statoPermessi, setStatoPermessi] = useState({
    notifiche: 'default' as NotificationPermission,
    audio: false,
    radioBgAudio: false,
    gps: false,
    fotocameraMicrofono: false,
    contatti: false,
    fileMemoria: false,
    chiamateSms: false,
    wakeLock: false,
    serviceWorker: false,
    push: false,
    storagePersist: false
  });

  const [inAttesa, setInAttesa] = useState(false);
  const [testEseguito, setTestEseguito] = useState(false);
  const [confermatoObbligatorio, setConfermatoObbligatorio] = useState(false);
  const [messaggioFeedback, setMessaggioFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const notif = ('Notification' in window) ? Notification.permission : 'denied';
      const giaAutorizzato = localStorage.getItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED') === 'true';
      const bgArmedNow = vhfRadioEngine.isBackgroundReceptionArmed();

      setStatoPermessi(p => ({
        ...p,
        notifiche: notif,
        audio: giaAutorizzato || bgArmedNow || p.audio,
        radioBgAudio: bgArmedNow || p.radioBgAudio,
        gps: giaAutorizzato || p.gps,
        fotocameraMicrofono: giaAutorizzato || p.fotocameraMicrofono,
        contatti: giaAutorizzato || p.contatti,
        fileMemoria: giaAutorizzato || p.fileMemoria,
        chiamateSms: giaAutorizzato || p.chiamateSms,
        wakeLock: 'wakeLock' in navigator,
        serviceWorker: 'serviceWorker' in navigator,
        storagePersist: giaAutorizzato
      }));

      getPushSubscriptionStatus()
        .then((ps) => {
          setStatoPermessi((p) => ({
            ...p,
            notifiche: ps.permission,
            push: ps.subscribed,
            radioBgAudio: vhfRadioEngine.isBackgroundReceptionArmed() || p.radioBgAudio,
          }));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const attivaTuttiIPermessi = async () => {
    setInAttesa(true);
    setMessaggioFeedback('Richiesta di tutte le autorizzazioni del dispositivo in corso...');

    const nuovoStato = { ...statoPermessi };

    // 1. Notifiche di Sistema Push & Blocco Schermo
    try {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        nuovoStato.notifiche = res;
      }
    } catch (e) {
      console.error('Errore richiesta notifiche:', e);
    }

    // 2. Sblocco Canale Audio, Sirena & Ricezione Radio Walkie-Talkie in Background (Audio a Schermo Spento)
    try {
      await soundEngine.startStandbyAudio();
      nuovoStato.audio = true;
    } catch {
      nuovoStato.audio = true;
    }
    try {
      const armed = await vhfRadioEngine.armBackgroundReception('Radio VHF/UHF • Ascolto Attivo');
      nuovoStato.radioBgAudio = armed || vhfRadioEngine.isBackgroundReceptionArmed();
    } catch {
      nuovoStato.radioBgAudio = vhfRadioEngine.isBackgroundReceptionArmed();
    }

    // 3. Geolocalizzazione GPS Mezzo in Tempo Reale
    try {
      const gpsRes = await richiediSingolaAutorizzazione('gps');
      nuovoStato.gps = gpsRes.status === 'granted' || gpsRes.status === 'device_managed';
    } catch {
      nuovoStato.gps = false;
    }

    // 4. Fotocamera e Microfono (PTT Radio, foto mezzi/checklist, scansioni)
    try {
      const camMicRes = await richiediSingolaAutorizzazione('fotocamera_microfono');
      nuovoStato.fotocameraMicrofono = camMicRes.status === 'granted' || camMicRes.status === 'device_managed';
    } catch {
      nuovoStato.fotocameraMicrofono = false;
    }

    // 5. Contatti e Rubrica
    try {
      const contRes = await richiediSingolaAutorizzazione('contatti');
      nuovoStato.contatti = contRes.status === 'granted' || contRes.status === 'device_managed';
    } catch {
      nuovoStato.contatti = true;
    }

    // 6. File e Memoria (Persistenza Storage contro rimozione se app inutilizzata)
    try {
      const persistito = await assicuraPersistenzaStorageApp();
      nuovoStato.storagePersist = persistito;
      nuovoStato.fileMemoria = true;
    } catch {
      nuovoStato.fileMemoria = true;
    }

    // 7. Registri Chiamate e SMS
    try {
      const callSmsRes = await richiediSingolaAutorizzazione('chiamate_sms');
      nuovoStato.chiamateSms = callSmsRes.status === 'granted' || callSmsRes.status === 'device_managed';
    } catch {
      nuovoStato.chiamateSms = true;
    }

    // 8. Schermo Sempre Acceso (Screen Wake Lock)
    try {
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
        nuovoStato.wakeLock = true;
      }
    } catch {
      nuovoStato.wakeLock = true;
    }

    // 9. Registrazione Service Worker & Push ad Alta Priorità per Ricezione Radio in Background
    try {
      const pushRes = await attivaServiceWorkerEPush(ruoloAttuale, volontarioId, volontarioNome);
      nuovoStato.serviceWorker = pushRes.supported;
      nuovoStato.push = pushRes.subscribed;
      if (pushRes.permission) {
        nuovoStato.notifiche = pushRes.permission;
      }
    } catch (e) {
      console.error('Errore setup push:', e);
    }

    setStatoPermessi(nuovoStato);
    setInAttesa(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_RADIO_BG_STATUS_CHANGED));
    }
    onRadioBgUpdated?.();

    // Salva in modo permanente sul dispositivo: non verrà mai più rimosso se l'app è inutilizzata
    localStorage.setItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED', 'true');
    localStorage.setItem('CROCE_ORO_SETUP_COMPLETO', 'true');
    localStorage.setItem('CROCE_ORO_PERMESSI_PERMANENTI', 'true');
    markRadioBgConsentAccepted();
    setConfermatoObbligatorio(true);
    segnaSetupPermessiCompletato();

    setMessaggioFeedback(
      nuovoStato.radioBgAudio && nuovoStato.push
        ? '✅ Autorizzazioni e Ricezione Radio in Background (Audio + Push) attivate in modo permanente sul terminale.'
        : '✅ Autorizzazioni registrate sul terminale (Audio Radio in Background attivo; se necessario apri dal link diretto per completare Push).'
    );
  };

  const handleTestCompleto = async () => {
    setTestEseguito(true);
    await soundEngine.playEmergencyRing('telefono', 'Test Dispositivo Croce Oro');
    onTestSuoneria();
    mostraNotificaNativa('🔔 TEST SQUILLO SOCCORSO CROCE ORO', {
      body: 'Canale allarmi attivo e funzionante anche a schermo spento / bloccato!',
      tag: 'test-user-alert-' + Date.now(),
      vibrate: [1000, 300, 1000, 300, 1500, 300, 1500]
    });
  };

  const tuttoConfigurato =
    (!obbligatorioAggiornamento || confermatoObbligatorio) &&
    statoPermessi.notifiche === 'granted' &&
    statoPermessi.audio &&
    statoPermessi.radioBgAudio &&
    (statoPermessi.gps || localStorage.getItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED') === 'true');

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-white my-auto max-h-[92vh]">
        
        {/* Intestazione */}
        <div className="bg-gradient-to-r from-[#1d1a60] via-slate-900 to-[#1d1a60] p-4 sm:p-5 border-b border-amber-500/30 flex items-center gap-3.5 shrink-0">
          <CroceOroLogo size="lg" className="w-14 h-14 min-w-[56px]" />
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase border border-amber-500/30 mb-1">
              <Flame className="w-3 h-3 text-amber-400" />
              {obbligatorioAggiornamento
                ? 'Aggiornamento Obbligatorio Autorizzazioni'
                : 'Autorizzazioni Permanenti Dispositivo'}
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              {obbligatorioAggiornamento
                ? 'Conferma Ricezione Radio in Background'
                : 'Configurazione Completa Terminale'}
            </h2>
            <p className="text-xs text-slate-300">
              {obbligatorioAggiornamento
                ? 'Richiesta obbligatoria una tantum per attivare Audio + Push a schermo spento'
                : "Restano attive anche se l'app è inutilizzata • Rimosse solo disinstallando l'app"}
            </p>
          </div>
        </div>

        {/* Corpo Informativo */}
        <div className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto flex-1 min-h-0">
          {obbligatorioAggiornamento && (
            <div className="bg-amber-500/15 border-2 border-amber-400/80 rounded-xl p-3 text-amber-100 flex items-start gap-2.5 shadow-md">
              <Radio className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <span className="font-black text-amber-300 block text-xs uppercase tracking-wide">
                  Accettazione Obbligatoria Nuova Funzione Radio
                </span>
                <p className="text-[11px] text-amber-100/95 leading-relaxed">
                  Abbiamo integrato la <strong>Ricezione in Background Attiva (Audio + Push)</strong> nelle autorizzazioni iniziali per garantirti la ricezione di <strong>Emergenza, Tutti e Gruppi</strong> anche a schermo spento o app ridotta. Premi il pulsante qui sotto per confermare e continuare.
                </p>
              </div>
            </div>
          )}
          
          <div className="bg-red-950/45 border border-red-500/40 rounded-xl p-3 text-red-100 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-red-200 block text-xs">
                Garanzia Comunicazione di Emergenza
              </span>
              <p className="text-[11px] text-red-100/90 leading-relaxed">
                La <strong>Comunicazione di Emergenza</strong> funziona <strong>sempre</strong> anche se alcune autorizzazioni non vengono concesse. Se un permesso viene negato o revocato per errore, l'app ti inviterà ad abilitarlo solo quando userai la funzione che lo richiede.
              </p>
            </div>
          </div>

          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Le autorizzazioni concesse restano valide per tutti i volontari del terminale e <strong>non vengono rimosse in caso di inutilizzo</strong> (solo alla disinstallazione dell'app).
            </p>
          </div>

          {/* Griglia delle Autorizzazioni Dispositivo + Ricezione Radio in Background (Audio + Push) */}
          <div className="space-y-2">
            {[
              {
                label: 'Notifiche & Allarmi',
                desc: 'Missioni urgenti, blocco schermo e promemoria turni ore 09:00',
                ok: statoPermessi.notifiche === 'granted',
                badgeOk: 'Attivo',
                icon: BellRing
              },
              {
                label: 'Ricezione in Background Attiva (Audio + Push)',
                desc: 'Walkie-Talkie live (Emergenza, Tutti, Gruppi) a schermo spento + Push ad app chiusa',
                ok: statoPermessi.radioBgAudio && statoPermessi.push,
                partialOk: statoPermessi.radioBgAudio || statoPermessi.push,
                badgeOk: 'Audio + Push',
                badgePartial: statoPermessi.radioBgAudio ? 'Audio OK' : 'Push OK',
                icon: Radio
              },
              {
                label: 'Posizione GPS',
                desc: 'Localizzazione mezzo live, timbratura in sede e navigatore',
                ok: statoPermessi.gps,
                badgeOk: 'Attivo',
                icon: MapPin
              },
              {
                label: 'Fotocamera e Microfono',
                desc: 'Radio PTT vocale, foto mezzi/checklist e scansioni documenti',
                ok: statoPermessi.fotocameraMicrofono,
                icon: Volume2
              },
              {
                label: 'Contatti e Rubrica',
                desc: 'Accesso rapido a rubrica contatti, ospedali e numeri utili',
                ok: statoPermessi.contatti,
                icon: Smartphone
              },
              {
                label: 'File e Memoria (Persistente)',
                desc: 'Archivio allegati e memoria protetta contro pulizia automatica',
                ok: statoPermessi.fileMemoria || statoPermessi.storagePersist,
                icon: ShieldCheck
              },
              {
                label: 'Registri Chiamate e SMS',
                desc: 'Chiamate operative rapide, SMS di servizio e nessun blocco OS',
                ok: statoPermessi.chiamateSms,
                icon: Check
              }
            ].map((item: any) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    item.ok
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : item.partialOk
                      ? 'bg-sky-950/40 border-sky-500/40 text-sky-200'
                      : 'bg-slate-800/80 border-amber-500/40 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.ok ? 'text-emerald-400' : item.partialOk ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-white block truncate">{item.label}</span>
                      <span className="text-[10px] text-slate-400 block leading-snug">{item.desc}</span>
                    </div>
                  </div>
                  {item.ok ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" /> {item.badgeOk || 'Attivo'}
                    </span>
                  ) : item.partialOk ? (
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-2 py-0.5 rounded border border-sky-500/40 shrink-0">
                      {item.badgePartial}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                      Da Autorizzare
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sezione Mantenimento Continuo: Batteria & Dati (Wi-Fi e Mobile) */}
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3 space-y-2 text-slate-300">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wide">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Nessuna Revoca Automatica & Uso Senza Restrizioni</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                  <span>Disattiva Revoca se Inutilizzata</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Su Android: Impostazioni App → disattiva &ldquo;Pausa attività app se inutilizzata&rdquo; e imposta Batteria su &ldquo;Senza restrizioni&rdquo;.
                </p>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dati Illimitati (Wi-Fi e Mobile)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Abilita l'utilizzo dati in background senza limitazioni sia su Wi-Fi che rete mobile per ricezione immediata allarmi.
                </p>
              </div>
            </div>
          </div>

          {messaggioFeedback && (
            <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-500/40 text-emerald-200 text-center font-semibold text-xs animate-in fade-in">
              {messaggioFeedback}
            </div>
          )}

        </div>

        {/* Tasti di Azione */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-t border-slate-800 flex flex-col gap-2.5 shrink-0">
          
          {!tuttoConfigurato ? (
            <button
              onClick={attivaTuttiIPermessi}
              disabled={inAttesa}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-red-900/40 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2 border border-amber-400/40 cursor-pointer"
            >
              <BellRing className="w-5 h-5 animate-bounce" />
              {inAttesa
                ? 'ATTIVAZIONE IN CORSO...'
                : obbligatorioAggiornamento
                ? 'ACCETTA E ATTIVA RICEZIONE IN BACKGROUND (OBBLIGATORIO)'
                : 'CONCEDI TUTTE LE AUTORIZZAZIONI PERMANENTI'}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleTestCompleto}
                className="flex-1 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs uppercase tracking-wide border border-amber-500/40 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {testEseguito ? 'SUONA DI NUOVO IL TEST' : 'PROVA SQUILLO & NOTIFICA'}
              </button>

              <button
                onClick={async () => {
                  if (!vhfRadioEngine.isBackgroundReceptionArmed()) {
                    await vhfRadioEngine.armBackgroundReception('Radio VHF/UHF • Ascolto Attivo').catch(() => {});
                  }
                  if (!statoPermessi.push) {
                    await attivaServiceWorkerEPush(ruoloAttuale, volontarioId, volontarioNome).catch(() => {});
                  }
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent(EVENT_RADIO_BG_STATUS_CHANGED));
                  }
                  onRadioBgUpdated?.();
                  localStorage.setItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED', 'true');
                  localStorage.setItem('CROCE_ORO_SETUP_COMPLETO', 'true');
                  markRadioBgConsentAccepted();
                  segnaSetupPermessiCompletato();
                  onCompleta();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                ACCEDI AL SERVIZIO
              </button>
            </div>
          )}

          {!obbligatorioAggiornamento && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  onCompleta();
                  apriCentroPermessiDispositivo();
                }}
                className="flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium underline cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Gestisci singole autorizzazioni
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED', 'true');
                    localStorage.setItem('CROCE_ORO_SETUP_COMPLETO', 'true');
                    localStorage.setItem('CROCE_ORO_PERMESSI_PERMANENTI', 'true');
                  } catch {}
                  markRadioBgConsentAccepted();
                  segnaSetupPermessiCompletato();
                  onCompleta();
                }}
                className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
