import React, { useState, useEffect } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { VersionInfo, applicaAggiornamento } from '../services/pwaUpdater';

export const BannerAggiornamentoPWA: React.FC = () => {
  const [nuovaVersione, setNuovaVersione] = useState<VersionInfo | null>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    const handleNuovaRelease = (e: Event) => {
      const customEvent = e as CustomEvent<VersionInfo>;
      if (customEvent.detail) {
        setNuovaVersione(customEvent.detail);
      }
    };

    window.addEventListener('croce-oro-nuova-release', handleNuovaRelease);
    return () => {
      window.removeEventListener('croce-oro-nuova-release', handleNuovaRelease);
    };
  }, []);

  if (!nuovaVersione) return null;

  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[9999] max-w-sm animate-in slide-in-from-top duration-300">
      <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 border-2 border-amber-400 text-white shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
              Nuova Release Disponibile
            </span>
            <span className="text-xs font-bold text-white block truncate">
              Versione v{nuovaVersione.version}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={inCorso}
            onClick={() => {
              setInCorso(true);
              applicaAggiornamento(nuovaVersione.version, true);
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase flex items-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer border border-emerald-400/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${inCorso ? 'animate-spin' : ''}`} />
            <span>{inCorso ? 'Aggiorno...' : 'Aggiorna Ora'}</span>
          </button>
          <button
            type="button"
            onClick={() => setNuovaVersione(null)}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            title="Ignora per ora"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
