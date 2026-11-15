import React, { useState, useRef } from 'react';
import { Upload, PenTool, Check, RotateCcw, AlertTriangle, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { rimuoviSfondoBiancoETrendiTrasparente, validaImmagineFirma } from '../utils/signatureUtils';
import { SignaturePad } from './SignaturePad';

interface UploadFirmaTrasparenteProps {
  label?: string;
  sottotitolo?: string;
  valoreIniziale?: string | null;
  onFirmaCambiata: (firmaBase64: string | null) => void;
  mostraModalitaDisegno?: boolean;
}

export const UploadFirmaTrasparente: React.FC<UploadFirmaTrasparenteProps> = ({
  label = 'Firma Digitale Autografa (con Trasparenza Automatica)',
  sottotitolo = 'Puoi caricare una foto/scansione della firma (il bianco verrà rimosso automaticamente) oppure tracciarla a mano.',
  valoreIniziale,
  onFirmaCambiata,
  mostraModalitaDisegno = true
}) => {
  const [modalita, setModalita] = useState<'upload' | 'disegno'>('upload');
  const [caricamentoInCorso, setCaricamentoInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [anteprimaFirma, setAnteprimaFirma] = useState<string | null>(valoreIniziale || null);
  const [nomeFileCaricato, setNomeFileCaricato] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gestisciSelezioneFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrore(null);
    const errValidazione = validaImmagineFirma(file);
    if (errValidazione) {
      setErrore(errValidazione);
      e.target.value = '';
      return;
    }

    setCaricamentoInCorso(true);
    setNomeFileCaricato(file.name);

    try {
      // Elabora l'immagine rimuovendo lo sfondo bianco e rendendola trasparente
      const firmaTrasparente = await rimuoviSfondoBiancoETrendiTrasparente(file);
      setAnteprimaFirma(firmaTrasparente);
      onFirmaCambiata(firmaTrasparente);
    } catch (err: any) {
      setErrore(err?.message || 'Errore durante la trasformazione della firma.');
    } finally {
      setCaricamentoInCorso(false);
      e.target.value = '';
    }
  };

  const rimuoviFirma = () => {
    setAnteprimaFirma(null);
    setNomeFileCaricato(null);
    setErrore(null);
    onFirmaCambiata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-md space-y-3">
      {/* Testata del Componente */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <label className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{label}</span>
          </label>
          {sottotitolo && (
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{sottotitolo}</p>
          )}
        </div>

        {/* Switcher Modalità: Upload File vs Disegno a Mano */}
        {mostraModalitaDisegno && (
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setModalita('upload');
                setErrore(null);
              }}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                modalita === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Carica File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalita('disegno');
                setErrore(null);
              }}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                modalita === 'disegno'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Disegna sul Display</span>
            </button>
          </div>
        )}
      </div>

      {/* SEZIONE UPLOAD FILE IMMAGINE CON RIMOZIONE BIANCO */}
      {modalita === 'upload' && (
        <div className="space-y-3">
          {anteprimaFirma ? (
            /* BOX ANTEPRIMA FIRMA TRASPARENTE ACQUISITA */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Firma Trasparente Acquisita (Sfondo Bianco Rimosso)</span>
                </span>
                <button
                  type="button"
                  onClick={rimuoviFirma}
                  className="text-slate-400 hover:text-red-400 text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-red-950/40 border border-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sostituisci / Rimuovi</span>
                </button>
              </div>

              {/* Area di visualizzazione su sfondo a scacchiera (per evidenziare la trasparenza) */}
              <div
                className="relative w-full h-32 rounded-xl border-2 border-dashed border-amber-500/50 flex items-center justify-center p-3 overflow-hidden shadow-inner"
                style={{
                  backgroundColor: '#ffffff',
                  backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                }}
              >
                <img
                  src={anteprimaFirma}
                  alt="Firma con sfondo trasparente"
                  className="max-h-full max-w-full object-contain filter drop-shadow-sm select-none"
                />
                <span className="absolute bottom-1 right-2 text-[9px] font-mono font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-300">
                  PNG Trasparente (Sfondo Trasparente ✓)
                </span>
              </div>

              {nomeFileCaricato && (
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  File originale: <strong className="text-slate-300">{nomeFileCaricato}</strong>
                </p>
              )}
            </div>
          ) : (
            /* BOX TRASCINAMENTO / CLICK PER CARICARE IL FILE */
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={gestisciSelezioneFile}
                className="hidden"
                id="input-file-firma-trasparente"
                disabled={caricamentoInCorso}
              />

              <label
                htmlFor="input-file-firma-trasparente"
                className={`relative w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all ${
                  caricamentoInCorso
                    ? 'border-amber-400 bg-amber-500/10 cursor-wait'
                    : 'border-slate-600 bg-slate-950/60 hover:bg-slate-950 hover:border-amber-400 group'
                }`}
              >
                {caricamentoInCorso ? (
                  <div className="flex flex-col items-center gap-2 text-amber-300 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Rimozione sfondo bianco in corso...
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Ritaglio inchiostro e conversione in PNG trasparente ad alta definizione
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Carica Immagine Firma (PNG, JPG, JPEG, WEBP)
                    </span>
                    <span className="text-[11px] text-slate-400 max-w-sm">
                      Carica la foto o scansione della firma su foglio bianco:
                      <strong className="text-amber-300 ml-1">il sistema rimuoverà automaticamente tutto il bianco rendendo la firma trasparente.</strong>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      Auto-Crop • Trasparenza Alpha • Tratto Nitido
                    </span>
                  </div>
                )}
              </label>
            </div>
          )}

          {errore && (
            <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errore}</span>
            </div>
          )}
        </div>
      )}

      {/* SEZIONE DISEGNO SULLO SCHERMO */}
      {modalita === 'disegno' && (
        <SignaturePad
          label="Traccia la firma con il dito o pennino sul display"
          sottotitolo="La firma viene salvata direttamente con sfondo trasparente per i fogli di viaggio e i verbali."
          valoreIniziale={anteprimaFirma || undefined}
          onFirmaCambiata={(dataUrl) => {
            setAnteprimaFirma(dataUrl);
            onFirmaCambiata(dataUrl);
          }}
          altezza={135}
        />
      )}
    </div>
  );
};
