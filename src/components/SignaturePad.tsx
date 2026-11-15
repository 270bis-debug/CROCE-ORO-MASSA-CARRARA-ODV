import React, { useRef, useEffect, useState } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  sottotitolo?: string;
  valoreIniziale?: string;
  onFirmaCambiata: (dataUrl: string | null) => void;
  altezza?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  sottotitolo,
  valoreIniziale,
  onFirmaCambiata,
  altezza = 150
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const hasStrokes = useRef(false);
  const [firmaPresente, setFirmaPresente] = useState<boolean>(Boolean(valoreIniziale));

  // Inizializza il canvas e carica eventuale firma esistente
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configura dimensioni tenendo conto del devicePixelRatio per massima nitidezza
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 360;
    const h = altezza;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Stile tratto firma
    ctx.strokeStyle = '#0f172a'; // Blu notte / nero inchiostro
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (valoreIniziale) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        hasStrokes.current = true;
        setFirmaPresente(true);
      };
      img.src = valoreIniziale;
    } else {
      ctx.clearRect(0, 0, w, h);
      hasStrokes.current = false;
      setFirmaPresente(false);
    }
  }, [altezza]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left,
        y: (e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Previeni scroll del touch
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
    if (!firmaPresente) {
      setFirmaPresente(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (hasStrokes.current) {
      const dataUrl = canvas.toDataURL('image/png');
      onFirmaCambiata(dataUrl);
    }
  };

  const pulisciFirma = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, altezza);
    hasStrokes.current = false;
    setFirmaPresente(false);
    onFirmaCambiata(null);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-amber-400" />
            <span>{label}</span>
          </label>
          {sottotitolo && (
            <p className="text-[11px] text-slate-300 mt-0.5">{sottotitolo}</p>
          )}
        </div>

        <button
          type="button"
          onClick={pulisciFirma}
          className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 border shadow-sm active:scale-95 transition-all cursor-pointer ${
            firmaPresente
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-600'
          }`}
          title="Cancella la firma e ripeti finché non ti soddisfa"
        >
          <RotateCcw className="w-3 h-3 text-amber-400" />
          <span>Ripeti Firma</span>
        </button>
      </div>

      <div className="relative w-full rounded-lg overflow-hidden border-2 border-dashed border-slate-600 bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ height: `${altezza}px`, touchAction: 'none' }}
          className="w-full block cursor-crosshair bg-white"
        />

        {!firmaPresente && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs font-semibold select-none opacity-60">
            <PenTool className="w-5 h-5 mb-1 text-slate-400 animate-pulse" />
            <span>Passa il dito o pennino qui per firmare</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="italic">
          {firmaPresente
            ? 'Non ti piace? Clicca "Ripeti Firma" in alto a destra per rifarla.'
            : 'Firma obbligatoria per completare la registrazione.'}
        </span>
        {firmaPresente ? (
          <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
            <Check className="w-3 h-3 text-emerald-400" /> Firma acquisita ✓
          </span>
        ) : (
          <span className="text-amber-400 font-medium">In attesa di firma sul display</span>
        )}
      </div>
    </div>
  );
};
