import React, { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Car,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Send,
  AlertCircle
} from 'lucide-react';
import {
  ChecklistTemplate,
  ChecklistCompilataTurno,
  RisultatoVoceChecklist,
  CategoriaVoceChecklist
} from '../types/checklistTypes';
import { Volontario } from './DatabaseVolontariModal';
import { CHECKLIST_TEMPLATES_INIZIALI, trovaTemplatePerTipo, deduciTipoMezzoDaNome } from '../data/checklistMockData';
import { getTipologieAssociateTemplate } from '../types/checklistTypes';
import { MezzoFlotta } from '../types/adminTypes';
import { formatDateTimeItaly } from '../utils/italianTime';

export interface ModalChecklistInizioTurnoGuidataProps {
  isOpen: boolean;
  template?: ChecklistTemplate;
  templates?: ChecklistTemplate[];
  mezzoSigla?: string;
  mezzo?: string;
  flottaMezzi?: string[];
  mezziFlotta?: MezzoFlotta[];
  volontario: Volontario;
  ruoloTurno?: string;
  onConferma?: (compilata: ChecklistCompilataTurno) => void;
  onConfermaOperativita?: (compilata: ChecklistCompilataTurno) => void;
  onAnnulla?: () => void;
  onClose?: () => void;
}

export const ModalChecklistInizioTurnoGuidata: React.FC<ModalChecklistInizioTurnoGuidataProps> = ({
  isOpen,
  template,
  templates,
  mezzoSigla,
  mezzo,
  flottaMezzi,
  mezziFlotta,
  volontario,
  ruoloTurno,
  onConferma,
  onConfermaOperativita,
  onAnnulla,
  onClose
}) => {
  const hasMezzoPreassegnato = Boolean((mezzoSigla || mezzo || '').trim());
  const listaSigleMezzi = React.useMemo(() => {
    const base = new Set<string>(flottaMezzi || []);
    (mezziFlotta || []).forEach(m => {
      if (m?.sigla) base.add(m.sigla);
    });
    return Array.from(base);
  }, [flottaMezzi, mezziFlotta]);

  const [mezzoSelezionato, setMezzoSelezionato] = useState<string>(
    mezzoSigla || mezzo || (listaSigleMezzi && listaSigleMezzi[0]) || 'Mezzo'
  );
  React.useEffect(() => {
    const incoming = mezzoSigla || mezzo;
    if (incoming && incoming.trim()) {
      setMezzoSelezionato(incoming);
    } else if (listaSigleMezzi.length > 0 && !listaSigleMezzi.includes(mezzoSelezionato)) {
      setMezzoSelezionato(listaSigleMezzi[0]);
    }
  }, [mezzoSigla, mezzo, listaSigleMezzi]);

  const effMezzo = mezzoSelezionato || 'Mezzo';
  const effRuolo = ruoloTurno || volontario?.qualifica || 'Soccorritore';
  const handleFinalConferma = onConfermaOperativita || onConferma || (() => {});
  const handleFinalAnnulla = onClose || onAnnulla || (() => {});

  const siglaNorm = effMezzo.split(' ')[0].trim().toUpperCase();
  const mezzoArchivio = React.useMemo(() => {
    if (!mezziFlotta || mezziFlotta.length === 0) return undefined;
    return mezziFlotta.find(
      (m) =>
        m.sigla.toUpperCase() === siglaNorm ||
        effMezzo.toUpperCase().includes(m.sigla.toUpperCase())
    );
  }, [mezziFlotta, siglaNorm, effMezzo]);

  const tipoMezzoEffettivo = mezzoArchivio?.tipo || deduciTipoMezzoDaNome(effMezzo);
  const activeTemplate =
    template ||
    (templates ? trovaTemplatePerTipo(templates, tipoMezzoEffettivo, effMezzo) : undefined) ||
    CHECKLIST_TEMPLATES_INIZIALI[0];
  const tipologieTemplateLabel = getTipologieAssociateTemplate(activeTemplate).join(', ') || activeTemplate.tipologiaMezzo;

  // Stato delle risposte: mappa voceId -> { conforme: boolean, noteKo: string }
  const [risposte, setRisposte] = useState<Record<string, { conforme: boolean; noteKo: string }>>(() => {
    const init: Record<string, { conforme: boolean; noteKo: string }> = {};
    (activeTemplate.voci || []).forEach(v => {
      init[v.id] = { conforme: true, noteKo: '' };
    });
    return init;
  });

  React.useEffect(() => {
    setRisposte(prev => {
      const next: Record<string, { conforme: boolean; noteKo: string }> = {};
      (activeTemplate.voci || []).forEach(v => {
        next[v.id] = prev[v.id] || { conforme: true, noteKo: '' };
      });
      return next;
    });
  }, [activeTemplate.id]);

  const [kmIniziali, setKmIniziali] = useState<string>('');
  const [noteGenerali, setNoteGenerali] = useState<string>('');
  const [erroreValidazione, setErroreValidazione] = useState<string | null>(null);

  if (!isOpen) return null;

  // Raggruppa le voci per categoria
  const categorieUniche = Array.from(new Set(activeTemplate.voci.map(v => v.categoria))) as CategoriaVoceChecklist[];

  const handleToggleConforme = (voceId: string, valore: boolean) => {
    setRisposte(prev => ({
      ...prev,
      [voceId]: {
        conforme: valore,
        noteKo: valore ? '' : (prev[voceId]?.noteKo || '')
      }
    }));
    setErroreValidazione(null);
  };

  const handleSetNoteKo = (voceId: string, note: string) => {
    setRisposte(prev => ({
      ...prev,
      [voceId]: {
        ...prev[voceId],
        noteKo: note
      }
    }));
  };

  // Funzione rapida per contrassegnare tutte le voci come conformi
  const handleSegnaTuttoConforme = () => {
    const agg: Record<string, { conforme: boolean; noteKo: string }> = {};
    activeTemplate.voci.forEach(v => {
      agg[v.id] = { conforme: true, noteKo: '' };
    });
    setRisposte(agg);
    setErroreValidazione(null);
  };

  // Conteggio conformi e anomalie
  const totaleVoci = activeTemplate.voci.length;
  const vociNonConformiList = activeTemplate.voci.filter(v => risposte[v.id]?.conforme === false);
  const numeroAnomalie = vociNonConformiList.length;
  const numeroConformi = totaleVoci - numeroAnomalie;
  const haAnomalieCritiche = vociNonConformiList.some(v => v.critica);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validazione: se ci sono voci non conformi, verificare che sia stata specificata la nota
    for (const v of vociNonConformiList) {
      const nota = risposte[v.id]?.noteKo?.trim();
      if (!nota) {
        setErroreValidazione(`⚠️ Inserisci una breve nota per l'anomalia rilevata su: "${v.titolo}".`);
        return;
      }
    }

    const risultati: RisultatoVoceChecklist[] = activeTemplate.voci.map(v => {
      const resp = risposte[v.id] || { conforme: true, noteKo: '' };
      return {
        voceId: v.id,
        titolo: v.titolo,
        categoria: v.categoria,
        conforme: resp.conforme,
        noteKo: resp.conforme ? undefined : resp.noteKo,
        critica: v.critica
      };
    });

    const anomalieRilevate: string[] = vociNonConformiList.map(v => {
      const n = risposte[v.id]?.noteKo?.trim();
      return `${v.titolo}: ${n || 'Non conforme'}`;
    });

    const compilata: ChecklistCompilataTurno = {
      id: `chk-comp-${Date.now()}`,
      templateId: activeTemplate.id,
      templateTitolo: activeTemplate.titolo,
      tipologiaMezzo: mezzoArchivio?.tipo || tipologieTemplateLabel,
      mezzoSigla: effMezzo.split(' ')[0] || effMezzo,
      mezzoModello: mezzoArchivio?.modello || effMezzo,
      volontarioId: volontario.id,
      volontarioNome: `${volontario.nome} ${volontario.cognome || ''}`.trim(),
      qualificaTurno: effRuolo,
      dataOraCompilazione: formatDateTimeItaly(undefined, false),
      tuttoConforme: numeroAnomalie === 0,
      totaleVoci,
      vociConformi: numeroConformi,
      vociNonConformi: numeroAnomalie,
      anomalieRilevate,
      noteGenerali: noteGenerali.trim() || undefined,
      kmInizialiDichiarati: kmIniziali ? Number(kmIniziali) : undefined,
      risultati,
      firmaVolontarioBase64: volontario.firmaBase64,
      statoCentrale: 'In Attesa'
    };

    handleFinalConferma(compilata);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[120] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-2xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden ring-4 ring-amber-500/20 text-slate-100">
        
        {/* Header Modale */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/60 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg shadow-amber-500/30">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Controllo Inizio Turno Guidato
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {mezzoArchivio?.tipo || tipologieTemplateLabel}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight truncate mt-0.5">
                {activeTemplate.titolo}
              </h3>
              <p className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                <span>🚑 Mezzo: <strong className="text-amber-400">{effMezzo}</strong></span>
                <span>•</span>
                <span>👤 <strong className="text-emerald-300">{volontario.nome} {volontario.cognome || ''}</strong> ({effRuolo})</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinalAnnulla}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm shrink-0 transition-colors cursor-pointer"
            title="Annulla"
          >
            ✕
          </button>
        </div>

        {/* Barra di Riepilogo Rapido & Pulsante "Segna Tutti Conformi" */}
        <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">Stato Controlli:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-black text-[11px] font-mono flex items-center gap-1.5 ${
              numeroAnomalie === 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
            }`}>
              {numeroAnomalie === 0 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{numeroConformi}/{totaleVoci} Conformi (100% OK)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>{numeroAnomalie} Anomalie Rilevate</span>
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSegnaTuttoConforme}
            className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/50 font-black text-[11px] uppercase flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            title="Imposta tutte le voci come conformi con un solo clic rapido"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>✓ Segna Tutte Conformi (Rapido)</span>
          </button>
        </div>

        {/* Errore di validazione se presente */}
        {erroreValidazione && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-red-950/90 border border-red-500 text-red-200 text-xs flex items-center gap-2 animate-shake shadow-lg shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{erroreValidazione}</span>
          </div>
        )}

        {/* Corpo Lista Controlli Raggruppati per Categoria */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {!hasMezzoPreassegnato && flottaMezzi && flottaMezzi.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-amber-200 font-bold">
                <Car className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Seleziona il mezzo su cui effettui la checklist:</span>
              </div>
              <select
                value={mezzoSelezionato}
                onChange={(e) => setMezzoSelezionato(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/50 text-amber-300 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {flottaMezzi.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-slate-300 leading-snug">
            Prima di iniziare il turno e dare operatività alla Centrale, spunta a crocette lo stato delle dotazioni di bordo. Se una voce presenta un'anomalia, tocca la <strong>croce rossa (✗)</strong> e scrivi una breve nota descrittiva.
          </p>

          {categorieUniche.map((cat) => {
            const vociDellaCategoria = activeTemplate.voci.filter(v => v.categoria === cat);
            const nonConformiInCat = vociDellaCategoria.filter(v => risposte[v.id]?.conforme === false).length;

            return (
              <div
                key={cat}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-inner"
              >
                {/* Header Categoria */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <span>📁</span>
                    <span>{cat}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {vociDellaCategoria.length} {vociDellaCategoria.length === 1 ? 'controllo' : 'controlli'}
                    {nonConformiInCat > 0 && (
                      <strong className="text-red-400 ml-1.5 font-bold">({nonConformiInCat} KO)</strong>
                    )}
                  </span>
                </div>

                {/* Voci della Categoria */}
                <div className="space-y-2">
                  {vociDellaCategoria.map((voce) => {
                    const isConforme = risposte[voce.id]?.conforme ?? true;
                    const notaKo = risposte[voce.id]?.noteKo || '';

                    return (
                      <div
                        key={voce.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isConforme
                            ? 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                            : 'bg-red-950/40 border-red-500/70 ring-1 ring-red-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white leading-snug">
                                {voce.titolo}
                              </span>
                              {voce.critica && (
                                <span className="px-1.5 py-0.2 rounded bg-red-600/30 text-red-300 border border-red-500/40 text-[9px] font-black uppercase font-mono">
                                  Critica
                                </span>
                              )}
                            </div>
                            {voce.descrizione && (
                              <p className="text-[10.5px] text-slate-400 mt-0.5 leading-tight">
                                {voce.descrizione}
                              </p>
                            )}
                          </div>

                          {/* Pulsanti Rapidi Crocette Sì / No */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Conforme (✓) */}
                            <button
                              type="button"
                              onClick={() => handleToggleConforme(voce.id, true)}
                              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                isConforme
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400'
                                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                              }`}
                              title="Segna come Conforme"
                            >
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              <span className="hidden sm:inline">OK</span>
                            </button>

                            {/* Non Conforme (✗) */}
                            <button
                              type="button"
                              onClick={() => handleToggleConforme(voce.id, false)}
                              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                !isConforme
                                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 ring-2 ring-red-400'
                                  : 'bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-slate-700 border border-slate-700'
                              }`}
                              title="Segna come Non Conforme / Anomalia"
                            >
                              <XCircle className="w-4 h-4 text-white" />
                              <span className="hidden sm:inline">KO</span>
                            </button>
                          </div>
                        </div>

                        {/* Box Descrizione Anomalia se Non Conforme */}
                        {!isConforme && (
                          <div className="mt-2.5 pt-2 border-t border-red-500/30 animate-in fade-in space-y-1">
                            <label className="block text-[10px] font-bold text-red-300 uppercase">
                              ⚠️ Dettaglio Anomalia Riscontrata * (obbligatorio se KO)
                            </label>
                            <input
                              type="text"
                              value={notaKo}
                              onChange={(e) => handleSetNoteKo(voce.id, e.target.value)}
                              placeholder="Es: livello sotto il minimo, lampadina anabbagliante sx spenta, bombola a 90 bar..."
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-red-400/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-400 font-medium"
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Dati Addizionali: KM Iniziali e Note Operative */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300 block">
              Dati Operativi Inizio Turno (Opzionali)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Chilometri Iniziali Veicolo (da contachilometri)
                </label>
                <input
                  type="number"
                  value={kmIniziali}
                  onChange={(e) => setKmIniziali(e.target.value)}
                  placeholder="Es. 42150"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Eventuali Note Aggiuntive per la Centrale
                </label>
                <input
                  type="text"
                  value={noteGenerali}
                  onChange={(e) => setNoteGenerali(e.target.value)}
                  placeholder="Es. Sostituito rotolo carta lettino, tutto pronto"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer con Azioni di Invio e Conferma */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleFinalAnnulla}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Annulla e Torna Indietro
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer ${
              numeroAnomalie === 0
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400 shadow-emerald-950/40'
                : haAnomalieCritiche
                ? 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border border-red-400 shadow-red-950/40 animate-pulse'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border border-amber-300 shadow-amber-950/40'
            }`}
          >
            {numeroAnomalie === 0 ? (
              <>
                <Send className="w-4 h-4 text-white" />
                <span>🚀 CONFERMA VERIFICA & DAI OPERATIVITÀ ALLA CENTRALE</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>⚠️ SEGNALA {numeroAnomalie} ANOMALIE & DAI OPERATIVITÀ</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
