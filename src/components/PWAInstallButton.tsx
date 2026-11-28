import React, { useState } from 'react';
import { Download, Smartphone, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../services/pwaUpdater';
import { ModalGuidaInstallazioneApp } from './ModalGuidaInstallazioneApp';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, isChromeIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Se l'app è già installata in standalone (o aperta da icona su Android/Apple), nascondi il pulsante
  // (La guida resta sempre accessibile in Archivio Documenti & SOP e nel menù Strumenti)
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Flusso Android / Desktop con prompt nativo disponibile */}
      {isInstallable && (
        <div className={`inline-flex items-center gap-1 ${className}`}>
          <button
            type="button"
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-400/40"
            title="Installa applicazione Croce Oro sul tuo dispositivo"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Installa App</span>
          </button>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/40 shadow transition-all cursor-pointer"
            title="Apri guida completa installazione (Apple & Android • Chrome & Safari)"
            aria-label="Apri guida installazione app"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Flusso Apple iOS (Safari e Google Chrome iOS) */}
      {isIOS && !isInstallable && (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer border border-blue-400/40 ${className}`}
          title={
            isChromeIOS
              ? 'Guida installazione su iPhone / iPad da Google Chrome'
              : 'Guida installazione su iPhone / iPad da Safari o Chrome'
          }
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>{isChromeIOS ? 'Installa (Chrome iOS)' : 'Installa su Apple'}</span>
        </button>
      )}

      {/* Fallback Browser Android / Web quando beforeinstallprompt non è attivo */}
      {!isIOS && !isInstallable && (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs uppercase shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-400/40 ${className}`}
          title="Guida installazione app su Android e Apple (Chrome e Safari)"
        >
          <Download className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>{isAndroid ? 'Installa su Android' : 'Guida Installazione'}</span>
        </button>
      )}

      <ModalGuidaInstallazioneApp
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </>
  );
};
