import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Clock,
  Send,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  Ambulance,
  RefreshCw,
  Printer,
  Calendar,
  User,
  Shield,
  FileText,
  BadgeAlert,
  ArrowRight,
  Sparkles,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import { VoceGiornaleBordo, CategoriaGiornaleBordo, MezzoFlotta } from '../../types/adminTypes';
import { CroceOroLogo } from '../CroceOroLogo';
import { getItalianDateParts } from '../../utils/italianTime';

interface GiornaleBordoCentraleProps {
  voci: VoceGiornaleBordo[];
  onAggiungiVoce: (voce: Omit<VoceGiornaleBordo, 'id' | 'data' | 'ora' | 'timestamp'>) => void;
  onFirmaPresaVisione: (voceId: string, operatoreNome: string) => void;
  operatoreCorrente: string;
  isCentraleAdmin?: boolean;
  mezziFlotta?: MezzoFlotta[];
  onTornaAllaCentrale?: () => void;
}

export const GiornaleBordoCentrale: React.FC<GiornaleBordoCentraleProps> = ({
  voci = [],
  onAggiungiVoce,
  onFirmaPresaVisione,
  operatoreCorrente = 'Operatore Centrale',
  isCentraleAdmin = false,
  mezziFlotta = [],
  onTornaAllaCentrale
}) => {
  // Orologio digitale ufficiale italiano (Europe/Rome) con aggiornamento automatico Ora Legale / Ora Solare
  const [italiaNow, setItaliaNow] = useState(() => getItalianDateParts(new Date()));
  const orologio = italiaNow.timeIt;

  useEffect(() => {
    const interval = setInterval(() => {
      setItaliaNow(getItalianDateParts(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Form stato nuova annotazione
  const [testo, setTesto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGiornaleBordo>('ordinaria');
  const [consegnaTurno, setConsegnaTurno] = useState(false);
  const [mezzoCoinvolto, setMezzoCoinvolto] = useState('');
  const [operatoreSelezionato, setOperatoreSelezionato] = useState(operatoreCorrente);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaSuccesso, setConfermaSuccesso] = useState<string | null>(null);

  useEffect(() => {
    if (operatoreCorrente) {
      setOperatoreSelezionato(operatoreCorrente);
    }
  }, [operatoreCorrente]);

  // Filtri e Ricerca
  const [ricerca, setRicerca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutte');
  const [filtroData, setFiltroData] = useState<'oggi' | 'ieri' | 'settimana' | 'tutte'>('oggi');
  const [soloConsegneAperte, setSoloConsegneAperte] = useState(false);

  // Categorie con configurazione visiva
  const categorieConfig: Record<CategoriaGiornaleBordo, { label: string; icon: any; color: string; bg: string; border: string }> = {
    ordinaria: {
      label: 'Ordinaria / Varie',
      icon: FileText,
      color: 'text-slate-200',
      bg: 'bg-slate-800/80',
      border: 'border-slate-700'
    },
    comunicazione_118: {
      label: 'Comunicazione 118 / Emergenza',
      icon: PhoneCall,
      color: 'text-cyan-300',
      bg: 'bg-cyan-950/60',
      border: 'border-cyan-500/50'
    },
    guasto_mezzo: {
      label: 'Mezzi & Attrezzature',
      icon: Ambulance,
      color: 'text-amber-300',
      bg: 'bg-amber-950/60',
      border: 'border-amber-500/50'
    },
    passaggio_consegne: {
      label: 'Passaggio Consegne Turno',
      icon: RefreshCw,
      color: 'text-emerald-300',
      bg: 'bg-emerald-950/60',
      border: 'border-emerald-500/50'
    },
    chiamata_servizio: {
      label: 'Chiamata Utente / Servizio',
      icon: User,
      color: 'text-purple-300',
      bg: 'bg-purple-950/60',
      border: 'border-purple-500/50'
    },
    disposizione: {
      label: 'Ordine / Disposizione Interna',
      icon: Shield,
      color: 'text-blue-300',
      bg: 'bg-blue-950/60',
      border: 'border-blue-500/50'
    },
    urgente: {
      label: 'Urgente / Prioritaria',
      icon: AlertTriangle,
      color: 'text-red-300',
      bg: 'bg-red-950/60',
      border: 'border-red-500/60'
    }
  };

  const dataOggiStr = italiaNow.dateIt;
  const dataIeriStr = useMemo(() => {
    const [y, m, d] = italiaNow.yesterdayIsoDate.split('-');
    return `${d}/${m}/${y}`;
  }, [italiaNow.yesterdayIsoDate]);

  // Invio nuova annotazione
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testo.trim()) {
      setErrore('Inserisci il testo dell\'annotazione da registrare nel giornale di bordo.');
      return;
    }

    setErrore(null);
    onAggiungiVoce({
      operatoreNome: operatoreSelezionato || 'Operatore Centrale',
      testo: testo.trim(),
      categoria,
      consegnaTurno: consegnaTurno || categoria === 'passaggio_consegne',
      mezzoCoinvolto: mezzoCoinvolto || undefined
    });

    setTesto('');
    setMezzoCoinvolto('');
    setConsegnaTurno(false);
    setConfermaSuccesso(`Annotazione registrata con successo alle ore ${orologio}!`);
    setTimeout(() => setConfermaSuccesso(null), 4000);
  };

  // Filtro voci
  const vociFiltrate = useMemo(() => {
    const q = ricerca.toLowerCase().trim();

    return voci.filter(v => {
      // Filtro testo
      if (q) {
        const matchTesto = v.testo.toLowerCase().includes(q);
        const matchOp = v.operatoreNome.toLowerCase().includes(q);
        const matchMezzo = v.mezzoCoinvolto?.toLowerCase().includes(q);
        if (!matchTesto && !matchOp && !matchMezzo) return false;
      }

      // Filtro Categoria
      if (filtroCategoria !== 'tutte' && v.categoria !== filtroCategoria) {
        return false;
      }

      // Filtro Consegne aperte
      if (soloConsegneAperte) {
        if (!v.consegnaTurno) return false;
        const giaFirmataDaMe = v.presaVisioneDa?.some(p => p.operatoreNome === operatoreCorrente);
        if (giaFirmataDaMe) return false;
      }

      // Filtro Data
      if (filtroData === 'oggi' && v.data !== dataOggiStr) return false;
      if (filtroData === 'ieri' && v.data !== dataIeriStr) return false;
      if (filtroData === 'settimana') {
        const setteGiorniFa = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (v.timestamp < setteGiorniFa) return false;
      }

      return true;
    });
  }, [voci, ricerca, filtroCategoria, soloConsegneAperte, filtroData, dataOggiStr, dataIeriStr, operatoreCorrente]);

  // Raggruppamento per data
  const vociRaggruppate = useMemo(() => {
    const groups: Record<string, VoceGiornaleBordo[]> = {};
    vociFiltrate.forEach(v => {
      const dataLabel = v.data === dataOggiStr ? `Oggi • ${v.data}` : v.data === dataIeriStr ? `Ieri • ${v.data}` : v.data;
      if (!groups[dataLabel]) groups[dataLabel] = [];
      groups[dataLabel].push(v);
    });
    return groups;
  }, [vociFiltrate, dataOggiStr, dataIeriStr]);

  // Statistiche rapide di turno
  const stats = useMemo(() => {
    const oggi = voci.filter(v => v.data === dataOggiStr);
    const consegneDaFirmare = voci.filter(v => v.consegnaTurno && !v.presaVisioneDa?.some(p => p.operatoreNome === operatoreCorrente));
    const segnalazioniMezzi = oggi.filter(v => v.categoria === 'guasto_mezzo');
    const comunicazioni118 = oggi.filter(v => v.categoria === 'comunicazione_118');

    return {
      totaleOggi: oggi.length,
      consegneDaFirmare: consegneDaFirmare.length,
      segnalazioniMezzi: segnalazioniMezzi.length,
      comunicazioni118: comunicazioni118.length
    };
  }, [voci, dataOggiStr, operatoreCorrente]);

  // Stampa / Esportazione registro
  const handleStampa = () => {
    window.print();
  };

  return (
    <div className="w-full flex flex-col gap-4 text-slate-100">
      {/* ----------------------------------------------------------------- */}
      {/* HEADER PROFESSIONALE GIORNALE DI BORDO CON OROLOGIO CENTRALE */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1d1a60] to-slate-900 border-2 border-amber-500/50 p-4 sm:p-5 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                  CENTRALE OPERATIVA • REGISTRO UFFICIALE
                </span>
                <span className="text-xs text-amber-300 font-mono font-bold">
                  {dataOggiStr}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase mt-0.5">
                GIORNALE DI BORDO & BROGLIACCIO EVENTI
              </h1>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-0.5">
                Registrazione cronologica e certificata di tutte le comunicazioni, disposizioni 118, guasti mezzi e passaggi di consegne durante il turno di servizio.
              </p>
            </div>
          </div>

          {/* Orologio Ufficiale di Centrale & Azioni */}
          <div className="flex items-center gap-3 self-start lg:self-center">
            <div className="bg-slate-950/90 border-2 border-emerald-500/60 rounded-2xl px-4 py-2 text-center shadow-inner">
              <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>ORA UFFICIALE CENTRALE</span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-300 tracking-wider">
                {orologio}
              </div>
              <div className="text-[9px] font-bold text-emerald-300/80 uppercase tracking-wide">
                🇮🇹 {italiaNow.fasciaOraShort}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStampa}
              className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase flex items-center gap-2 border border-slate-700 shadow-md active:scale-95 transition-all cursor-pointer"
              title="Stampa brogliaccio per archivio cartaceo"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Stampa / Esporta</span>
            </button>
          </div>
        </div>

        {/* STATISTICHE RAPIDE IN TEMPO REALE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Annotazioni Oggi</span>
            <span className="text-lg font-black text-white font-mono">{stats.totaleOggi}</span>
          </div>

          <div className={`p-2.5 rounded-2xl border ${stats.consegneDaFirmare > 0 ? 'bg-amber-950/60 border-amber-500 text-amber-200 animate-pulse' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}>
            <span className="text-[10px] font-bold uppercase block">Consegne Da Firmare</span>
            <span className="text-lg font-black font-mono">{stats.consegneDaFirmare}</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Segnalazioni Mezzi</span>
            <span className="text-lg font-black text-amber-400 font-mono">{stats.segnalazioniMezzi}</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Comunicazioni 118</span>
            <span className="text-lg font-black text-cyan-400 font-mono">{stats.comunicazioni118}</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* BOX FORM NUOVA ANNOTAZIONE NEL GIORNALE DI BORDO */}
      {/* ----------------------------------------------------------------- */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">✍️</span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                Nuova Annotazione nel Giornale di Bordo
              </h2>
              <span className="text-[11px] text-slate-400 block">
                L'orario esatto (<strong className="text-emerald-400 font-mono">{orologio}</strong>) e la data saranno registrati in automatico dal sistema.
              </span>
            </div>
          </div>

          {/* Operatore Centrale firmatario */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-slate-400 uppercase font-bold">Operatore:</span>
            <strong className="text-xs text-white font-mono">{operatoreSelezionato || 'Operatore Centrale'}</strong>
          </div>
        </div>

        {/* Selezione Rapida Categoria */}
        <div>
          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
            1. Categoria dell'Evento / Comunicazione:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(Object.keys(categorieConfig) as CategoriaGiornaleBordo[]).map(catKey => {
              const cfg = categorieConfig[catKey];
              const IconComp = cfg.icon;
              const isSelected = categoria === catKey;
              return (
                <button
                  type="button"
                  key={catKey}
                  onClick={() => {
                    setCategoria(catKey);
                    if (catKey === 'passaggio_consegne') {
                      setConsegnaTurno(true);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? `${cfg.bg} ${cfg.border} ring-2 ring-amber-400 shadow-md scale-[1.02]`
                      : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <IconComp className={`w-4 h-4 ${isSelected ? cfg.color : 'text-slate-400'}`} />
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <span className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selezione Opzionale Mezzo Coinvolto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
              🚑 Mezzo Coinvolto (Opzionale):
            </label>
            <select
              value={mezzoCoinvolto}
              onChange={(e) => setMezzoCoinvolto(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
            >
              <option value="">-- Nessun mezzo associato --</option>
              {mezziFlotta.map(m => (
                <option key={m.id} value={`${m.sigla} (${m.targa})`}>
                  {m.sigla} - {m.modello} ({m.targa}) [{m.stato}]
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <label className="w-full flex items-center gap-2.5 bg-slate-950/80 hover:bg-slate-950 p-2.5 rounded-xl border border-amber-500/40 cursor-pointer select-none transition-all">
              <input
                type="checkbox"
                checked={consegnaTurno}
                onChange={(e) => setConsegnaTurno(e.target.checked)}
                className="w-4 h-4 rounded border-amber-400 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500 shrink-0"
              />
              <div>
                <span className="font-black text-amber-300 text-xs block">
                  📌 Contrassegna come "Passaggio di Consegne per il Turno Successivo"
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Rimarrà evidenziata finché l'operatore del turno successivo non appone la firma di presa visione.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Testo dell'annotazione */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase">
              2. Testo dell'Annotazione / Evento di Turno *:
            </label>
            {/* Scorciatoie rapide */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9.5px] text-slate-400 uppercase font-bold">Inserisci rapido:</span>
              <button
                type="button"
                onClick={() => setTesto(prev => prev ? `${prev}\n📞 Chiamata 118: ` : '📞 Chiamata 118: ')}
                className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
              >
                118
              </button>
              <button
                type="button"
                onClick={() => setTesto(prev => prev ? `${prev}\n🚑 Segnalazione Mezzo: ` : '🚑 Segnalazione Mezzo: ')}
                className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
              >
                Guasto
              </button>
              <button
                type="button"
                onClick={() => setTesto(prev => prev ? `${prev}\n🔄 Consegna turno successivo: ` : '🔄 Consegna turno successivo: ')}
                className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700"
              >
                Consegna
              </button>
              <button
                type="button"
                onClick={() => setTesto(prev => prev ? `${prev}\n👤 Chiamata utente: ` : '👤 Chiamata utente: ')}
                className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700"
              >
                Utente
              </button>
            </div>
          </div>

          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={3}
            placeholder="Scrivi qui qualsiasi evento accaduto in centrale: chiamate del 118, guasti o spie accese sui mezzi, disposizioni del consiglio, imprevisti stradali o comunicazioni da lasciare a chi subentra..."
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-sans leading-relaxed resize-y"
          />
        </div>

        {errore && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-xs text-red-200 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errore}</span>
          </div>
        )}

        {confermaSuccesso && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-200 font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{confermaSuccesso}</span>
          </div>
        )}

        {/* Pulsante di Invio */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-slate-400 font-mono">
            ⏱️ Ora server di registrazione: <strong>{orologio}</strong>
          </span>
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-xl shadow-amber-600/30 active:scale-95 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>REGISTRA NEL GIORNALE DI BORDO</span>
          </button>
        </div>
      </form>

      {/* ----------------------------------------------------------------- */}
      {/* BARRA FILTRI E RICERCA REGISTRO */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per testo, operatore, mezzo o parola chiave..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {ricerca && (
            <button
              onClick={() => setRicerca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Data */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFiltroData('oggi')}
              className={`px-2.5 py-1 rounded-lg transition-all ${filtroData === 'oggi' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Oggi
            </button>
            <button
              type="button"
              onClick={() => setFiltroData('ieri')}
              className={`px-2.5 py-1 rounded-lg transition-all ${filtroData === 'ieri' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Ieri
            </button>
            <button
              type="button"
              onClick={() => setFiltroData('settimana')}
              className={`px-2.5 py-1 rounded-lg transition-all ${filtroData === 'settimana' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              7 Giorni
            </button>
            <button
              type="button"
              onClick={() => setFiltroData('tutte')}
              className={`px-2.5 py-1 rounded-lg transition-all ${filtroData === 'tutte' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Tutte
            </button>
          </div>

          {/* Filtro Categoria */}
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
          >
            <option value="tutte">Tutte le Categorie</option>
            {(Object.keys(categorieConfig) as CategoriaGiornaleBordo[]).map(catKey => (
              <option key={catKey} value={catKey}>
                {categorieConfig[catKey].label}
              </option>
            ))}
          </select>

          {/* Filtro Consegne Aperte */}
          <button
            type="button"
            onClick={() => setSoloConsegneAperte(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              soloConsegneAperte
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span>📌</span>
            <span>Solo Consegne Aperte</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* ELENCO ANNOTAZIONI CRONOLOGICO */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        {Object.keys(vociRaggruppate).length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <h3 className="text-base font-bold text-slate-200 uppercase">Nessuna annotazione registrata</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {ricerca || filtroCategoria !== 'tutte' || soloConsegneAperte
                ? 'Nessun evento corrisponde ai filtri impostati. Prova a reimpostare i criteri di ricerca.'
                : 'Il giornale di bordo per questa data è vuoto. Utilizza il modulo in alto per annotare qualsiasi evento del tuo turno.'}
            </p>
          </div>
        ) : (
          Object.keys(vociRaggruppate).map(dataLabel => {
            const list = vociRaggruppate[dataLabel];
            return (
              <div key={dataLabel} className="space-y-2.5">
                {/* Intestazione data gruppo */}
                <div className="flex items-center gap-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-black uppercase text-amber-300 tracking-wider">
                    {dataLabel}
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    {list.length} {list.length === 1 ? 'evento' : 'eventi'}
                  </span>
                </div>

                {/* Lista eventi di quella data */}
                <div className="space-y-2.5">
                  {list.map(v => {
                    const cfg = categorieConfig[v.categoria] || categorieConfig.ordinaria;
                    const IconComp = cfg.icon;
                    const presaDaMe = v.presaVisioneDa?.some(p => p.operatoreNome === operatoreCorrente);

                    return (
                      <div
                        key={v.id}
                        className={`bg-slate-900 border rounded-2xl p-4 transition-all shadow-md ${
                          v.consegnaTurno
                            ? 'border-amber-500/80 bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Badge Orario Automatico Certificato */}
                            <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-center shrink-0">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">ORA</span>
                              <span className="text-sm font-black font-mono text-emerald-300 block">
                                {v.ora}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Categoria & Operatore */}
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                  <IconComp className="w-3 h-3" />
                                  <span>{cfg.label}</span>
                                </span>

                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                  <User className="w-3 h-3 text-amber-400" />
                                  <span>{v.operatoreNome}</span>
                                </span>

                                {v.mezzoCoinvolto && (
                                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Ambulance className="w-3 h-3" />
                                    <span>{v.mezzoCoinvolto}</span>
                                  </span>
                                )}

                                {v.consegnaTurno && (
                                  <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono">
                                    📌 CONSEGNA TURNO
                                  </span>
                                )}
                              </div>

                              {/* Testo dell'evento */}
                              <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed font-sans">
                                {v.testo}
                              </p>
                            </div>
                          </div>

                          {/* Sezione Presa Visione per Consegne di Turno */}
                          {v.consegnaTurno && (
                            <div className="sm:self-center shrink-0 flex flex-col gap-1.5 items-end">
                              {!presaDaMe ? (
                                <button
                                  type="button"
                                  onClick={() => onFirmaPresaVisione(v.id, operatoreCorrente)}
                                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-emerald-400"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Firma Presa Visione</span>
                                </button>
                              ) : (
                                <span className="text-[10.5px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Hai preso visione</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Firme di Presa Visione Registrate */}
                        {v.presaVisioneDa && v.presaVisioneDa.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-[10.5px]">
                            <span className="text-slate-400 font-bold uppercase">Visto da:</span>
                            {v.presaVisioneDa.map((p, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300 font-mono"
                              >
                                ✓ {p.operatoreNome} ({p.ora})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
