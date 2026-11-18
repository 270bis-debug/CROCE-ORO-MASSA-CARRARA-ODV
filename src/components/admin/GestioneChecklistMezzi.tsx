import React, { useState } from 'react';
import {
  ClipboardCheck,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Car,
  Calendar,
  Clock,
  User,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  FileText,
  Copy,
  Printer,
  Sparkles,
  Info,
  Check,
  Layers,
  Wrench
} from 'lucide-react';
import {
  ChecklistTemplate,
  ChecklistCompilataTurno,
  VoceChecklistTemplate,
  CategoriaVoceChecklist,
  getTipologieAssociateTemplate,
  templateCopreTipologia
} from '../../types/checklistTypes';
import { MezzoFlotta } from '../../types/adminTypes';
import { formatDateItaly } from '../../utils/italianTime';
import { useTipologieMezzo, getIconaTipologiaMezzo } from '../../utils/tipologieMezzo';

interface GestioneChecklistMezziProps {
  templates: ChecklistTemplate[];
  onAggiornaTemplates: (nuovi: ChecklistTemplate[]) => void;
  compilate: ChecklistCompilataTurno[];
  onAggiornaCompilate: (nuove: ChecklistCompilataTurno[]) => void;
  mezzi: MezzoFlotta[];
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onApriGestioneTipologie?: () => void;
}

const CATEGORIE_DISPONIBILI: CategoriaVoceChecklist[] = [
  'Documenti & Dotazioni Bordo',
  'Stato Meccanico & Livelli',
  'Dispositivi Emergenza & Luci',
  'Vano Sanitario & Elettromedicali',
  'Attrezzatura Protezione Civile',
  'Pulizia, Sanificazione & DPI'
];

export const GestioneChecklistMezzi: React.FC<GestioneChecklistMezziProps> = ({
  templates,
  onAggiornaTemplates,
  compilate,
  onAggiornaCompilate,
  mezzi,
  onNotificaRadio,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onApriGestioneTipologie
}) => {
  const tipologieCatalogo = useTipologieMezzo();
  const [vistaAttiva, setVistaAttiva] = useState<'modelli' | 'registro'>('modelli');
  const [filtroTipoMezzo, setFiltroTipoMezzo] = useState<string>('TUTTE');
  const [ricerca, setRicerca] = useState<string>('');

  // Modale Nuovo / Modifica Template
  const [modaleTemplateAperta, setModaleTemplateAperta] = useState(false);
  const [templateInModifica, setTemplateInModifica] = useState<ChecklistTemplate | null>(null);
  const [formTitolo, setFormTitolo] = useState('');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formTipologieMezzo, setFormTipologieMezzo] = useState<string[]>(['Ambulanza Emergenza']);
  const [formVoci, setFormVoci] = useState<VoceChecklistTemplate[]>([]);
  const [erroreFormTemplate, setErroreFormTemplate] = useState<string | null>(null);
  const [templateDaEliminare, setTemplateDaEliminare] = useState<{ id: string; titolo: string } | null>(null);

  // Form aggiunta singola voce nel builder
  const [nuovaVoceTitolo, setNuovaVoceTitolo] = useState('');
  const [nuovaVoceCategoria, setNuovaVoceCategoria] = useState<CategoriaVoceChecklist>('Stato Meccanico & Livelli');
  const [nuovaVoceDescrizione, setNuovaVoceDescrizione] = useState('');
  const [nuovaVoceCritica, setNuovaVoceCritica] = useState(true);

  // Modale visualizzazione dettagli verifica compilata
  const [verificaDettaglio, setVerificaDettaglio] = useState<ChecklistCompilataTurno | null>(null);

  // Tipologie veicolo sincronizzate dal catalogo Tipologia Mezzo + flotta + template esistenti
  const tipologieMezzoDisponibili = React.useMemo(() => {
    const setT = new Set<string>();
    tipologieCatalogo.forEach(t => {
      if (t.nome) setT.add(t.nome);
    });
    mezzi.forEach(m => {
      if (m.tipo) setT.add(m.tipo);
    });
    templates.forEach(t => {
      getTipologieAssociateTemplate(t).forEach(tp => {
        if (tp && tp.toLowerCase() !== 'tutte le tipologie' && tp.toLowerCase() !== 'tutte') {
          setT.add(tp);
        }
      });
    });
    return Array.from(setT);
  }, [tipologieCatalogo, mezzi, templates]);

  // Apri modale per nuovo template
  const apriNuovoTemplate = () => {
    setTemplateInModifica(null);
    setErroreFormTemplate(null);
    setFormTitolo('Nuova Checklist Inizio Turno');
    setFormDescrizione('Controlli e verifiche visive pre-partenza per l\'equipaggio di bordo.');
    setFormTipologieMezzo([tipologieMezzoDisponibili[0] || 'Ambulanza Emergenza']);
    setFormVoci([
      {
        id: `v-${Date.now()}-1`,
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Libretto di circolazione, assicurazione e scheda carburante presenti',
        critica: true,
        obbligatoria: true
      },
      {
        id: `v-${Date.now()}-2`,
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Livelli olio motore, liquido raffreddamento e carburante > 1/2',
        critica: true,
        obbligatoria: true
      },
      {
        id: `v-${Date.now()}-3`,
        categoria: 'Dispositivi Emergenza & Luci',
        titolo: 'Lampeggianti blu e sirena bitonale provati e funzionanti',
        critica: true,
        obbligatoria: true
      }
    ]);
    setModaleTemplateAperta(true);
  };

  // Apri modale per modificare template esistente
  const apriModificaTemplate = (tmpl: ChecklistTemplate) => {
    setTemplateInModifica(tmpl);
    setErroreFormTemplate(null);
    setFormTitolo(tmpl.titolo);
    setFormDescrizione(tmpl.descrizione);
    const assoc = getTipologieAssociateTemplate(tmpl);
    setFormTipologieMezzo(assoc.length > 0 ? assoc : ['Tutte le tipologie']);
    setFormVoci([...tmpl.voci]);
    setModaleTemplateAperta(true);
  };

  // Duplica template
  const duplicaTemplate = (tmpl: ChecklistTemplate) => {
    const nuovo: ChecklistTemplate = {
      ...tmpl,
      id: `chk-${Date.now()}`,
      titolo: `${tmpl.titolo} (Copia)`,
      dataCreazione: formatDateItaly(),
      dataUltimaModifica: formatDateItaly(),
      voci: tmpl.voci.map(v => ({ ...v, id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` }))
    };
    onAggiornaTemplates([nuovo, ...templates]);
    onNotificaRadio?.(`📋 CHECKLIST MEZZI: Duplicato modello "${nuovo.titolo}"`, 'sistema');
  };

  // Conferma eliminazione template
  const confermaEliminaTemplate = () => {
    if (!templateDaEliminare) return;
    const aggiornati = templates.filter(t => t.id !== templateDaEliminare.id);
    onAggiornaTemplates(aggiornati);
    onNotificaRadio?.(`🗑️ CHECKLIST MEZZI: Rimosso modello "${templateDaEliminare.titolo}"`, 'centrale');
    setTemplateDaEliminare(null);
  };

  // Toggle selezione Tipologia Mezzo nel modale template
  const toggleFormTipologiaMezzo = (nome: string) => {
    setErroreFormTemplate(null);
    if (nome === 'Tutte le tipologie') {
      setFormTipologieMezzo(prev => (prev.includes('Tutte le tipologie') ? [] : ['Tutte le tipologie']));
      return;
    }
    setFormTipologieMezzo(prev => {
      const senzaTutte = prev.filter(x => x !== 'Tutte le tipologie' && x !== 'Tutte');
      if (senzaTutte.includes(nome)) {
        return senzaTutte.filter(x => x !== nome);
      }
      return [...senzaTutte, nome];
    });
  };

  // Aggiungi voce al form builder
  const handleAggiungiVoce = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuovaVoceTitolo.trim()) return;

    const nuovaVoce: VoceChecklistTemplate = {
      id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      titolo: nuovaVoceTitolo.trim(),
      categoria: nuovaVoceCategoria,
      descrizione: nuovaVoceDescrizione.trim() || undefined,
      critica: nuovaVoceCritica,
      obbligatoria: true
    };

    setFormVoci(prev => [...prev, nuovaVoce]);
    setNuovaVoceTitolo('');
    setNuovaVoceDescrizione('');
  };

  // Rimuovi voce dal form builder
  const handleRimuoviVoce = (voceId: string) => {
    setFormVoci(prev => prev.filter(v => v.id !== voceId));
  };

  // Salva template creato o modificato
  const handleSalvaTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitolo.trim()) return;
    if (formVoci.length === 0) {
      setErroreFormTemplate('Inserisci almeno una voce di controllo nella checklist.');
      return;
    }
    if (formTipologieMezzo.length === 0) {
      setErroreFormTemplate('Seleziona almeno una Tipologia Mezzo associata a questa checklist.');
      return;
    }

    const tipologiePulite = Array.from(new Set(formTipologieMezzo.map(t => t.trim()).filter(Boolean)));
    const tipologieIds = tipologiePulite
      .map(nome => tipologieCatalogo.find(tc => tc.nome.trim().toLowerCase() === nome.toLowerCase())?.id)
      .filter((id): id is string => Boolean(id));
    const tipoPrimario = tipologiePulite[0] || 'Tutte le tipologie';
    const labelLog = tipologiePulite.join(', ');
    const nowStr = formatDateItaly();

    if (templateInModifica) {
      const aggiornati = templates.map(t =>
        t.id === templateInModifica.id
          ? {
              ...t,
              titolo: formTitolo.trim(),
              descrizione: formDescrizione.trim(),
              tipologiaMezzo: tipoPrimario,
              tipologieMezzo: tipologiePulite,
              tipologieMezzoIds: tipologieIds,
              voci: formVoci,
              dataUltimaModifica: nowStr
            }
          : t
      );
      onAggiornaTemplates(aggiornati);
      onNotificaRadio?.(`📋 CHECKLIST AGGIORNATA: Modello "${formTitolo}" per ${labelLog} salvato nel database.`, 'sistema');
    } else {
      const nuovo: ChecklistTemplate = {
        id: `chk-${Date.now()}`,
        titolo: formTitolo.trim(),
        descrizione: formDescrizione.trim(),
        tipologiaMezzo: tipoPrimario,
        tipologieMezzo: tipologiePulite,
        tipologieMezzoIds: tipologieIds,
        attiva: true,
        dataCreazione: nowStr,
        dataUltimaModifica: nowStr,
        autore: operatoreCorrente,
        voci: formVoci
      };
      onAggiornaTemplates([nuovo, ...templates]);
      onNotificaRadio?.(`📋 NUOVA CHECKLIST MEZZI: Creato modello "${nuovo.titolo}" per ${labelLog}.`, 'sistema');
    }

    setErroreFormTemplate(null);
    setModaleTemplateAperta(false);
  };

  // Segna stato verifica nel registro
  const handleCambiaStatoVerifica = (compilataId: string, nuovoStato: 'Presa in Carico' | 'Anomalia Risolta') => {
    const aggiornate = compilate.map(c =>
      c.id === compilataId ? { ...c, statoCentrale: nuovoStato } : c
    );
    onAggiornaCompilate(aggiornate);
    if (verificaDettaglio?.id === compilataId) {
      setVerificaDettaglio({ ...verificaDettaglio, statoCentrale: nuovoStato });
    }
  };

  // Filtraggio Modelli
  const templatesFiltrati = templates.filter(t => {
    const tipoItem = tipologieCatalogo.find(tc => tc.nome.trim().toLowerCase() === filtroTipoMezzo.trim().toLowerCase());
    const matchTipo = filtroTipoMezzo === 'TUTTE' || templateCopreTipologia(t, filtroTipoMezzo, tipoItem?.id);
    const matchQ = !ricerca.trim() || t.titolo.toLowerCase().includes(ricerca.toLowerCase()) || t.descrizione.toLowerCase().includes(ricerca.toLowerCase()) || t.voci.some(v => v.titolo.toLowerCase().includes(ricerca.toLowerCase()));
    return matchTipo && matchQ;
  });

  // Filtraggio Registro Compilate
  const compilateFiltrate = compilate.filter(c => {
    const matchTipo = filtroTipoMezzo === 'TUTTE' || c.tipologiaMezzo.toLowerCase() === filtroTipoMezzo.toLowerCase();
    const matchQ = !ricerca.trim() || c.mezzoSigla.toLowerCase().includes(ricerca.toLowerCase()) || c.volontarioNome.toLowerCase().includes(ricerca.toLowerCase()) || c.templateTitolo.toLowerCase().includes(ricerca.toLowerCase());
    return matchTipo && matchQ;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Banner Intestazione Sotto-Tab */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50">
                Mezzi & Sicurezza Bordo
              </span>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Checklist Inizio Turno Guidate
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Configura checklist di controllo rapido a crocette differenziate per tipologia di mezzo (Ambulanze, Fuoristrada 4x4, Pulmini). I volontari le compileranno sullo smartphone prima di dare l'operatività alla Centrale.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onApriGestioneTipologie && (
            <button
              type="button"
              onClick={onApriGestioneTipologie}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-black text-xs uppercase flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
            >
              <Car className="w-4 h-4 text-amber-400" />
              <span>Gestisci Tipologie Mezzo</span>
            </button>
          )}
          <button
            type="button"
            onClick={apriNuovoTemplate}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>+ Crea Nuova Checklist per Tipologia</span>
          </button>
        </div>
      </div>

      {/* Navigazione tra Modelli e Registro Verifiche */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVistaAttiva('modelli')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              vistaAttiva === 'modelli'
                ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Modelli per Tipologia Mezzo ({templates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaAttiva('registro')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
              vistaAttiva === 'registro'
                ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-400 font-black'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
            <span>Registro Verifiche Compilate dai Volontari ({compilate.length})</span>
          </button>
        </div>

        {/* Filtri Rapidi */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca mezzo, voce o volontario..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <select
            value={filtroTipoMezzo}
            onChange={(e) => setFiltroTipoMezzo(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-bold text-xs focus:outline-none"
          >
            <option value="TUTTE">Tutte le Tipologie</option>
            {tipologieMezzoDisponibili.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* VISTA 1: MODELLI DI CHECKLIST PER TIPOLOGIA MEZZO */}
      {vistaAttiva === 'modelli' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templatesFiltrati.map((tmpl) => {
            const numeroVociCritiche = tmpl.voci.filter(v => v.critica).length;

            return (
              <div
                key={tmpl.id}
                className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm">
                        📋
                      </span>
                      <div>
                        <div className="flex items-center gap-1 flex-wrap mb-1">
                          {getTipologieAssociateTemplate(tmpl).length === 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 font-mono text-[10px] font-bold text-slate-400 uppercase">
                              Nessuna Tipologia Mezzo associata
                            </span>
                          ) : (
                            getTipologieAssociateTemplate(tmpl).map((tp) => (
                              <span
                                key={tp}
                                className="px-2 py-0.5 rounded-full bg-slate-800 border border-amber-500/40 font-mono text-[10px] font-bold text-amber-300 uppercase"
                              >
                                {getIconaTipologiaMezzo(tp, tipologieCatalogo)} {tp}
                              </span>
                            ))
                          )}
                        </div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">
                          {tmpl.titolo}
                        </h4>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold shrink-0">
                      {tmpl.voci.length} Voci
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {tmpl.descrizione}
                  </p>

                  {/* Sintesi Categorie Coperte */}
                  <div className="mt-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Aree di Controllo ({tmpl.voci.length} voci):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from(new Set(tmpl.voci.map(v => v.categoria))).map(cat => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700"
                        >
                          {cat}
                        </span>
                      ))}
                      {numeroVociCritiche > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-red-950/80 text-red-300 border border-red-500/40 text-[10px] font-bold">
                          ⚠️ {numeroVociCritiche} Critiche
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
                  <span>Aggiornato: {tmpl.dataUltimaModifica}</span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => duplicaTemplate(tmpl)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      title="Duplica Checklist"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => apriModificaTemplate(tmpl)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Modifica Voci</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateDaEliminare({ id: tmpl.id, titolo: tmpl.titolo })}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-900/60 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                      title="Elimina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISTA 2: REGISTRO STORICO DELLE VERIFICHE COMPILATE DAI VOLONTARI */}
      {vistaAttiva === 'registro' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Data / Ora</th>
                  <th className="py-3 px-3">Mezzo</th>
                  <th className="py-3 px-3">Volontario</th>
                  <th className="py-3 px-3">Tipologia Checklist</th>
                  <th className="py-3 px-3 text-center">Esito Controlli</th>
                  <th className="py-3 px-3">Anomalie Rilevate</th>
                  <th className="py-3 px-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {compilateFiltrate.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                      Nessuna verifica inizio turno registrata con i filtri selezionati.
                    </td>
                  </tr>
                ) : (
                  compilateFiltrate.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-3.5 font-mono text-slate-300">
                        {item.dataOraCompilazione}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-amber-400 font-mono text-sm block">
                          {item.mezzoSigla}
                        </span>
                        {item.kmInizialiDichiarati && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.kmInizialiDichiarati} KM
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-white block">
                          {item.volontarioNome}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.qualificaTurno}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-300">
                        <span className="font-medium truncate max-w-[200px] block">
                          {item.templateTitolo}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.tipologiaMezzo}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {item.tuttoConforme ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>100% Conforme</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold text-[10px] animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span>{item.vociNonConformi} Anomalie</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {item.anomalieRilevate && item.anomalieRilevate.length > 0 ? (
                          <span className="text-red-300 font-medium text-[11px] line-clamp-2 max-w-[240px]">
                            {item.anomalieRilevate.join('; ')}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Nessuna anomalia</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setVerificaDettaglio(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Visualizza
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE BUILDER TEMPLATE (NUOVO / MODIFICA) */}
      {modaleTemplateAperta && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSalvaTemplate}
            className="bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-3xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden text-slate-100"
          >
            {/* Header Builder */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 to-amber-950/60 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">
                    {templateInModifica ? 'Modifica Modello Checklist' : 'Nuovo Modello Checklist per Tipologia'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Definisci le voci di controllo guidate per la flotta veicoli
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModaleTemplateAperta(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Campi Principali */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {erroreFormTemplate && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{erroreFormTemplate}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Titolo Checklist *
                </label>
                <input
                  type="text"
                  required
                  value={formTitolo}
                  onChange={(e) => {
                    setFormTitolo(e.target.value);
                    setErroreFormTemplate(null);
                  }}
                  placeholder="Es: Checklist Giornaliera Ambulanza Emergenza"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase">
                    Tipologie Mezzo Associate * (seleziona una o più tipologie)
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleFormTipologiaMezzo('Tutte le tipologie')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer transition-colors ${
                      formTipologieMezzo.includes('Tutte le tipologie')
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Tutte le tipologie
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto">
                  {tipologieMezzoDisponibili.map((t) => {
                    const checked = formTipologieMezzo.includes(t) || formTipologieMezzo.includes('Tutte le tipologie');
                    return (
                      <label
                        key={t}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors select-none ${
                          checked
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-200 font-bold'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formTipologieMezzo.includes(t)}
                          onChange={() => toggleFormTipologiaMezzo(t)}
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                        />
                        <span className="truncate">
                          {getIconaTipologiaMezzo(t, tipologieCatalogo)} {t}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Descrizione / Istruzioni Operative per il Volontario
                </label>
                <textarea
                  rows={2}
                  value={formDescrizione}
                  onChange={(e) => setFormDescrizione(e.target.value)}
                  placeholder="Istruzioni visive prima dell'accesso in turno..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Builder Voci di Controllo */}
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Voci di Controllo Configurate ({formVoci.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Aggiungi tutte le voci che il volontario dovrà spuntare
                  </span>
                </div>

                {/* Box Aggiunta Nuova Voce */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block uppercase">
                    + Aggiungi Nuova Voce di Controllo
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={nuovaVoceTitolo}
                        onChange={(e) => setNuovaVoceTitolo(e.target.value)}
                        placeholder="Titolo controllo (es. Bombole O2 cariche > 150 bar, DAE funzionante...)"
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <select
                        value={nuovaVoceCategoria}
                        onChange={(e) => setNuovaVoceCategoria(e.target.value as CategoriaVoceChecklist)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-medium focus:outline-none"
                      >
                        {CATEGORIE_DISPONIBILI.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={nuovaVoceCritica}
                        onChange={(e) => setNuovaVoceCritica(e.target.checked)}
                        className="w-4 h-4 rounded text-red-600 border-slate-700 accent-red-600 cursor-pointer"
                      />
                      <span>⚠️ Voce Critica (Se KO allerta prioritariamente la centrale)</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleAggiungiVoce}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Aggiungi Voce</span>
                    </button>
                  </div>
                </div>

                {/* Elenco Voci già Presenti nel Template */}
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {formVoci.map((v, idx) => (
                    <div
                      key={v.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-lg bg-slate-900 text-slate-400 flex items-center justify-center font-mono text-[10px] shrink-0 font-bold">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-white block truncate">
                            {v.titolo}
                          </span>
                          <span className="text-[10px] text-amber-300/80 font-mono">
                            {v.categoria} {v.critica ? '• ⚠️ Critica' : ''}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRimuoviVoce(v.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Rimuovi voce"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Builder */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setModaleTemplateAperta(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Annulla
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-950" />
                <span>Salva Modello Checklist</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE DETTAGLI VERIFICA COMPILATA */}
      {verificaDettaglio && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[115] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-2xl w-full p-5 space-y-4 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  📋
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase">
                    Verifica Inizio Turno: {verificaDettaglio.mezzoSigla}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Compilata da {verificaDettaglio.volontarioNome} ({verificaDettaglio.qualificaTurno}) • {verificaDettaglio.dataOraCompilazione}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerificaDettaglio(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Riepilogo Esito */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              verificaDettaglio.tuttoConforme
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/40 border-red-500/50 text-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {verificaDettaglio.tuttoConforme ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <strong className="text-xs uppercase font-black block">
                    {verificaDettaglio.tuttoConforme ? 'Tutte le voci conformi' : `${verificaDettaglio.vociNonConformi} Anomalie Rilevate`}
                  </strong>
                  <span className="text-[10px] text-slate-300">
                    {verificaDettaglio.vociConformi} su {verificaDettaglio.totaleVoci} controlli OK
                  </span>
                </div>
              </div>

              {verificaDettaglio.kmInizialiDichiarati && (
                <span className="text-xs font-mono font-bold text-amber-300">
                  KM Inizio: {verificaDettaglio.kmInizialiDichiarati}
                </span>
              )}
            </div>

            {/* Note Generali */}
            {verificaDettaglio.noteGenerali && (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Note Equipaggio:</span>
                <span className="text-slate-200">{verificaDettaglio.noteGenerali}</span>
              </div>
            )}

            {/* Elenco Voci e Risposte */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {verificaDettaglio.risultati.map((r) => (
                <div
                  key={r.voceId}
                  className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    r.conforme
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-red-950/60 border-red-500 text-red-200'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-semibold block truncate">{r.titolo}</span>
                    {r.noteKo && (
                      <span className="text-[10px] text-red-300 font-bold block">
                        ⚠️ Anomalia: {r.noteKo}
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                    r.conforme
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-600 text-white'
                  }`}>
                    {r.conforme ? '✓ OK' : '✗ KO'}
                  </span>
                </div>
              ))}
            </div>

            {/* Azioni Centrale */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400">
                Stato: <strong>{verificaDettaglio.statoCentrale || 'Registrata'}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCambiaStatoVerifica(verificaDettaglio.id, 'Anomalia Risolta')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  ✓ Segna Anomalia Risolta
                </button>
                <button
                  type="button"
                  onClick={() => setVerificaDettaglio(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE CHECKLIST */}
      {templateDaEliminare && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/60 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-black uppercase text-white">Conferma Eliminazione Checklist</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sei sicuro di voler eliminare definitivamente il modello di checklist{' '}
              <strong className="text-white">&quot;{templateDaEliminare.titolo}&quot;</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTemplateDaEliminare(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaEliminaTemplate}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase cursor-pointer"
              >
                Elimina Modello
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
