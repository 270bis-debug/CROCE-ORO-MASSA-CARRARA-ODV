import React from 'react';
import { Trash2, AlertTriangle, RotateCcw, X, Info } from 'lucide-react';
import { calcolaProssimoNumeroMissione, estraiProgressivoDaCodice } from '../App';
import { getCurrentYearItaly } from '../utils/italianTime';

export interface ModalConfermaEliminaServizioProps {
  isOpen: boolean;
  onClose: () => void;
  onConferma: () => void;
  servizi: any[];
  archivioCompleto: any[];
  currentProg: number;
  isLoading: boolean;
}

export const ModalConfermaEliminaServizio: React.FC<ModalConfermaEliminaServizioProps> = ({
  isOpen,
  onClose,
  onConferma,
  servizi,
  archivioCompleto,
  currentProg,
  isLoading
}) => {
  if (!isOpen || !servizi || servizi.length === 0) return null;

  const currentYear = getCurrentYearItaly();
  const idsToDelete = servizi.map(s => s.id || s.codice);
  const remainingAfter = archivioCompleto.filter(s => !idsToDelete.includes(s.id) && !idsToDelete.includes(s.codice));
  const newProg = calcolaProssimoNumeroMissione(remainingAfter, null, currentYear);
  const haRecuperato = newProg < currentProg;

  // Ordina i servizi da eliminare per codice/data decrescente per chiarezza visiva
  const serviziOrdinati = [...servizi].sort((a, b) => {
    const progA = estraiProgressivoDaCodice(a.codice, currentYear) || 0;
    const progB = estraiProgressivoDaCodice(b.codice, currentYear) || 0;
    return progB - progA;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[130] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[92vh] overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0 shadow-inner">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-white tracking-wide">
                {servizi.length === 1
                  ? 'Elimina Servizio dal Database'
                  : `Elimina ${servizi.length} Servizi dal Database`}
              </h3>
              <p className="text-xs text-slate-400">
                Azione riservata all'Amministratore • Controllo progressivi cronologici
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avviso generale */}
        <div className="bg-red-950/40 border border-red-500/50 p-3 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-red-300 font-bold block mb-0.5">
              ATTENZIONE: Operazione permanente
            </strong>
            Stai per rimuovere dal database storico {servizi.length === 1 ? 'il seguente servizio' : `i seguenti ${servizi.length} servizi`}.
          </div>
        </div>

        {/* Elenco dei servizi selezionati */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            {servizi.length === 1 ? 'Servizio selezionato:' : `Servizi da rimuovere (${servizi.length}):`}
          </span>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60 rounded-xl bg-slate-950/70 p-2.5 border border-slate-800">
            {serviziOrdinati.map((s) => {
              const prog = estraiProgressivoDaCodice(s.codice, currentYear);
              return (
                <div key={s.id || s.codice} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-amber-400 flex items-center gap-1.5 flex-wrap">
                      <span>{s.codice}</span>
                      {prog !== null && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Prog. #{prog}
                        </span>
                      )}
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {s.anno}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
                      🚑 {s.mezzo} • 📅 {s.data}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {s.kmTotali ? `${s.kmTotali} KM` : s.inAttesaKm ? 'In attesa KM' : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sezione Recupero Numero Progressivo di Missione */}
        <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed transition-all ${
          haRecuperato
            ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200 ring-1 ring-emerald-500/30'
            : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }`}>
          {haRecuperato ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs sm:text-sm">
                <RotateCcw className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>RECUPERO NUMERO MISSIONE RILEVATO</span>
              </div>
              <p className="text-[11.5px] text-emerald-200 leading-snug">
                Hai selezionato il servizio più recente (o servizi consecutivi recenti).
                Il numero progressivo viene <strong>automaticamente recuperato</strong> e sarà riutilizzato per il primo nuovo servizio salvato:
              </p>
              <div className="flex items-center justify-center gap-3 py-2 font-mono font-bold bg-slate-900/90 rounded-xl border border-emerald-500/40 shadow-inner">
                <div className="text-center">
                  <span className="text-[9px] text-slate-500 block uppercase">Prima</span>
                  <span className="text-xs text-slate-400 line-through">
                    N° {String(currentProg).padStart(3, '0')}
                  </span>
                </div>
                <span className="text-emerald-400 text-base">➔</span>
                <div className="text-center">
                  <span className="text-[9px] text-emerald-400 font-bold block uppercase">Recuperato</span>
                  <span className="text-sm text-emerald-300 font-black px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400">
                    N° {String(newProg).padStart(3, '0')}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-emerald-300/90 font-medium bg-emerald-900/30 p-2 rounded-lg border border-emerald-600/30 flex items-center gap-1.5">
                <span>✓</span>
                <span>
                  Prossimo nuovo servizio: <strong className="text-white font-mono">CO-...-{currentYear}-{String(newProg).padStart(3, '0')}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Progressivo di Missione Invariato</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                I servizi selezionati non sono i più recenti cronologicamente nel database del {currentYear} (sono presenti altre missioni con progressivo più elevato). Il prossimo codice disponibile rimarrà <strong className="text-amber-300 font-mono">N° {String(currentProg).padStart(3, '0')}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Pulsanti di Azione */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConferma}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-red-950/60 active:scale-95 transition-all cursor-pointer border border-red-400 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isLoading
                ? 'Eliminazione in corso...'
                : servizi.length === 1
                  ? 'Conferma Eliminazione'
                  : `Elimina ${servizi.length} Servizi`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
