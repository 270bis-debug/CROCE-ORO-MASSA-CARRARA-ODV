import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  PlusCircle,
  Edit2,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  RotateCcw,
  Fuel,
  CheckCircle2,
  AlertTriangle,
  Power,
  Ambulance,
} from 'lucide-react';
import { MezzoFlotta } from '../../types/adminTypes';
import { RifornimentoCarburante } from '../../types/consumiTypes';
import {
  MetodoPagamentoCarburante,
  METODI_PAGAMENTO_CARBURANTE_DEFAULT,
  salvaMetodiPagamentoCarburante,
} from '../../utils/metodiPagamentoCarburanteStore';
import { realtime } from '../../services/realtime';

interface SezionePagamentiCarburanteProps {
  metodi: MetodoPagamentoCarburante[];
  mezzi: MezzoFlotta[];
  rifornimenti: RifornimentoCarburante[];
  operatoreCorrente?: string;
  onAvvisa?: (msg: string) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onVaiAConsumi?: () => void;
}

export const SezionePagamentiCarburante: React.FC<SezionePagamentiCarburanteProps> = ({
  metodi,
  mezzi,
  rifornimenti,
  operatoreCorrente = 'Amministratore',
  onAvvisa,
  onNotificaRadio,
  onVaiAConsumi,
}) => {
  // Form aggiunta nuovo metodo
  const [nuovoNome, setNuovoNome] = useState('');
  const [nuovoCodice, setNuovoCodice] = useState('');
  const [nuovaDescrizione, setNuovaDescrizione] = useState('');
  const [nuovoMezzoAssegnato, setNuovoMezzoAssegnato] = useState('');
  const [nuovoAttivo, setNuovoAttivo] = useState(true);
  const [nuovoPredefinito, setNuovoPredefinito] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  // Modifica inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCodice, setEditCodice] = useState('');
  const [editDescrizione, setEditDescrizione] = useState('');
  const [editMezzoAssegnato, setEditMezzoAssegnato] = useState('');

  // Conferme inline (zero window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Statistiche utilizzo per metodo nei rifornimenti registrati
  const statsPerMetodo = useMemo(() => {
    const map = new Map<string, { conteggio: number; spesa: number; litri: number }>();
    rifornimenti.forEach((r) => {
      const k = String(r.metodoPagamento || '').trim().toLowerCase();
      if (!k) return;
      const cur = map.get(k) || { conteggio: 0, spesa: 0, litri: 0 };
      cur.conteggio += 1;
      cur.spesa += Number(r.costoTotale || 0);
      cur.litri += Number(r.litri || 0);
      map.set(k, cur);
    });
    return map;
  }, [rifornimenti]);

  const attiviCount = useMemo(() => metodi.filter((m) => m.attivo).length, [metodi]);
  const metodoPredefinito = useMemo(
    () => metodi.find((m) => m.predefinito && m.attivo) || metodi.find((m) => m.attivo) || metodi[0],
    [metodi]
  );

  const persistiESincronizza = (nuovaLista: MetodoPagamentoCarburante[], messaggioToast: string) => {
    const saved = salvaMetodiPagamentoCarburante(nuovaLista);
    realtime.syncMetodiPagamentoCarburante(saved.lista, saved.updatedAt);
    onAvvisa?.(messaggioToast);
  };

  const handleAggiungi = (e: React.FormEvent) => {
    e.preventDefault();
    setErroreForm(null);
    const nomeTrim = nuovoNome.trim();
    if (!nomeTrim) {
      setErroreForm('Inserisci il nome del sistema di pagamento (es. Carta Carburante IP, Telepass Fleet...).');
      return;
    }
    if (metodi.some((m) => m.nome.trim().toLowerCase() === nomeTrim.toLowerCase())) {
      setErroreForm('Esiste già un sistema di pagamento con questo nome.');
      return;
    }

    const now = Date.now();
    const nuovoItem: MetodoPagamentoCarburante = {
      id: `mpc-${now}`,
      nome: nomeTrim,
      codiceCarta: nuovoCodice.trim() || undefined,
      descrizione: nuovaDescrizione.trim() || undefined,
      mezzoSiglaAssegnato: nuovoMezzoAssegnato.trim() || undefined,
      attivo: nuovoAttivo,
      predefinito: nuovoPredefinito && nuovoAttivo,
      ordine: metodi.length,
      updatedAt: now,
    };

    const base =
      nuovoItem.predefinito
        ? metodi.map((m) => ({ ...m, predefinito: false }))
        : metodi;

    persistiESincronizza(
      [...base, nuovoItem],
      nuovoItem.mezzoSiglaAssegnato
        ? `✅ Aggiunto "${nomeTrim}" associato al mezzo ${nuovoItem.mezzoSiglaAssegnato}.`
        : `✅ Aggiunto metodo di pagamento "${nomeTrim}".`
    );
    onNotificaRadio?.(
      `💳 DATABASE MEZZI: Aggiunto metodo pagamento carburante "${nomeTrim}"${nuovoItem.mezzoSiglaAssegnato ? ` (Mezzo ${nuovoItem.mezzoSiglaAssegnato})` : ''} (${operatoreCorrente}).`,
      'sistema'
    );

    setNuovoNome('');
    setNuovoCodice('');
    setNuovaDescrizione('');
    setNuovoMezzoAssegnato('');
    setNuovoAttivo(true);
    setNuovoPredefinito(false);
  };

  const avviaModifica = (m: MetodoPagamentoCarburante) => {
    setEditingId(m.id);
    setEditNome(m.nome);
    setEditCodice(m.codiceCarta || '');
    setEditDescrizione(m.descrizione || '');
    setEditMezzoAssegnato(m.mezzoSiglaAssegnato || '');
    setConfirmDeleteId(null);
  };

  const salvaModifica = (id: string) => {
    const nomeTrim = editNome.trim();
    if (!nomeTrim) return;
    if (metodi.some((m) => m.id !== id && m.nome.trim().toLowerCase() === nomeTrim.toLowerCase())) {
      setErroreForm('Esiste già un altro sistema di pagamento con questo nome.');
      return;
    }
    setErroreForm(null);
    const next = metodi.map((m) =>
      m.id === id
        ? {
            ...m,
            nome: nomeTrim,
            codiceCarta: editCodice.trim() || undefined,
            descrizione: editDescrizione.trim() || undefined,
            mezzoSiglaAssegnato: editMezzoAssegnato.trim() || undefined,
            updatedAt: Date.now(),
          }
        : m
    );
    persistiESincronizza(next, `💾 Metodo "${nomeTrim}" aggiornato e sincronizzato.`);
    setEditingId(null);
  };

  const handleToggleAttivo = (m: MetodoPagamentoCarburante) => {
    if (m.attivo && attiviCount <= 1) {
      setErroreForm('Deve rimanere almeno un sistema di pagamento attivo nei moduli di rifornimento.');
      return;
    }
    setErroreForm(null);
    const next = metodi.map((item) =>
      item.id === m.id
        ? { ...item, attivo: !item.attivo, predefinito: !item.attivo ? item.predefinito : false, updatedAt: Date.now() }
        : item
    );
    persistiESincronizza(
      next,
      !m.attivo
        ? `✅ Metodo "${m.nome}" riattivato nei moduli rifornimento.`
        : `⏸️ Metodo "${m.nome}" nascosto dai nuovi rifornimenti.`
    );
  };

  const handleImpostaPredefinito = (m: MetodoPagamentoCarburante) => {
    setErroreForm(null);
    const next = metodi.map((item) => ({
      ...item,
      attivo: item.id === m.id ? true : item.attivo,
      predefinito: item.id === m.id,
      updatedAt: item.id === m.id ? Date.now() : item.updatedAt,
    }));
    persistiESincronizza(next, `⭐ "${m.nome}" impostato come metodo predefinito per i rifornimenti.`);
  };

  const handleSposta = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= metodi.length) return;
    const copy = [...metodi];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    const reordered = copy.map((item, i) => ({ ...item, ordine: i }));
    persistiESincronizza(reordered, '↕️ Ordine dei metodi di pagamento carburante aggiornato.');
  };

  const handleElimina = (m: MetodoPagamentoCarburante) => {
    if (metodi.length <= 1) {
      setErroreForm('Impossibile eliminare l\'unico metodo di pagamento rimasto.');
      setConfirmDeleteId(null);
      return;
    }
    setErroreForm(null);
    const next = metodi.filter((item) => item.id !== m.id);
    persistiESincronizza(next, `🗑️ Metodo "${m.nome}" eliminato dall'elenco (lo storico rifornimenti resta intatto).`);
    setConfirmDeleteId(null);
  };

  const handleRipristinaPredefiniti = () => {
    setErroreForm(null);
    const defaults = METODI_PAGAMENTO_CARBURANTE_DEFAULT.map((m, idx) => ({
      ...m,
      ordine: idx,
      updatedAt: Date.now(),
    }));
    persistiESincronizza(defaults, '🔄 Ripristinati i 5 metodi di pagamento carburante predefiniti.');
    setConfirmResetOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Intestazione & Azioni Rapide */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
              Sistemi di Pagamento Carburante
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Configura le carte carburante, bancomat, contanti e altri sistemi usati per i rifornimenti dei mezzi.
              Le modifiche si aggiornano automaticamente sia in <strong className="text-slate-200">Consumi &amp; Costo KM</strong> sia nel{' '}
              <strong className="text-amber-300">Rifornimento Rapido da Turno</strong> su tutti i dispositivi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onVaiAConsumi && (
            <button
              type="button"
              onClick={onVaiAConsumi}
              className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Fuel className="w-4 h-4" />
              <span>Vai a Consumi</span>
            </button>
          )}
          {!confirmResetOpen ? (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ripristina Predefiniti</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-[11px] text-amber-200">
              <span className="font-bold">Ripristinare elenco base?</span>
              <button
                type="button"
                onClick={handleRipristinaPredefiniti}
                className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase cursor-pointer"
              >
                Sì
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase cursor-pointer"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Riepilogo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-black uppercase text-slate-400">Metodi Configurati</div>
          <div className="text-2xl font-black text-white font-mono mt-1">{metodi.length}</div>
        </div>
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-3.5">
          <div className="text-[10px] font-black uppercase text-emerald-400">Attivi nei Moduli</div>
          <div className="text-2xl font-black text-emerald-300 font-mono mt-1">{attiviCount}</div>
        </div>
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-3.5">
          <div className="text-[10px] font-black uppercase text-amber-400">Predefinito</div>
          <div className="text-sm font-black text-amber-200 mt-1.5 truncate" title={metodoPredefinito?.nome}>
            {metodoPredefinito?.nome || '—'}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-black uppercase text-slate-400">Rifornimenti Archiviati</div>
          <div className="text-2xl font-black text-sky-300 font-mono mt-1">{rifornimenti.length}</div>
        </div>
      </div>

      {erroreForm && (
        <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{erroreForm}</span>
          </div>
          <button
            type="button"
            onClick={() => setErroreForm(null)}
            className="p-1 rounded-lg hover:bg-rose-900/60 text-rose-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form Nuovo Metodo */}
      <form
        onSubmit={handleAggiungi}
        className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-300">
          <PlusCircle className="w-4 h-4" />
          <span>Aggiungi Nuovo Sistema di Pagamento Carburante</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
              Nome Sistema / Carta *
            </label>
            <input
              type="text"
              value={nuovoNome}
              onChange={(e) => setNuovoNome(e.target.value)}
              placeholder="Es. Carta Carburante Eni T4606"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
              <Ambulance className="w-3 h-3 text-amber-400" />
              <span>Mezzo Assegnato (opzionale)</span>
            </label>
            <select
              value={nuovoMezzoAssegnato}
              onChange={(e) => setNuovoMezzoAssegnato(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
            >
              <option value="">Tutta la flotta (generico)</option>
              {mezzi.map((mz) => (
                <option key={mz.id || mz.sigla} value={mz.sigla}>
                  {mz.sigla} — {mz.modello} ({mz.targa})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
              Codice / Ultime Cifre Carta (opzionale)
            </label>
            <input
              type="text"
              value={nuovoCodice}
              onChange={(e) => setNuovoCodice(e.target.value)}
              placeholder="Es. Carta #4821 / Cartissima"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
              Descrizione / Note Autisti (opzionale)
            </label>
            <input
              type="text"
              value={nuovaDescrizione}
              onChange={(e) => setNuovaDescrizione(e.target.value)}
              placeholder="Es. Custodita nel cruscotto, conservare ricevuta"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={nuovoAttivo}
                onChange={(e) => {
                  setNuovoAttivo(e.target.checked);
                  if (!e.target.checked) setNuovoPredefinito(false);
                }}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="font-bold">Attivo subito nei moduli</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={nuovoPredefinito}
                disabled={!nuovoAttivo}
                onChange={(e) => setNuovoPredefinito(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 disabled:opacity-40"
              />
              <span className="font-bold text-amber-300">Imposta come predefinito</span>
            </label>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow-lg cursor-pointer transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Aggiungi Sistema</span>
          </button>
        </div>
      </form>

      {/* Elenco Metodi Configurati */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-slate-300">
            Elenco Sistemi di Pagamento ({metodi.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Usa le frecce per cambiare l&apos;ordine nei menu a tendina
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {metodi.map((m, idx) => {
            const isEditing = editingId === m.id;
            const stats = statsPerMetodo.get(m.nome.trim().toLowerCase());

            return (
              <div
                key={m.id}
                className={`p-3.5 sm:p-4 transition-colors ${
                  !m.attivo ? 'bg-slate-950/60 opacity-70' : 'hover:bg-slate-800/35'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Nome *
                        </label>
                        <input
                          type="text"
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/60 text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Mezzo Assegnato
                        </label>
                        <select
                          value={editMezzoAssegnato}
                          onChange={(e) => setEditMezzoAssegnato(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                        >
                          <option value="">Tutta la flotta (generico)</option>
                          {mezzi.map((mz) => (
                            <option key={mz.id || mz.sigla} value={mz.sigla}>
                              {mz.sigla} — {mz.modello} ({mz.targa})
                            </option>
                          ))}
                          {editMezzoAssegnato && !mezzi.some((mz) => mz.sigla === editMezzoAssegnato) && (
                            <option value={editMezzoAssegnato}>{editMezzoAssegnato}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Codice / Ultime Cifre Carta
                        </label>
                        <input
                          type="text"
                          value={editCodice}
                          onChange={(e) => setEditCodice(e.target.value)}
                          placeholder="Opzionale"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Descrizione / Note
                        </label>
                        <input
                          type="text"
                          value={editDescrizione}
                          onChange={(e) => setEditDescrizione(e.target.value)}
                          placeholder="Opzionale"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Annulla
                      </button>
                      <button
                        type="button"
                        onClick={() => salvaModifica(m.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Salva Modifiche
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleSposta(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          title="Sposta su"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSposta(idx, 1)}
                          disabled={idx === metodi.length - 1}
                          className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          title="Sposta giù"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-white">{m.nome}</span>
                          {m.mezzoSiglaAssegnato && (
                            <span
                              className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/50 text-[10px] font-mono font-black text-amber-300 inline-flex items-center gap-1"
                              title={`Preselezionata automaticamente quando si rifornisce il mezzo ${m.mezzoSiglaAssegnato}`}
                            >
                              <Ambulance className="w-3 h-3" />
                              Mezzo {m.mezzoSiglaAssegnato}
                            </span>
                          )}
                          {m.codiceCarta && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-sky-300">
                              {m.codiceCarta}
                            </span>
                          )}
                          {m.predefinito && m.attivo && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-[10px] font-black uppercase text-amber-300 inline-flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              Predefinito
                            </span>
                          )}
                          {m.attivo ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-black uppercase text-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Attivo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-black uppercase text-slate-400">
                              Disattivato
                            </span>
                          )}
                        </div>

                        {m.descrizione && (
                          <p className="text-xs text-slate-400 leading-snug">{m.descrizione}</p>
                        )}

                        <div className="text-[11px] text-slate-500">
                          {stats ? (
                            <span>
                              Usato in <strong className="text-slate-300">{stats.conteggio}</strong>{' '}
                              {stats.conteggio === 1 ? 'rifornimento' : 'rifornimenti'} • Totale:{' '}
                              <strong className="text-amber-300 font-mono">€ {stats.spesa.toFixed(2)}</strong> ({stats.litri.toFixed(1)} L)
                            </span>
                          ) : (
                            <span>Nessun rifornimento registrato finora con questo metodo</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Azioni riga */}
                    <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center shrink-0">
                      {!m.predefinito && (
                        <button
                          type="button"
                          onClick={() => handleImpostaPredefinito(m)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Imposta come predefinito"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Predefinito</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleAttivo(m)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                          m.attivo
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                            : 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300'
                        }`}
                        title={m.attivo ? 'Disattiva nei nuovi rifornimenti' : 'Riattiva nei nuovi rifornimenti'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{m.attivo ? 'Disattiva' : 'Attiva'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => avviaModifica(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-500/50 text-slate-200 hover:text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Modifica nome o dettagli"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Modifica</span>
                      </button>

                      {confirmDeleteId === m.id ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/90 border border-rose-500/60 text-[11px]">
                          <span className="text-rose-200 font-bold">Eliminare?</span>
                          <button
                            type="button"
                            onClick={() => handleElimina(m)}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-black uppercase cursor-pointer"
                          >
                            Sì
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(m.id)}
                          disabled={metodi.length <= 1}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-400 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                          title="Elimina metodo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
