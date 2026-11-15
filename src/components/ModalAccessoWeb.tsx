import React, { useState } from 'react';
import {
  Globe,
  Copy,
  Check,
  X,
  Monitor,
  Laptop,
  ExternalLink,
  ShieldCheck,
  Bookmark,
  Sparkles,
  Info
} from 'lucide-react';

interface ModalAccessoWebProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalAccessoWeb: React.FC<ModalAccessoWebProps> = ({ isOpen, onClose }) => {
  const [copiato, setCopiato] = useState(false);
  const [copiatoVolontario, setCopiatoVolontario] = useState(false);

  if (!isOpen) return null;

  // Ottieni l'indirizzo web corrente dell'applicazione
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://croceoromassacarrara.app';
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://croceoromassacarrara.app';
  const volunteerUrl = `${originUrl}/?view=volontario`;

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleCopiaUrl = async () => {
    await copyToClipboard(originUrl);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 3000);
  };

  const handleCopiaVolontarioUrl = async () => {
    await copyToClipboard(volunteerUrl);
    setCopiatoVolontario(true);
    setTimeout(() => setCopiatoVolontario(false), 3000);
  };

  const handleApriNuovaScheda = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-70 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Intestazione */}
        <div className="bg-gradient-to-r from-sky-950 via-slate-950 to-indigo-950 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-md">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  Accesso Web da Smartphone, Tablet & Computer
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Online 24/7
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Link diretti per collegarsi all'applicazione come Volontario o Centrale
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Chiudi finestra"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Informativo */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Box 1: LINK DEDICATO VOLONTARIO (BORDO MEZZO / TURNI / BACHECA) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-950 border-2 border-amber-500/60 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                🚑 Link Diretto per Volontari (Bordo Mezzo / Turni / Bacheca)
              </span>
              <span className="text-[10px] text-amber-300 font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                Accesso Volontario
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-amber-300 text-xs sm:text-[13px] select-all break-all flex items-center gap-2">
                <span className="select-none">📱</span>
                <span className="truncate">{volunteerUrl}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopiaVolontarioUrl}
                  className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
                    copiatoVolontario
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                  title="Copia il link per i volontari"
                >
                  {copiatoVolontario ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copiato! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copia Link Volontario</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleApriNuovaScheda(volunteerUrl)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  title="Apri link volontario in una nuova scheda"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Apri</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-amber-200/90 leading-snug">
              Invia questo link ai volontari: si apre direttamente sul terminale di bordo, tabellone turni, bacheca avvisi e timbrature GPS.
            </p>
          </div>

          {/* Box 2: INDIRIZZO PRINCIPALE DELL'APPLICAZIONE */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-sky-500/40 shadow-inner space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" />
                Indirizzo Web Generale (Centrale & Selezione Profilo)
              </span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Online & Attivo
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-white text-xs sm:text-[13px] select-all break-all flex items-center gap-2">
                <span className="text-sky-400 select-none">🌐</span>
                <span className="truncate">{originUrl}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopiaUrl}
                  className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
                    copiato
                      ? 'bg-emerald-600 text-white'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                  title="Copia l'indirizzo web generale"
                >
                  {copiato ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copiato! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copia Indirizzo</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleApriNuovaScheda(originUrl)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  title="Apri indirizzo in una nuova scheda del browser"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nuova Scheda</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Permette di accedere alla schermata iniziale di selezione profilo o effettuare l'accesso come Amministratore / Operatore Centrale.
            </p>
          </div>

          {/* Griglia Browser Supportati */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { nome: 'Google Chrome', icon: '🟢', note: 'Consigliato (Windows / Mac / Linux)' },
              { nome: 'Microsoft Edge', icon: '🔵', note: 'Integrato in Windows 10/11' },
              { nome: 'Mozilla Firefox', icon: '🟠', note: 'Desktop & Portatili' },
              { nome: 'Apple Safari', icon: '🧭', note: 'macOS, iPad e MacBook' }
            ].map(b => (
              <div key={b.nome} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span>{b.icon}</span>
                  <span>{b.nome}</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1">{b.note}</span>
              </div>
            ))}
          </div>

          {/* Istruzioni pratiche per l'Amministratore */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Guida Rapida all'Accesso per l'Amministratore
            </h4>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                  1
                </div>
                <div>
                  <strong className="text-white block text-xs">Apri il browser su qualsiasi computer</strong>
                  <span className="text-slate-300 text-[11px] leading-relaxed">
                    Avvia Google Chrome, Microsoft Edge, Firefox o Safari dal computer della sede o dal tuo PC personale. Incolla l'indirizzo web nella barra degli indirizzi e premi <strong>Invio</strong>.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                  2
                </div>
                <div>
                  <strong className="text-white block text-xs">Accesso Riservato Amministratore</strong>
                  <span className="text-slate-300 text-[11px] leading-relaxed">
                    Usa il tuo <strong>PIN Amministratore</strong> per sbloccare la gestione completa: Centrale Operativa, Archivio Volontari e Operatori, Registrazione Vestiario con taglie XXS-XXL, Controllo Scadenza Patenti (alert 7 giorni) e Stampa PDF delle Schede di Consegna firmabili.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                  3
                </div>
                <div>
                  <strong className="text-white block text-xs flex items-center gap-1.5">
                    <Bookmark className="w-3 h-3 text-amber-400" />
                    Salva nei Preferiti o Crea Icona Desktop
                  </strong>
                  <span className="text-slate-300 text-[11px] leading-relaxed">
                    Premi <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-amber-300">Ctrl + D</kbd> (su Windows/Linux) oppure <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-amber-300">Cmd + D</kbd> (su Mac) per aggiungerlo alla barra dei preferiti, oppure clicca sui <strong>tre puntini del browser → Installa applicazione</strong> per creare un'icona desktop dedicata con avvio immediato a tutto schermo.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Box Informativo Compatibilità */}
          <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-sky-200 flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="text-[11px] leading-snug">
              <strong>Interfaccia Full Responsive:</strong> La schermata riconosce automaticamente la risoluzione del computer desktop, organizzando i dati in comode tabelle larghe, schede affiancate e layout ottimizzato per mouse e tastiera.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-3.5 sm:p-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 font-mono truncate">
            {originUrl}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
