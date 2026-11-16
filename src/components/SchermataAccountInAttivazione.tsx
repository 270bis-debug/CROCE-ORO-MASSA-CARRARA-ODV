import React, { useEffect, useState } from 'react';
import { ShieldAlert, Clock, CheckCircle2, ArrowLeft, RefreshCw, KeyRound, Phone, User, Radio, Sparkles } from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import { Volontario } from './DatabaseVolontariModal';
import { realtime } from '../services/realtime';
import { APP_VERSION_LABEL } from '../version';
import { isAccessoDaWeb } from '../utils/accessoWeb';

interface SchermataAccountInAttivazioneProps {
  operatore: Volontario;
  onAccediCentrale: () => void;
  onTornaAllaScelta: () => void;
  onAggiornaStato?: (aggiornato: Volontario) => void;
}

export const SchermataAccountInAttivazione: React.FC<SchermataAccountInAttivazioneProps> = ({
  operatore,
  onAccediCentrale,
  onTornaAllaScelta,
  onAggiornaStato
}) => {
  const [statoOperatore, setStatoOperatore] = useState<Volontario>(operatore);
  const [inVerifica, setInVerifica] = useState(false);
  const [messaggioVerifica, setMessaggioVerifica] = useState<string | null>(null);

  // Sincronizzazione in tempo reale: se l'Amministratore approva l'operatore, rileva immediatamente il cambio
  useEffect(() => {
    const unsub = realtime.on('VOLONTARI_UPDATED', (payload: any) => {
      if (Array.isArray(payload?.volontari)) {
        const trovato = payload.volontari.find((v: Volontario) => v.id === operatore.id || v.pin === operatore.pin);
        if (trovato) {
          setStatoOperatore(trovato);
          if (onAggiornaStato) onAggiornaStato(trovato);
        }
      }
    });

    const unsubSync = realtime.on('POLL_SYNC', (state: any) => {
      if (Array.isArray(state?.volontari)) {
        const trovato = state.volontari.find((v: Volontario) => v.id === operatore.id || v.pin === operatore.pin);
        if (trovato) {
          setStatoOperatore(trovato);
          if (onAggiornaStato) onAggiornaStato(trovato);
        }
      }
    });

    // Controllo periodico ogni 4 secondi se la connessione è attiva
    const interval = setInterval(async () => {
      try {
        const vols = await realtime.fetchVolontari();
        if (vols && Array.isArray(vols)) {
          const trovato = vols.find((v: Volontario) => v.id === operatore.id || v.pin === operatore.pin);
          if (trovato) {
            setStatoOperatore(trovato);
            if (onAggiornaStato) onAggiornaStato(trovato);
          }
        }
      } catch {}
    }, 4000);

    return () => {
      unsub();
      unsubSync();
      clearInterval(interval);
    };
  }, [operatore.id, operatore.pin, onAggiornaStato]);

  const verificaManuale = async () => {
    setInVerifica(true);
    setMessaggioVerifica(null);
    try {
      const vols = await realtime.fetchVolontari();
      if (vols && Array.isArray(vols)) {
        const trovato = vols.find((v: Volontario) => v.id === operatore.id || v.pin === operatore.pin);
        if (trovato) {
          setStatoOperatore(trovato);
          if (onAggiornaStato) onAggiornaStato(trovato);
          if (trovato.approvato) {
            setMessaggioVerifica('✅ Congratulazioni! Il tuo account è stato approvato dall\'Amministratore.');
          } else {
            setMessaggioVerifica('⏳ Account ancora in attivazione. In attesa di approvazione dall\'Amministratore.');
          }
        }
      }
    } catch {
      setMessaggioVerifica('Impossibile contattare il server. Riprova tra poco.');
    } finally {
      setTimeout(() => setInVerifica(false), 500);
    }
  };

  const isApprovato = !!statoOperatore.approvato;

  const isWeb = isAccessoDaWeb();

  return (
    <div
      className={isWeb ? "min-h-screen bg-white text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden font-sans" : "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-y-auto overflow-x-hidden font-sans"}
      style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a' } : undefined}
    >
      {/* Sfondo solo in dark mode */}
      {!isWeb && (
        <>
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#1d1a60]/40 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Header */}
      <div className="relative z-10 max-w-xl mx-auto w-full text-center pt-4">
        <CroceOroLogo size="lg" className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 shadow-2xl shadow-amber-500/20" />
        <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-wider ${isWeb ? 'text-[#1d1a60]' : 'text-amber-400'}`}>
          Croce Oro Massa Carrara OdV
        </h1>
        <p className={`text-xs font-bold font-mono mt-0.5 ${isWeb ? 'text-slate-600' : 'text-slate-300'}`}>
          Centrale Operativa • {APP_VERSION_LABEL}
        </p>
      </div>

      {/* Box Principale */}
      <div
        className={isWeb ? "relative z-10 max-w-xl mx-auto w-full my-6 bg-white border-2 border-amber-600 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900" : "relative z-10 max-w-xl mx-auto w-full my-6 bg-slate-900/95 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-white"}
        style={isWeb ? { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#d97706' } : undefined}
      >
        {!isApprovato ? (
          <>
            {/* Badge Stato */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm animate-pulse border ${
                  isWeb ? 'bg-amber-100 text-amber-950 border-amber-400' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                Account in Attivazione
              </span>
            </div>

            <div className="text-center mb-6">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md border-2 ${
                  isWeb ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}
                style={isWeb ? { backgroundColor: '#f59e0b', color: '#020617', borderColor: '#d97706' } : undefined}
              >
                <Radio className="w-8 h-8" />
              </div>
              <h2 className={`text-xl sm:text-2xl font-black ${isWeb ? 'text-slate-950' : 'text-white'}`}>
                Richiesta in Attesa di Approvazione
              </h2>
              <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isWeb ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                La registrazione del tuo profilo per la <strong className={isWeb ? "text-amber-800" : "text-amber-400"}>Centrale</strong> è stata completata con successo sul device.
                Fino a quando l'<strong>account amministratore</strong> non convalida la richiesta, l'accesso resta in fase di attivazione.
              </p>
            </div>

            {/* Dettagli Profilo Registrato */}
            <div
              className={`rounded-2xl border p-4 space-y-2.5 text-xs mb-6 ${
                isWeb ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950/80 border-slate-800 text-slate-200'
              }`}
              style={isWeb ? { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' } : undefined}
            >
              <div className={`flex items-center justify-between pb-2 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800/80'}`}>
                <span className={`flex items-center gap-1.5 ${isWeb ? 'text-slate-700 font-bold' : 'text-slate-400'}`}>
                  <User className="w-3.5 h-3.5 text-amber-500" /> Profilo Operatore:
                </span>
                <span className={`font-black text-sm ${isWeb ? 'text-slate-950' : 'text-white'}`}>
                  {statoOperatore.nome} {statoOperatore.cognome}
                </span>
              </div>

              <div className={`flex items-center justify-between pb-2 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800/80'}`}>
                <span className={`flex items-center gap-1.5 ${isWeb ? 'text-slate-700 font-bold' : 'text-slate-400'}`}>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Ruolo Assegnato:
                </span>
                <span className={`font-black ${isWeb ? 'text-amber-800' : 'text-amber-400'}`}>
                  Operatore Centrale
                </span>
              </div>

              {statoOperatore.matricola && (
                <div className={`flex items-center justify-between pb-2 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800/80'}`}>
                  <span className={isWeb ? 'text-slate-700 font-bold' : 'text-slate-400'}>Sigla / Matricola:</span>
                  <span className={`font-mono font-bold ${isWeb ? 'text-slate-900' : 'text-slate-200'}`}>{statoOperatore.matricola}</span>
                </div>
              )}

              {statoOperatore.telefono && (
                <div className={`flex items-center justify-between pb-2 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800/80'}`}>
                  <span className={`flex items-center gap-1.5 ${isWeb ? 'text-slate-700 font-bold' : 'text-slate-400'}`}>
                    <Phone className="w-3.5 h-3.5 text-slate-500" /> Telefono:
                  </span>
                  <span className={`font-mono font-bold ${isWeb ? 'text-slate-900' : 'text-slate-200'}`}>{statoOperatore.telefono}</span>
                </div>
              )}

              <div className={`flex items-center justify-between pb-2 border-b ${isWeb ? 'border-slate-300' : 'border-slate-800/80'}`}>
                <span className={`flex items-center gap-1.5 ${isWeb ? 'text-slate-700 font-bold' : 'text-slate-400'}`}>
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" /> PIN Personale:
                </span>
                <span className={`font-mono font-black px-2 py-0.5 rounded border ${
                  isWeb ? 'bg-amber-100 text-amber-950 border-amber-400' : 'bg-slate-900 text-amber-300 border-slate-700'
                }`}>
                  {statoOperatore.pin}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className={isWeb ? 'text-slate-700 font-bold' : 'text-slate-400'}>Stato Abilitazione:</span>
                <span className={`font-black flex items-center gap-1 ${isWeb ? 'text-amber-800' : 'text-amber-400'}`}>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  In Attesa Amministratore
                </span>
              </div>
            </div>

            {messaggioVerifica && (
              <div className={`p-3 rounded-xl text-xs font-bold text-center mb-4 border-2 ${
                messaggioVerifica.includes('Congratulazioni')
                  ? (isWeb ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300')
                  : (isWeb ? 'bg-amber-100 border-amber-400 text-amber-950' : 'bg-amber-500/20 border-amber-500/40 text-amber-300')
              }`}>
                {messaggioVerifica}
              </div>
            )}

            {/* Azioni */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={verificaManuale}
                disabled={inVerifica}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md disabled:opacity-50 border-2 ${
                  isWeb
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                }`}
                style={isWeb ? { backgroundColor: '#f59e0b', color: '#020617', borderColor: '#b45309' } : undefined}
              >
                <RefreshCw className={`w-4 h-4 ${inVerifica ? 'animate-spin' : ''}`} />
                <span>{inVerifica ? 'Verifica in corso...' : 'Verifica Stato Approvazione Ora'}</span>
              </button>

              <button
                type="button"
                onClick={onTornaAllaScelta}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  isWeb
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white border-transparent'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Torna alla Selezione Ruoli</span>
              </button>
            </div>
          </>
        ) : (
          /* Stato APPROVATO */
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 border-2 border-emerald-700 flex items-center justify-center mx-auto mb-3 text-white shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white animate-bounce" />
            </div>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border-2 border-emerald-400 text-xs font-black uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Account Abilitato con Successo!
            </span>

            <h2 className={`text-2xl font-black ${isWeb ? 'text-slate-950' : 'text-white'}`}>
              Benvenuto in Centrale, {statoOperatore.nome}!
            </h2>
            <p className={`text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed ${isWeb ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
              L'Account Amministratore ha approvato il tuo profilo. Puoi ora accedere e utilizzare tutte le funzioni operative della Centrale.
            </p>

            <div className={`mt-6 pt-6 border-t flex flex-col gap-3 ${isWeb ? 'border-slate-300' : 'border-slate-800'}`}>
              <button
                type="button"
                onClick={onAccediCentrale}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer border-2 border-emerald-800"
                style={{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#047857' }}
              >
                <Radio className="w-5 h-5 text-white" />
                <span>Entra Subito in Centrale</span>
              </button>

              <button
                type="button"
                onClick={onTornaAllaScelta}
                className={`text-xs py-1 font-bold ${isWeb ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                Torna alla schermata iniziale
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`relative z-10 max-w-md mx-auto text-center text-[11px] pb-2 ${isWeb ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
        <p>💡 Una notifica è stata recapitata all'amministratore della Centrale Operativa.</p>
      </div>
    </div>
  );
};
