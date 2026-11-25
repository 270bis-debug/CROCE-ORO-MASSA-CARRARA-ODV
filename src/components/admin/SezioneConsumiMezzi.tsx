import React, { useState, useMemo } from 'react';
import {
  Fuel,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Gauge,
  PlusCircle,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Sparkles,
  Car,
  Ambulance,
  Building2,
  X,
  CreditCard,
  Droplet,
  Camera
} from 'lucide-react';
import { MezzoFlotta, InterventoManutenzione } from '../../types/adminTypes';
import { RifornimentoCarburante, StatisticheConsumoMezzo } from '../../types/consumiTypes';
import { calcolaStatisticheFlottaGlobale } from '../../utils/calcoloConsumiFlotta';
import { formatISODateItaly, formatTimeItaly } from '../../utils/italianTime';
import {
  useMetodiPagamentoCarburante,
  getMetodiPagamentoCarburanteAttivi,
  getMetodoPagamentoCarburantePerMezzo,
  getMetodoOggettoPerMezzo,
} from '../../utils/metodiPagamentoCarburanteStore';

interface SezioneConsumiMezziProps {
  mezzi: MezzoFlotta[];
  manutenzioni?: InterventoManutenzione[];
  serviziArchivio?: any[];
  rifornimenti: RifornimentoCarburante[];
  onAggiungiRifornimento: (nuovo: RifornimentoCarburante) => void;
  onEliminaRifornimento?: (id: string) => void;
  operatoreCorrente?: string;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onApriGestionePagamentiCarburante?: () => void;
}

export const SezioneConsumiMezzi: React.FC<SezioneConsumiMezziProps> = ({
  mezzi,
  manutenzioni = [],
  serviziArchivio = [],
  rifornimenti,
  onAggiungiRifornimento,
  onEliminaRifornimento,
  operatoreCorrente = 'Amministratore',
  onNotificaRadio,
  onApriGestionePagamentiCarburante,
}) => {
  const tuttiMetodiPagamento = useMetodiPagamentoCarburante();
  const metodiPagamentoAttivi = useMemo(
    () => getMetodiPagamentoCarburanteAttivi(tuttiMetodiPagamento),
    [tuttiMetodiPagamento]
  );

  const [ricerca, setRicerca] = useState('');
  const [filtroFlotta, setFiltroFlotta] = useState<'tutte' | 'vet' | 'pc'>('tutte');
  const [ordinamento, setOrdinamento] = useState<'consumo' | 'costoKm' | 'spesa' | 'km'>('consumo');

  // Modale Nuovo Rifornimento
  const [modaleRifornimentoAperta, setModaleRifornimentoAperta] = useState(false);
  const [formMezzoSigla, setFormMezzoSigla] = useState(mezzi[0]?.sigla || 'T4606');
  const [formData, setFormData] = useState(() => formatISODateItaly());
  const [formOrario, setFormOrario] = useState(() => formatTimeItaly(undefined, false));
  const [formLitri, setFormLitri] = useState<number | string>(65);
  const [formCostoTotale, setFormCostoTotale] = useState<number | string>(116.35);
  const [formKm, setFormKm] = useState<number | string>(mezzi[0]?.chilometraggioAttuale || 114500);
  const [formDistributore, setFormDistributore] = useState('Eni Station Massa Aurelia');
  const [formMetodo, setFormMetodo] = useState<string>(() =>
    getMetodoPagamentoCarburantePerMezzo(mezzi[0]?.sigla || 'T4606')
  );
  const [formTipoCarburante, setFormTipoCarburante] = useState<RifornimentoCarburante['tipoCarburante']>('Gasolio / Diesel');
  const [formNote, setFormNote] = useState('');
  const [erroreForm, setErroreForm] = useState<string | null>(null);
  const [fotoScontrinoAperta, setFotoScontrinoAperta] = useState<{ src: string; titolo: string } | null>(null);

  const metodoAssegnatoAlMezzoCorrente = useMemo(
    () => getMetodoOggettoPerMezzo(formMezzoSigla, tuttiMetodiPagamento),
    [formMezzoSigla, tuttiMetodiPagamento]
  );

  React.useEffect(() => {
    if (!modaleRifornimentoAperta) return;
    setFormMetodo(getMetodoPagamentoCarburantePerMezzo(formMezzoSigla, tuttiMetodiPagamento));
  }, [modaleRifornimentoAperta, formMezzoSigla, tuttiMetodiPagamento]);

  // Calcola statistiche flotta e per singolo mezzo
  const { statisticheMezzi, globale } = useMemo(() => {
    return calcolaStatisticheFlottaGlobale(mezzi, rifornimenti, serviziArchivio, manutenzioni);
  }, [mezzi, rifornimenti, serviziArchivio, manutenzioni]);

  // Filtra e ordina i dati della tabella
  const mezziFiltrati = useMemo(() => {
    return statisticheMezzi.filter(m => {
      const matchTesto = !ricerca.trim() ||
        m.mezzoSigla.toLowerCase().includes(ricerca.toLowerCase()) ||
        (m.targa && m.targa.toLowerCase().includes(ricerca.toLowerCase())) ||
        (m.modello && m.modello.toLowerCase().includes(ricerca.toLowerCase()));
      const matchFlotta = filtroFlotta === 'tutte' || m.flotta === filtroFlotta;
      return matchTesto && matchFlotta;
    }).sort((a, b) => {
      if (ordinamento === 'consumo') return b.consumoMedioKmL - a.consumoMedioKmL;
      if (ordinamento === 'costoKm') return a.costoCarburanteAlKm - b.costoCarburanteAlKm;
      if (ordinamento === 'spesa') return b.spesaCarburanteTotale - a.spesaCarburanteTotale;
      return b.kmServiziPercorsi - a.kmServiziPercorsi;
    });
  }, [statisticheMezzi, ricerca, filtroFlotta, ordinamento]);

  // Prezzo calcolato al litro nel form
  const prezzoAlLitroCalcolato = useMemo(() => {
    const l = parseFloat(String(formLitri));
    const c = parseFloat(String(formCostoTotale));
    if (l > 0 && c > 0) {
      return (c / l).toFixed(3);
    }
    return '1.790';
  }, [formLitri, formCostoTotale]);

  // Invio Form Nuovo Rifornimento
  const handleSalvaRifornimento = (e: React.FormEvent) => {
    e.preventDefault();
    setErroreForm(null);

    const litriNum = parseFloat(String(formLitri));
    const costoNum = parseFloat(String(formCostoTotale));
    const kmNum = parseInt(String(formKm), 10);

    if (isNaN(litriNum) || litriNum <= 0) {
      setErroreForm('Inserire un quantitativo di litri valido maggiore di zero.');
      return;
    }
    if (isNaN(costoNum) || costoNum <= 0) {
      setErroreForm('Inserire un importo totale speso valido.');
      return;
    }
    if (isNaN(kmNum) || kmNum <= 0) {
      setErroreForm('Inserire il chilometraggio del veicolo al momento del rifornimento.');
      return;
    }

    const nuovo: RifornimentoCarburante = {
      id: `rif-${Date.now()}`,
      mezzoSigla: formMezzoSigla,
      data: formData,
      orario: formOrario,
      litri: Math.round(litriNum * 10) / 10,
      costoTotale: Math.round(costoNum * 100) / 100,
      prezzoAlLitro: parseFloat((costoNum / litriNum).toFixed(3)),
      chilometraggio: kmNum,
      distributore: formDistributore.trim(),
      volontarioNome: operatoreCorrente,
      metodoPagamento: formMetodo,
      tipoCarburante: formTipoCarburante,
      note: formNote.trim() || undefined
    };

    onAggiungiRifornimento(nuovo);
    onNotificaRadio?.(
      `⛽ RIFORNIMENTO REGISTRATO: Mezzo ${nuovo.mezzoSigla} • ${nuovo.litri} L (${nuovo.tipoCarburante}) • Spesa: € ${nuovo.costoTotale.toFixed(2)}`,
      'sistema'
    );
    setModaleRifornimentoAperta(false);
    setFormNote('');
  };

  // Esporta CSV Rifornimenti
  const handleEsportaCSVRifornimenti = () => {
    if (rifornimenti.length === 0) return;

    const headers = ['Data', 'Ora', 'Mezzo Sigla', 'Chilometraggio', 'Litri', 'Prezzo/Litro (€)', 'Costo Totale (€)', 'Distributore', 'Metodo Pagamento', 'Operatore', 'Note'];
    const rows = rifornimenti.map(r => [
      `"${r.data}"`,
      `"${r.orario || ''}"`,
      `"${r.mezzoSigla}"`,
      r.chilometraggio,
      r.litri.toFixed(1).replace('.', ','),
      (r.prezzoAlLitro || 0).toFixed(3).replace('.', ','),
      r.costoTotale.toFixed(2).replace('.', ','),
      `"${r.distributore || ''}"`,
      `"${r.metodoPagamento || ''}"`,
      `"${r.volontarioNome || ''}"`,
      `"${(r.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rifornimenti_carburante_croceoro_${formatISODateItaly()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* HEADER DELLA SEZIONE CONSUMI & COSTO KM */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
              Analisi Efficienza & Esercizio Flotta
            </span>
            <span className="text-xs font-mono font-bold text-amber-300">
              Croce Oro Massa Carrara
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mt-1 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-amber-400" />
            <span>Calcolo Consumi Medi (km/l) & Costo al Chilometro (€/km)</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5 max-w-3xl">
            Monitoraggio incrociato tra i chilometri percorsi registrati dai volontari e i litri di carburante erogati per ciascuna ambulanza e automezzo associativo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleEsportaCSVRifornimenti}
            disabled={rifornimenti.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Esporta il registro di tutti i rifornimenti carburante in formato CSV / Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Esporta CSV Rifornimenti</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormMezzoSigla(mezzi[0]?.sigla || 'T4606');
              setFormData(formatISODateItaly());
              setFormOrario(formatTimeItaly(undefined, false));
              setFormLitri(65);
              setFormCostoTotale(116.35);
              const mMatch = mezzi.find(m => m.sigla === (mezzi[0]?.sigla || 'T4606'));
              setFormKm(mMatch?.chilometraggioAttuale || 114500);
              setErroreForm(null);
              setModaleRifornimentoAperta(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registra Rifornimento Carburante</span>
          </button>
        </div>
      </div>

      {/* 4 CARDS KPI GLOBALI FLOTTA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Consumo Medio Flotta */}
        <div className="bg-slate-950 p-4 rounded-2xl border-2 border-emerald-500/40 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Consumo Medio Flotta</span>
            <Fuel className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {globale.consumoMedioFlottaKmL} <span className="text-xs font-sans text-slate-300">km / L</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>{globale.consumoMedioFlottaL100Km} L / 100 km</span>
            <span className="text-emerald-400 font-bold">Standard Soccorso</span>
          </div>
        </div>

        {/* Costo Carburante al KM */}
        <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Costo Carburante / KM</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            € {globale.costoMedioCarburanteAlKm.toFixed(2)} <span className="text-xs font-sans text-slate-300">/ km</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>Spesa Tot: € {globale.spesaCarburanteTotaleFlotta.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Costo Totale Esercizio al KM (Carburante + Manutenzioni) */}
        <div className="bg-slate-950 p-4 rounded-2xl border-2 border-blue-500/40 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Costo Totale Esercizio / KM</span>
            <Gauge className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono">
            € {globale.costoMedioTotaleAlKm.toFixed(2)} <span className="text-xs font-sans text-slate-300">/ km</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>Carburante + Manutenzioni</span>
          </div>
        </div>

        {/* Litri Totali Erogati */}
        <div className="bg-slate-950 p-4 rounded-2xl border-2 border-purple-500/40 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Litri Totali Erogati</span>
            <Droplet className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">
            {globale.litriTotaliFlotta.toLocaleString('it-IT', { minimumFractionDigits: 1 })} <span className="text-xs font-sans text-slate-300">L</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>{globale.numeroTotaleRifornimenti} rifornimenti registrati</span>
          </div>
        </div>
      </div>

      {/* BARRA RICERCA E FILTRI */}
      <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca mezzo per sigla, targa, modello..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {/* Filtro Flotta */}
          <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setFiltroFlotta('tutte')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filtroFlotta === 'tutte' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Tutti i Mezzi
            </button>
            <button
              type="button"
              onClick={() => setFiltroFlotta('vet')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filtroFlotta === 'vet' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              🚑 Emergenza
            </button>
            <button
              type="button"
              onClick={() => setFiltroFlotta('pc')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filtroFlotta === 'pc' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              🌲 Protezione Civile
            </button>
          </div>

          {/* Ordinamento */}
          <select
            value={ordinamento}
            onChange={(e) => setOrdinamento(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-400"
          >
            <option value="consumo">Ordina per Consumo (km/l)</option>
            <option value="costoKm">Ordina per Costo / km</option>
            <option value="spesa">Ordina per Spesa Totale</option>
            <option value="km">Ordina per Km Percorsi</option>
          </select>
        </div>
      </div>

      {/* TABELLA COMPARATIVA CONSUMI & COSTI PER MEZZO */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                <th className="py-3 px-4">Mezzo</th>
                <th className="py-3 px-4">Km Percorsi</th>
                <th className="py-3 px-4 font-mono">Litri Totali</th>
                <th className="py-3 px-4 font-mono">Spesa Carburante</th>
                <th className="py-3 px-4 font-mono">Spesa Manutenzione</th>
                <th className="py-3 px-4 font-mono text-center">Consumo Medio</th>
                <th className="py-3 px-4 font-mono text-center">Costo Carburante / km</th>
                <th className="py-3 px-4 font-mono text-center">Costo Totale / km</th>
                <th className="py-3 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mezziFiltrati.map((m) => {
                const isOttima = m.efficienza === 'ottima';
                const isBassa = m.efficienza === 'bassa';
                return (
                  <tr key={m.mezzoSigla} className="hover:bg-slate-900/50 transition-colors">
                    {/* Mezzo */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-amber-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-700">
                          {m.mezzoSigla}
                        </span>
                        <div>
                          <div className="font-black text-white">{m.targa || 'N.D.'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{m.modello}</div>
                        </div>
                      </div>
                    </td>

                    {/* Km Registrati */}
                    <td className="py-3 px-4 font-mono">
                      <div className="font-black text-white">{m.kmServiziPercorsi.toLocaleString('it-IT')} km</div>
                      <div className="text-[10px] text-slate-500">Odo: {m.kmTotaliRegistrati.toLocaleString('it-IT')} km</div>
                    </td>

                    {/* Litri Totali */}
                    <td className="py-3 px-4 font-mono text-slate-200">
                      <div className="font-bold">{m.litriTotaliRiforniti} L</div>
                      <div className="text-[10px] text-slate-500">{m.numeroRifornimenti} rifornimenti</div>
                    </td>

                    {/* Spesa Carburante */}
                    <td className="py-3 px-4 font-mono font-black text-amber-400">
                      € {m.spesaCarburanteTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Spesa Manutenzione */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      € {m.spesaManutenzioniTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Consumo Medio (km/l) */}
                    <td className="py-3 px-4 font-mono text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black ${
                        isOttima
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : isBassa
                          ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                      }`}>
                        {isOttima ? <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingUp className="w-3.5 h-3.5 text-current" />}
                        <span>{m.consumoMedioKmL} km/L</span>
                      </span>
                      <div className="text-[9px] text-slate-500 mt-0.5">{m.consumoMedioL100Km} L/100km</div>
                    </td>

                    {/* Costo Carburante al KM */}
                    <td className="py-3 px-4 font-mono text-center">
                      <span className="font-black text-white text-xs">
                        € {m.costoCarburanteAlKm.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/ km</span>
                    </td>

                    {/* Costo Totale al KM */}
                    <td className="py-3 px-4 font-mono text-center">
                      <span className="font-black text-blue-400 text-xs">
                        € {m.costoTotaleAlKm.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">/ km (tot.)</span>
                    </td>

                    {/* Azioni */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setFormMezzoSigla(m.mezzoSigla);
                          setFormData(formatISODateItaly());
                          setFormKm(m.kmTotaliRegistrati || 114500);
                          setErroreForm(null);
                          setModaleRifornimentoAperta(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-black transition-colors cursor-pointer"
                        title="Registra un rifornimento di carburante per questo mezzo"
                      >
                        + Pieno
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* STORICO RECENTE DEI RIFORNIMENTI */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black uppercase text-white tracking-wide">
              Registro Ultimi Rifornimenti di Carburante
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {rifornimenti.length} registrazioni memorizzate
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {rifornimenti.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                  {r.mezzoSigla}
                </span>
                <div>
                  <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                    <span>{r.litri} L ({r.tipoCarburante || 'Diesel'})</span>
                    <span className="text-slate-400 font-mono">• € {(r.prezzoAlLitro || 0).toFixed(3)}/L</span>
                    {r.creatoDaTurno && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-600/40 text-[9.5px] font-black uppercase">
                        Da Turno
                      </span>
                    )}
                    {r.consumoAnomalo && (
                      <span
                        className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/50 text-[9.5px] font-black uppercase inline-flex items-center gap-1"
                        title={r.consumoAnomaloNota || 'Consumo anomalo rilevato'}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Consumo Anomalo</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {r.data} {r.orario ? `ore ${r.orario}` : ''} • Distributore: <span className="text-slate-300 font-semibold">{r.distributore || 'N.D.'}</span> • Pagamento: <span className="text-slate-300">{r.metodoPagamento || 'Carta'}</span>
                    {r.volontarioNome ? <> • Op: <span className="text-slate-300">{r.volontarioNome}</span></> : null}
                  </div>
                  {r.consumoAnomalo && r.consumoAnomaloNota && (
                    <div className="text-[10.5px] text-rose-300 mt-0.5 font-semibold">
                      ⚠️ {r.consumoAnomaloNota}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center">
                {r.fotoScontrinoBase64 && (
                  <button
                    type="button"
                    onClick={() =>
                      setFotoScontrinoAperta({
                        src: r.fotoScontrinoBase64!,
                        titolo: `Scontrino ${r.mezzoSigla} — ${r.data} (€ ${r.costoTotale.toFixed(2)})`,
                      })
                    }
                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    title="Visualizza foto scontrino allegata"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scontrino</span>
                  </button>
                )}

                <div className="text-right font-mono">
                  <div className="font-black text-amber-400 text-sm">€ {r.costoTotale.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">Km: {r.chilometraggio.toLocaleString('it-IT')}</div>
                </div>

                {onEliminaRifornimento && (
                  <button
                    type="button"
                    onClick={() => onEliminaRifornimento(r.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 transition-colors cursor-pointer"
                    title="Elimina registrazione"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LIGHTBOX FOTO SCONTRINO */}
      {fotoScontrinoAperta && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFotoScontrinoAperta(null)}
        >
          <div
            className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-white uppercase">{fotoScontrinoAperta.titolo}</span>
              <button
                type="button"
                onClick={() => setFotoScontrinoAperta(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={fotoScontrinoAperta.src}
              alt="Foto scontrino rifornimento"
              className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-950 border border-slate-800"
            />
          </div>
        </div>
      )}

      {/* MODALE NUOVO RIFORNIMENTO CARBURANTE */}
      {modaleRifornimentoAperta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl w-full max-w-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Registra Rifornimento Carburante</h3>
                  <p className="text-xs text-slate-400">Inserisci i litri e il costo per aggiornare i calcoli di consumo (km/l) del mezzo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleRifornimentoAperta(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroreForm && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{erroreForm}</span>
              </div>
            )}

            <form onSubmit={handleSalvaRifornimento} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mezzo */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mezzo Flotta</label>
                  <select
                    value={formMezzoSigla}
                    onChange={(e) => {
                      const nuovaSigla = e.target.value;
                      setFormMezzoSigla(nuovaSigla);
                      const m = mezzi.find(v => v.sigla === nuovaSigla);
                      if (m?.chilometraggioAttuale) setFormKm(m.chilometraggioAttuale);
                      setFormMetodo(getMetodoPagamentoCarburantePerMezzo(nuovaSigla, tuttiMetodiPagamento));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {mezzi.map((m) => (
                      <option key={m.sigla} value={m.sigla}>
                        {m.sigla} - {m.modello} ({m.targa})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo Carburante */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tipo Carburante</label>
                  <select
                    value={formTipoCarburante}
                    onChange={(e) => setFormTipoCarburante(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Gasolio / Diesel">Gasolio / Diesel (Autotrazione)</option>
                    <option value="Benzina Verde">Benzina Senza Piombo</option>
                    <option value="AdBlue">Additivo AdBlue</option>
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Orario */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Orario</label>
                  <input
                    type="time"
                    value={formOrario}
                    onChange={(e) => setFormOrario(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Litri */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Litri Carburante (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formLitri}
                    onChange={(e) => setFormLitri(e.target.value)}
                    placeholder="es. 68.5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Costo Totale */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Importo Totale (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCostoTotale}
                    onChange={(e) => setFormCostoTotale(e.target.value)}
                    placeholder="es. 122.60"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Chilometraggio Attuale */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Chilometri Contachilometri</label>
                  <input
                    type="number"
                    value={formKm}
                    onChange={(e) => setFormKm(e.target.value)}
                    placeholder="es. 114520"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Metodo di Pagamento */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Metodo di Pagamento</label>
                    {onApriGestionePagamentiCarburante && (
                      <button
                        type="button"
                        onClick={() => {
                          setModaleRifornimentoAperta(false);
                          onApriGestionePagamentiCarburante();
                        }}
                        className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Gestisci Metodi
                      </button>
                    )}
                  </div>
                  <select
                    value={formMetodo}
                    onChange={(e) => setFormMetodo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {metodiPagamentoAttivi.map((m) => (
                      <option key={m.id} value={m.nome}>
                        {m.nome}{m.codiceCarta ? ` (${m.codiceCarta})` : ''}{m.mezzoSiglaAssegnato ? ` — ${m.mezzoSiglaAssegnato}` : ''}
                      </option>
                    ))}
                    {formMetodo && !metodiPagamentoAttivi.some((m) => m.nome === formMetodo) && (
                      <option value={formMetodo}>{formMetodo}</option>
                    )}
                  </select>
                  {metodoAssegnatoAlMezzoCorrente && metodoAssegnatoAlMezzoCorrente.nome === formMetodo && (
                    <p className="text-[10px] text-emerald-400 font-semibold mt-1">
                      ✓ Carta assegnata automaticamente al mezzo {formMezzoSigla}
                    </p>
                  )}
                </div>
              </div>

              {/* Distributore */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Stazione di Servizio / Distributore</label>
                <input
                  type="text"
                  value={formDistributore}
                  onChange={(e) => setFormDistributore(e.target.value)}
                  placeholder="es. Eni Station Massa Aurelia, Q8 Viale Stazione..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Note Opzionali</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="es. Pieno per servizio di trasporto urgente..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Box Riepilogo Prezzo al Litro */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 font-sans">Prezzo Calcolato al Litro:</span>
                <span className="font-bold text-emerald-400">€ {prezzoAlLitroCalcolato} / Litro</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleRifornimentoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  Salva Rifornimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
