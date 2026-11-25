import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  X,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  CreditCard,
  MapPin,
  Trash2,
  Droplet,
} from 'lucide-react';
import { MezzoFlotta } from '../types/adminTypes';
import { RifornimentoCarburante } from '../types/consumiTypes';
import { formatISODateItaly, formatTimeItaly } from '../utils/italianTime';
import { comprimiFotoOperativa } from '../utils/fotoCompressione';
import {
  analizzaAnomaliaRifornimento,
  getRifornimentiMezzi,
  salvaRifornimentiMezzi,
} from '../utils/rifornimentiStore';
import { realtime } from '../services/realtime';
import {
  useMetodiPagamentoCarburante,
  getMetodiPagamentoCarburanteAttivi,
  getMetodoPagamentoCarburantePerMezzo,
  getMetodoOggettoPerMezzo,
} from '../utils/metodiPagamentoCarburanteStore';

interface ModalRifornimentoRapidoTurnoProps {
  aperta: boolean;
  onChiudi: () => void;
  mezziFlotta: MezzoFlotta[];
  mezzoPreselezionato?: string;
  volontarioId?: string;
  volontarioNome: string;
  sezioneNome?: string;
  onAggiornaKmMezzo?: (mezzoSigla: string, nuovoKm: number) => void;
  onRifornimentoRegistrato?: (rifornimento: RifornimentoCarburante) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const ModalRifornimentoRapidoTurno: React.FC<ModalRifornimentoRapidoTurnoProps> = ({
  aperta,
  onChiudi,
  mezziFlotta,
  mezzoPreselezionato,
  volontarioId,
  volontarioNome,
  sezioneNome,
  onAggiornaKmMezzo,
  onRifornimentoRegistrato,
  onNotificaRadio,
}) => {
  const siglaIniziale = useMemo(() => {
    if (mezzoPreselezionato) {
      const token = mezzoPreselezionato.trim().split(/\s+/)[0];
      const match = mezziFlotta.find(
        (m) => m.sigla.toLowerCase() === token.toLowerCase() || mezzoPreselezionato.toLowerCase().includes(m.sigla.toLowerCase())
      );
      if (match) return match.sigla;
    }
    return mezziFlotta[0]?.sigla || '';
  }, [mezzoPreselezionato, mezziFlotta]);

  const tuttiMetodiPagamento = useMetodiPagamentoCarburante();
  const metodiPagamentoAttivi = useMemo(
    () => getMetodiPagamentoCarburanteAttivi(tuttiMetodiPagamento),
    [tuttiMetodiPagamento]
  );

  const [mezzoSigla, setMezzoSigla] = useState(siglaIniziale);
  const [data, setData] = useState(() => formatISODateItaly());
  const [orario, setOrario] = useState(() => formatTimeItaly(undefined, false));
  const [chilometraggio, setChilometraggio] = useState('');
  const [litri, setLitri] = useState('');
  const [costoTotale, setCostoTotale] = useState('');
  const [tipoCarburante, setTipoCarburante] = useState<RifornimentoCarburante['tipoCarburante']>('Gasolio / Diesel');
  const [metodoPagamento, setMetodoPagamento] = useState<string>(() =>
    getMetodoPagamentoCarburantePerMezzo(siglaIniziale)
  );
  const [distributore, setDistributore] = useState('');
  const [note, setNote] = useState('');
  const [fotoScontrino, setFotoScontrino] = useState<string | undefined>(undefined);
  const [caricamentoFoto, setCaricamentoFoto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [esitoSuccesso, setEsitoSuccesso] = useState<{ msg: string; anomalia?: string } | null>(null);

  const metodoSelezionatoObj = useMemo(
    () => metodiPagamentoAttivi.find((m) => m.nome === metodoPagamento),
    [metodiPagamentoAttivi, metodoPagamento]
  );
  const metodoAssegnatoAlMezzoCorrente = useMemo(
    () => getMetodoOggettoPerMezzo(mezzoSigla, tuttiMetodiPagamento),
    [mezzoSigla, tuttiMetodiPagamento]
  );

  useEffect(() => {
    if (!aperta) return;
    setMezzoSigla(siglaIniziale);
    setData(formatISODateItaly());
    setOrario(formatTimeItaly(undefined, false));
    const mz = mezziFlotta.find((m) => m.sigla === siglaIniziale);
    setChilometraggio(mz?.chilometraggioAttuale ? String(mz.chilometraggioAttuale) : '');
    setLitri('');
    setCostoTotale('');
    setMetodoPagamento(getMetodoPagamentoCarburantePerMezzo(siglaIniziale, tuttiMetodiPagamento));
    setDistributore('');
    setNote('');
    setFotoScontrino(undefined);
    setErrore(null);
    setEsitoSuccesso(null);
  }, [aperta, siglaIniziale, mezziFlotta, tuttiMetodiPagamento]);

  const mezzoCorrente = useMemo(
    () => mezziFlotta.find((m) => m.sigla === mezzoSigla),
    [mezziFlotta, mezzoSigla]
  );

  const prezzoAlLitro = useMemo(() => {
    const l = parseFloat(litri.replace(',', '.'));
    const c = parseFloat(costoTotale.replace(',', '.'));
    if (l > 0 && c > 0) return (c / l).toFixed(3);
    return null;
  }, [litri, costoTotale]);

  const handleCaricaFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrore(null);
    setCaricamentoFoto(true);
    try {
      const dataUrl = await comprimiFotoOperativa(file, 640, 0.62);
      setFotoScontrino(dataUrl);
    } catch (err: any) {
      setErrore(err?.message || 'Errore nel caricamento della foto scontrino.');
    } finally {
      setCaricamentoFoto(false);
    }
  };

  const handleSalva = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);

    if (!mezzoSigla) {
      setErrore('Seleziona il mezzo rifornito.');
      return;
    }
    const kmNum = parseInt(chilometraggio.replace(/\D/g, ''), 10);
    const litriNum = parseFloat(litri.replace(',', '.'));
    const costoNum = parseFloat(costoTotale.replace(',', '.'));

    if (isNaN(kmNum) || kmNum <= 0) {
      setErrore('Inserisci i chilometri attuali letti sul contachilometri.');
      return;
    }
    if (isNaN(litriNum) || litriNum <= 0) {
      setErrore('Inserisci i litri riforniti.');
      return;
    }
    if (isNaN(costoNum) || costoNum <= 0) {
      setErrore("Inserisci l'importo totale dello scontrino (€).");
      return;
    }

    const storico = getRifornimentiMezzi();
    const now = Date.now();
    const bozza: RifornimentoCarburante = {
      id: `rif-${now}`,
      mezzoSigla,
      data,
      orario,
      litri: Math.round(litriNum * 10) / 10,
      costoTotale: Math.round(costoNum * 100) / 100,
      prezzoAlLitro: parseFloat((costoNum / litriNum).toFixed(3)),
      chilometraggio: kmNum,
      distributore: distributore.trim() || 'Distributore in servizio',
      volontarioNome,
      volontarioId,
      sezione: sezioneNome,
      metodoPagamento,
      tipoCarburante,
      fotoScontrinoBase64: fotoScontrino,
      creatoDaTurno: true,
      updatedAt: now,
      note: note.trim() || undefined,
    };

    const controllo = analizzaAnomaliaRifornimento(bozza, storico);
    const nuovo: RifornimentoCarburante = {
      ...bozza,
      consumoAnomalo: controllo.anomalo,
      consumoAnomaloNota: controllo.nota,
    };

    const saved = salvaRifornimentiMezzi([nuovo, ...storico], now);
    realtime.syncRifornimentiMezzi(saved.lista, saved.updatedAt);
    onRifornimentoRegistrato?.(nuovo);

    if (mezzoCorrente && kmNum > (mezzoCorrente.chilometraggioAttuale || 0)) {
      onAggiornaKmMezzo?.(mezzoSigla, kmNum);
    }

    if (controllo.anomalo) {
      onNotificaRadio?.(
        `⚠️ ANOMALIA RIFORNIMENTO ${mezzoSigla} (${volontarioNome}): ${nuovo.litri} L • € ${nuovo.costoTotale.toFixed(2)} • ${controllo.nota}`,
        'allarme'
      );
    } else {
      onNotificaRadio?.(
        `⛽ RIFORNIMENTO DA TURNO: ${mezzoSigla} • ${nuovo.litri} L (${nuovo.tipoCarburante}) • € ${nuovo.costoTotale.toFixed(2)} • Km ${kmNum} (${volontarioNome})`,
        'mezzo'
      );
    }

    setEsitoSuccesso({
      msg: `Rifornimento registrato su ${mezzoSigla} (${nuovo.litri} L • € ${nuovo.costoTotale.toFixed(2)}). Collegato automaticamente a Consumi Mezzi e Contabilità.`,
      anomalia: controllo.anomalo ? controllo.nota : undefined,
    });
  };

  if (!aperta) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-amber-500/35 px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0">
              <Fuel className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                Rifornimento Rapido da Turno
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Autista: <strong className="text-amber-300">{volontarioNome}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3.5">
          {esitoSuccesso ? (
            <div className="space-y-3 py-2 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-white uppercase">Rifornimento Salvato!</h4>
              <p className="text-xs text-slate-200 leading-relaxed">{esitoSuccesso.msg}</p>
              {esitoSuccesso.anomalia && (
                <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/60 text-left text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300 uppercase text-[10px]">Consumo / Dato Anomalo Segnalato alla Centrale</strong>
                    <span>{esitoSuccesso.anomalia}</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={onChiudi}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase cursor-pointer"
              >
                Chiudi e Torna al Turno
              </button>
            </div>
          ) : (
            <form onSubmit={handleSalva} className="space-y-3">
              {errore && (
                <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errore}</span>
                </div>
              )}

              {/* Mezzo e Km */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Mezzo Rifornito *
                  </label>
                  <select
                    value={mezzoSigla}
                    onChange={(e) => {
                      const s = e.target.value;
                      setMezzoSigla(s);
                      const m = mezziFlotta.find((x) => x.sigla === s);
                      if (m?.chilometraggioAttuale) setChilometraggio(String(m.chilometraggioAttuale));
                      setMetodoPagamento(getMetodoPagamentoCarburantePerMezzo(s, tuttiMetodiPagamento));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    {mezziFlotta.map((m) => (
                      <option key={m.id || m.sigla} value={m.sigla}>
                        {m.sigla} — {m.modello} ({m.targa})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-amber-400" />
                    <span>Km Attuali Contachilometri *</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={chilometraggio}
                    onChange={(e) => setChilometraggio(e.target.value)}
                    placeholder={mezzoCorrente?.chilometraggioAttuale ? `Es. ${mezzoCorrente.chilometraggioAttuale}` : 'Es. 125400'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Litri & Importo */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <Droplet className="w-3 h-3 text-sky-400" />
                    <span>Litri *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={litri}
                    onChange={(e) => setLitri(e.target.value)}
                    placeholder="Es. 54.5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Importo Totale (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={costoTotale}
                    onChange={(e) => setCostoTotale(e.target.value)}
                    placeholder="Es. 96.50"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              {prezzoAlLitro && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Prezzo calcolato al litro:</span>
                  <span className="font-mono font-black text-emerald-300">€ {prezzoAlLitro} / L</span>
                </div>
              )}

              {/* Tipo & Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Carburante
                  </label>
                  <select
                    value={tipoCarburante}
                    onChange={(e) => setTipoCarburante(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none"
                  >
                    <option value="Gasolio / Diesel">Gasolio / Diesel</option>
                    <option value="Benzina Verde">Benzina Verde</option>
                    <option value="AdBlue">AdBlue</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-emerald-400" />
                    <span>Metodo Pagamento</span>
                  </label>
                  <select
                    value={metodoPagamento}
                    onChange={(e) => setMetodoPagamento(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none"
                  >
                    {metodiPagamentoAttivi.map((m) => (
                      <option key={m.id} value={m.nome}>
                        {m.nome}{m.codiceCarta ? ` (${m.codiceCarta})` : ''}{m.mezzoSiglaAssegnato ? ` — ${m.mezzoSiglaAssegnato}` : ''}
                      </option>
                    ))}
                    {metodoPagamento && !metodiPagamentoAttivi.some((m) => m.nome === metodoPagamento) && (
                      <option value={metodoPagamento}>{metodoPagamento}</option>
                    )}
                  </select>
                  {metodoAssegnatoAlMezzoCorrente && metodoAssegnatoAlMezzoCorrente.nome === metodoPagamento && (
                    <p className="text-[10px] text-emerald-400 font-semibold mt-1 leading-tight">
                      ✓ Carta assegnata automaticamente al mezzo {mezzoSigla}
                    </p>
                  )}
                  {metodoSelezionatoObj?.descrizione && (
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      {metodoSelezionatoObj.descrizione}
                    </p>
                  )}
                </div>
              </div>

              {/* Distributore */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Distributore / Località</span>
                </label>
                <input
                  type="text"
                  value={distributore}
                  onChange={(e) => setDistributore(e.target.value)}
                  placeholder="Es. Eni Via Aurelia Massa"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Foto Scontrino */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Foto Scontrino / Ricevuta (consigliata)</span>
                  </span>
                  {fotoScontrino && (
                    <button
                      type="button"
                      onClick={() => setFotoScontrino(undefined)}
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Rimuovi
                    </button>
                  )}
                </div>

                {fotoScontrino ? (
                  <img
                    src={fotoScontrino}
                    alt="Anteprima scontrino"
                    className="w-full max-h-40 object-contain rounded-xl border border-slate-700 bg-black"
                  />
                ) : (
                  <label className="w-full py-2.5 px-3 rounded-xl border border-dashed border-amber-500/50 bg-amber-950/20 hover:bg-amber-950/35 text-amber-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>{caricamentoFoto ? 'Compressione foto...' : 'Scatta o Allega Foto Scontrino'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCaricaFoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Note (opzionale)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Es. Pieno completo a fine servizio"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onChiudi}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Fuel className="w-4 h-4" />
                  <span>Registra Rifornimento</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
