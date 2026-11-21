import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  Grid,
  Headphones,
  Users,
  Ambulance,
  Receipt,
  GraduationCap,
  Package,
  Building2,
  Calendar,
  Megaphone,
  BookUser
} from 'lucide-react';
import { AdminSectionId } from './AdminPortalDashboard';
import { LISTA_MACRO_CATEGORIE, getNomiDatabaseCustom, getTitoloDatabase } from '../../constants/macroCategorie';

interface AdminTopNavbarProps {
  currentSection: AdminSectionId;
  onSelectSection: (section: AdminSectionId) => void;
  operatoreNome: string;
  isPresidente?: boolean;
  isAdmin?: boolean;
  allowedSections?: AdminSectionId[];
  onLogout?: () => void;
  onSwitchToSmartphone?: () => void;
  onApriSyncServer?: () => void;
  onApriTimbraturaCentrale?: () => void;
  timbraturaCentraleAttiva?: boolean;
}

const GRID_COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-3 lg:grid-cols-6',
  7: 'grid-cols-4 lg:grid-cols-7',
  8: 'grid-cols-4 lg:grid-cols-8',
  9: 'grid-cols-5 xl:grid-cols-9',
  10: 'grid-cols-5 xl:grid-cols-10'
};

// Scala progressiva di dimensioni e crenatura per adattamento automatico del nome DB all'icona
const AUTO_FIT_FONT_CLASSES = [
  'text-[10.5px] tracking-normal',
  'text-[10px] tracking-normal',
  'text-[9.5px] tracking-tight',
  'text-[9px] tracking-tight',
  'text-[8.5px] tracking-tight',
  'text-[8px] tracking-tighter',
  'text-[7.5px] tracking-tighter',
  'text-[7px] tracking-tighter',
  'text-[6.5px] tracking-tighter',
  'text-[6px] tracking-tighter'
] as const;

interface AutoFitDatabaseLabelProps {
  label: string;
  layoutKey: number;
}

/**
 * Regola di auto-adattamento del nome del Database nell'icona in alto:
 * - Nome composto da 1 sola parola: resta sempre intero su una sola riga senza mai troncare con "...".
 * - Nome composto da più parole: va a capo naturalmente su una 2ª riga (e all'occorrenza su una 3ª)
 *   senza spezzare le parole e adattando la dimensione del testo allo spazio disponibile.
 */
const AutoFitDatabaseLabel: React.FC<AutoFitDatabaseLabelProps> = ({ label, layoutKey }) => {
  const normalizedLabel = label.trim().replace(/\s+/g, ' ');
  const words = normalizedLabel.split(' ').filter(Boolean);
  const isSingleWord = words.length <= 1;

  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [sizeIdx, setSizeIdx] = useState<number>(1);
  const [fallbackBreakWord, setFallbackBreakWord] = useState<boolean>(false);

  const computeBestFit = useCallback(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const availWidth = box.clientWidth;
    if (availWidth <= 0) return;

    const baseClass = isSingleWord
      ? 'inline-block text-center leading-none whitespace-nowrap'
      : 'block w-full text-center leading-[1.12] whitespace-normal break-normal';

    let best = AUTO_FIT_FONT_CLASSES.length - 1;
    let fittedWithoutBreak = false;

    for (let i = 0; i < AUTO_FIT_FONT_CLASSES.length; i += 1) {
      text.className = `${baseClass} ${AUTO_FIT_FONT_CLASSES[i]}`;
      const fitsWidth = text.scrollWidth <= availWidth + 0.5;
      if (isSingleWord) {
        if (fitsWidth) {
          best = i;
          fittedWithoutBreak = true;
          break;
        }
      } else {
        const computed = window.getComputedStyle(text);
        const fontSizePx = parseFloat(computed.fontSize) || 8;
        const lineHeightPx = parseFloat(computed.lineHeight) || fontSizePx * 1.15;
        const maxThreeLinesHeight = lineHeightPx * 3.25;
        const fitsHeight = text.scrollHeight <= maxThreeLinesHeight;
        if (fitsWidth && fitsHeight) {
          best = i;
          fittedWithoutBreak = true;
          break;
        }
      }
    }

    const useBreakFallback = !isSingleWord && !fittedWithoutBreak;
    const finalBase = useBreakFallback
      ? 'block w-full text-center leading-[1.12] whitespace-normal break-words'
      : baseClass;

    text.className = `${finalBase} ${AUTO_FIT_FONT_CLASSES[best]}`;
    setSizeIdx((prev) => (prev === best ? prev : best));
    setFallbackBreakWord((prev) => (prev === useBreakFallback ? prev : useBreakFallback));
  }, [isSingleWord]);

  useLayoutEffect(() => {
    computeBestFit();
  }, [normalizedLabel, layoutKey, computeBestFit]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let rafId: number | null = null;
    const schedule = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        computeBestFit();
      });
    };

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(box);
    window.addEventListener('resize', schedule);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [computeBestFit]);

  const baseClass = isSingleWord
    ? 'inline-block text-center leading-none whitespace-nowrap'
    : fallbackBreakWord
      ? 'block w-full text-center leading-[1.12] whitespace-normal break-words'
      : 'block w-full text-center leading-[1.12] whitespace-normal break-normal';

  return (
    <div ref={boxRef} className="w-full min-w-0 flex items-center justify-center">
      <span ref={textRef} className={`${baseClass} ${AUTO_FIT_FONT_CLASSES[sizeIdx]}`}>
        {normalizedLabel}
      </span>
    </div>
  );
};

export const AdminTopNavbar: React.FC<AdminTopNavbarProps> = ({
  currentSection,
  onSelectSection,
  operatoreNome,
  isPresidente,
  isAdmin = true,
  allowedSections
}) => {
  const tabMetaMap: Record<string, { label: string; icona: React.ComponentType<{ className?: string }> }> = {
    centrale: { label: 'Centrale', icona: Headphones },
    volontari: { label: 'Volontari', icona: Users },
    mezzi: { label: 'Mezzi', icona: Ambulance },
    contabilita: { label: 'Contabilità', icona: Receipt },
    formazione: { label: 'Formazione', icona: GraduationCap },
    magazzino: { label: 'Magazzino', icona: Package },
    sedi: { label: 'Sedi', icona: Building2 },
    turni: { label: 'Turni', icona: Calendar },
    bacheca: { label: 'Bacheca', icona: Megaphone },
    contatti: { label: 'Contatti', icona: BookUser }
  };

  const [nomiDatabaseCustom, setNomiDatabaseCustom] = useState<Record<string, string>>(() => getNomiDatabaseCustom());

  useEffect(() => {
    const refresh = () => setNomiDatabaseCustom(getNomiDatabaseCustom());
    window.addEventListener('croceoro_nomi_db_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('croceoro_nomi_db_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const tabs = React.useMemo(
    () =>
      LISTA_MACRO_CATEGORIE.map((cat, idx) => ({
        id: cat.id as AdminSectionId,
        numero: String(idx + 1),
        label: getTitoloDatabase(cat.id, tabMetaMap[cat.id]?.label || cat.titolo, nomiDatabaseCustom),
        icona: tabMetaMap[cat.id]?.icona || Grid
      })),
    [nomiDatabaseCustom]
  );

  const tabsVisibili = React.useMemo(() => {
    if (isAdmin || !allowedSections || allowedSections.length === 0) {
      return tabs;
    }
    return tabs.filter(t => allowedSections.includes(t.id));
  }, [tabs, isAdmin, allowedSections]);

  const gridColsClass = GRID_COLS_CLASS[tabsVisibili.length] || 'grid-cols-5 xl:grid-cols-10';

  return (
    <nav
      aria-label="Navigazione database gestionali"
      className="bg-slate-950/95 border-b border-slate-800 px-1.5 sm:px-4 py-1.5 shadow-md w-full max-w-full relative z-30"
    >
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2 w-full min-w-0">
        {/* TUTTI I DATABASE DIRETTI IN 1 RIGA (desktop) O MASSIMO 2 RIGHE (mobile/tablet) CON AUTO-ADATTAMENTO DEL NOME */}
        <div className={`grid ${gridColsClass} gap-1 flex-1 min-w-0 items-stretch`}>
          {tabsVisibili.map((tab) => {
            const Icona = tab.icona;
            const isAttivo = currentSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSection(tab.id)}
                title={`${tab.numero}. ${tab.label}`}
                className={`px-1 sm:px-1.5 py-1.5 rounded-lg font-bold uppercase flex flex-col items-center justify-center gap-1 min-w-0 h-full transition-all cursor-pointer border active:scale-95 ${
                  isAttivo
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icona className="w-3.5 h-3.5 shrink-0" />
                <AutoFitDatabaseLabel label={tab.label} layoutKey={tabsVisibili.length} />
              </button>
            );
          })}
        </div>

        <div className="hidden 2xl:block text-right leading-tight shrink-0 pl-2 border-l border-slate-800">
          <div className="text-[9px] uppercase font-bold text-slate-400 whitespace-nowrap">
            {isPresidente ? 'Presidente' : (!isAdmin ? 'Operatore Delegato' : 'Amministratore')}
          </div>
          <div className="text-[11px] font-black text-amber-400 truncate max-w-[140px]">
            {operatoreNome}
          </div>
        </div>
      </div>
    </nav>
  );
};
