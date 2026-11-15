import React, { useState } from 'react';
import { AlertTriangle, X, Ban, ShieldAlert, Phone, User, CheckCircle2 } from 'lucide-react';

interface ModalAnnullaInterventoCentraleProps {
  isOpen: boolean;
  codiceMissione: string;
  mezzoAssegnato: string;
  indirizzoIntervento: string;
  onClose: () => void;
  onConfermaAnnullamento: (dati: {
    motivo: string;
    richiedente: string;
    dettagli?: string;
  }) => void;
}

const MOTIVI_PREDEFINITI = [
  'Richiesta annullata dal segnalante/chiamante',
  'Paziente / Animale non reperibile sul posto',
  'Intervento non più necessario (risolto autonomamente)',
  'Revoca da parte di NUE 112 / Sala Operativa',
  'Revoca da parte di Polizia Municipale / Forze dell\'Ordine',
  'Revoca da parte di ASL Sanità Animale',
  'Soggetto già preso in carico da terzi / proprietario',
  'Altro motivo (specificare)'
];

const RICHIEDENTI_PREDEFINITI = [
  'Chiamante / Segnalante privato',
  'NUE 112 / Sala Operativa',
  'Polizia Municipale',
  'Carabinieri Forestali',
  'Vigili del Fuoco',
  'ASL Sanità Animale',
  'Centrale Operativa Croce Oro',
  'Altro Ente / Richiedente'
];

export const ModalAnnullaInterventoCentrale: React.FC<ModalAnnullaInterventoCentraleProps> = ({
  isOpen,
  codiceMissione,
  mezzoAssegnato,
  indirizzoIntervento,
  onClose,
  onConfermaAnnullamento
}) => {
  const [motivoSelezionato, setMotivoSelezionato] = useState<string>(MOTIVI_PREDEFINITI[0]);
  const [motivoPersonalizzato, setMotivoPersonalizzato] = useState<string>('');
  const [richiedenteSelezionato, setRichiedenteSelezionato] = useState<string>(RICHIEDENTI_PREDEFINITI[0]);
  const [richiedentePersonalizzato, setRichiedentePersonalizzato] = useState<string>('');
  const [noteDettagli, setNoteDettagli] = useState<string>('');
  const [errore, setErrore] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConferma = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);

    const motivoFinale = motivoSelezionato === 'Altro motivo (specificare)'
      ? motivoPersonalizzato.trim()
      : motivoSelezionato;

    const richiedenteFinale = richiedenteSelezionato === 'Altro Ente / Richiedente'
      ? richiedentePersonalizzato.trim()
      : richiedenteSelezionato;

    if (!motivoFinale) {
      setErrore('Devi indicare il motivo dell\'annullamento dell\'intervento.');
      return;
    }

    if (!richiedenteFinale) {
      setErrore('Devi indicare chi ha richiesto l\'annullamento.');
      return;
    }

    onConfermaAnnullamento({
      motivo: motivoFinale,
      richiedente: richiedenteFinale,
      dettagli: noteDettagli.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="p-4 bg-red-950/80 border-b border-red-500/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500/60 flex items-center justify-center text-red-400 shrink-0">
              <Ban className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>Annulla Intervento Operativo</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-red-500/20 text-red-300 border border-red-500/40">
                  {codiceMissione}
                </span>
              </h3>
              <p className="text-xs text-red-200 mt-0.5">
                Mezzo assegnato: <strong className="text-white">🚑 {mezzoAssegnato}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENUTO FORM */}
        <form onSubmit={handleConferma} className="p-5 space-y-4">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="text-slate-400 text-[11px]">Intervento in corso:</div>
            <div className="font-bold text-white truncate">📍 {indirizzoIntervento}</div>
            <div className="text-[11px] text-amber-300 pt-1 border-t border-slate-800/80 mt-1">
              ⚠️ L&apos;annullamento verrà trasmesso istantaneamente a bordo mezzo con segnale acustico e notifica. L&apos;equipaggio <strong>non dovrà compilare gli orari di arrivo/partenza dall&apos;obiettivo e arrivo a destinazione</strong>, ma registrerà esclusivamente Partenza, Fine Missione, Rientro e KM.
            </div>
          </div>

          {errore && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errore}</span>
            </div>
          )}

          {/* MOTIVO ANNULLAMENTO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Motivo dell&apos;Annullamento *
            </label>
            <select
              value={motivoSelezionato}
              onChange={(e) => setMotivoSelezionato(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-medium focus:ring-2 focus:ring-red-400 focus:outline-none"
            >
              {MOTIVI_PREDEFINITI.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {motivoSelezionato === 'Altro motivo (specificare)' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Specifica il motivo *
              </label>
              <input
                type="text"
                autoFocus
                value={motivoPersonalizzato}
                onChange={(e) => setMotivoPersonalizzato(e.target.value)}
                placeholder="Inserisci la motivazione dell'annullamento..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
              />
            </div>
          )}

          {/* CHI HA RICHIESTO L'ANNULLAMENTO */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Chi ha richiesto l&apos;annullamento? *
            </label>
            <select
              value={richiedenteSelezionato}
              onChange={(e) => setRichiedenteSelezionato(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-medium focus:ring-2 focus:ring-red-400 focus:outline-none"
            >
              {RICHIEDENTI_PREDEFINITI.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {richiedenteSelezionato === 'Altro Ente / Richiedente' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Specifica chi ha richiesto l&apos;annullamento *
              </label>
              <input
                type="text"
                autoFocus
                value={richiedentePersonalizzato}
                onChange={(e) => setRichiedentePersonalizzato(e.target.value)}
                placeholder="es. Pattuglia Municipale sul posto, Chiamante Sig. Rossi..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
              />
            </div>
          )}

          {/* NOTE AGGIUNTIVE */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Note Aggiuntive per il Volontario (Facoltativo)
            </label>
            <textarea
              rows={2}
              value={noteDettagli}
              onChange={(e) => setNoteDettagli(e.target.value)}
              placeholder="Eventuali dettagli o disposizioni operative per l'equipaggio..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
          </div>

          {/* FOOTER AZIONI */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Torna Indietro
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>Conferma Annullamento & Notifica Mezzo</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
