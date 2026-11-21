import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Bell,
  MapPin,
  Camera,
  BookUser,
  HardDrive,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  X,
  Siren,
  RefreshCw,
  Lock,
  Radio,
} from 'lucide-react';
import {
  DevicePermissionId,
  DevicePermissionStateItem,
  PermissionNeededEventDetail,
  EVENT_PERMISSION_REQUIRED,
  EVENT_OPEN_PERMISSIONS_MODAL,
  leggiStatoTutteAutorizzazioni,
  richiediSingolaAutorizzazione,
  assicuraPersistenzaStorageApp,
  segnaSetupPermessiCompletato,
} from '../utils/devicePermissions';

const iconForPerm = (id: DevicePermissionId) => {
  switch (id) {
    case 'notifiche':
      return <Bell className="w-4 h-4 text-amber-400" />;
    case 'radio_background':
      return <Radio className="w-4 h-4 text-emerald-400" />;
    case 'gps':
      return <MapPin className="w-4 h-4 text-emerald-400" />;
    case 'fotocamera_microfono':
      return <Camera className="w-4 h-4 text-sky-400" />;
    case 'contatti':
      return <BookUser className="w-4 h-4 text-indigo-400" />;
    case 'file_memoria':
      return <HardDrive className="w-4 h-4 text-teal-400" />;
    case 'chiamate_sms':
      return <PhoneCall className="w-4 h-4 text-violet-400" />;
  }
};

interface ModalPermessiDispositivoProps {
  ruoloAttuale?: 'admin' | 'volontario';
  volontarioId?: string;
  volontarioNome?: string;
}

export const ModalPermessiDispositivo: React.FC<ModalPermessiDispositivoProps> = ({
  ruoloAttuale = 'volontario',
  volontarioId,
  volontarioNome,
}) => {
  const [apertaCentro, setApertaCentro] = useState(false);
  const [permessi, setPermessi] = useState<DevicePermissionStateItem[]>([]);
  const [loadingId, setLoadingId] = useState<DevicePermissionId | 'all' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [richiestaContestuale, setRichiestaContestuale] = useState<PermissionNeededEventDetail | null>(null);

  const ricaricaStato = useCallback(async () => {
    const lista = await leggiStatoTutteAutorizzazioni();
    setPermessi(lista);
  }, []);

  // All'avvio richiede subito lo storage persistente per impedire la rimozione dati/permessi in inattività
  useEffect(() => {
    assicuraPersistenzaStorageApp().catch(() => {});
    ricaricaStato().catch(() => {});

    const onOpenCenter = () => {
      ricaricaStato().catch(() => {});
      setApertaCentro(true);
    };
    const onNeeded = (e: Event) => {
      const detail = (e as CustomEvent<PermissionNeededEventDetail>).detail;
      if (!detail) return;
      ricaricaStato().catch(() => {});
      setRichiestaContestuale(detail);
    };

    window.addEventListener(EVENT_OPEN_PERMISSIONS_MODAL, onOpenCenter);
    window.addEventListener(EVENT_PERMISSION_REQUIRED, onNeeded);
    return () => {
      window.removeEventListener(EVENT_OPEN_PERMISSIONS_MODAL, onOpenCenter);
      window.removeEventListener(EVENT_PERMISSION_REQUIRED, onNeeded);
    };
  }, [ricaricaStato]);

  const handleRichiediUno = async (id: DevicePermissionId) => {
    setLoadingId(id);
    setFeedback(null);
    const res = await richiediSingolaAutorizzazione(id, {
      role: ruoloAttuale,
      volontarioId,
      volontarioNome,
    });
    await ricaricaStato();
    setFeedback(res.message);
    setLoadingId(null);

    if (richiestaContestuale && richiestaContestuale.permissionId === id && res.status === 'granted') {
      const retry = richiestaContestuale.onRetry;
      setRichiestaContestuale(null);
      if (retry) {
        setTimeout(() => retry(), 150);
      }
    }
  };

  const handleAutorizzaTutti = async () => {
    setLoadingId('all');
    setFeedback(null);
    const ordine: DevicePermissionId[] = [
      'notifiche',
      'radio_background',
      'gps',
      'fotocamera_microfono',
      'file_memoria',
      'contatti',
      'chiamate_sms',
    ];
    for (const id of ordine) {
      await richiediSingolaAutorizzazione(id, {
        role: ruoloAttuale,
        volontarioId,
        volontarioNome,
      });
    }
    segnaSetupPermessiCompletato();
    await ricaricaStato();
    setFeedback('Verifica di tutte le autorizzazioni e della Ricezione Radio in Background (Audio + Push) completata.');
    setLoadingId(null);
  };

  // 1. Modale contestuale quando l'utente usa una funzione la cui autorizzazione manca o è stata rimossa
  if (richiestaContestuale) {
    const targetItem = permessi.find((p) => p.id === richiestaContestuale.permissionId);
    const isDenied = targetItem?.status === 'denied';
    const promptNode = (
      <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-slate-900 border-2 border-amber-500/70 rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl my-auto">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0">
                {iconForPerm(richiestaContestuale.permissionId)}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-white uppercase truncate">Autorizzazione Necessaria</h4>
                <p className="text-[11px] text-amber-300 truncate">{targetItem?.titolo || 'Permesso Dispositivo'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRichiestaContestuale(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain text-xs text-slate-200">
            <p className="leading-relaxed">
              Per utilizzare <strong className="text-white">{richiestaContestuale.azione}</strong> è necessario concedere l&apos;autorizzazione{' '}
              <strong className="text-amber-300">{targetItem?.titolo}</strong> sul dispositivo.
            </p>
            {isDenied && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-[11px] text-rose-200 space-y-1">
                <strong className="flex items-center gap-1 text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Autorizzazione attualmente bloccata o rimossa</span>
                </strong>
                <p>
                  Se il browser/dispositivo non mostra il popup, tocca l&apos;icona del lucchetto/impostazioni nella barra dell&apos;app (o <em>Impostazioni Telefono → App → Croce Oro → Autorizzazioni</em>) e imposta su <strong>Consenti</strong>.
                </p>
              </div>
            )}
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-start gap-2">
              <Siren className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Nota di sicurezza:</strong> la <strong>Comunicazione di Emergenza</strong> resta sempre attiva e funzionante anche senza queste autorizzazioni.
              </span>
            </div>
            {feedback && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-[11px] text-sky-200">
                {feedback}
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRichiestaContestuale(null);
                setApertaCentro(true);
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
            >
              Tutte le Autorizzazioni
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRichiestaContestuale(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Più tardi
              </button>
              <button
                type="button"
                disabled={loadingId !== null}
                onClick={() => handleRichiediUno(richiestaContestuale.permissionId)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                {loadingId ? 'Richiesta...' : 'Consenti Ora'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(promptNode, document.body) : promptNode;
  }

  // 2. Centro completo Gestione Autorizzazioni Dispositivo
  if (!apertaCentro) return null;

  const grantedCount = permessi.filter((p) => p.status === 'granted').length;

  const centerNode = (
    <div className="fixed inset-0 z-[240] bg-black/82 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-sky-500/60 rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl my-auto">
        {/* Header Fisso */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/50 text-sky-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm sm:text-base font-black text-white uppercase truncate">
                Autorizzazioni Dispositivo ({grantedCount}/{permessi.length})
              </h4>
              <p className="text-[11px] text-slate-400 truncate">
                Mantieni attivi tutti i permessi operativi fino a eventuale disinstallazione dell&apos;app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setApertaCentro(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Scrollabile */}
        <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Garanzia Emergenza Sempre Attiva */}
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200 flex items-start gap-2.5">
            <Siren className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300 block font-black uppercase text-[11px]">
                Comunicazione di Emergenza Sempre Garantita
              </strong>
              <p className="text-[11px] text-emerald-100/90 mt-0.5 leading-snug">
                Anche se alcune autorizzazioni risultassero disattivate o negate per errore, la <strong>Comunicazione di Emergenza</strong> e gli avvisi di soccorso restano sempre pienamente operativi.
              </p>
            </div>
          </div>

          {/* Avviso Anti-Revoca Automatica su Device */}
          <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/40 text-[11px] text-indigo-200 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
            <div>
              <strong className="text-indigo-200 block font-bold">
                Protezione contro la rimozione automatica dei permessi in inattività
              </strong>
              <p className="text-indigo-200/90 mt-0.5 leading-snug">
                L&apos;app richiede automaticamente la memoria persistente sul browser. Sui telefoni Android, apri <em>Impostazioni → App → Croce Oro</em> e disattiva <strong>&ldquo;Rimuovi autorizzazioni se l&apos;app non viene utilizzata&rdquo;</strong> affinché i permessi restino attivi fino alla rimozione dell&apos;app.
              </p>
            </div>
          </div>

          {feedback && (
            <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/50 text-[11px] text-sky-200 font-semibold">
              ℹ️ {feedback}
            </div>
          )}

          {/* Elenco 6 Autorizzazioni */}
          <div className="space-y-2">
            {permessi.map((p) => {
              const isOk = p.status === 'granted';
              const isBlocked = p.status === 'denied';
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isOk
                      ? 'bg-emerald-950/25 border-emerald-600/40'
                      : isBlocked
                      ? 'bg-rose-950/25 border-rose-600/50'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {iconForPerm(p.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-white">{p.titolo}</span>
                        <span
                          className={`text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            isOk
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-600/50'
                              : isBlocked
                              ? 'bg-rose-950 text-rose-300 border-rose-600/50'
                              : 'bg-amber-950 text-amber-300 border-amber-600/50'
                          }`}
                        >
                          {isOk ? 'Autorizzata' : isBlocked ? 'Bloccata / Rimossa' : 'Da Autorizzare'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{p.descrizione}</p>
                      {p.dettaglio && (
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{p.dettaglio}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loadingId !== null}
                    onClick={() => handleRichiediUno(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase shrink-0 cursor-pointer transition-all disabled:opacity-50 ${
                      isOk
                        ? 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50'
                        : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
                    }`}
                  >
                    {loadingId === p.id ? 'Attendere...' : isOk ? 'Verifica ✓' : 'Consenti'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Fisso */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => ricaricaStato()}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Aggiorna Stato</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loadingId !== null}
              onClick={handleAutorizzaTutti}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loadingId === 'all' ? 'Richiesta in corso...' : 'Autorizza Tutte Ora'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                segnaSetupPermessiCompletato();
                setApertaCentro(false);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(centerNode, document.body) : centerNode;
};
