import React from 'react';
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
  Shield,
  Smartphone,
  Radio,
  ChevronRight,
  Megaphone,
  BookUser,
  Server
} from 'lucide-react';
import { CroceOroLogo } from '../CroceOroLogo';
import { AdminSectionId } from './AdminPortalDashboard';
import { LISTA_MACRO_CATEGORIE } from '../../constants/macroCategorie';

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
}

export const AdminTopNavbar: React.FC<AdminTopNavbarProps> = ({
  currentSection,
  onSelectSection,
  operatoreNome,
  isPresidente,
  isAdmin = true,
  allowedSections,
  onSwitchToSmartphone,
  onApriSyncServer
}) => {
  const tabMetaMap: Record<string, { label: string; icona: any }> = {
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

  const tabs: { id: AdminSectionId; numero: string; label: string; icona: any }[] = React.useMemo(
    () =>
      LISTA_MACRO_CATEGORIE.map((cat, idx) => ({
        id: cat.id as AdminSectionId,
        numero: String(idx + 1),
        label: tabMetaMap[cat.id]?.label || cat.titolo,
        icona: tabMetaMap[cat.id]?.icona || Grid
      })),
    []
  );

  const tabsVisibili = React.useMemo(() => {
    if (isAdmin || !allowedSections || allowedSections.length === 0) {
      return tabs;
    }
    return tabs.filter(t => allowedSections.includes(t.id));
  }, [tabs, isAdmin, allowedSections]);

  const numeroScelteVisibili = isAdmin ? tabs.length : tabsVisibili.length;

  return (
    <div className="bg-slate-950/95 backdrop-blur-md border-b-2 border-slate-800 sticky top-0 z-40 px-3 sm:px-6 py-2.5 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Bottone Ritorno al Portale */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-start">
          <button
            type="button"
            onClick={() => onSelectSection('dashboard')}
            className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer border shadow-md active:scale-95 ${
              currentSection === 'dashboard'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-amber-500/40 hover:border-amber-400'
            }`}
            title={`Torna alla schermata principale con le ${numeroScelteVisibili} macro scelte`}
          >
            <Grid className="w-4 h-4" />
            <span className="tracking-wide">Portale {numeroScelteVisibili} Scelte</span>
          </button>

          <div className="flex items-center gap-2">
            <CroceOroLogo size="sm" className="hidden sm:block" />
            <div className="hidden lg:block text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Croce Oro Massa Carrara</span>
              <span className="text-xs font-black text-white leading-tight">Gestionale Amministratore</span>
            </div>
          </div>

          {/* Versione Mobile Logout & Server Sync */}
          <div className="flex md:hidden items-center gap-1.5">
            {onApriSyncServer && (
              <button
                type="button"
                onClick={onApriSyncServer}
                className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40"
                title="Salva e sincronizza i dati sul dominio www.croceoro.org (10 GB)"
              >
                <Server className="w-4 h-4" />
              </button>
            )}
            {onSwitchToSmartphone && (
              <button
                type="button"
                onClick={onSwitchToSmartphone}
                className="px-2 py-1 rounded-lg bg-blue-900/60 text-blue-200 border border-blue-700/60 flex items-center gap-1 text-[10px] font-bold"
                title="Passa ad Accesso Volontario"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Accesso Volontario</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra di Navigazione Rapida per le Macro Categorie */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {tabsVisibili.map((tab) => {
            const Icona = tab.icona;
            const isAttivo = currentSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSection(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] uppercase flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 border ${
                  isAttivo
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black scale-105'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${
                  isAttivo ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.numero}
                </span>
                <Icona className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Profilo Operatore & Azioni Desktop */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {onApriSyncServer && (
            <button
              type="button"
              onClick={onApriSyncServer}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95 group"
              title="Salva e sincronizza i dati sui 10 GB di spazio del dominio www.croceoro.org"
            >
              <Server className="w-3.5 h-3.5 text-amber-400 group-hover:text-slate-950" />
              <span className="hidden xl:inline">Backup Server (10 GB)</span>
              <span className="xl:hidden">10 GB</span>
            </button>
          )}

          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              {isPresidente ? 'Presidente' : (!isAdmin ? 'Operatore Delegato' : 'Amministratore')}
            </div>
            <div className="text-xs font-black text-amber-400 truncate max-w-[150px]">
              {operatoreNome}
            </div>
          </div>

          {onSwitchToSmartphone && (
            <button
              type="button"
              onClick={onSwitchToSmartphone}
              className="px-2.5 py-1.5 rounded-xl bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Passa ad Accesso Volontario"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Accesso Volontario</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
