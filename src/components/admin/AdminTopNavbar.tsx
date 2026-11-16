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
    <div className="bg-slate-950/95 backdrop-blur-md border-b-2 border-slate-800 sticky top-0 z-40 px-3 sm:px-5 py-2 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">

        {/* Riga Superiore: Brand & Azioni Profilo */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <CroceOroLogo size="sm" className="shrink-0" />
            <div className="text-left leading-tight">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Croce Oro Massa Carrara</span>
              <span className="text-xs font-black text-white block">Gestionale Amministratore</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onApriSyncServer && (
              <button
                type="button"
                onClick={onApriSyncServer}
                className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95 group"
                title="Salva e sincronizza i dati sui 10 GB di spazio del dominio www.croceoro.org"
              >
                <Server className="w-3.5 h-3.5 text-amber-400 group-hover:text-slate-950" />
                <span className="hidden sm:inline">Backup Server (10 GB)</span>
                <span className="sm:hidden">10 GB</span>
              </button>
            )}

            <div className="text-right hidden sm:block leading-tight">
              <div className="text-[9px] uppercase font-bold text-slate-400">
                {isPresidente ? 'Presidente' : (!isAdmin ? 'Operatore Delegato' : 'Amministratore')}
              </div>
              <div className="text-xs font-black text-amber-400 truncate max-w-[160px]">
                {operatoreNome}
              </div>
            </div>

            {onSwitchToSmartphone && (
              <button
                type="button"
                onClick={onSwitchToSmartphone}
                className="px-2.5 py-1 rounded-xl bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Passa ad Accesso Volontario"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Accesso Volontario</span>
              </button>
            )}
          </div>
        </div>

        {/* Riga/e Navigazione Rapida: Portale Scelte + Tutte le Macro Categorie su più righe se necessario */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/70">
          <button
            type="button"
            onClick={() => onSelectSection('dashboard')}
            className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase flex items-center gap-1.5 transition-all cursor-pointer border shadow-md active:scale-95 shrink-0 ${
              currentSection === 'dashboard'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-amber-500/40 hover:border-amber-400'
            }`}
            title={`Torna alla schermata principale con le ${numeroScelteVisibili} macro scelte`}
          >
            <Grid className="w-3.5 h-3.5 shrink-0" />
            <span className="tracking-wide whitespace-nowrap">Portale {numeroScelteVisibili} Scelte</span>
          </button>

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
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black'
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

      </div>
    </div>
  );
};
