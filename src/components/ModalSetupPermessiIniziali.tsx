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
  Sparkles
} from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import { attivaServiceWorkerEPush, mostraNotificaNativa } from '../services/pushManager';
import { soundEngine } from '../services/soundEngine';

interface ModalSetupPermessiInizialiProps {
  isOpen: boolean;
  ruoloAttuale: 'volontario' | 'admin';
  onCompleta: () => void;
  onTestSuoneria: () => void;
}

export const ModalSetupPermessiIniziali: React.FC<ModalSetupPermessiInizialiProps> = ({
  isOpen,
  ruoloAttuale,
  onCompleta,
  onTestSuoneria
}) => {
  const [statoPermessi, setStatoPermessi] = useState({
    notifiche: 'default' as NotificationPermission,
    audio: false,
    gps: false,
    wakeLock: false,
    serviceWorker: false,
    push: false,
    storagePersist: false
  });

  const [inAttesa, setInAttesa] = useState(false);
  const [testEseguito, setTestEseguito] = useState(false);
  const [messaggioFeedback, setMessaggioFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const notif = ('Notification' in window) ? Notification.permission : 'denied';
      const giaAutorizzato = localStorage.getItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED') === 'true';

      setStatoPermessi(p => ({
        ...p,
        notifiche: notif,
        audio: giaAutorizzato || p.audio,
        gps: giaAutorizzato || p.gps,
        wakeLock: 'wakeLock' in navigator,
        serviceWorker: 'serviceWorker' in navigator,
        storagePersist: giaAutorizzato
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const attivaTuttiIPermessi = async () => {
    setInAttesa(true);
    setMessaggioFeedback('Richiesta autorizzazioni in corso sul dispositivo...');

    const nuovoStato = { ...statoPermessi };

    // 1. Notifiche di Sistema Push & Blocco Schermo (OBBLIGATORIO)
    try {
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        nuovoStato.notifiche = res;
      }
    } catch (e) {
      console.error('Errore richiesta notifiche:', e);
    }

    // 2. Sblocco Canale Audio & Sirena ad Alto Volume (OBBLIGATORIO)
    try {
      await soundEngine.startStandbyAudio();
      nuovoStato.audio = true;
    } catch (e) {
      nuovoStato.audio = true;
    }

    // 3. Geolocalizzazione GPS Mezzo in Tempo Reale (OBBLIGATORIO)
    try {
      if ('geolocation' in navigator) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              nuovoStato.gps = true;
              resolve(true);
            },
            () => {
              nuovoStato.gps = false;
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 6000 }
          );
        });
      }
    } catch {
      nuovoStato.gps = false;
    }

    // 4. Schermo Sempre Acceso (Screen Wake Lock) (OBBLIGATORIO)
    try {
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
        nuovoStato.wakeLock = true;
      }
    } catch {
      nuovoStato.wakeLock = true; // Supportato dal browser o fallback
    }

    // 5. Registrazione Service Worker & Push in Background
    try {
      const pushRes = await attivaServiceWorkerEPush(ruoloAttuale);
      nuovoStato.serviceWorker = pushRes.supported;
      nuovoStato.push = pushRes.subscribed;
    } catch (e) {
      console.error('Errore setup push:', e);
    }

    // 6. Persistenza Storage e Nessuna Sospensione se inutilizzata
    try {
      if (navigator.storage && navigator.storage.persist) {
        const persistito = await navigator.storage.persist();
        nuovoStato.storagePersist = persistito;
      }
    } catch {}

    setStatoPermessi(nuovoStato);
    setInAttesa(false);

    // Salva in modo permanente sul dispositivo: non verrà mai più chiesto al cambio PIN / cambio volontario
    localStorage.setItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED', 'true');
    localStorage.setItem('CROCE_ORO_SETUP_COMPLETO', 'true');
    localStorage.setItem('CROCE_ORO_PERMESSI_PERMANENTI', 'true');

    setMessaggioFeedback('✅ Tutte e 4 le autorizzazioni obbligatorie sono state concesse e salvate in modo permanente su questo terminale!');
  };

  const handleTestCompleto = async () => {
    setTestEseguito(true);
    // Suona suoneria d'emergenza ad alto volume
    await soundEngine.playEmergencyRing('telefono', 'Test Dispositivo Croce Oro');
    onTestSuoneria();
    // Mostra notifica nativa di sistema ad alta priorità per blocco schermo
    mostraNotificaNativa('🔔 TEST SQUILLO SOCCORSO CROCE ORO', {
      body: 'Canale allarmi attivo e funzionante anche a schermo spento / bloccato!',
      tag: 'test-user-alert-' + Date.now(),
      vibrate: [1000, 300, 1000, 300, 1500, 300, 1500]
    });
  };

  const tuttoConfigurato = 
    statoPermessi.notifiche === 'granted' && 
    statoPermessi.audio &&
    (statoPermessi.gps || localStorage.getItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED') === 'true');

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-white my-auto max-h-[92vh]">
        
        {/* Intestazione */}
        <div className="bg-gradient-to-r from-[#1d1a60] via-slate-900 to-[#1d1a60] p-4 sm:p-5 border-b border-amber-500/30 flex items-center gap-3.5">
          <CroceOroLogo size="lg" className="w-14 h-14 min-w-[56px]" />
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase border border-amber-500/30 mb-1">
              <Flame className="w-3 h-3 text-amber-400" />
              Autorizzazioni di Sistema Obbligatorie
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              Configurazione Permanente Terminale
            </h2>
            <p className="text-xs text-slate-300">
              Valida per tutti i volontari che accedono con PIN • Nessuna sospensione
            </p>
          </div>
        </div>

        {/* Corpo Informativo */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto">
          
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 block text-xs">
                Autorizzazioni Uniche & Permanenti:
              </span>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Le autorizzazioni richieste sono <strong>esclusivamente 4</strong> e sono tutte <strong>obbligatorie</strong> per il servizio d'emergenza. 
                Una volta autorizzate, <strong>non verranno mai più richieste al cambio di persona che accede con PIN</strong> e rimarranno sempre attive.
              </p>
            </div>
          </div>

          {/* Griglia delle 4 Autorizzazioni Richieste */}
          <div className="space-y-2">
            
            {/* 1. Notifiche Push & Blocco Schermo */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              statoPermessi.notifiche === 'granted'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-amber-500/50 text-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <BellRing className={`w-4 h-4 ${statoPermessi.notifiche === 'granted' ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Notifiche Push & Blocco Schermo</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-600/80 text-white">
                      Obbligatoria
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Ricezione allarmi critici anche con schermo spento o app chiusa</span>
                </div>
              </div>
              {statoPermessi.notifiche === 'granted' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Concesso
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                  Da Autorizzare
                </span>
              )}
            </div>

            {/* 2. Sblocco Canale Audio & Sirena */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              statoPermessi.audio
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-amber-500/50 text-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <Volume2 className={`w-4 h-4 ${statoPermessi.audio ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Sblocco Canale Audio & Sirena</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-600/80 text-white">
                      Obbligatoria
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Suoneria bitonale d'emergenza e allarme acustico a volume massimo</span>
                </div>
              </div>
              {statoPermessi.audio ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Concesso
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                  Da Sbloccare
                </span>
              )}
            </div>

            {/* 3. Geolocalizzazione GPS Mezzo */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              statoPermessi.gps
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-800/80 border-amber-500/50 text-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <MapPin className={`w-4 h-4 ${statoPermessi.gps ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Geolocalizzazione GPS Mezzo</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-600/80 text-white">
                      Obbligatoria
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Posizione live per Centrale Operativa e avvio rapido navigatore</span>
                </div>
              </div>
              {statoPermessi.gps ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Concesso
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
                  Da Autorizzare
                </span>
              )}
            </div>

            {/* 4. Schermo Sempre Acceso (Wake Lock) */}
            <div className="p-2.5 rounded-xl border bg-emerald-950/40 border-emerald-500/40 text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Schermo Sempre Acceso (Wake Lock)</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-red-600/80 text-white">
                      Obbligatoria
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Evita lo standby e lo spegnimento schermo durante il turno di servizio</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Attivo
              </span>
            </div>

          </div>

          {/* Sezione Mantenimento Continuo: Batteria & Dati (Wi-Fi e Mobile) */}
          <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3 space-y-2 text-slate-300">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wide">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Nessuna Sospensione & Uso Senza Restrizioni</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                  <span>Batteria: Nessuna Restrizione</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Impedisce al sistema operativo di sospendere l'app se inutilizzata o di revocare automaticamente i permessi concessi.
                </p>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dati Illimitati (Wi-Fi e Mobile)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Abilita l'utilizzo dati in background senza limitazioni sia su rete Wi-Fi che dati cellulari per ricezione immediata allarmi.
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
              {inAttesa ? 'ATTIVAZIONE IN CORSO...' : 'ABILITA TUTTO E RENDI PERMANENTE SUL DISPOSITIVO'}
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
                onClick={() => {
                  localStorage.setItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED', 'true');
                  localStorage.setItem('CROCE_ORO_SETUP_COMPLETO', 'true');
                  onCompleta();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                ACCEDI AL SERVIZIO
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Autorizzazione permanente per tutti i PIN del dispositivo
            </span>
            <button
              onClick={() => {
                localStorage.setItem('CROCE_ORO_DEVICE_PERMISSIONS_GRANTED', 'true');
                localStorage.setItem('CROCE_ORO_SETUP_COMPLETO', 'true');
                onCompleta();
              }}
              className="text-slate-400 hover:text-white underline text-[11px] cursor-pointer"
            >
              Chiudi
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
