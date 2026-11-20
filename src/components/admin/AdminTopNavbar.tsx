import React, { useState, useEffect } from 'react';
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
      className="bg-slate-950/95 border-b border-slate-800 px-2 sm:px-4 py-1.5 shadow-md w-full max-w-full relative z-30"
    >
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2 w-full min-w-0">
        {/* TUTTI I DATABASE DIRETTI IN 1 RIGA (desktop) O MASSIMO 2 RIGHE (mobile/tablet) — SENZA MENÙ A TENDINA E SENZA PULSANTI HOME */}
        <div className={`grid ${gridColsClass} gap-1 flex-1 min-w-0`}>
          {tabsVisibili.map((tab) => {
            const Icona = tab.icona;
            const isAttivo = currentSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSection(tab.id)}
                title={`${tab.numero}. ${tab.label}`}
                className={`px-1 sm:px-2 py-1.5 sm:py-1.5 rounded-lg font-bold uppercase flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 min-w-0 transition-all cursor-pointer border active:scale-95 ${
                  isAttivo
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icona className="w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0" />
                <span className="text-[9px] sm:text-[10px] leading-none truncate max-w-full">
                  {tab.label}
                </span>
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
