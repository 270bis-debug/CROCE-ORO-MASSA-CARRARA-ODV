import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Truck,
  MapPin,
  Building,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Send,
  Sparkles,
  TreePine,
  Landmark,
  Clock
} from 'lucide-react';
import { TIPOLOGIE_SERVIZIO_ISTITUTO, TIPOLOGIE_PROTEZIONE_CIVILE } from '../data/tipologieServizio';

export interface DatiNuovoServizioAutonomo {
  ambito: 'SERVIZIO D\'ISTITUTO' | 'PROTEZIONE CIVILE';
  tipologiaServizio: string;
  luogo: string;
  mezzo: string;
  urgenza: 'ROSSO' | 'GIALLO' | 'VERDE' | 'BIANCO';
  note: string;
  kmInizio?: string;
}

interface ModalNuovoServizioAutonomoProps {
  isOpen: boolean;
  onClose: () => void;
  volontarioNome?: string;
  volontarioId?: string;
  mezzoPredefinito?: string;
  flottaMezzi: string[];
  getKmInizialiSuggeriti?: (mezzo: string) => number | null;
  onConferma: (dati: DatiNuovoServizioAutonomo) => void;
}

const PRESET_LUOGHI = [
  'Sede Operativa Le Jare, Massa (MS)',
  'Sede Legale Ronchi, Massa (MS)',
  'Territorio Comunale Massa-Carrara',
  'Presidio Ospedaliero NOA, Massa',
  'Distributore Carburante / Rifornimento',
  'Magazzino Protezione Civile / Logistica'
];

export const ModalNuovoServizioAutonomo: React.FC<ModalNuovoServizioAutonomoProps> = ({
  isOpen,
  onClose,
  volontarioNome = 'Volontario',
  mezzoPredefinito,
  flottaMezzi,
  getKmInizialiSuggeriti,
  onConferma
}) => {
  const [ambito, setAmbito] = useState<'SERVIZIO D\'ISTITUTO' | 'PROTEZIONE CIVILE'>('SERVIZIO D\'ISTITUTO');
  const [tipologia, setTipologia] = useState<string>(TIPOLOGIE_SERVIZIO_ISTITUTO[0]);
  const [tipologiaCustom, setTipologiaCustom] = useState<string>('');
  const [luogo, setLuogo] = useState<string>('Territorio Comunale Massa-Carrara');
  const [mezzo, setMezzo] = useState<string>(mezzoPredefinito || '');
  const [erroreMezzo, setErroreMezzo] = useState<string | null>(null);
  const [kmInizio, setKmInizio] = useState<string>('');
  const [kmInizioModificato, setKmInizioModificato] = useState<boolean>(false);
  const [urgenza, setUrgenza] = useState<'VERDE' | 'BIANCO' | 'GIALLO'>('VERDE');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setMezzo(mezzoPredefinito || '');
      setErroreMezzo(null);
      setKmInizioModificato(false);
    }
  }, [isOpen, mezzoPredefinito]);

  useEffect(() => {
    if (!isOpen) {
      setKmInizioModificato(false);
      return;
    }
    if (!kmInizioModificato) {
      if (!mezzo) {
        setKmInizio('');
      } else {
        const suggeriti = getKmInizialiSuggeriti?.(mezzo);
        setKmInizio(suggeriti !== null && suggeriti !== undefined ? String(suggeriti) : '');
      }
    }
  }, [isOpen, mezzo, kmInizioModificato, getKmInizialiSuggeriti]);

  // Al cambio di ambito, preimposta la prima tipologia
  useEffect(() => {
    if (ambito === 'SERVIZIO D\'ISTITUTO') {
      setTipologia(TIPOLOGIE_SERVIZIO_ISTITUTO[0]);
    } else {
      setTipologia(TIPOLOGIE_PROTEZIONE_CIVILE[0]);
    }
    setTipologiaCustom('');
  }, [ambito]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mezzo || !mezzo.trim()) {
      setErroreMezzo('Seleziona il mezzo operativo prima di avviare il servizio.');
      return;
    }
    const tipologiaFinale = tipologiaCustom.trim() || tipologia;
    const luogoFinale = luogo.trim() || 'Territorio Massa-Carrara';

    onConferma({
      ambito,
      tipologiaServizio: tipologiaFinale,
      luogo: luogoFinale,
      mezzo: mezzo.trim(),
      urgenza,
      note: note.trim(),
      kmInizio: kmInizio.trim() || undefined
    });
    onClose();
  };

  const listaTipologie = ambito === 'SERVIZIO D\'ISTITUTO' ? TIPOLOGIE_SERVIZIO_ISTITUTO : TIPOLOGIE_PROTEZIONE_CIVILE;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border-2 border-[#bfa353] rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto ring-4 ring-[#bfa353]/20">
        
        {/* Header Modale Fisso in Alto */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-lg font-black shrink-0">
              {ambito === 'SERVIZIO D\'ISTITUTO' ? <Landmark className="w-5 h-5 text-amber-400" /> : <TreePine className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase text-white tracking-wide">
                Nuovo Servizio Autonomo
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight">
                Inserito in autonomia dall'equipaggio a bordo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form con Corpo Scrollabile e Footer Fisso */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          
          {/* Contenuto Scrollabile Interno */}
          <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 text-xs">
            
            {/* Banner Avviso Notifica Centrale */}
            <div className="p-3 bg-gradient-to-r from-amber-950/60 via-slate-950 to-amber-950/60 border-2 border-amber-500/70 rounded-2xl text-xs space-y-1 shadow-md">
              <div className="flex items-center gap-2 font-black text-amber-300 uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Notifica Immediata Centrale Operativa</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                All'avvio, la Centrale Operativa riceverà istantaneamente una <strong>notifica di allerta con sirena e messaggio radio</strong> che la informa che {mezzo ? <>il mezzo <strong>{mezzo}</strong></> : 'il mezzo selezionato'} si sta spostando per questo servizio.
              </p>
            </div>

            {/* SCELTA AMBITO: ISTITUTO O PROTEZIONE CIVILE */}
            <div>
              <label className="block text-slate-300 font-bold uppercase text-[11px] mb-1.5">
                1. Seleziona Ambito del Servizio <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAmbito('SERVIZIO D\'ISTITUTO')}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                    ambito === 'SERVIZIO D\'ISTITUTO'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <span className="font-black text-xs block text-white uppercase">Servizio d'Istituto</span>
                    <span className="text-[9.5px] text-slate-400 leading-tight">Logistica, Ufficio, Rifornimento, Spostamento Mezzo</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAmbito('PROTEZIONE CIVILE')}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                    ambito === 'PROTEZIONE CIVILE'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-md ring-1 ring-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <TreePine className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="font-black text-xs block text-white uppercase">Protezione Civile</span>
                    <span className="text-[9.5px] text-slate-400 leading-tight">Monitoraggio, Allerte, Eventi, Esercitazioni</span>
                  </div>
                </button>
              </div>
            </div>

            {/* TIPOLOGIA DI SERVIZIO */}
            <div>
              <label className="block text-slate-300 font-bold uppercase text-[11px] mb-1">
                2. Tipologia del Servizio <span className="text-red-400">*</span>
              </label>
              <select
                value={tipologia}
                onChange={(e) => setTipologia(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {listaTipologie.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__ALTRO__">-- Altra Tipologia (Specifica sotto) --</option>
              </select>

              {tipologia === '__ALTRO__' && (
                <input
                  type="text"
                  required
                  placeholder="Specifica la tipologia del servizio..."
                  value={tipologiaCustom}
                  onChange={(e) => setTipologiaCustom(e.target.value)}
                  className="w-full mt-2 p-2 rounded-xl bg-slate-950 border border-amber-500 text-white text-xs"
                />
              )}
            </div>

            {/* LUOGO / DESTINAZIONE / OBIETTIVO */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-300 font-bold uppercase text-[11px]">
                  3. Luogo / Destinazione / Percorso <span className="text-red-400">*</span>
                </label>
              </div>
              <input
                type="text"
                required
                value={luogo}
                onChange={(e) => setLuogo(e.target.value)}
                placeholder="Es. Sede Operativa Le Jare, Territorio Comunale, Presidio..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:ring-1 focus:ring-amber-500"
              />

              {/* Preset rapidi di destinazione */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1.5 text-[10px]">
                <span className="text-slate-500 font-bold">Preset:</span>
                {PRESET_LUOGHI.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setLuogo(p)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    {p.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* MEZZO UTILIZZATO, KM INIZIALI & URGENZA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-bold uppercase text-[11px] mb-1">
                  Mezzo Operativo <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={mezzo}
                  onChange={(e) => {
                    setMezzo(e.target.value);
                    setErroreMezzo(null);
                    setKmInizioModificato(false);
                  }}
                  className={`w-full p-2.5 rounded-xl bg-slate-950 border ${
                    erroreMezzo ? 'border-red-500 ring-1 ring-red-500' : !mezzo ? 'border-amber-500/70' : 'border-slate-700'
                  } text-white font-mono font-bold text-xs cursor-pointer`}
                >
                  <option value="">-- Seleziona Mezzo --</option>
                  {[...flottaMezzi].sort((a, b) => a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' })).map((m) => (
                    <option key={m} value={m}>
                      🚑 {m}
                    </option>
                  ))}
                </select>
                {erroreMezzo && (
                  <p className="text-[10px] text-red-400 font-bold mt-1">{erroreMezzo}</p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase text-[11px] mb-1">
                  KM Partenza (Auto / Modif.)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={kmInizio}
                  onChange={(e) => {
                    setKmInizio(e.target.value);
                    setKmInizioModificato(true);
                  }}
                  placeholder="Auto da mezzo..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase text-[11px] mb-1">
                  Codice Priorità
                </label>
                <select
                  value={urgenza}
                  onChange={(e) => setUrgenza(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs cursor-pointer"
                >
                  <option value="VERDE">🟢 VERDE (Ordinario)</option>
                  <option value="BIANCO">⚪ BIANCO (Servizio Amministrativo / Sede)</option>
                  <option value="GIALLO">🟡 GIALLO (Urgente / Operativo PC)</option>
                </select>
              </div>
            </div>

            {/* NOTE OPERATIVE */}
            <div>
              <label className="block text-slate-400 font-bold mb-1">
                Note Operative / Motivo Spostamento (Opzionale)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Es. Rifornimento carburante e controllo livelli prima del turno serale..."
                className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Riepilogo Regole Operative */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px] text-slate-400 space-y-1">
              <span className="font-bold text-amber-300 block uppercase">
                📋 Modalità Operativa Bordo:
              </span>
              <p>
                1. All'uscita dalla sede dovrai cliccare il pulsante <strong>"1. PARTENZA DA SEDE"</strong>.
              </p>
              <p>
                2. La Centrale riceverà la notifica che il mezzo si sta spostando e potrà disporre rientro o nuovo obiettivo all'arrivo.
              </p>
            </div>

          </div>

          {/* Footer Fisso con Pulsanti Azione */}
          <div className="flex items-center justify-end gap-2.5 p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/90 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black uppercase text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer border border-amber-600"
            >
              <Send className="w-4 h-4 text-slate-950" />
              <span>Avvia Servizio & Notifica Centrale</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
