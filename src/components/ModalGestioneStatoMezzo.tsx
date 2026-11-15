import React, { useState } from 'react';
import { Wrench, CheckCircle2, AlertTriangle, X, ShieldAlert, ArrowRight, Clock, User, FileText } from 'lucide-react';
import {
  FLOTTA_SUGGERIMENTI,
  SuggerimentoMezzo,
  MezzoFuoriServizio,
  MotivoFuoriServizio,
  MOTIVI_FUORI_SERVIZIO_LABELS
} from '../data/suggerimentiMezzi';
import { CroceOroLogo } from './CroceOroLogo';

interface ModalGestioneStatoMezzoProps {
  isOpen: boolean;
  onClose: () => void;
  mezziFuoriServizio: Record<string, MezzoFuoriServizio>;
  onMettiFuoriServizio: (sigla: string, motivo: MotivoFuoriServizio, note: string) => void;
  onReintegraMezzo: (sigla: string) => void;
  operatoreCorrente?: string;
}

export const ModalGestioneStatoMezzo: React.FC<ModalGestioneStatoMezzoProps> = ({
  isOpen,
  onClose,
  mezziFuoriServizio,
  onMettiFuoriServizio,
  onReintegraMezzo,
  operatoreCorrente = 'Operatore Centrale'
}) => {
  const [mezzoInModifica, setMezzoInModifica] = useState<SuggerimentoMezzo | null>(null);
  const [motivoSelezionato, setMotivoSelezionato] = useState<MotivoFuoriServizio>('riparazione');
  const [noteAggiuntive, setNoteAggiuntive] = useState<string>('');

  if (!isOpen) return null;

  const handleConfermaFuoriServizio = () => {
    if (!mezzoInModifica) return;
    onMettiFuoriServizio(mezzoInModifica.sigla, motivoSelezionato, noteAggiuntive);
    setMezzoInModifica(null);
    setNoteAggiuntive('');
    setMotivoSelezionato('riparazione');
  };

  const fuoriServizioCount = Object.keys(mezziFuoriServizio).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
        
        {/* Header Modale */}
        <div className="bg-slate-950 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <CroceOroLogo size="sm" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  Gestione Flotta: Disponibilità & Manutenzione
                </h3>
                {fuoriServizioCount > 0 ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                    🚨 {fuoriServizioCount} Fuori Servizio
                  </span>
                ) : (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    ✓ Tutti i Mezzi Operativi (8/8)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Funzione esclusiva Centrale Operativa & Amministratore: un mezzo posto fuori servizio non potrà essere selezionato dai volontari fino al reintegro.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Scrollabile */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Box Informativo / Guida */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-amber-200">
            <Wrench className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Regola Operativa di Centrale:</strong> Se un mezzo va in officina per riparazione, tagliando, revisione o manutenzione straordinaria, impostalo su <em>"Fuori Servizio"</em>. Il mezzo risulterà bloccato ed escluso dalla scelta dei volontari a bordo mezzo. Al rientro in sede, clicca su <em>"Reintegra in Servizio"</em> per renderlo nuovamente assegnabile.
            </div>
          </div>

          {/* Griglia dei Mezzi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FLOTTA_SUGGERIMENTI.map((m) => {
              const statoFS = mezziFuoriServizio[m.sigla.toUpperCase()];
              const isFuoriServizio = Boolean(statoFS);

              return (
                <div
                  key={m.sigla}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isFuoriServizio
                      ? 'bg-red-950/30 border-red-500/50 shadow-md ring-1 ring-red-500/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header Scheda Mezzo */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{m.icona}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-black text-white">{m.sigla}</strong>
                            <span className="text-xs text-slate-300 font-medium">— {m.nomeEsteso}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{m.etichettaVolontario}</span>
                        </div>
                      </div>

                      {/* Badge Stato */}
                      <div className="shrink-0">
                        {isFuoriServizio ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white font-black text-[10px] uppercase shadow animate-pulse">
                            <Wrench className="w-3 h-3" /> Fuori Servizio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black text-[10px] uppercase">
                            <CheckCircle2 className="w-3 h-3" /> In Servizio
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dettagli Stato Fuori Servizio se presente */}
                    {isFuoriServizio && statoFS && (
                      <div className="my-2.5 p-2.5 rounded-xl bg-red-950/70 border border-red-500/40 space-y-1.5 text-xs text-red-200">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-red-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            Motivo: {MOTIVI_FUORI_SERVIZIO_LABELS[statoFS.motivo] || statoFS.motivo}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{statoFS.dataOra}</span>
                        </div>
                        {statoFS.note && (
                          <div className="text-[11px] text-slate-300 bg-black/40 p-2 rounded-lg border border-red-500/20 italic">
                            "{statoFS.note}"
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>Disposto da: <strong className="text-white">{statoFS.operatore}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pulsante Azione Centrale */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-end gap-2">
                    {isFuoriServizio ? (
                      <button
                        type="button"
                        onClick={() => onReintegraMezzo(m.sigla)}
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        title={`Reintegra ${m.sigla} nella flotta attiva`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Reintegra in Servizio</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMezzoInModifica(m);
                          setMotivoSelezionato('riparazione');
                          setNoteAggiuntive('');
                        }}
                        className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-red-950/80 hover:text-red-300 text-slate-300 border border-slate-700 hover:border-red-500/50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        title={`Metti temporaneamente fuori servizio ${m.sigla}`}
                      >
                        <Wrench className="w-3.5 h-3.5 text-amber-400" />
                        <span>Metti Fuori Servizio</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-3.5 sm:p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Stato flotta salvato e sincronizzato in tempo reale.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>

      {/* Sottomodale Conferma Messa Fuori Servizio */}
      {mezzoInModifica && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-lg w-full text-white shadow-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">
                    Metti Fuori Servizio: {mezzoInModifica.sigla}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {mezzoInModifica.nomeEsteso}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMezzoInModifica(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Motivo Principale del Fermo Tecnico *
                </label>
                <select
                  value={motivoSelezionato}
                  onChange={(e) => setMotivoSelezionato(e.target.value as MotivoFuoriServizio)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="riparazione">🔧 Riparazione in Officina</option>
                  <option value="manutenzione">⚙️ Manutenzione Ordinaria / Straordinaria</option>
                  <option value="guasto">🚨 Guasto Meccanico / Elettrico Improvviso</option>
                  <option value="revisione">📋 Revisione Periodica / Collaudo Motorizzazione</option>
                  <option value="incidente">💥 Incidente / Sinistro</option>
                  <option value="altro">📦 Altro / Fermo Tecnico Disposto dalla Centrale</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Note Aggiuntive / Officina / Rientro Previsto (opzionale)
                </label>
                <textarea
                  value={noteAggiuntive}
                  onChange={(e) => setNoteAggiuntive(e.target.value)}
                  placeholder="Es. In riparazione presso officina Autorizzata per sostituzione pastiglie freni. Rientro previsto domani ore 14:00."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-[11px] text-red-200 leading-snug">
                ⚠️ <strong>Attenzione:</strong> I volontari che effettuano il login su display di bordo non potranno selezionare <strong>{mezzoInModifica.sigla}</strong> fino al momento del reintegro ufficiale da parte della Centrale.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMezzoInModifica(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfermaFuoriServizio}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Conferma Fuori Servizio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
