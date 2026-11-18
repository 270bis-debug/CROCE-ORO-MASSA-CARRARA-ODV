import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Tags,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Ambulance,
  Link2,
  Search,
  Save,
  X,
  Check,
  ArrowRight,
  Layers
} from 'lucide-react';
import {
  MezzoFlotta,
  TipologiaMezzoItem
} from '../../types/adminTypes';
import {
  ChecklistTemplate,
  ChecklistCompilataTurno,
  getTipologieAssociateTemplate,
  templateCopreTipologia
} from '../../types/checklistTypes';
import { formatDateItaly } from '../../utils/italianTime';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';

interface SezioneTipologieMezzoProps {
  tipologie: TipologiaMezzoItem[];
  onAggiornaTipologie: (nuoveTipologie: TipologiaMezzoItem[]) => void;
  mezzi: MezzoFlotta[];
  onAggiornaMezzi: (nuoviMezzi: MezzoFlotta[]) => void;
  templates: ChecklistTemplate[];
  onAggiornaTemplates: (nuoviTemplates: ChecklistTemplate[]) => void;
  compilate?: ChecklistCompilataTurno[];
  onAggiornaCompilate?: (nuoveCompilate: ChecklistCompilataTurno[]) => void;
  onFiltraFlottaPerTipologia?: (tipologiaNome: string) => void;
  onApriTabChecklist?: () => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onAvvisa?: (msg: string) => void;
}

const ICONE_DISPONIBILI = ['🚑', '🚐', '🚙', '♿', '🚚', '🚓', '🚒', '🚜', '🏍️', '🚤', '🚗', '🛟'];

export const SezioneTipologieMezzo: React.FC<SezioneTipologieMezzoProps> = ({
  tipologie,
  onAggiornaTipologie,
  mezzi,
  onAggiornaMezzi,
  templates,
  onAggiornaTemplates,
  compilate = [],
  onAggiornaCompilate,
  onFiltraFlottaPerTipologia,
  onApriTabChecklist,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  onAvvisa
}) => {
  const [ricerca, setRicerca] = useState('');
  const [filtroFlotta, setFiltroFlotta] = useState<'tutte' | 'vet' | 'pc' | 'senza_checklist'>('tutte');

  // Stato pannello dedicato "Associa Checklist Esistente -> Una o più Tipologie Mezzo"
  const [checklistSelezionataId, setChecklistSelezionataId] = useState<string>(() => templates[0]?.id || '');
  const [tipologieSelezionatePerChecklist, setTipologieSelezionatePerChecklist] = useState<string[]>(() =>
    templates[0] ? getTipologieAssociateTemplate(templates[0]) : []
  );
  const binderSectionRef = useRef<HTMLDivElement | null>(null);

  // Sincronizza checklist selezionata e checkbox quando cambia template o lista templates
  useEffect(() => {
    if (!templates || templates.length === 0) {
      setChecklistSelezionataId('');
      setTipologieSelezionatePerChecklist([]);
      return;
    }
    const trovata = templates.find((t) => t.id === checklistSelezionataId) || templates[0];
    if (trovata.id !== checklistSelezionataId) {
      setChecklistSelezionataId(trovata.id);
    }
    setTipologieSelezionatePerChecklist(getTipologieAssociateTemplate(trovata));
  }, [templates, checklistSelezionataId]);

  const checklistSelezionata = useMemo(
    () => templates.find((t) => t.id === checklistSelezionataId) || templates[0] || null,
    [templates, checklistSelezionataId]
  );

  // Modale Nuova / Modifica Tipologia Mezzo
  const [modaleTipoAperta, setModaleTipoAperta] = useState(false);
  const [tipoInModifica, setTipoInModifica] = useState<TipologiaMezzoItem | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formIcona, setFormIcona] = useState('🚑');
  const [formFlottaDefault, setFormFlottaDefault] = useState<'vet' | 'pc' | 'tutte'>('tutte');
  const [formChecklistAssociateIds, setFormChecklistAssociateIds] = useState<string[]>([]);
  const [erroreFormTipo, setErroreFormTipo] = useState<string | null>(null);

  // Modale Associazione Rapida Checklist per una specifica Tipologia Mezzo
  const [tipoPerAssociazioneChecklist, setTipoPerAssociazioneChecklist] = useState<TipologiaMezzoItem | null>(null);
  const [checklistIdsPerTipoModal, setChecklistIdsPerTipoModal] = useState<string[]>([]);

  // Modale Conferma Eliminazione Tipologia Mezzo (con eventuale riassegnazione mezzi)
  const [tipoDaEliminare, setTipoDaEliminare] = useState<TipologiaMezzoItem | null>(null);
  const [tipologiaSostitutiva, setTipologiaSostitutiva] = useState<string>('');

  const notificaFeedback = (msg: string) => {
    onAvvisa?.(msg);
  };

  // Lista completa di tutte le tipologie note (catalogo + eventuali tipologie trovate in mezzi/template non ancora presenti)
  const tipologieUnificate = useMemo(() => {
    const map = new Map<string, TipologiaMezzoItem>();
    tipologie.forEach((t) => {
      map.set(t.nome.trim().toLowerCase(), t);
    });
    mezzi.forEach((m) => {
      const k = String(m.tipo || '').trim().toLowerCase();
      if (k && !map.has(k)) {
        map.set(k, {
          id: `tipo-auto-${k.replace(/[^a-z0-9]/g, '-')}`,
          nome: m.tipo.trim(),
          descrizione: 'Tipologia rilevata in archivio flotta mezzi',
          flottaDefault: m.flotta,
          icona: '🚐',
          predefinita: false,
        });
      }
    });
    return Array.from(map.values());
  }, [tipologie, mezzi]);

  // Calcolo statistiche collegate per ciascuna Tipologia Mezzo
  const tipologieArricchite = useMemo(() => {
    return tipologieUnificate.map((t) => {
      const mezziCollegati = mezzi.filter(
        (m) => String(m.tipo || '').trim().toLowerCase() === t.nome.trim().toLowerCase()
      );
      const checklistsCollegate = templates.filter((tmpl) => templateCopreTipologia(tmpl, t.nome));
      return {
        item: t,
        mezziCollegati,
        checklistsCollegate,
      };
    });
  }, [tipologieUnificate, mezzi, templates]);

  const tipologieFiltrate = useMemo(() => {
    return tipologieArricchite.filter(({ item, checklistsCollegate }) => {
      const matchQ =
        !ricerca.trim() ||
        item.nome.toLowerCase().includes(ricerca.toLowerCase()) ||
        (item.descrizione || '').toLowerCase().includes(ricerca.toLowerCase());
      const matchFlotta =
        filtroFlotta === 'tutte'
          ? true
          : filtroFlotta === 'senza_checklist'
          ? checklistsCollegate.length === 0
          : item.flottaDefault === filtroFlotta || item.flottaDefault === 'tutte';
      return matchQ && matchFlotta;
    });
  }, [tipologieArricchite, ricerca, filtroFlotta]);

  // Helper per aggiornare associazioni tra una tipologia e gli ID checklist selezionati
  const applicaChecklistATipologia = (
    listaTemplates: ChecklistTemplate[],
    nomeTipologia: string,
    selectedTemplateIds: string[],
    vecchioNomeTipologia?: string
  ): ChecklistTemplate[] => {
    const selectedSet = new Set(selectedTemplateIds);
    const oldNorm = vecchioNomeTipologia ? vecchioNomeTipologia.trim().toLowerCase() : '';
    const newNorm = nomeTipologia.trim().toLowerCase();
    const nowStr = formatDateItaly();

    return listaTemplates.map((tmpl) => {
      const assocRaw = getTipologieAssociateTemplate(tmpl);
      // Sostituisci eventuale vecchio nome e normalizza
      const assocPulite = assocRaw.filter((tp) => {
        const l = tp.trim().toLowerCase();
        if (oldNorm && l === oldNorm) return false;
        if (l === newNorm) return false;
        return true;
      });

      const eraAssociata =
        assocRaw.some((tp) => tp.trim().toLowerCase() === newNorm || (oldNorm && tp.trim().toLowerCase() === oldNorm));
      const deveEssereAssociata = selectedSet.has(tmpl.id);

      if (deveEssereAssociata) {
        const nextList = [...assocPulite, nomeTipologia];
        return {
          ...tmpl,
          tipologieMezzo: nextList,
          tipologiaMezzo: nextList[0] || nomeTipologia,
          dataUltimaModifica: nowStr,
        };
      } else if (eraAssociata) {
        // Rimuovi il vecchio/nuovo nome (mantenendo le altre tipologie)
        return {
          ...tmpl,
          tipologieMezzo: assocPulite,
          tipologiaMezzo: assocPulite[0] || 'Non associata',
          dataUltimaModifica: nowStr,
        };
      } else if (oldNorm && assocRaw.some((tp) => tp.trim().toLowerCase() === oldNorm)) {
        const nextList = [...assocPulite, nomeTipologia];
        return {
          ...tmpl,
          tipologieMezzo: nextList,
          tipologiaMezzo: nextList[0] || nomeTipologia,
          dataUltimaModifica: nowStr,
        };
      }
      return tmpl;
    });
  };

  // Handler per pannello Associazione Checklist Esistente -> Una o più Tipologie Mezzo
  const handleToggleTipologiaNelBinder = (nomeTipologia: string) => {
    if (nomeTipologia === 'Tutte le tipologie') {
      setTipologieSelezionatePerChecklist((prev) =>
        prev.some((x) => x.toLowerCase() === 'tutte le tipologie' || x.toLowerCase() === 'tutte')
          ? []
          : ['Tutte le tipologie']
      );
      return;
    }
    setTipologieSelezionatePerChecklist((prev) => {
      const senzaTutte = prev.filter((x) => x.toLowerCase() !== 'tutte le tipologie' && x.toLowerCase() !== 'tutte');
      const exists = senzaTutte.some((x) => x.toLowerCase() === nomeTipologia.toLowerCase());
      if (exists) {
        return senzaTutte.filter((x) => x.toLowerCase() !== nomeTipologia.toLowerCase());
      }
      return [...senzaTutte, nomeTipologia];
    });
  };

  const handleSalvaAssociazioneChecklist = () => {
    if (!checklistSelezionata) return;
    const cleaned = Array.from(
      new Set(tipologieSelezionatePerChecklist.map((s) => s.trim()).filter(Boolean))
    );
    const nowStr = formatDateItaly();
    const updatedTemplates = templates.map((t) => {
      if (t.id !== checklistSelezionata.id) return t;
      return {
        ...t,
        tipologieMezzo: cleaned,
        tipologiaMezzo: cleaned[0] || 'Non associata',
        dataUltimaModifica: nowStr,
      };
    });

    onAggiornaTemplates(updatedTemplates);
    const riepilogo = cleaned.length > 0 ? cleaned.join(', ') : 'Nessuna tipologia';
    const msg = `✓ Checklist "${checklistSelezionata.titolo}" associata a: ${riepilogo}.`;
    notificaFeedback(msg);
    onNotificaRadio?.(
      `🔗 TIPOLOGIE MEZZO & CHECKLIST: "${checklistSelezionata.titolo}" collegata a [${riepilogo}]`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'mezzi',
        'Associazione checklist a Tipologia Mezzo',
        `La checklist "${checklistSelezionata.titolo}" è stata associata alle tipologie: ${riepilogo}.`,
        operatoreCorrente
      );
    }
  };

  // Apertura modale Nuova Tipologia Mezzo
  const apriNuovaTipologia = () => {
    setTipoInModifica(null);
    setErroreFormTipo(null);
    setFormNome('');
    setFormDescrizione('');
    setFormIcona('🚐');
    setFormFlottaDefault('tutte');
    setFormChecklistAssociateIds([]);
    setModaleTipoAperta(true);
  };

  // Apertura modale Modifica Tipologia Mezzo
  const apriModificaTipologia = (item: TipologiaMezzoItem) => {
    setTipoInModifica(item);
    setErroreFormTipo(null);
    setFormNome(item.nome);
    setFormDescrizione(item.descrizione || '');
    setFormIcona(item.icona || '🚐');
    setFormFlottaDefault(item.flottaDefault || 'tutte');
    const collegate = templates
      .filter((t) =>
        getTipologieAssociateTemplate(t).some(
          (tp) => tp.trim().toLowerCase() === item.nome.trim().toLowerCase()
        )
      )
      .map((t) => t.id);
    setFormChecklistAssociateIds(collegate);
    setModaleTipoAperta(true);
  };

  // Salvataggio Nuova / Modifica Tipologia Mezzo con propagazione globale su tutto l'archivio
  const handleSalvaTipologia = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = formNome.trim();
    if (!nomePulito) {
      setErroreFormTipo('Inserisci il nome della Tipologia Mezzo.');
      return;
    }

    const duplicato = tipologieUnificate.find(
      (t) =>
        t.nome.trim().toLowerCase() === nomePulito.toLowerCase() &&
        (!tipoInModifica || t.id !== tipoInModifica.id)
    );
    if (duplicato) {
      setErroreFormTipo(`Esiste già una Tipologia Mezzo chiamata "${duplicato.nome}".`);
      return;
    }

    const nowStr = formatDateItaly();
    const vecchioNome = tipoInModifica ? tipoInModifica.nome.trim() : '';
    const isRename = Boolean(vecchioNome && vecchioNome.toLowerCase() !== nomePulito.toLowerCase());

    let nuoveTipologie: TipologiaMezzoItem[];
    if (tipoInModifica) {
      const esisteInLista = tipologie.some((t) => t.id === tipoInModifica.id);
      const updatedItem: TipologiaMezzoItem = {
        ...tipoInModifica,
        nome: nomePulito,
        descrizione: formDescrizione.trim(),
        icona: formIcona,
        flottaDefault: formFlottaDefault,
      };
      nuoveTipologie = esisteInLista
        ? tipologie.map((t) => (t.id === tipoInModifica.id ? updatedItem : t))
        : [...tipologie, updatedItem];
    } else {
      const nuovo: TipologiaMezzoItem = {
        id: `tipo-${Date.now()}`,
        nome: nomePulito,
        descrizione: formDescrizione.trim(),
        icona: formIcona,
        flottaDefault: formFlottaDefault,
        predefinita: false,
        dataCreazione: nowStr,
      };
      nuoveTipologie = [...tipologieUnificate, nuovo];
    }

    onAggiornaTipologie(nuoveTipologie);

    // 1. Propaga eventuale rinomina su tutti i mezzi della flotta in archivio
    let mezziAggCount = 0;
    if (isRename && vecchioNome) {
      const oldLow = vecchioNome.toLowerCase();
      const nuoviMezzi = mezzi.map((m) => {
        if (String(m.tipo || '').trim().toLowerCase() === oldLow) {
          mezziAggCount += 1;
          return { ...m, tipo: nomePulito };
        }
        return m;
      });
      if (mezziAggCount > 0) {
        onAggiornaMezzi(nuoviMezzi);
      }

      // 2. Propaga rinomina sullo storico checklist compilate
      if (onAggiornaCompilate && compilate.length > 0) {
        let compChanged = false;
        const nuoveCompilate = compilate.map((c) => {
          if (String(c.tipologiaMezzo || '').trim().toLowerCase() === oldLow) {
            compChanged = true;
            return { ...c, tipologiaMezzo: nomePulito };
          }
          return c;
        });
        if (compChanged) {
          onAggiornaCompilate(nuoveCompilate);
        }
      }
    }

    // 3. Aggiorna collegamenti con le Checklist esistenti (propagando anche l'eventuale rinomina)
    const updatedTemplates = applicaChecklistATipologia(
      templates,
      nomePulito,
      formChecklistAssociateIds,
      isRename ? vecchioNome : undefined
    );
    onAggiornaTemplates(updatedTemplates);

    const msg = tipoInModifica
      ? `✓ Tipologia Mezzo "${nomePulito}" aggiornata e collegata in archivio${mezziAggCount > 0 ? ` (${mezziAggCount} mezzi aggiornati)` : ''}.`
      : `✓ Nuova Tipologia Mezzo "${nomePulito}" creata e collegata a tutto l'archivio.`;

    notificaFeedback(msg);
    onNotificaRadio?.(
      `🏷️ TIPOLOGIA MEZZO: ${tipoInModifica ? `Aggiornata "${nomePulito}"` : `Creata nuova tipologia "${nomePulito}"`}`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin('mezzi', 'Gestione Tipologia Mezzo', msg, operatoreCorrente);
    }

    setModaleTipoAperta(false);
    setTipoInModifica(null);
  };

  // Apertura modale associazione checklist per singola tipologia
  const apriAssociazioneChecklistPerTipologia = (item: TipologiaMezzoItem) => {
    setTipoPerAssociazioneChecklist(item);
    const ids = templates
      .filter((t) =>
        getTipologieAssociateTemplate(t).some(
          (tp) => tp.trim().toLowerCase() === item.nome.trim().toLowerCase()
        )
      )
      .map((t) => t.id);
    setChecklistIdsPerTipoModal(ids);
  };

  const confermaAssociazioneChecklistPerTipologia = () => {
    if (!tipoPerAssociazioneChecklist) return;
    const updatedTemplates = applicaChecklistATipologia(
      templates,
      tipoPerAssociazioneChecklist.nome,
      checklistIdsPerTipoModal
    );
    onAggiornaTemplates(updatedTemplates);
    const msg = `✓ Associate ${checklistIdsPerTipoModal.length} checklist alla Tipologia Mezzo "${tipoPerAssociazioneChecklist.nome}".`;
    notificaFeedback(msg);
    onNotificaRadio?.(
      `🔗 CHECKLIST COLLEGATE: ${checklistIdsPerTipoModal.length} modelli collegati a "${tipoPerAssociazioneChecklist.nome}"`,
      'sistema'
    );
    setTipoPerAssociazioneChecklist(null);
  };

  // Apertura conferma eliminazione Tipologia Mezzo
  const apriEliminaTipologia = (item: TipologiaMezzoItem) => {
    const altre = tipologieUnificate.filter(
      (t) => t.nome.trim().toLowerCase() !== item.nome.trim().toLowerCase()
    );
    setTipologiaSostitutiva(altre[0]?.nome || '');
    setTipoDaEliminare(item);
  };

  const confermaEliminaTipologia = () => {
    if (!tipoDaEliminare) return;
    const targetLow = tipoDaEliminare.nome.trim().toLowerCase();
    const mezziCoinvolti = mezzi.filter((m) => String(m.tipo || '').trim().toLowerCase() === targetLow);

    if (mezziCoinvolti.length > 0 && !tipologiaSostitutiva) {
      return;
    }

    const rimanenti = tipologieUnificate.filter((t) => t.nome.trim().toLowerCase() !== targetLow);
    onAggiornaTipologie(rimanenti);

    if (mezziCoinvolti.length > 0 && tipologiaSostitutiva) {
      const nuoviMezzi = mezzi.map((m) =>
        String(m.tipo || '').trim().toLowerCase() === targetLow
          ? { ...m, tipo: tipologiaSostitutiva }
          : m
      );
      onAggiornaMezzi(nuoviMezzi);
    }

    // Rimuovi il riferimento dalla proprietà tipologieMezzo dei template
    const nowStr = formatDateItaly();
    const updatedTemplates = templates.map((t) => {
      const assoc = getTipologieAssociateTemplate(t);
      if (!assoc.some((tp) => tp.trim().toLowerCase() === targetLow)) return t;
      const filtrate = assoc.filter((tp) => tp.trim().toLowerCase() !== targetLow);
      return {
        ...t,
        tipologieMezzo: filtrate,
        tipologiaMezzo: filtrate[0] || 'Non associata',
        dataUltimaModifica: nowStr,
      };
    });
    onAggiornaTemplates(updatedTemplates);

    notificaFeedback(
      `🗑️ Tipologia Mezzo "${tipoDaEliminare.nome}" rimossa dall'archivio${
        mezziCoinvolti.length > 0 ? ` (${mezziCoinvolti.length} mezzi riassegnati a "${tipologiaSostitutiva}")` : ''
      }.`
    );
    setTipoDaEliminare(null);
  };

  const totaleMezziCollegati = mezzi.filter((m) =>
    tipologieUnificate.some((t) => t.nome.trim().toLowerCase() === String(m.tipo || '').trim().toLowerCase())
  ).length;
  const tipologieSenzaChecklist = tipologieArricchite.filter((x) => x.checklistsCollegate.length === 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER SOTTOSEZIONE TIPOLOGIA MEZZO */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
            <Tags className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50">
                Archivio Unificato Mezzi & Checklist
              </span>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Gestione Tipologia Mezzo
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Catalogo centrale delle Tipologie Mezzo collegato automaticamente con Flotta Mezzi, schede veicolo, filtri archivio, monitoraggio e Checklist Inizio Turno.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onApriTabChecklist && (
            <button
              type="button"
              onClick={onApriTabChecklist}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-black text-xs uppercase flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4 text-amber-400" />
              <span>Vai a Modelli Checklist</span>
            </button>
          )}
          <button
            type="button"
            onClick={apriNuovaTipologia}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>+ Nuova Tipologia Mezzo</span>
          </button>
        </div>
      </div>

      {/* KPI RAPIDI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Tipologie Mezzo Attive</span>
            <div className="text-xl font-black text-amber-400 font-mono">{tipologieUnificate.length}</div>
            <span className="text-[10px] text-slate-500">Sincronizzate in tutto l&apos;archivio</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center">
            <Tags className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Mezzi Flotta Collegati</span>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {totaleMezziCollegati} / {mezzi.length}
            </div>
            <span className="text-[10px] text-slate-500">Assegnati a una Tipologia Mezzo</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 flex items-center justify-center">
            <Ambulance className="w-5 h-5" />
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            tipologieSenzaChecklist.length > 0
              ? 'bg-amber-950/20 border-amber-500/40'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Copertura Checklist</span>
            <div
              className={`text-xl font-black font-mono ${
                tipologieSenzaChecklist.length === 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {tipologieUnificate.length - tipologieSenzaChecklist.length} / {tipologieUnificate.length} Tipologie
            </div>
            <span className="text-[10px] text-slate-400">
              {tipologieSenzaChecklist.length === 0
                ? 'Tutte le tipologie hanno una checklist'
                : `${tipologieSenzaChecklist.length} senza checklist associata`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FUNZIONE DEDICATA: ASSOCIA CHECKLIST ESISTENTE A UNA O PIÙ TIPOLOGIE  */}
      {/* ===================================================================== */}
      <div
        ref={binderSectionRef}
        className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 p-5 rounded-3xl border-2 border-amber-500/40 shadow-2xl space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">
                Associa Checklist Esistente a una o più Tipologia Mezzo
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Seleziona una checklist già presente in archivio e scegli una o più Tipologia Mezzo a cui collegarla automaticamente all&apos;avvio turno dei volontari.
              </p>
            </div>
          </div>

          {checklistSelezionata && (
            <span className="px-3 py-1 rounded-full bg-slate-900 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold shrink-0">
              {checklistSelezionata.voci.length} voci di controllo
            </span>
          )}
        </div>

        {templates.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
            <ClipboardCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-300">Nessuna checklist presente in archivio</p>
            <p className="text-[11px] text-slate-500">
              Crea almeno un modello nella scheda &quot;6. Checklist Inizio Turno&quot; per poterlo associare alle Tipologie Mezzo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* PASSO 1: SELEZIONE CHECKLIST ESISTENTE */}
            <div className="lg:col-span-5 space-y-2.5 bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
              <label className="block text-[11px] font-black uppercase text-amber-400">
                1. Seleziona una Checklist Esistente ({templates.length})
              </label>

              <select
                value={checklistSelezionataId}
                onChange={(e) => setChecklistSelezionataId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                {templates.map((t) => {
                  const assoc = getTipologieAssociateTemplate(t);
                  return (
                    <option key={t.id} value={t.id}>
                      📋 {t.titolo} ({t.voci.length} voci • {assoc.length} tipologie)
                    </option>
                  );
                })}
              </select>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {templates.map((t) => {
                  const active = t.id === checklistSelezionata?.id;
                  const assoc = getTipologieAssociateTemplate(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setChecklistSelezionataId(t.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black truncate">{t.titolo}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 border border-slate-700 shrink-0">
                          {t.voci.length} voci
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {assoc.length === 0 ? (
                          <span className="text-[10px] text-slate-500 italic">Nessuna tipologia associata</span>
                        ) : (
                          assoc.map((tp) => (
                            <span
                              key={tp}
                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-emerald-300 font-semibold"
                            >
                              {tp}
                            </span>
                          ))
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PASSO 2: SELEZIONE MULTIPLA TIPOLOGIE MEZZO */}
            <div className="lg:col-span-7 space-y-3 bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="block text-[11px] font-black uppercase text-amber-400">
                  2. Scegli una o più Tipologia Mezzo da associare
                </label>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTipologieSelezionatePerChecklist(tipologieUnificate.map((t) => t.nome))}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase cursor-pointer"
                  >
                    Seleziona Tutte
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleTipologiaNelBinder('Tutte le tipologie')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border cursor-pointer ${
                      tipologieSelezionatePerChecklist.some(
                        (x) => x.toLowerCase() === 'tutte le tipologie' || x.toLowerCase() === 'tutte'
                      )
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                    }`}
                  >
                    Tutte le tipologie (Globale)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipologieSelezionatePerChecklist([])}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase cursor-pointer"
                  >
                    Svuota
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tipologieArricchite.map(({ item, mezziCollegati }) => {
                  const isTutteGlobal = tipologieSelezionatePerChecklist.some(
                    (x) => x.toLowerCase() === 'tutte le tipologie' || x.toLowerCase() === 'tutte'
                  );
                  const isChecked = tipologieSelezionatePerChecklist.some(
                    (x) => x.trim().toLowerCase() === item.nome.trim().toLowerCase()
                  );
                  const activeVisual = isChecked || isTutteGlobal;

                  return (
                    <label
                      key={item.id}
                      className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition-all select-none ${
                        activeVisual
                          ? 'bg-amber-500/15 border-amber-500/70 shadow-md'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTipologiaNelBinder(item.nome)}
                        className="w-4 h-4 mt-0.5 rounded accent-amber-500 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-black text-white truncate">
                            {item.icona || '🚐'} {item.nome}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {mezziCollegati.length} {mezziCollegati.length === 1 ? 'mezzo' : 'mezzi'}
                          </span>
                        </div>
                        {item.descrizione && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.descrizione}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-300">
                  <strong className="text-amber-300">Selezionate:</strong>{' '}
                  {tipologieSelezionatePerChecklist.length > 0
                    ? tipologieSelezionatePerChecklist.join(', ')
                    : 'Nessuna Tipologia Mezzo selezionata'}
                </div>

                <button
                  type="button"
                  onClick={handleSalvaAssociazioneChecklist}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Associazione Checklist</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BARRA FILTRI ARCHIVIO TIPOLOGIE MEZZO */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca Tipologia Mezzo..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <select
            value={filtroFlotta}
            onChange={(e) => setFiltroFlotta(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
          >
            <option value="tutte">Tutte le Tipologie ({tipologieUnificate.length})</option>
            <option value="vet">🐾 Emergenza & Veterinario</option>
            <option value="pc">🌲 Protezione Civile</option>
            <option value="senza_checklist">⚠️ Senza Checklist Associata</option>
          </select>
        </div>
      </div>

      {/* GRIGLIA CARD TIPOLOGIE MEZZO CON COLLEGAMENTI LIVE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tipologieFiltrate.map(({ item, mezziCollegati, checklistsCollegate }) => (
          <div
            key={item.id}
            className="bg-slate-950 rounded-2xl border border-slate-800 hover:border-amber-500/50 p-4 shadow-xl flex flex-col justify-between gap-3 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                    {item.icona || '🚐'}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-white leading-tight truncate">{item.nome}</h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-900 border border-slate-700 text-slate-300">
                        {item.flottaDefault === 'vet'
                          ? '🐾 Emergenza/Vet'
                          : item.flottaDefault === 'pc'
                          ? '🌲 Prot. Civile'
                          : '🌐 Tutte Flotte'}
                      </span>
                      {item.predefinita && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300">
                          Standard
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {item.descrizione && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.descrizione}</p>
              )}

              {/* Collegamento con Archivio Flotta Mezzi */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                  <span>Mezzi in Archivio Flotta:</span>
                  <span className="font-mono text-amber-300">{mezziCollegati.length}</span>
                </div>
                {mezziCollegati.length === 0 ? (
                  <p className="text-[10.5px] text-slate-500 italic">Nessun mezzo associato a questa tipologia.</p>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap">
                    {mezziCollegati.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onFiltraFlottaPerTipologia?.(item.nome)}
                        className="px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 text-[10px] font-mono font-black text-amber-400 transition-colors cursor-pointer"
                        title={`Vedi ${m.sigla} (${m.modello}) in Flotta Mezzi`}
                      >
                        {m.sigla}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Collegamento con Checklist Inizio Turno */}
              <div
                className={`p-2.5 rounded-xl border space-y-1.5 ${
                  checklistsCollegate.length > 0
                    ? 'bg-emerald-950/20 border-emerald-800/50'
                    : 'bg-amber-950/20 border-amber-700/40'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                  <span className={checklistsCollegate.length > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                    Checklist Associate:
                  </span>
                  <span className="font-mono text-white">{checklistsCollegate.length}</span>
                </div>
                {checklistsCollegate.length === 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-amber-200/80">Nessuna checklist collegata</span>
                    <button
                      type="button"
                      onClick={() => apriAssociazioneChecklistPerTipologia(item)}
                      className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase cursor-pointer"
                    >
                      + Associa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {checklistsCollegate.map((chk) => (
                      <div
                        key={chk.id}
                        className="text-[10.5px] font-semibold text-emerald-200 flex items-center gap-1.5 truncate"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{chk.titolo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Azioni Card Tipologia Mezzo */}
            <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => apriAssociazioneChecklistPerTipologia(item)}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Associa Checklist</span>
              </button>

              <button
                type="button"
                onClick={() => apriModificaTipologia(item)}
                className="p-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Modifica o Rinomina Tipologia Mezzo (aggiorna tutto l'archivio)"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {tipologieUnificate.length > 1 && (
                <button
                  type="button"
                  onClick={() => apriEliminaTipologia(item)}
                  className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/70 transition-colors cursor-pointer"
                  title="Elimina Tipologia Mezzo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODALE NUOVA / MODIFICA TIPOLOGIA MEZZO */}
      {modaleTipoAperta && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {tipoInModifica ? `Modifica Tipologia: ${tipoInModifica.nome}` : 'Nuova Tipologia Mezzo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleTipoAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroreFormTipo && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{erroreFormTipo}</span>
              </div>
            )}

            <form onSubmit={handleSalvaTipologia} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1 uppercase">Nome Tipologia Mezzo *</label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => {
                      setFormNome(e.target.value);
                      setErroreFormTipo(null);
                    }}
                    placeholder="Es. Ambulanza Veterinaria 4x4, Unità Cinofila..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-amber-500 focus:outline-none"
                  />
                  {tipoInModifica && formNome.trim() && formNome.trim() !== tipoInModifica.nome && (
                    <p className="text-[10px] text-amber-300 mt-1">
                      La rinomina verrà aggiornata automaticamente su tutti i mezzi e le checklist collegate.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase">Flotta Predefinita</label>
                  <select
                    value={formFlottaDefault}
                    onChange={(e) => setFormFlottaDefault(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="tutte">🌐 Tutte le Flotte</option>
                    <option value="vet">🐾 Emergenza & Vet</option>
                    <option value="pc">🌲 Protezione Civile</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase">Icona Identificativa</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ICONE_DISPONIBILI.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setFormIcona(ic)}
                      className={`w-9 h-9 rounded-xl border text-lg flex items-center justify-center cursor-pointer transition-all ${
                        formIcona === ic
                          ? 'bg-amber-500/25 border-amber-400 scale-105'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 uppercase">Descrizione & Impiego</label>
                <textarea
                  rows={2}
                  value={formDescrizione}
                  onChange={(e) => setFormDescrizione(e.target.value)}
                  placeholder="Descrizione operativa dei mezzi appartenenti a questa tipologia..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              {templates.length > 0 && (
                <div>
                  <label className="block text-slate-300 font-bold mb-1 uppercase">
                    Checklist Inizio Turno Associate (opzionale)
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                    {templates.map((tmpl) => {
                      const checked = formChecklistAssociateIds.includes(tmpl.id);
                      return (
                        <label
                          key={tmpl.id}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer select-none ${
                            checked
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-bold'
                              : 'bg-slate-900/70 border-slate-800 text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFormChecklistAssociateIds((prev) =>
                                prev.includes(tmpl.id) ? prev.filter((id) => id !== tmpl.id) : [...prev, tmpl.id]
                              )
                            }
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span className="truncate flex-1">{tmpl.titolo}</span>
                          <span className="text-[10px] font-mono text-slate-400">{tmpl.voci.length} voci</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleTipoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Tipologia Mezzo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ASSOCIA CHECKLIST ESISTENTI A UNA SINGOLA TIPOLOGIA MEZZO */}
      {tipoPerAssociazioneChecklist && (
        <div className="fixed inset-0 z-[115] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    Associa Checklist a: {tipoPerAssociazioneChecklist.nome}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Spunta una o più checklist esistenti da collegare a questa Tipologia Mezzo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTipoPerAssociazioneChecklist(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {templates.map((tmpl) => {
                const checked = checklistIdsPerTipoModal.includes(tmpl.id);
                const altreTipologie = getTipologieAssociateTemplate(tmpl).filter(
                  (tp) => tp.trim().toLowerCase() !== tipoPerAssociazioneChecklist.nome.trim().toLowerCase()
                );
                return (
                  <label
                    key={tmpl.id}
                    className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer select-none transition-all ${
                      checked
                        ? 'bg-amber-500/15 border-amber-500/70 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setChecklistIdsPerTipoModal((prev) =>
                          prev.includes(tmpl.id) ? prev.filter((id) => id !== tmpl.id) : [...prev, tmpl.id]
                        )
                      }
                      className="w-4 h-4 mt-0.5 rounded accent-amber-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black">{tmpl.titolo}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {tmpl.voci.length} voci
                        {altreTipologie.length > 0 ? ` • Già associata anche a: ${altreTipologie.join(', ')}` : ''}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTipoPerAssociazioneChecklist(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaAssociazioneChecklistPerTipologia}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Conferma Collegamenti</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE TIPOLOGIA MEZZO */}
      {tipoDaEliminare && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-red-500/60 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-slate-200">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-black uppercase text-white">
                Elimina Tipologia: {tipoDaEliminare.nome}
              </h4>
            </div>

            {(() => {
              const mezziConTipo = mezzi.filter(
                (m) => String(m.tipo || '').trim().toLowerCase() === tipoDaEliminare.nome.trim().toLowerCase()
              );
              const altre = tipologieUnificate.filter(
                (t) => t.nome.trim().toLowerCase() !== tipoDaEliminare.nome.trim().toLowerCase()
              );

              return (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300 leading-relaxed">
                    Stai per eliminare la Tipologia Mezzo <strong className="text-white">{tipoDaEliminare.nome}</strong> dall&apos;archivio.
                  </p>
                  {mezziConTipo.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2">
                      <p className="text-amber-200 font-bold">
                        Attenzione: {mezziConTipo.length} {mezziConTipo.length === 1 ? 'mezzo utilizza' : 'mezzi utilizzano'} attualmente questa tipologia ({mezziConTipo.map((m) => m.sigla).join(', ')}).
                      </p>
                      <label className="block text-[11px] font-bold text-slate-300">
                        Riassegna i mezzi alla Tipologia Mezzo:
                      </label>
                      <select
                        value={tipologiaSostitutiva}
                        onChange={(e) => setTipologiaSostitutiva(e.target.value)}
                        className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs"
                      >
                        {altre.map((t) => (
                          <option key={t.id} value={t.nome}>
                            {t.icona || '🚐'} {t.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTipoDaEliminare(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaEliminaTipologia}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase cursor-pointer"
              >
                Conferma Eliminazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
