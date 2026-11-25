import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Edit3,
  Trash2,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Save,
  RotateCcw,
  Send,
  Search,
  Power,
} from 'lucide-react';
import {
  ScadenzaFiscaleODV,
  StatoScadenzaFiscale,
  CategoriaScadenzaFiscaleODV,
  ConfigScadenzeFiscaliODV,
} from '../../types/adminTypes';
import { Volontario } from '../DatabaseVolontariModal';
import {
  useScadenzeFiscaliOdv,
  salvaScadenzeFiscaliOdv,
  creaScadenzeFiscaliOdvDefault,
  normalizzaGiorniPreavviso,
  calcolaGiorniAllaScadenza,
  risolviDestinatariScadenzeFiscali,
  inviaEmailPromemoriaScadenzaFiscale,
} from '../../utils/scadenzeFiscaliOdv';
import { formatDateItaly, formatISODateItaly } from '../../utils/italianTime';
import { realtime } from '../../services/realtime';
import { notificaModificaGestionale } from '../../utils/notificaModificaAdmin';

interface PannelloScadenzeFiscaliOdvProps {
  volontari: Volontario[];
  puoModificarePreavviso: boolean; // Solo Tesoriere e Amministratore
  isAdmin?: boolean;
  operatoreNome?: string;
  onNotificaRadio?: (messaggio: string) => void;
}

const CATEGORIE_FISCALI: CategoriaScadenzaFiscaleODV[] = [
  'RUNTS & Bilancio',
  '5 per Mille',
  'Trasparenza',
  'Fiscale & Tributi',
  'Dipendenti & Collaboratori',
  'Altro',
];

const STATI_SCADENZA: StatoScadenzaFiscale[] = ['Aperta', 'Chiusa', 'Annullata'];

export const PannelloScadenzeFiscaliOdv: React.FC<PannelloScadenzeFiscaliOdvProps> = ({
  volontari,
  puoModificarePreavviso,
  isAdmin = false,
  operatoreNome = 'Amministrazione',
  onNotificaRadio,
}) => {
  const { scadenze, config } = useScadenzeFiscaliOdv();

  const [filtroStato, setFiltroStato] = useState<'Tutte' | StatoScadenzaFiscale>('Tutte');
  const [filtroAttiva, setFiltroAttiva] = useState<'tutte' | 'attive' | 'disattive'>('tutte');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Tutte');
  const [ricerca, setRicerca] = useState('');

  // Configurazione giorni preavviso default (modificabile solo da Tesoriere o Admin)
  const [giorniInput, setGiorniInput] = useState<string>(() =>
    (config.giorniPreavvisoDefault || [60, 30, 15]).join(', ')
  );
  const [messaggioFeedback, setMessaggioFeedback] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);

  // Modale aggiunta / modifica scadenza
  const [modalAperta, setModalAperta] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitolo, setFormTitolo] = useState('');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formCategoria, setFormCategoria] = useState<CategoriaScadenzaFiscaleODV>('RUNTS & Bilancio');
  const [formDataScadenza, setFormDataScadenza] = useState(() => formatISODateItaly());
  const [formRicorrenza, setFormRicorrenza] = useState(true);
  const [formAttiva, setFormAttiva] = useState(true);
  const [formStato, setFormStato] = useState<StatoScadenzaFiscale>('Aperta');
  const [formNormativa, setFormNormativa] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formGiorniCustom, setFormGiorniCustom] = useState('');

  const destinatariRisolti = useMemo(() => {
    const lista = risolviDestinatariScadenzeFiscali(volontari);
    return {
      lista,
      emails: Array.from(new Set(lista.map((d) => d.email).filter((e) => e.includes('@')))),
      nomi: lista.map((d) => `${d.nome} (${d.ruolo})`),
    };
  }, [volontari]);

  const mostraFeedback = (msg: string) => {
    setMessaggioFeedback(msg);
    setTimeout(() => setMessaggioFeedback(null), 4500);
  };

  const persisti = (nuovaLista: ScadenzaFiscaleODV[], nuovaConfig?: ConfigScadenzeFiscaliODV) => {
    const res = salvaScadenzeFiscaliOdv(nuovaLista, nuovaConfig || config);
    realtime.syncScadenzeFiscaliOdv(res.lista, res.config);
    return res;
  };

  const handleSalvaGiorniDefault = () => {
    if (!puoModificarePreavviso) return;
    const parts = giorniInput
      .split(/[,;\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 365);
    const norm = normalizzaGiorniPreavviso(parts);
    const nextConfig: ConfigScadenzeFiscaliODV = {
      ...config,
      giorniPreavvisoDefault: norm,
      updatedAt: Date.now(),
      updatedBy: operatoreNome,
    };
    persisti(scadenze, nextConfig);
    setGiorniInput(norm.join(', '));
    mostraFeedback(`Preavvisi default aggiornati a: ${norm.map((g) => `${g}gg`).join(', ')}`);
    notificaModificaGestionale({
      macroCategoria: 'Contabilità — Scadenze Fiscali ODV',
      azione: 'Modifica Preavvisi Notifiche',
      dettaglio: `Giorni di preavviso impostati a: ${norm.join(', ')} giorni.`,
    });
  };

  const apriNuovaScadenza = () => {
    setEditingId(null);
    setFormTitolo('');
    setFormDescrizione('');
    setFormCategoria('RUNTS & Bilancio');
    setFormDataScadenza(formatISODateItaly());
    setFormRicorrenza(true);
    setFormAttiva(true);
    setFormStato('Aperta');
    setFormNormativa('');
    setFormNote('');
    setFormGiorniCustom('');
    setModalAperta(true);
  };

  const apriModificaScadenza = (s: ScadenzaFiscaleODV) => {
    setEditingId(s.id);
    setFormTitolo(s.titolo);
    setFormDescrizione(s.descrizione || '');
    setFormCategoria(s.categoria);
    setFormDataScadenza(s.dataScadenza);
    setFormRicorrenza(Boolean(s.ricorrenzaAnnuale));
    setFormAttiva(Boolean(s.attiva));
    setFormStato(s.stato);
    setFormNormativa(s.riferimentoNormativo || '');
    setFormNote(s.note || '');
    setFormGiorniCustom(
      Array.isArray(s.giorniPreavvisoCustom) && s.giorniPreavvisoCustom.length > 0
        ? s.giorniPreavvisoCustom.join(', ')
        : ''
    );
    setModalAperta(true);
  };

  const handleSalvaScadenza = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitolo.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(formDataScadenza)) return;

    const customGiorni =
      puoModificarePreavviso && formGiorniCustom.trim()
        ? normalizzaGiorniPreavviso(
            formGiorniCustom
              .split(/[,;\s]+/)
              .map((v) => Number(v.trim()))
              .filter((n) => Number.isFinite(n) && n >= 1 && n <= 365)
          )
        : undefined;

    const prevItem = editingId ? scadenze.find((x) => x.id === editingId) : undefined;
    const item: ScadenzaFiscaleODV = {
      id: editingId || `odv-scad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      titolo: formTitolo.trim(),
      descrizione: formDescrizione.trim(),
      categoria: formCategoria,
      dataScadenza: formDataScadenza,
      ricorrenzaAnnuale: formRicorrenza,
      attiva: formAttiva,
      stato: formStato,
      riferimentoNormativo: formNormativa.trim() || undefined,
      note: formNote.trim() || undefined,
      giorniPreavvisoCustom: puoModificarePreavviso ? customGiorni : prevItem?.giorniPreavvisoCustom,
      notificheInviate: prevItem?.notificheInviate,
      predefinita: prevItem?.predefinita,
      creataDa: prevItem?.creataDa || operatoreNome,
      aggiornataIl: formatDateItaly(),
    };

    const nextList = editingId
      ? scadenze.map((x) => (x.id === editingId ? item : x))
      : [...scadenze, item];

    persisti(nextList);
    setModalAperta(false);
    mostraFeedback(editingId ? `Scadenza "${item.titolo}" aggiornata.` : `Scadenza "${item.titolo}" aggiunta.`);
    notificaModificaGestionale({
      macroCategoria: 'Contabilità — Scadenze Fiscali ODV',
      azione: editingId ? 'Modifica Scadenza Fiscale' : 'Nuova Scadenza Fiscale',
      elementoNome: item.titolo,
      dettaglio: `Data: ${item.dataScadenza} • Stato: ${item.stato} • Attiva: ${item.attiva ? 'Sì' : 'No'}`,
    });
  };

  const toggleAttiva = (s: ScadenzaFiscaleODV) => {
    const nextList = scadenze.map((x) =>
      x.id === s.id ? { ...x, attiva: !x.attiva, aggiornataIl: formatDateItaly() } : x
    );
    persisti(nextList);
  };

  const cambiaStato = (s: ScadenzaFiscaleODV, nuovoStato: StatoScadenzaFiscale) => {
    const nextList = scadenze.map((x) =>
      x.id === s.id ? { ...x, stato: nuovoStato, aggiornataIl: formatDateItaly() } : x
    );
    persisti(nextList);
    mostraFeedback(`"${s.titolo}" impostata su: ${nuovoStato}`);
  };

  const eliminaScadenza = (s: ScadenzaFiscaleODV) => {
    if (!isAdmin) return;
    const nextList = scadenze.filter((x) => x.id !== s.id);
    persisti(nextList);
    mostraFeedback(`Scadenza "${s.titolo}" eliminata.`);
  };

  const ripristinaScadenzeOdvMancanti = () => {
    const defaults = creaScadenzeFiscaliOdvDefault();
    const existingIds = new Set(scadenze.map((s) => s.id));
    const daAggiungere = defaults.filter((d) => !existingIds.has(d.id));
    if (daAggiungere.length === 0) {
      mostraFeedback('Tutte le 17 scadenze fiscali ODV predefinite sono già presenti.');
      return;
    }
    persisti([...scadenze, ...daAggiungere]);
    mostraFeedback(`Ripristinate ${daAggiungere.length} scadenze ODV predefinite.`);
  };

  const handleVerificaEInviaNotificheOra = async () => {
    setInvioInCorso(true);
    try {
      const oggiIso = formatISODateItaly();
      let inviate = 0;
      const nextList = [...scadenze];

      for (let i = 0; i < nextList.length; i++) {
        const scad = nextList[i];
        if (!scad.attiva || scad.stato !== 'Aperta') continue;
        const giorniMancanti = calcolaGiorniAllaScadenza(scad.dataScadenza, oggiIso);
        if (giorniMancanti < 0) continue;

        const soglie = normalizzaGiorniPreavviso(
          scad.giorniPreavvisoCustom && scad.giorniPreavvisoCustom.length > 0
            ? scad.giorniPreavvisoCustom
            : config.giorniPreavvisoDefault
        );
        const soglieRaggiunte = soglie.filter((g) => giorniMancanti <= g).sort((a, b) => a - b);
        if (soglieRaggiunte.length === 0) continue;

        const sogliaTarget = soglieRaggiunte[0];
        const key = `${scad.dataScadenza}_${sogliaTarget}`;
        if (scad.notificheInviate?.[key]) continue;

        await inviaEmailPromemoriaScadenzaFiscale({
          scadenza: scad,
          giorniMancanti,
          sogliaGiorni: sogliaTarget,
          destinatari: destinatariRisolti.lista,
        });

        onNotificaRadio?.(
          `📅 SCADENZA FISCALE ODV (-${giorniMancanti}gg, soglia ${sogliaTarget}gg): "${scad.titolo}" scade il ${scad.dataScadenza}.`
        );

        nextList[i] = {
          ...scad,
          notificheInviate: {
            ...(scad.notificheInviate || {}),
            [key]: oggiIso,
          },
        };
        inviate++;
      }

      if (inviate > 0) {
        persisti(nextList);
        mostraFeedback(
          `Inviate ${inviate} notifiche (Email + App) a Presidente, Tesoriere e Segretario.`
        );
      } else {
        mostraFeedback(
          'Nessuna nuova soglia di scadenza da notificare oggi (tutte le soglie raggiunte sono già state notificate).'
        );
      }
    } finally {
      setInvioInCorso(false);
    }
  };

  const scadenzeFiltrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return scadenze.filter((s) => {
      if (filtroStato !== 'Tutte' && s.stato !== filtroStato) return false;
      if (filtroAttiva === 'attive' && !s.attiva) return false;
      if (filtroAttiva === 'disattive' && s.attiva) return false;
      if (filtroCategoria !== 'Tutte' && s.categoria !== filtroCategoria) return false;
      if (q) {
        const hay = `${s.titolo} ${s.descrizione} ${s.riferimentoNormativo || ''} ${s.categoria}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scadenze, filtroStato, filtroAttiva, filtroCategoria, ricerca]);

  const stats = useMemo(() => {
    const aperte = scadenze.filter((s) => s.stato === 'Aperta').length;
    const chiuse = scadenze.filter((s) => s.stato === 'Chiusa').length;
    const annullate = scadenze.filter((s) => s.stato === 'Annullata').length;
    const attive = scadenze.filter((s) => s.attiva).length;
    return { aperte, chiuse, annullate, attive };
  }, [scadenze]);

  const renderBadgeStato = (stato: StatoScadenzaFiscale) => {
    if (stato === 'Chiusa') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
          <CheckCircle2 className="w-3 h-3" /> Chiusa
        </span>
      );
    }
    if (stato === 'Annullata') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/60 border border-slate-600 text-slate-300 text-[10px] font-black uppercase">
          <XCircle className="w-3 h-3" /> Annullata
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase">
        <Clock className="w-3 h-3" /> Aperta
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Azioni Rapide */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
              Scadenze Fiscali &amp; Economiche ODV (RUNTS / ETS)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Scadenziario precaricato per Organizzazioni di Volontariato (D.Lgs. 117/2017, 5x1000, L. 124/2017, CU, Modello ENC). Attiva o disattiva singolarmente ogni adempimento e monitora lo stato.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVerificaEInviaNotificheOra}
            disabled={invioInCorso}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {invioInCorso ? 'Invio...' : 'Controlla & Notifica Ora'}
          </button>
          <button
            type="button"
            onClick={ripristinaScadenzeOdvMancanti}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-colors"
            title="Ripristina eventuali scadenze ODV predefinite mancanti"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Ripristina ODV
          </button>
          <button
            type="button"
            onClick={apriNuovaScadenza}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase transition-colors shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            Nuova Scadenza
          </button>
        </div>
      </div>

      {messaggioFeedback && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {messaggioFeedback}
        </div>
      )}

      {/* KPI + Configurazione Preavviso Notifiche Email & App */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-black text-amber-400 uppercase">Aperte</div>
            <div className="text-2xl font-black text-white mt-0.5">{stats.aperte}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-black text-emerald-400 uppercase">Chiuse</div>
            <div className="text-2xl font-black text-white mt-0.5">{stats.chiuse}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-black text-slate-400 uppercase">Annullate</div>
            <div className="text-2xl font-black text-white mt-0.5">{stats.annullate}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-black text-sky-400 uppercase">Monitorate Attive</div>
            <div className="text-2xl font-black text-white mt-0.5">
              {stats.attive} / {scadenze.length}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-white uppercase">
                Notifiche Automatiche (Email + App)
              </span>
            </div>
            {!puoModificarePreavviso && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400">
                <Lock className="w-3 h-3" /> Modifica giorni riservata a Tesoriere e Admin
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-300 leading-relaxed">
            <span className="font-bold text-amber-300">Destinatari default:</span> Presidente, Tesoriere e Segretario{' '}
            <span className="text-slate-400">
              ({destinatariRisolti.emails.length > 0 ? destinatariRisolti.emails.join(', ') : 'presidenza@croceoro.org'})
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-bold text-slate-300 shrink-0">
              Giorni di preavviso:
            </label>
            <input
              type="text"
              value={giorniInput}
              disabled={!puoModificarePreavviso}
              onChange={(e) => setGiorniInput(e.target.value)}
              placeholder="60, 30, 15"
              className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                puoModificarePreavviso
                  ? 'bg-slate-950 border-slate-700 text-amber-300 focus:outline-none focus:border-amber-500'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            />
            {puoModificarePreavviso && (
              <button
                type="button"
                onClick={handleSalvaGiorniDefault}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase transition-colors shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                Salva Preavvisi
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            Soglie attive di default: <strong className="text-white">{config.giorniPreavvisoDefault.map((g) => `${g} gg`).join(' • ')}</strong> prima della scadenza (separare i valori con virgola).
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca scadenza, RUNTS, 5x1000, normativa..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value as any)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold"
        >
          <option value="Tutte">Stato: Tutti</option>
          <option value="Aperta">Solo Aperte</option>
          <option value="Chiusa">Solo Chiuse</option>
          <option value="Annullata">Solo Annullate</option>
        </select>
        <select
          value={filtroAttiva}
          onChange={(e) => setFiltroAttiva(e.target.value as any)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold"
        >
          <option value="tutte">Attivazione: Tutte</option>
          <option value="attive">Solo Attive</option>
          <option value="disattive">Solo Disattivate</option>
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-bold"
        >
          <option value="Tutte">Categoria: Tutte</option>
          {CATEGORIE_FISCALI.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Elenco Scadenze Fiscali */}
      <div className="space-y-2.5">
        {scadenzeFiltrate.map((s) => {
          const giorni = calcolaGiorniAllaScadenza(s.dataScadenza);
          const soglie =
            s.giorniPreavvisoCustom && s.giorniPreavvisoCustom.length > 0
              ? s.giorniPreavvisoCustom
              : config.giorniPreavvisoDefault;
          const urgente = s.attiva && s.stato === 'Aperta' && giorni <= 15;
          const inArrivo = s.attiva && s.stato === 'Aperta' && giorni > 15 && giorni <= 60;

          return (
            <div
              key={s.id}
              className={`rounded-xl border p-3.5 sm:p-4 transition-all ${
                !s.attiva
                  ? 'bg-slate-950/50 border-slate-800/70 opacity-70'
                  : urgente
                    ? 'bg-rose-950/30 border-rose-500/50'
                    : inArrivo
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderBadgeStato(s.stato)}
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                      {s.categoria}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        s.attiva
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {s.attiva ? 'ATTIVA' : 'DISATTIVATA'}
                    </span>
                    {s.ricorrenzaAnnuale && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold">
                        Annuale
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm sm:text-base font-black text-white leading-snug">
                    {s.titolo}
                  </h4>

                  {s.descrizione && (
                    <p className="text-xs text-slate-300 leading-relaxed">{s.descrizione}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                    <span>
                      <strong className="text-slate-200">Scadenza:</strong>{' '}
                      <span className="font-black text-amber-300">{s.dataScadenza.split('-').reverse().join('/')}</span>
                      {s.stato === 'Aperta' && (
                        <span
                          className={`ml-1.5 font-black ${
                            giorni < 0
                              ? 'text-rose-400'
                              : giorni <= 15
                                ? 'text-rose-300'
                                : giorni <= 60
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                          }`}
                        >
                          ({giorni < 0 ? `Scaduta da ${Math.abs(giorni)} gg` : giorni === 0 ? 'OGGI' : `tra ${giorni} gg`})
                        </span>
                      )}
                    </span>
                    <span>
                      <strong className="text-slate-200">Preavvisi:</strong> {soglie.map((g) => `${g}gg`).join(', ')}
                    </span>
                    {s.riferimentoNormativo && (
                      <span>
                        <strong className="text-slate-200">Norma:</strong> {s.riferimentoNormativo}
                      </span>
                    )}
                  </div>
                  {s.note && (
                    <div className="text-[11px] text-amber-200/80 italic">Nota: {s.note}</div>
                  )}
                </div>

                {/* Controlli riga: Attiva/Disattiva, Stato, Modifica, Elimina */}
                <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleAttiva(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase border transition-colors ${
                      s.attiva
                        ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {s.attiva ? 'Attiva' : 'Disattivata'}
                  </button>

                  <select
                    value={s.stato}
                    onChange={(e) => cambiaStato(s, e.target.value as StatoScadenzaFiscale)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-[11px] font-black text-white focus:outline-none focus:border-amber-500"
                    title="Cambia stato scadenza"
                  >
                    {STATI_SCADENZA.map((st) => (
                      <option key={st} value={st}>
                        Stato: {st}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => apriModificaScadenza(s)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                      title="Modifica scadenza"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => eliminaScadenza(s)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                        title="Elimina scadenza"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {scadenzeFiltrate.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            Nessuna scadenza fiscale trovata con i filtri selezionati.
          </div>
        )}
      </div>

      {/* Modale Crea / Modifica Scadenza Fiscale */}
      {modalAperta && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSalvaScadenza}
            className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm sm:text-base font-black text-white uppercase">
                {editingId ? 'Modifica Scadenza Fiscale ODV' : 'Nuova Scadenza Fiscale ODV'}
              </h4>
              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                Chiudi
              </button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                  Titolo Adempimento *
                </label>
                <input
                  type="text"
                  required
                  value={formTitolo}
                  onChange={(e) => setFormTitolo(e.target.value)}
                  placeholder="Es. Deposito Bilancio RUNTS"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Data Scadenza *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDataScadenza}
                    onChange={(e) => setFormDataScadenza(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as CategoriaScadenzaFiscaleODV)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {CATEGORIE_FISCALI.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Stato Scadenza
                  </label>
                  <select
                    value={formStato}
                    onChange={(e) => setFormStato(e.target.value as StatoScadenzaFiscale)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {STATI_SCADENZA.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAttiva}
                      onChange={(e) => setFormAttiva(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    Scadenza Attiva (invia notifiche)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRicorrenza}
                      onChange={(e) => setFormRicorrenza(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    Ricorrenza Annuale
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                  Descrizione Adempimento
                </label>
                <textarea
                  rows={3}
                  value={formDescrizione}
                  onChange={(e) => setFormDescrizione(e.target.value)}
                  placeholder="Dettaglio adempimenti, modulistica o portale telematico..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                  Riferimento Normativo
                </label>
                <input
                  type="text"
                  value={formNormativa}
                  onChange={(e) => setFormNormativa(e.target.value)}
                  placeholder="Es. D.Lgs. 117/2017 Art. 48"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {puoModificarePreavviso && (
                <div>
                  <label className="block text-[11px] font-black text-amber-300 uppercase mb-1">
                    Giorni di Preavviso Personalizzati (opzionale — solo Tesoriere / Admin)
                  </label>
                  <input
                    type="text"
                    value={formGiorniCustom}
                    onChange={(e) => setFormGiorniCustom(e.target.value)}
                    placeholder={`Lascia vuoto per usare i default (${config.giorniPreavvisoDefault.join(', ')})`}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-amber-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                  Note Interne
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Eventuali annotazioni operative..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase"
              >
                {editingId ? 'Salva Modifiche' : 'Inserisci Scadenza'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
