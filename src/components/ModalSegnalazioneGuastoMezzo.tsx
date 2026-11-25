import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  Camera,
  X,
  CheckCircle2,
  Trash2,
  FileDown,
  ShieldAlert,
  MapPin,
  Gauge,
} from 'lucide-react';
import { MezzoFlotta } from '../types/adminTypes';
import { Volontario } from './DatabaseVolontariModal';
import { formatDateTimeItaly } from '../utils/italianTime';
import { comprimiFotoOperativa } from '../utils/fotoCompressione';
import {
  GravitaGuastoMezzo,
  SegnalazioneGuastoMezzo,
  TipoSegnalazioneGuasto,
  generaPdfSchedaGuastoSinistro,
  getSegnalazioniGuastiMezzi,
  salvaSegnalazioniGuastiMezzi,
} from '../utils/guastiMezziStore';
import { realtime } from '../services/realtime';

interface ModalSegnalazioneGuastoMezzoProps {
  aperta: boolean;
  onChiudi: () => void;
  mezziFlotta: MezzoFlotta[];
  volontari?: Volontario[];
  mezzoPreselezionato?: string;
  volontarioId?: string;
  volontarioNome: string;
  sezioneNome?: string;
  onImpostaMezzoFuoriServizio?: (mezzoSigla: string, motivo: string) => void;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

const TIPI_SEGNALAZIONE: TipoSegnalazioneGuasto[] = [
  'Guasto Meccanico',
  'Danno Carrozzeria',
  'Sinistro Stradale',
  'Guasto Apparecchiature / Sanitario',
  'Pneumatici / Freni / Luci',
  'Altro',
];

const GRAVITA_OPTIONS: Array<{ val: GravitaGuastoMezzo; desc: string; color: string }> = [
  { val: 'Lieve / Utilizzabile', desc: 'Mezzo utilizzabile in sicurezza, da programmare controllo', color: 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200' },
  { val: 'Attenzione / Con Riserva', desc: 'Usare con cautela, avvisare subito Responsabile Mezzi', color: 'border-amber-500/60 bg-amber-950/30 text-amber-200' },
  { val: 'Critico / Fuori Servizio', desc: 'Mezzo non sicuro o danneggiato gravemente: fermo immediato', color: 'border-red-500/70 bg-red-950/40 text-red-200' },
];

export const ModalSegnalazioneGuastoMezzo: React.FC<ModalSegnalazioneGuastoMezzoProps> = ({
  aperta,
  onChiudi,
  mezziFlotta,
  volontari = [],
  mezzoPreselezionato,
  volontarioId,
  volontarioNome,
  sezioneNome,
  onImpostaMezzoFuoriServizio,
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

  const [mezzoSigla, setMezzoSigla] = useState(siglaIniziale);
  const [tipo, setTipo] = useState<TipoSegnalazioneGuasto>('Guasto Meccanico');
  const [gravita, setGravita] = useState<GravitaGuastoMezzo>('Attenzione / Con Riserva');
  const [descrizione, setDescrizione] = useState('');
  const [luogo, setLuogo] = useState('');
  const [kmMezzo, setKmMezzo] = useState('');
  const [coinvoltiTerzi, setCoinvoltiTerzi] = useState(false);
  const [datiControparte, setDatiControparte] = useState('');
  const [mettiFuoriServizio, setMettiFuoriServizio] = useState(false);
  const [foto, setFoto] = useState<string[]>([]);
  const [loadingFoto, setLoadingFoto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvata, setSalvata] = useState<SegnalazioneGuastoMezzo | null>(null);

  useEffect(() => {
    if (!aperta) return;
    setMezzoSigla(siglaIniziale);
    const mz = mezziFlotta.find((m) => m.sigla === siglaIniziale);
    setKmMezzo(mz?.chilometraggioAttuale ? String(mz.chilometraggioAttuale) : '');
    setTipo('Guasto Meccanico');
    setGravita('Attenzione / Con Riserva');
    setDescrizione('');
    setLuogo('');
    setCoinvoltiTerzi(false);
    setDatiControparte('');
    setMettiFuoriServizio(false);
    setFoto([]);
    setErrore(null);
    setSalvata(null);
  }, [aperta, siglaIniziale, mezziFlotta]);

  const mezzoCorrente = useMemo(
    () => mezziFlotta.find((m) => m.sigla === mezzoSigla),
    [mezziFlotta, mezzoSigla]
  );

  const handleAggiungiFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setErrore(null);
    setLoadingFoto(true);
    try {
      const rimanenti = Math.max(0, 3 - foto.length);
      const nuove: string[] = [];
      for (const f of files.slice(0, rimanenti)) {
        const comp = await comprimiFotoOperativa(f, 640, 0.62);
        nuove.push(comp);
      }
      setFoto((prev) => [...prev, ...nuove].slice(0, 3));
    } catch (err: any) {
      setErrore(err?.message || 'Errore nel caricamento delle foto.');
    } finally {
      setLoadingFoto(false);
    }
  };

  const handleInvia = (e: React.FormEvent) => {
    e.preventDefault();
    setErrore(null);

    if (!mezzoSigla) {
      setErrore('Seleziona il mezzo interessato.');
      return;
    }
    if (descrizione.trim().length < 6) {
      setErrore('Inserisci una descrizione chiara del guasto, danno o sinistro.');
      return;
    }

    const now = Date.now();
    const isCritico = gravita === 'Critico / Fuori Servizio' || mettiFuoriServizio;
    const kmNum = kmMezzo ? parseInt(kmMezzo.replace(/\D/g, ''), 10) : undefined;

    const nuova: SegnalazioneGuastoMezzo = {
      id: `guasto-${now}`,
      mezzoSigla,
      mezzoTarga: mezzoCorrente?.targa,
      mezzoModello: mezzoCorrente?.modello,
      tipo,
      gravita,
      descrizione: descrizione.trim(),
      luogo: luogo.trim() || undefined,
      kmMezzo: kmNum && !isNaN(kmNum) ? kmNum : undefined,
      dataOra: formatDateTimeItaly(),
      segnalatoDaId: volontarioId,
      segnalatoDaNome: volontarioNome,
      sezione: sezioneNome,
      fotoBase64: foto.length > 0 ? foto : undefined,
      richiestoFermoImmediato: isCritico,
      coinvoltiTerzi: tipo === 'Sinistro Stradale' || coinvoltiTerzi,
      datiControparte: datiControparte.trim() || undefined,
      stato: 'Aperta',
      updatedAt: now,
    };

    const esistenti = getSegnalazioniGuastiMezzi();
    const saved = salvaSegnalazioniGuastiMezzi([nuova, ...esistenti], now);
    realtime.syncSegnalazioniGuastiMezzi(saved.lista, saved.updatedAt);

    if (isCritico && onImpostaMezzoFuoriServizio) {
      onImpostaMezzoFuoriServizio(mezzoSigla, `${tipo}: ${descrizione.trim().slice(0, 90)}`);
    }

    // Trova email Responsabile Mezzi, Presidente e Centrale
    const emailsDest = (volontari || [])
      .filter((v) => {
        if (!v || v.approvato === false) return false;
        const txt = `${v.caricaConsiglioDirettivo || ''} ${v.qualifica || ''} ${(v.mansioni || []).join(' ')}`.toLowerCase();
        return Boolean(
          v.profiloCentrale ||
            txt.includes('presidente') ||
            txt.includes('mezz') ||
            v.macroCategorieAbilitate?.includes('mezzi')
        );
      })
      .map((v) => (v.emailNotifiche || v.email || '').trim())
      .filter((em) => em.includes('@'));

    if (!realtime.isServerlessStatic()) {
      fetch(`${realtime.getApiBaseUrl()}/api/notifica-guasto-mezzo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guasto: nuova, destinatariEmails: emailsDest }),
      }).catch(() => {});
    }

    onNotificaRadio?.(
      `${isCritico ? '🚨 MEZZO FUORI SERVIZIO / GUASTO CRITICO' : '🔧 SEGNALAZIONE GUASTO/DANNO'} ${mezzoSigla} (${tipo}): ${descrizione.trim().slice(0, 110)} — ${volontarioNome}`,
      isCritico ? 'allarme' : 'mezzo'
    );

    setSalvata(nuova);
  };

  if (!aperta) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-red-500/70 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-red-950/70 to-slate-950 border-b border-red-500/35 px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-400/50 text-red-300 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                Segnalazione Guasto, Danno o Sinistro
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Avviso immediato a Responsabile Mezzi, Presidenza & Centrale
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
          {salvata ? (
            <div className="space-y-3 py-2 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-white uppercase">Segnalazione Registrata!</h4>
              <p className="text-xs text-slate-200 leading-relaxed">
                La segnalazione per <strong>{salvata.mezzoSigla}</strong> ({salvata.tipo} • {salvata.gravita}) è stata sincronizzata nel registro Parco Mezzi e notificata ai responsabili.
                {salvata.richiestoFermoImmediato ? ' Il mezzo è stato contrassegnato come Fuori Servizio.' : ''}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => generaPdfSchedaGuastoSinistro(salvata)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Scarica Scheda PDF</span>
                </button>
                <button
                  type="button"
                  onClick={onChiudi}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvia} className="space-y-3">
              {errore && (
                <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errore}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Mezzo *</label>
                  <select
                    value={mezzoSigla}
                    onChange={(e) => {
                      const s = e.target.value;
                      setMezzoSigla(s);
                      const m = mezziFlotta.find((x) => x.sigla === s);
                      if (m?.chilometraggioAttuale) setKmMezzo(String(m.chilometraggioAttuale));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-400"
                  >
                    {mezziFlotta.map((m) => (
                      <option key={m.id || m.sigla} value={m.sigla}>
                        {m.sigla} — {m.modello} ({m.targa})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tipologia Evento *</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoSegnalazioneGuasto)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none"
                  >
                    {TIPI_SEGNALAZIONE.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gravità */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
                  Gravità & Stato Operativo *
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {GRAVITA_OPTIONS.map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        setGravita(opt.val);
                        if (opt.val === 'Critico / Fuori Servizio') setMettiFuoriServizio(true);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        gravita === opt.val
                          ? `${opt.color} ring-2 ring-white/30`
                          : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-black">{opt.val}</div>
                      <div className="text-[10px] opacity-80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrizione */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Descrizione del Guasto / Danno / Dinamica *
                </label>
                <textarea
                  rows={3}
                  value={descrizione}
                  onChange={(e) => setDescrizione(e.target.value)}
                  placeholder="Descrivi cosa è successo, quali spie/parti sono coinvolte, eventuali danni visibili..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                  required
                />
              </div>

              {/* Km e Luogo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-slate-400" />
                    <span>Km Mezzo</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={kmMezzo}
                    onChange={(e) => setKmMezzo(e.target.value)}
                    placeholder="Es. 125400"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Luogo dell'Evento</span>
                  </label>
                  <input
                    type="text"
                    value={luogo}
                    onChange={(e) => setLuogo(e.target.value)}
                    placeholder="Es. Via Aurelia / Sede Massa"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              {/* Terzi / Sinistro */}
              {(tipo === 'Sinistro Stradale' || coinvoltiTerzi) && (
                <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 space-y-2">
                  <div className="text-[10px] font-black uppercase text-red-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Dati Controparte / CID / Testimoni (Assicurazione)</span>
                  </div>
                  <textarea
                    rows={2}
                    value={datiControparte}
                    onChange={(e) => setDatiControparte(e.target.value)}
                    placeholder="Targa controparte, conducente, compagnia assicurativa, CID compilato, eventuali testimoni..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-red-800/60 text-white text-xs"
                  />
                </div>
              )}

              {/* Foto (max 3) */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-red-400" />
                    <span>Foto del Danno / Guasto ({foto.length}/3)</span>
                  </span>
                  {tipo !== 'Sinistro Stradale' && (
                    <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coinvoltiTerzi}
                        onChange={(e) => setCoinvoltiTerzi(e.target.checked)}
                        className="rounded border-slate-600"
                      />
                      <span>Coinvolti terzi</span>
                    </label>
                  )}
                </div>

                {foto.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {foto.map((src, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-square">
                        <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFoto((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white cursor-pointer"
                          title="Rimuovi foto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {foto.length < 3 && (
                  <label className="w-full py-2.5 px-3 rounded-xl border border-dashed border-red-500/50 bg-red-950/20 hover:bg-red-950/35 text-red-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                    <Camera className="w-4 h-4 text-red-400" />
                    <span>{loadingFoto ? 'Compressione foto...' : 'Scatta o Allega Foto (max 3)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handleAggiungiFoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Flag fermo immediato */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-red-950/25 border border-red-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mettiFuoriServizio || gravita === 'Critico / Fuori Servizio'}
                  onChange={(e) => setMettiFuoriServizio(e.target.checked)}
                  className="mt-0.5 rounded border-red-500"
                />
                <span className="text-[11px] text-red-200 leading-snug">
                  <strong>Metti subito il mezzo in "Fuori Servizio"</strong> sulla Centrale Operativa fino a verifica dell'officina.
                </span>
              </label>

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
                  className="flex-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Invia Segnalazione</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
