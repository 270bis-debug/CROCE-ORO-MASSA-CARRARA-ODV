import React from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Mail,
  ShieldAlert,
  X,
  User,
  Radio,
  Clock,
  Phone,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Volontario } from './DatabaseVolontariModal';

interface ModalDecisioneSbloccoAdminProps {
  isOpen: boolean;
  onClose: () => void;
  accountBloccati: Volontario[];
  onAzzeraSbagliESblocca: (v: Volontario) => void;
  onAzzeraESpedisciInvitoReset: (v: Volontario) => void;
  onApriDatabaseCompleto?: () => void;
}

export const ModalDecisioneSbloccoAdmin: React.FC<ModalDecisioneSbloccoAdminProps> = ({
  isOpen,
  onClose,
  accountBloccati,
  onAzzeraSbagliESblocca,
  onAzzeraESpedisciInvitoReset,
  onApriDatabaseCompleto
}) => {
  if (!isOpen || accountBloccati.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 overflow-y-auto overscroll-y-contain">
      <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-xl w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Intestazione Allarme Sicurezza */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 p-4 sm:p-5 border-b border-red-500/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 shadow-lg">
              <ShieldAlert className="w-7 h-7 text-red-400 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/30 border border-red-400 text-red-200 text-[10px] font-black uppercase tracking-wider mb-1">
                <span>Notifica Amministratore</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Blocco Sicurezza: 3 Tentativi PIN Errati
              </h3>
              <p className="text-xs text-red-200/90 mt-0.5">
                {accountBloccati.length === 1
                  ? 'Un account ha esaurito i 3 tentativi ed è stato bloccato.'
                  : `${accountBloccati.length} account hanno esaurito i 3 tentativi e sono bloccati.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Chiudi avviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Notifica con Elenco Account Bloccati */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <p>
              In qualità di <strong>Amministratore</strong> della Centrale Operativa, puoi decidere per ciascun utente bloccato se <strong>azzerare gli sbagli</strong> per consentirgli di riprovare con il PIN attuale, oppure <strong>azzerare gli sbagli e inviare un invito email per il reset</strong> della password/PIN.
            </p>
          </div>

          <div className="space-y-3">
            {accountBloccati.map((v) => {
              const isOperatore = v.profiloCentrale || v.qualifica === 'Operatore Centrale';

              return (
                <div
                  key={v.id}
                  className="bg-slate-950 rounded-2xl border-2 border-red-500/40 p-4 shadow-lg space-y-3"
                >
                  {/* Dettagli Account */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm sm:text-base">
                          {v.nome} {v.cognome}
                        </span>
                        {isOperatore ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            <Radio className="w-3 h-3 text-purple-400" />
                            Operatore Centrale
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            v.qualifica === 'Autista'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}>
                            {v.qualifica}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-3 flex-wrap">
                        <span>Matricola: <strong className="text-white">{v.matricola || 'N/D'}</strong></span>
                        {v.telefono && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {v.telefono}
                          </span>
                        )}
                        {v.email && (
                          <span className="flex items-center gap-1 text-amber-300/90 truncate max-w-[200px]">
                            <Mail className="w-3 h-3 text-amber-400 shrink-0" />
                            {v.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-red-950 text-red-300 border border-red-500/50">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        3/3 Errori PIN
                      </span>
                      {v.dataBlocco && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Bloccato: {v.dataBlocco}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Azioni Decisionali Amministratore */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2">
                    {/* Decisione 1: Azzera sbagli e sblocca */}
                    <button
                      type="button"
                      onClick={() => onAzzeraSbagliESblocca(v)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-white border border-slate-700 hover:border-emerald-500/50 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow"
                    >
                      <RotateCcw className="w-4 h-4 text-emerald-400" />
                      <span>Azzera Sbagli e Sblocca</span>
                    </button>

                    {/* Decisione 2: Azzera sbagli e fa partire invito reset password */}
                    <button
                      type="button"
                      onClick={() => onAzzeraESpedisciInvitoReset(v)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <Mail className="w-4 h-4 text-slate-950" />
                      <span>Azzera & Invia Invito Reset</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer con opzioni secondarie */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
          {onApriDatabaseCompleto ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onApriDatabaseCompleto();
              }}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Vedi nel Database Profili Completo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-slate-500">Croce Oro Massa Carrara • Sicurezza</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-all cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
