import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusCircle,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Minus,
  Plus
} from 'lucide-react';
import { TipoTurnoConfig, MansioneTipoTurno } from '../../types/adminTypes';
import {
  getTutteMansioniDisponibiliPerTipoTurno,
  OpzioneMansioneTurno,
  salvaTipiTurnoCatalogo
} from '../../utils/tipiTurno';
import { getMansioniCatalogo, MansioneOperativa } from '../../utils/mansioniVolontari';
import { realtime } from '../../services/realtime';
import { formatDateItaly } from '../../utils/italianTime';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';

interface PannelloTipiTurnoProps {
  tipiTurno: TipoTurnoConfig[];
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onAvviso?: (msg: string) => void;
}

const ICONE_SUGGERITE = ['🚑', '🚐', '🎧', '🛡️', '🏥', '📋', '⚡', '🩺', '🚒', '📞'];

export const PannelloTipiTurno: React.FC<PannelloTipiTurnoProps> = ({
  tipiTurno,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onAvviso
}) => {
  // Catalogo Mansioni & Competenze da Gestione Volontari (aggiornato in tempo reale)
  const [catalogoMansioniVolontari, setCatalogoMansioniVolontari] = useState<MansioneOperativa[]>(() =>
    getMansioniCatalogo()
  );

  useEffect(() => {
    const refreshMansioni = () => setCatalogoMansioniVolontari(getMansioniCatalogo());
    window.addEventListener('croceoro_mansioni_updated', refreshMansioni);
    window.addEventListener('storage', refreshMansioni);
    return () => {
      window.removeEventListener('croceoro_mansioni_updated', refreshMansioni);
      window.removeEventListener('storage', refreshMansioni);
    };
  }, []);

  const tutteMansioniDisponibili = useMemo(
    () => getTutteMansioniDisponibiliPerTipoTurno(catalogoMansioniVolontari),
    [catalogoMansioniVolontari]
  );

  // Stato modale Creazione / Modifica Tipo Turno
  const [modaleAperta, setModaleAperta] = useState(false);
  const [tipoInModifica, setTipoInModifica] = useState<TipoTurnoConfig | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formIcona, setFormIcona] = useState('🚑');
  const [formMansioni, setFormMansioni] = useState<MansioneTipoTurno[]>([]);
  const [filtroMansioni, setFiltroMansioni] = useState('');
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  // Conferma eliminazione in-app (senza window.confirm)
  const [tipoDaEliminare, setTipoDaEliminare] = useState<TipoTurnoConfig | null>(null);

  const apriNuovoTipo = () => {
    setTipoInModifica(null);
    setFormNome('');
    setFormDescrizione('');
    setFormIcona('🚑');
    setFormMansioni([]);
    setFiltroMansioni('');
    setErroreForm(null);
    setModaleAperta(true);
  };

  const apriModificaTipo = (tipo: TipoTurnoConfig) => {
    setTipoInModifica(tipo);
    setFormNome(tipo.nome);
    setFormDescrizione(tipo.descrizione || '');
    setFormIcona(tipo.icona || '🚑');
    setFormMansioni(tipo.mansioniObbligatorie.map((m) => ({ ...m })));
    setFiltroMansioni('');
    setErroreForm(null);
    setModaleAperta(true);
  };

  const aggiungiMansione = (opt: OpzioneMansioneTurno) => {
    setErroreForm(null);
    setFormMansioni((prev) => {
      if (prev.some((m) => m.id === opt.id)) return prev;
      return [
        ...prev,
        {
          id: opt.id,
          nome: opt.nome,
          emoji: opt.emoji,
          ruoloTurno: opt.ruoloTurno,
          mansioneCatalogoId: opt.mansioneCatalogoId,
          categoria: opt.categoria,
          minimo: 1,
          massimo: 1,
        },
      ];
    });
  };

  const rimuoviMansione = (id: string) => {
    setFormMansioni((prev) => prev.filter((m) => m.id !== id));
  };

  const aggiornaMinMaxMansione = (id: string, campo: 'minimo' | 'massimo', valoreRaw: number) => {
    const val = Math.max(1, Math.min(50, Math.floor(Number.isFinite(valoreRaw) ? valoreRaw : 1)));
    setFormMansioni((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (campo === 'minimo') {
          const nextMin = val;
          const nextMax = Math.max(nextMin, m.massimo);
          return { ...m, minimo: nextMin, massimo: nextMax };
        } else {
          const nextMax = val;
          const nextMin = Math.min(m.minimo, nextMax);
          return { ...m, minimo: Math.max(1, nextMin), massimo: nextMax };
        }
      })
    );
  };

  const handleSalvaTipo = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = formNome.trim();
    if (!nomePulito) {
      setErroreForm('Inserisci il nome del tipo di turno.');
      return;
    }
    if (formMansioni.length === 0) {
      setErroreForm('Associa almeno una mansione obbligatoria per comporre l\'equipaggio.');
      return;
    }

    // Controllo duplicati nome (case-insensitive)
    const duplicato = tipiTurno.find(
      (t) => t.nome.trim().toLowerCase() === nomePulito.toLowerCase() && t.id !== tipoInModifica?.id
    );
    if (duplicato) {
      setErroreForm(`Esiste già un tipo di turno denominato "${duplicato.nome}". Scegli un nome diverso.`);
      return;
    }

    const mansioniPulite: MansioneTipoTurno[] = formMansioni.map((m) => {
      const minimo = Math.max(1, Math.floor(m.minimo || 1));
      const massimo = Math.max(minimo, Math.floor(m.massimo || minimo));
      return { ...m, minimo, massimo };
    });

    let aggiornati: TipoTurnoConfig[];
    if (tipoInModifica) {
      aggiornati = tipiTurno.map((t) =>
        t.id === tipoInModifica.id
          ? {
              ...t,
              nome: nomePulito,
              descrizione: formDescrizione.trim(),
              icona: formIcona || '📅',
              mansioniObbligatorie: mansioniPulite,
            }
          : t
      );
    } else {
      const nuovo: TipoTurnoConfig = {
        id: `tipo-turno-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nome: nomePulito,
        descrizione: formDescrizione.trim(),
        icona: formIcona || '📅',
        mansioniObbligatorie: mansioniPulite,
        dataCreazione: formatDateItaly(),
        predefinito: false,
      };
      aggiornati = [...tipiTurno, nuovo];
    }

    const salvati = salvaTipiTurnoCatalogo(aggiornati);
    realtime.syncTipiTurno(salvati);

    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'turni',
        tipoInModifica ? 'Modifica Tipo di Turno' : 'Creazione Tipo di Turno',
        `${tipoInModifica ? 'Modificato' : 'Creato'} tipo di turno "${nomePulito}" con ${mansioniPulite.length} mansioni obbligatorie`,
        operatoreCorrente
      );
    }

    onAvviso?.(
      tipoInModifica
        ? `✓ Tipo di turno "${nomePulito}" aggiornato con successo.`
        : `✓ Nuovo tipo di turno "${nomePulito}" creato e sincronizzato.`
    );
    setModaleAperta(false);
    setTipoInModifica(null);
  };

  const confermaEliminaTipo = () => {
    if (!tipoDaEliminare) return;
    const nome = tipoDaEliminare.nome;
    const aggiornati = tipiTurno.filter((t) => t.id !== tipoDaEliminare.id);
    const salvati = salvaTipiTurnoCatalogo(aggiornati);
    realtime.syncTipiTurno(salvati);
    onAvviso?.(`Tipo di turno "${nome}" eliminato.`);
    setTipoDaEliminare(null);
  };

  // Raggruppamento opzioni mansioni per il selettore
  const { ruoliBaseFiltrati, mansioniExtraPerCategoria } = useMemo(() => {
    const q = filtroMansioni.trim().toLowerCase();
    const base = tutteMansioniDisponibili.filter(
      (o) => o.isRuoloBase && (!q || o.nome.toLowerCase().includes(q) || (o.descrizione || '').toLowerCase().includes(q))
    );
    const extra = tutteMansioniDisponibili.filter(
      (o) => !o.isRuoloBase && (!q || o.nome.toLowerCase().includes(q) || o.categoria.toLowerCase().includes(q))
    );
    const byCat: Record<string, OpzioneMansioneTurno[]> = {};
    extra.forEach((opt) => {
      const cat = opt.categoria || 'Altre Mansioni';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(opt);
    });
    return { ruoliBaseFiltrati: base, mansioniExtraPerCategoria: byCat };
  }, [tutteMansioniDisponibili, filtroMansioni]);

  const idsSelezionati = useMemo(() => new Set(formMansioni.map((m) => m.id)), [formMansioni]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Intestazione Sottosezione Tipi di Turni */}
      <div className="bg-slate-950 p-4 sm:p-5 rounded-3xl border border-indigo-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
              Tipi di Turni & Equipaggi Obbligatori
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Crea e configura i tipi di turno selezionabili nella programmazione di turni singoli o ripetuti. Associa una o più mansioni obbligatorie indicando il numero minimo e massimo di persone per ciascuna mansione.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={apriNuovoTipo}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer shrink-0 border border-indigo-400/50"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nuovo Tipo di Turno</span>
        </button>
      </div>

      {/* Griglia dei Tipi di Turno */}
      {tipiTurno.length === 0 ? (
        <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="text-base font-bold text-white">Nessun Tipo di Turno configurato</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Crea il primo Tipo di Turno associando le mansioni obbligatorie e il numero minimo/massimo di volontari per ogni mansione.
          </p>
          <button
            type="button"
            onClick={apriNuovoTipo}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crea Primo Tipo di Turno</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tipiTurno.map((tipo) => {
            const totMin = tipo.mansioniObbligatorie.reduce((acc, m) => acc + (m.minimo || 1), 0);
            const totMax = tipo.mansioniObbligatorie.reduce((acc, m) => acc + (m.massimo || m.minimo || 1), 0);

            return (
              <div
                key={tipo.id}
                className="bg-slate-950 rounded-2xl border border-slate-800 hover:border-indigo-500/60 p-4 shadow-xl flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-3">
                  {/* Header Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-xl flex items-center justify-center shrink-0">
                        {tipo.icona || '📅'}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-black text-white text-sm leading-tight break-words">
                          {tipo.nome}
                        </h4>
                        {tipo.descrizione && (
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {tipo.descrizione}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-lg bg-teal-950/80 border border-teal-500/40 text-teal-300 font-mono text-[10px] font-black whitespace-nowrap shrink-0 tabular-nums">
                      <Users className="w-3 h-3 inline mr-1 -mt-0.5" />
                      {totMin === totMax ? `${totMin} pers.` : `${totMin}–${totMax} pers.`}
                    </span>
                  </div>

                  {/* Mansioni Obbligatorie */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] uppercase font-black text-slate-400 tracking-wide mb-1">
                      Mansioni Obbligatorie ({tipo.mansioniObbligatorie.length}):
                    </div>
                    {tipo.mansioniObbligatorie.length === 0 ? (
                      <div className="text-[11px] text-amber-400 italic">Nessuna mansione associata</div>
                    ) : (
                      tipo.mansioniObbligatorie.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs"
                        >
                          <span className="font-semibold text-slate-200 truncate">
                            <span className="mr-1">{m.emoji || '🎖️'}</span>
                            {m.nome}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono text-[10px] font-black whitespace-nowrap shrink-0 tabular-nums">
                            Min {m.minimo} · Max {m.massimo}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Azioni */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => apriModificaTipo(tipo)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Modifica</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDaEliminare(tipo)}
                    className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-800/70 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Elimina</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE (IN-APP) */}
      {tipoDaEliminare && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-red-500/60 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase">Elimina Tipo di Turno</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Confermi di voler eliminare il tipo di turno <strong className="text-amber-300">"{tipoDaEliminare.nome}"</strong>? I turni già programmati nel calendario non verranno cancellati.
                </p>
              </div>
            </div>
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
                onClick={confermaEliminaTipo}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase cursor-pointer shadow-md"
              >
                Conferma Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CREA / MODIFICA TIPO DI TURNO */}
      {modaleAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl max-w-3xl w-full p-4 sm:p-5 shadow-2xl text-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {tipoInModifica ? 'Modifica Tipo di Turno' : 'Nuovo Tipo di Turno'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaTipo} className="space-y-4 text-xs">
              {erroreForm && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{erroreForm}</span>
                </div>
              )}

              {/* Nome, Icona, Descrizione */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-slate-300 font-bold mb-1">
                    Nome Tipo di Turno <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => {
                      setFormNome(e.target.value);
                      setErroreForm(null);
                    }}
                    placeholder="es. Emergenza 118, Dialisi, Protezione Civile, Evento..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-slate-300 font-bold mb-1">Icona</label>
                  <div className="flex items-center gap-1 flex-wrap p-1.5 rounded-xl bg-slate-950 border border-slate-700">
                    {ICONE_SUGGERITE.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setFormIcona(ico)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                          formIcona === ico
                            ? 'bg-indigo-600 ring-2 ring-indigo-300 scale-105'
                            : 'hover:bg-slate-800'
                        }`}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-12">
                  <label className="block text-slate-400 font-bold mb-1">Descrizione (Opzionale)</label>
                  <input
                    type="text"
                    value={formDescrizione}
                    onChange={(e) => setFormDescrizione(e.target.value)}
                    placeholder="Breve descrizione operativa del tipo di turno..."
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Mansioni Obbligatorie Selezionate con MIN e MAX */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase text-indigo-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>Mansioni Obbligatorie Associate ({formMansioni.length})</span>
                  </span>
                  <span className="text-[10.5px] text-slate-400">
                    Imposta per ogni mansione il numero <strong className="text-white">Minimo</strong> e <strong className="text-white">Massimo</strong> di persone
                  </span>
                </div>

                {formMansioni.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-dashed border-slate-700 text-center text-slate-400 text-xs">
                    Nessuna mansione ancora aggiunta. Seleziona una o più mansioni dall'elenco sottostante.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formMansioni.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-xs truncate">
                            <span className="mr-1.5">{m.emoji || '🎖️'}</span>
                            {m.nome}
                          </div>
                          {m.categoria && (
                            <span className="text-[10px] text-slate-400">{m.categoria}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between sm:justify-end">
                          {/* Controllo Minimo */}
                          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700">
                            <span className="text-[10px] font-black uppercase text-teal-400 mr-1">Min</span>
                            <button
                              type="button"
                              onClick={() => aggiornaMinMaxMansione(m.id, 'minimo', m.minimo - 1)}
                              disabled={m.minimo <= 1}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              required
                              value={m.minimo}
                              onChange={(e) => aggiornaMinMaxMansione(m.id, 'minimo', Number(e.target.value))}
                              className="w-10 text-center bg-transparent text-white font-mono font-black text-xs focus:outline-none tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => aggiornaMinMaxMansione(m.id, 'minimo', m.minimo + 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Controllo Massimo */}
                          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700">
                            <span className="text-[10px] font-black uppercase text-amber-400 mr-1">Max</span>
                            <button
                              type="button"
                              onClick={() => aggiornaMinMaxMansione(m.id, 'massimo', m.massimo - 1)}
                              disabled={m.massimo <= 1}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={m.minimo}
                              max={50}
                              required
                              value={m.massimo}
                              onChange={(e) => aggiornaMinMaxMansione(m.id, 'massimo', Number(e.target.value))}
                              className="w-10 text-center bg-transparent text-white font-mono font-black text-xs focus:outline-none tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => aggiornaMinMaxMansione(m.id, 'massimo', m.massimo + 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => rimuoviMansione(m.id)}
                            className="p-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/60 cursor-pointer"
                            title="Rimuovi mansione"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Catalogo Mansioni Selezionabili (7 Ruoli Base + Mansioni & Competenze Volontari) */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase text-slate-300">
                    Aggiungi Mansioni all'Equipaggio:
                  </span>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={filtroMansioni}
                      onChange={(e) => setFiltroMansioni(e.target.value)}
                      placeholder="Cerca mansione o ruolo..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 1. Ruoli Equipaggio Base (1-7) */}
                {ruoliBaseFiltrati.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black uppercase text-teal-400 tracking-wide">
                      Ruoli Equipaggio Standard
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ruoliBaseFiltrati.map((opt) => {
                        const aggiunta = idsSelezionati.has(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => (aggiunta ? rimuoviMansione(opt.id) : aggiungiMansione(opt))}
                            className={`px-2.5 py-2 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              aggiunta
                                ? 'bg-indigo-600/30 border-indigo-400 text-white'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="truncate">
                              <span className="mr-1.5">{opt.emoji}</span>
                              {opt.nome}
                            </span>
                            {aggiunta ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <PlusCircle className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Altre Mansioni dal Database Gestione Volontari -> Mansioni & Competenze */}
                {Object.keys(mansioniExtraPerCategoria).length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-800">
                    <div className="text-[10px] font-black uppercase text-amber-400 tracking-wide">
                      Mansioni & Competenze (Database Gestione Volontari)
                    </div>
                    {Object.entries(mansioniExtraPerCategoria).map(([cat, items]) => (
                      <div key={cat} className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{cat}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {items.map((opt) => {
                            const aggiunta = idsSelezionati.has(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => (aggiunta ? rimuoviMansione(opt.id) : aggiungiMansione(opt))}
                                className={`px-2.5 py-2 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                  aggiunta
                                    ? 'bg-amber-500/20 border-amber-400 text-white'
                                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                                }`}
                              >
                                <span className="truncate">
                                  <span className="mr-1.5">{opt.emoji}</span>
                                  {opt.nome}
                                </span>
                                {aggiunta ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <PlusCircle className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Bottoni */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer border border-indigo-400/50"
                >
                  <Save className="w-4 h-4" />
                  <span>{tipoInModifica ? 'Salva Modifiche' : 'Salva Tipo di Turno'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
