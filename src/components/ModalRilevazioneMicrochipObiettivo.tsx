import React, { useState, useEffect } from 'react';
import { QrCode, AlertTriangle, Send, CheckCircle2, Lock, X } from 'lucide-react';
import { LISTA_ANIMALI_VOLONTARIO } from '../data/animali';

interface ModalRilevazioneMicrochipObiettivoProps {
  isOpen: boolean;
  onClose: () => void;
  codiceMissione: string;
  mezzoAssegnato: string;
  tipoAnimaleIniziale?: string;
  tipoAnimaleAltroIniziale?: string;
  impostoDaCentrale?: boolean;
  microchipIniziale?: string;
  noMicrochipIniziale?: boolean;
  onConferma: (dati: {
    tipo: string;
    tipoAltro?: string;
    microchip: string;
    noMicrochip: boolean;
  }) => void;
}

export const ModalRilevazioneMicrochipObiettivo: React.FC<ModalRilevazioneMicrochipObiettivoProps> = ({
  isOpen,
  onClose,
  codiceMissione,
  mezzoAssegnato,
  tipoAnimaleIniziale = 'Cane',
  tipoAnimaleAltroIniziale = '',
  impostoDaCentrale = false,
  microchipIniziale = '',
  noMicrochipIniziale = false,
  onConferma
}) => {
  const [tipoAnimale, setTipoAnimale] = useState<string>(tipoAnimaleIniziale || 'Cane');
  const [tipoAltro, setTipoAltro] = useState<string>(tipoAnimaleAltroIniziale || '');
  const [microchip, setMicrochip] = useState<string>(microchipIniziale || '');
  const [noMicrochip, setNoMicrochip] = useState<boolean>(noMicrochipIniziale || false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTipoAnimale(tipoAnimaleIniziale || 'Cane');
      setTipoAltro(tipoAnimaleAltroIniziale || '');
      setMicrochip(microchipIniziale || '');
      setNoMicrochip(Boolean(noMicrochipIniziale));
      setErrore(null);
    }
  }, [isOpen, tipoAnimaleIniziale, tipoAnimaleAltroIniziale, microchipIniziale, noMicrochipIniziale]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrore(null);

    const effTipo = impostoDaCentrale ? tipoAnimaleIniziale : tipoAnimale;
    if (!effTipo || !effTipo.trim()) {
      setErrore("Il tipo di animale recuperato è un dato obbligatorio!");
      return;
    }

    if (effTipo === 'Altro' && (!tipoAltro || !tipoAltro.trim())) {
      setErrore("Hai selezionato 'Altro': specifica il tipo di animale recuperato!");
      return;
    }

    // Se è Cane o Gatto (o in generale animale non di proprietà):
    // il volontario deve inserire il microchip oppure flaggare la casella NO MICROCHIP obbligatoriamente
    const isCaneOGatto = effTipo.toLowerCase().includes('cane') || effTipo.toLowerCase().includes('gatto');
    if (isCaneOGatto || true) {
      if (!noMicrochip) {
        const chipTrim = microchip.trim();
        if (!chipTrim) {
          setErrore("Obbligatorio inserire il numero di microchip oppure flaggare la casella 'NO MICROCHIP'!");
          return;
        }
        if (chipTrim.length < 8) {
          setErrore("Inserisci un codice microchip valido (solitamente 15 cifre ISO) oppure spunta 'NO MICROCHIP'!");
          return;
        }
      }
    }

    onConferma({
      tipo: effTipo,
      tipoAltro: effTipo === 'Altro' ? tipoAltro.trim() : undefined,
      microchip: noMicrochip ? 'NO MICROCHIP' : microchip.trim(),
      noMicrochip
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header Modale */}
        <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-red-950 border-b border-amber-500/40 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-lg animate-pulse">
              🏷️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white tracking-wide">
                  OBBLIGATORIO SU OBIETTIVO
                </span>
                <span className="text-[11px] font-mono text-amber-300 font-bold">
                  {codiceMissione}
                </span>
              </div>
              <h2 className="text-sm font-black text-white uppercase tracking-wide mt-0.5">
                Rilevazione Microchip Animale Non di Proprietà
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Indicazione Operativa */}
        <div className="p-3 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="leading-snug">
            <strong>Sei arrivato sull'obiettivo d'intervento (Mezzo {mezzoAssegnato}).</strong>
            <p className="text-[11px] text-slate-300 mt-1">
              Poiché si tratta di un <strong>animale non di proprietà</strong>, effettua subito la scansione con il lettore microchip di bordo e comunica il codice alla Centrale Operativa, oppure spunta la casella se l'animale è sprovvisto di microchip.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs text-slate-200">
          {errore && (
            <div className="p-3 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-bold">{errore}</span>
            </div>
          )}

          {/* 1. TIPO DI ANIMALE RECUPERATO */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                <span>🐾 Tipo di Animale Recuperato</span>
                <span className="text-red-400">*</span>
              </label>

              {impostoDaCentrale ? (
                <span className="text-[9.5px] font-bold text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-700/60 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  Impostato da Centrale (Non modificabile)
                </span>
              ) : (
                <span className="text-[9.5px] text-amber-300 font-semibold">
                  Seleziona dalla lista
                </span>
              )}
            </div>

            {impostoDaCentrale ? (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold flex items-center justify-between">
                <span>{tipoAnimaleIniziale} {tipoAnimaleAltroIniziale ? `(${tipoAnimaleAltroIniziale})` : ''}</span>
                <span className="text-slate-400 text-[10px] font-normal italic">Confermato da Centrale</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {LISTA_ANIMALI_VOLONTARIO.map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTipoAnimale(tipo)}
                      className={`py-2 px-2 rounded-xl font-black text-xs border transition-all text-center ${
                        tipoAnimale === tipo
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {tipo === 'Cane' ? '🐶 Cane' : tipo === 'Gatto' ? '🐱 Gatto' : '🐾 Altro'}
                    </button>
                  ))}
                </div>

                {tipoAnimale === 'Altro' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Specifica tipo di animale <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Furetto, Coniglio, Volatile, ecc."
                      value={tipoAltro}
                      onChange={(e) => setTipoAltro(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. RILEVAZIONE MICROCHIP O NO MICROCHIP */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Numero di Microchip Rilevato</span>
              </label>

              <span className="text-[10px] text-slate-400 font-mono">15 cifre ISO standard</span>
            </div>

            {/* Input Microchip */}
            <div>
              <input
                type="text"
                disabled={noMicrochip}
                placeholder={noMicrochip ? "Nessun microchip presente (lettore negativo)" : "Es. 380260042819231"}
                value={noMicrochip ? "" : microchip}
                onChange={(e) => setMicrochip(e.target.value.replace(/\s+/g, ''))}
                maxLength={25}
                className={`w-full p-3 rounded-xl border text-white font-mono text-sm tracking-wider focus:outline-none transition-all ${
                  noMicrochip
                    ? 'bg-slate-950/60 border-slate-800 text-slate-500 cursor-not-allowed italic'
                    : 'bg-slate-900 border-amber-500/70 focus:ring-2 focus:ring-amber-500 text-amber-300 font-bold'
                }`}
              />
            </div>

            {/* Checkbox NO MICROCHIP in evidenza */}
            <div className="pt-1 border-t border-slate-800">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 cursor-pointer select-none transition-all">
                <input
                  type="checkbox"
                  checked={noMicrochip}
                  onChange={(e) => {
                    setNoMicrochip(e.target.checked);
                    if (e.target.checked) {
                      setMicrochip('');
                    }
                  }}
                  className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-amber-400 bg-slate-950 cursor-pointer accent-amber-500 shrink-0"
                />
                <div>
                  <span className="font-black text-amber-300 text-xs sm:text-sm block">
                    🚫 NO MICROCHIP (Animale sprovvisto di microchip)
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Flagga questa casella se il lettore non ha rilevato alcun transponder sottocutaneo.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Azioni */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-colors"
            >
              Annulla
            </button>

            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 text-slate-950" />
              <span>Invia Rilevazione Microchip alla Centrale</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
