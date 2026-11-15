import React, { useState } from 'react';
import { X, PenTool, CheckCircle, RotateCcw } from 'lucide-react';
import { SignaturePad } from './SignaturePad';

interface ModalFirmaOperatoreProps {
  nomeOperatore: string;
  firmaAttuale?: string;
  onSalvaFirma: (base64: string) => void;
  onClose: () => void;
}

export const ModalFirmaOperatore: React.FC<ModalFirmaOperatoreProps> = ({
  nomeOperatore,
  firmaAttuale,
  onSalvaFirma,
  onClose
}) => {
  const [firmaTemp, setFirmaTemp] = useState<string | null>(firmaAttuale || null);
  const [errore, setErrore] = useState<string | null>(null);

  const handleSalva = () => {
    if (!firmaTemp || !firmaTemp.trim()) {
      setErrore("Traccia la tua firma autografa nell'area apposita prima di confermare.");
      return;
    }
    onSalvaFirma(firmaTemp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 sm:p-6 max-w-md w-full text-white shadow-2xl relative my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white uppercase tracking-wide">
              Firma Precaricata Operatore Centrale
            </h3>
            <p className="text-[11px] text-amber-300">
              Operatore: <strong>{nomeOperatore}</strong>
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          Disegna la tua firma autografa direttamente sul display. Questa firma rimarrà precaricata sul tuo profilo di Centrale e verrà utilizzata per firmare i fogli di viaggio visionati (anche in anteprima o in modalità simultanea differita).
        </p>

        {errore && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-semibold">
            {errore}
          </div>
        )}

        <div className="mb-4">
          <SignaturePad
            label="Traccia la tua Firma Operatore"
            sottotitolo="Usa il dito o pennino sul display (disponibile pulsante Ripeti Firma per rifarla)"
            valoreIniziale={firmaAttuale}
            onFirmaCambiata={(dataUrl) => {
              setFirmaTemp(dataUrl);
              if (dataUrl) setErrore(null);
            }}
            altezza={160}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSalva}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Salva e Applica Firma</span>
          </button>
        </div>
      </div>
    </div>
  );
};
