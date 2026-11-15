import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, CheckCircle2, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../services/pwaUpdater';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Se l'app è già installata in standalone (o aperta da icona su Android/Apple), nascondi il pulsante
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Flusso Android / Google Play / Desktop */}
      {isInstallable && (
        <button
          type="button"
          onClick={install}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-400/40 ${className}`}
          title="Installa applicazione Croce Oro sul tuo dispositivo"
        >
          <Download className="w-3.5 h-3.5 text-white" />
          <span>Installa App</span>
        </button>
      )}

      {/* Flusso Apple iOS Safari */}
      {isIOS && !isInstallable && (
        <>
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer border border-blue-400/40 ${className}`}
            title="Installa su iPhone o iPad"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-300" />
            <span>Installa su Apple</span>
          </button>

          {showIOSGuide && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-amber-500 p-5 shadow-2xl text-slate-100 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-500/40">
                      
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase">
                        Installa su iPhone / iPad
                      </h3>
                      <p className="text-[11px] text-amber-300 font-medium">
                        Scorciatoia Schermata Home
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                  <p className="text-[11px]">
                    Installando la scorciatoia sul tuo dispositivo Apple, l'applicazione si aprirà a schermo intero come un'app nativa e punterà <strong>automaticamente all'ultimo aggiornamento</strong> caricato sul server.
                  </p>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center justify-center shrink-0 font-bold text-[11px]">
                        1
                      </div>
                      <div>
                        <span className="font-bold text-white block">Tocca l'icona Condividi</span>
                        <span className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                          Tocca l'icona <Share2 className="w-3.5 h-3.5 text-blue-400 inline" /> nella barra inferiore di Safari.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 pt-1 border-t border-slate-900">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-bold text-[11px]">
                        2
                      </div>
                      <div>
                        <span className="font-bold text-white block">Aggiungi a Schermata Home</span>
                        <span className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                          Scorri l'elenco e seleziona <PlusSquare className="w-3.5 h-3.5 text-amber-400 inline" /> <strong>"Aggiungi alla schermata Home"</strong>.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2 text-emerald-300 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>L'app riceverà automaticamente ogni nuova release pubblicata.</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase transition-colors cursor-pointer"
                >
                  Ho Capito
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
