import React, { useState } from 'react';
import {
  Headphones,
  Users,
  Ambulance,
  Receipt,
  GraduationCap,
  Package,
  Building2,
  Calendar,
  ArrowRight,
  Shield,
  AlertTriangle,
  Megaphone,
  BookUser,
  Wrench,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { MezzoFlotta, InterventoManutenzione } from '../../types/adminTypes';
import { calcolaManutenzioniInScadenza } from '../../utils/avvisiManutenzioneMezzi';
import { MonitoraggioFlotta } from './MonitoraggioFlotta';
import { LISTA_MACRO_CATEGORIE, getNomiDatabaseCustom, getTitoloDatabase } from '../../constants/macroCategorie';

export type AdminSectionId =
  | 'dashboard'
  | 'centrale'
  | 'volontari'
  | 'mezzi'
  | 'contabilita'
  | 'formazione'
  | 'magazzino'
  | 'sedi'
  | 'turni'
  | 'bacheca'
  | 'contatti';

interface AdminPortalDashboardProps {
  onSelectSection: (section: AdminSectionId) => void;
  operatoreNome: string;
  isPresidente?: boolean;
  isAdmin?: boolean;
  allowedSections?: AdminSectionId[];
  onApriSyncServer?: () => void;
  conteggioServiziArchivio: number;
  conteggioVolontari: number;
  conteggioMezzi: number;
  conteggioMezziFuoriServizio: number;
  conteggioDonazioni: number;
  conteggioCorsi: number;
  conteggioSedi: number;
  conteggioTurniOggi: number;
  conteggioComunicazioni?: number;
  conteggioContatti?: number;
  mezziFlotta?: MezzoFlotta[];
  manutenzioni?: InterventoManutenzione[];
  serviziArchivio?: any[];
}

export const AdminPortalDashboard: React.FC<AdminPortalDashboardProps> = ({
  onSelectSection,
  operatoreNome,
  isPresidente,
  isAdmin = true,
  allowedSections,
  conteggioServiziArchivio,
  conteggioVolontari,
  conteggioMezzi,
  conteggioMezziFuoriServizio,
  conteggioDonazioni,
  conteggioCorsi,
  conteggioSedi,
  conteggioTurniOggi,
  conteggioComunicazioni = 3,
  conteggioContatti = 11,
  mezziFlotta = [],
  manutenzioni = [],
  serviziArchivio = []
}) => {
  const [vistaAttiva, setVistaAttiva] = useState<'macro' | 'monitoraggio_flotta'>('macro');
  const [avvisiAperti, setAvvisiAperti] = useState(false);
  const [nomiDatabaseCustom, setNomiDatabaseCustom] = useState<Record<string, string>>(() => getNomiDatabaseCustom());

  React.useEffect(() => {
    const refresh = () => setNomiDatabaseCustom(getNomiDatabaseCustom());
    window.addEventListener('croceoro_nomi_db_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('croceoro_nomi_db_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Calcolo automatico avvisi manutenzione programmata e scadenze flotta entro 30 giorni
  const avvisiManutenzione = React.useMemo(() => {
    return calcolaManutenzioniInScadenza(mezziFlotta, manutenzioni, 30);
  }, [mezziFlotta, manutenzioni]);

  const sezioni = [
    {
      id: 'centrale' as AdminSectionId,
      numero: '1',
      titolo: 'Operatore Centrale',
      sottotitolo: 'Missioni, GPS & Archivio Servizi',
      icona: Headphones,
      coloreBg: 'bg-emerald-500/15',
      coloreBordo: 'border-emerald-500/40 hover:border-emerald-400',
      coloreTesto: 'text-emerald-400',
      coloreGradiente: 'from-emerald-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioServiziArchivio),
      statLabel: 'Servizi'
    },
    {
      id: 'volontari' as AdminSectionId,
      numero: '2',
      titolo: 'Database Volontari',
      sottotitolo: 'Anagrafiche, PIN & Timbrature',
      icona: Users,
      coloreBg: 'bg-blue-500/15',
      coloreBordo: 'border-blue-500/40 hover:border-blue-400',
      coloreTesto: 'text-blue-400',
      coloreGradiente: 'from-blue-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioVolontari),
      statLabel: 'Volontari'
    },
    {
      id: 'mezzi' as AdminSectionId,
      numero: '3',
      titolo: 'Mezzi & Flotta',
      sottotitolo: 'Autoparco, Manutenzioni & Bordo',
      icona: Ambulance,
      coloreBg: 'bg-amber-500/15',
      coloreBordo: 'border-amber-500/40 hover:border-amber-400',
      coloreTesto: 'text-amber-400',
      coloreGradiente: 'from-amber-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioMezzi),
      statLabel: conteggioMezziFuoriServizio > 0 ? `${conteggioMezziFuoriServizio} Fuori Serv.` : 'Operativi'
    },
    {
      id: 'contabilita' as AdminSectionId,
      numero: '4',
      titolo: 'Contabilità',
      sottotitolo: 'Donazioni, Tessere & Note Debito',
      icona: Receipt,
      coloreBg: 'bg-purple-500/15',
      coloreBordo: 'border-purple-500/40 hover:border-purple-400',
      coloreTesto: 'text-purple-400',
      coloreGradiente: 'from-purple-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioDonazioni),
      statLabel: 'Donazioni'
    },
    {
      id: 'formazione' as AdminSectionId,
      numero: '5',
      titolo: 'Formazione / Corsi',
      sottotitolo: 'Corsi, Presenze & Attestati PDF',
      icona: GraduationCap,
      coloreBg: 'bg-indigo-500/15',
      coloreBordo: 'border-indigo-500/40 hover:border-indigo-400',
      coloreTesto: 'text-indigo-400',
      coloreGradiente: 'from-indigo-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioCorsi),
      statLabel: 'Corsi'
    },
    {
      id: 'magazzino' as AdminSectionId,
      numero: '6',
      titolo: 'Vestiario & DPI',
      sottotitolo: 'Divise, Radio & Attrezzature',
      icona: Package,
      coloreBg: 'bg-cyan-500/15',
      coloreBordo: 'border-cyan-500/40 hover:border-cyan-400',
      coloreTesto: 'text-cyan-400',
      coloreGradiente: 'from-cyan-600/15 via-slate-900 to-slate-950',
      statNumero: 'H24',
      statLabel: 'Giacenze'
    },
    {
      id: 'sedi' as AdminSectionId,
      numero: '7',
      titolo: 'Sedi Associative',
      sottotitolo: 'Sedi, Sezioni & Dotazioni Locali',
      icona: Building2,
      coloreBg: 'bg-rose-500/15',
      coloreBordo: 'border-rose-500/40 hover:border-rose-400',
      coloreTesto: 'text-rose-400',
      coloreGradiente: 'from-rose-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioSedi),
      statLabel: 'Sedi'
    },
    {
      id: 'turni' as AdminSectionId,
      numero: '8',
      titolo: 'Calendario Turni',
      sottotitolo: 'Pianificazione & Coperture Sedi',
      icona: Calendar,
      coloreBg: 'bg-teal-500/15',
      coloreBordo: 'border-teal-500/40 hover:border-teal-400',
      coloreTesto: 'text-teal-400',
      coloreGradiente: 'from-teal-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioTurniOggi),
      statLabel: 'Turni'
    },
    {
      id: 'bacheca' as AdminSectionId,
      numero: '9',
      titolo: 'Bacheca di Sezione',
      sottotitolo: 'Avvisi, Circolari & Corsi Attivi',
      icona: Megaphone,
      coloreBg: 'bg-violet-500/15',
      coloreBordo: 'border-violet-500/40 hover:border-violet-400',
      coloreTesto: 'text-violet-400',
      coloreGradiente: 'from-violet-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioComunicazioni),
      statLabel: 'Avvisi'
    },
    {
      id: 'contatti' as AdminSectionId,
      numero: '10',
      titolo: 'Contatti & Enti',
      sottotitolo: 'Fornitori, Officine & Donatori',
      icona: BookUser,
      coloreBg: 'bg-amber-500/15',
      coloreBordo: 'border-amber-500/40 hover:border-amber-400',
      coloreTesto: 'text-amber-400',
      coloreGradiente: 'from-amber-600/15 via-slate-900 to-slate-950',
      statNumero: String(conteggioContatti),
      statLabel: 'Contatti'
    }
  ];

  // Allinea e numera automaticamente le macro categorie in base a LISTA_MACRO_CATEGORIE + eventuali nomi personalizzati
  const sezioniAttive = React.useMemo(() => {
    const byId = new Map(sezioni.map(s => [s.id, s]));
    return LISTA_MACRO_CATEGORIE.map((cat, idx) => {
      const card = byId.get(cat.id as AdminSectionId);
      if (card) {
        return {
          ...card,
          titolo: getTitoloDatabase(cat.id, card.titolo, nomiDatabaseCustom),
          numero: String(idx + 1)
        };
      }
      return {
        id: cat.id as AdminSectionId,
        numero: String(idx + 1),
        titolo: getTitoloDatabase(cat.id, cat.titolo, nomiDatabaseCustom),
        sottotitolo: cat.sottotitolo,
        icona: Shield,
        coloreBg: 'bg-slate-500/15',
        coloreBordo: 'border-slate-500/40 hover:border-slate-400',
        coloreTesto: 'text-slate-300',
        coloreGradiente: 'from-slate-600/15 via-slate-900 to-slate-950',
        statNumero: 'OK',
        statLabel: 'Attiva'
      };
    });
  }, [sezioni, nomiDatabaseCustom]);

  // Filtra le sezioni disponibili in base ai permessi delegati
  const sezioniVisibili = React.useMemo(() => {
    if (isAdmin || !allowedSections || allowedSections.length === 0) {
      return sezioniAttive;
    }
    return sezioniAttive.filter(s => allowedSections.includes(s.id));
  }, [sezioniAttive, isAdmin, allowedSections]);

  return (
    <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-2 sm:gap-2.5 flex-1 justify-between animate-in fade-in duration-200 min-h-0">

      {/* Barra Intestazione Portale Super-Compatta (Adattiva Mobile / Tablet / Desktop) */}
      <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border border-[#bfa353]/50 rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 shadow-lg flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex items-center gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase leading-tight truncate">
                {!isAdmin ? 'Portale Operativo Delegato' : 'Portale Gestionale'}
              </h1>
              <span className="text-[10px] text-amber-300 font-bold hidden sm:inline whitespace-nowrap">
                · {operatoreNome} ({isPresidente ? 'Presidente' : (!isAdmin ? 'Delegato' : 'Amministratore')})
              </span>
            </div>
            <p className="text-[10px] text-slate-300 sm:hidden truncate">
              {operatoreNome} · {isPresidente ? 'Presidente' : (!isAdmin ? 'Delegato' : 'Admin')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Switch Viste: Macro Categorie vs Monitoraggio Flotta */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950/90 border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setVistaAttiva('macro')}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                vistaAttiva === 'macro'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3 h-3 shrink-0" />
              <span>Scelte ({sezioniVisibili.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setVistaAttiva('monitoraggio_flotta')}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                vistaAttiva === 'monitoraggio_flotta'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">Monitoraggio Flotta</span>
              <span className="sm:hidden">Flotta KM</span>
            </button>
          </div>

          {/* Indicatore compatto Manutenzioni in Scadenza (apre menù a tendina se presenti) */}
          {avvisiManutenzione.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAvvisiAperti(prev => !prev)}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-300 font-black text-[10px] sm:text-[11px] uppercase flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Visualizza manutenzioni mezzi in scadenza entro 30 giorni"
              >
                <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="tabular-nums">{avvisiManutenzione.length}</span>
                <span className="hidden md:inline">Scadenze Mezzi</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${avvisiAperti ? 'rotate-180' : ''}`} />
              </button>

              {avvisiAperti && (
                <div className="absolute right-0 mt-1.5 w-72 sm:w-80 bg-slate-950 border-2 border-amber-500 rounded-xl shadow-2xl p-2.5 z-50 max-h-[60dvh] overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
                    <span className="text-[11px] font-black uppercase text-amber-300">
                      Manutenzioni / Scadenze (30 gg)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAvvisiAperti(false);
                        onSelectSection('mezzi');
                      }}
                      className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950 cursor-pointer"
                    >
                      Gestisci
                    </button>
                  </div>
                  {avvisiManutenzione.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => {
                        setAvvisiAperti(false);
                        onSelectSection('mezzi');
                      }}
                      className="w-full text-left bg-slate-900 hover:bg-slate-800 p-2 rounded-lg border border-amber-500/30 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-black text-amber-400 truncate">
                          {alert.mezzoSigla} {alert.targa ? `· ${alert.targa}` : ''}
                        </div>
                        <div className="text-[11px] font-bold text-white truncate">{alert.tipo}</div>
                        <div className="text-[10px] text-slate-400">Scad. {alert.dataScadenza}</div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase font-mono shrink-0 ${
                          alert.scaduta
                            ? 'bg-rose-950 text-rose-300 border border-rose-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                        }`}
                      >
                        {alert.scaduta ? 'SCADUTA' : `${alert.giorniRimanenti}g`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CONTENUTO PRINCIPALE: MONITORAGGIO FLOTTA OPPURE GRIGLIA COMPATTA DELLE 10 SCELTE */}
      {vistaAttiva === 'monitoraggio_flotta' ? (
        <div className="space-y-2.5 flex-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVistaAttiva('macro')}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Torna alle {sezioniVisibili.length} Macro Categorie</span>
            </button>
          </div>

          <MonitoraggioFlotta
            mezzi={mezziFlotta}
            serviziArchivio={serviziArchivio}
            manutenzioni={manutenzioni}
            onSelezionaMezzo={() => onSelectSection('mezzi')}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {!isAdmin && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-200 text-[11px] flex items-center justify-between gap-2 shrink-0">
              <span className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate font-semibold">
                  Accesso Delegato: inserimenti e modifiche attivi (eliminazione riservata ad Admin).
                </span>
              </span>
              <span className="font-mono font-black text-amber-300 shrink-0 whitespace-nowrap">
                {sezioniVisibili.length} Sezioni
              </span>
            </div>
          )}

          {/* GRIGLIA ADATTIVA TUTTO-IN-SCHERMATA:
              - Mobile (< sm): 2 colonne x 5 righe compatte (tutte le 10 scelte visibili senza scroll!)
              - Tablet verticale (sm): 3 colonne
              - Tablet orizzontale & Desktop (md / lg): 5 colonne x 2 righe (tutte le 10 scelte in 1 schermata!) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2.5 lg:gap-3 flex-1 auto-rows-fr">
            {sezioniVisibili.map((sez) => {
              const Icona = sez.icona;
              return (
                <button
                  key={sez.id}
                  type="button"
                  onClick={() => onSelectSection(sez.id)}
                  className={`group text-left bg-gradient-to-b ${sez.coloreGradiente} border ${sez.coloreBordo} rounded-xl sm:rounded-2xl p-2 sm:p-3 lg:p-4 shadow-md hover:shadow-xl transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2.5 min-h-[76px] sm:min-h-[120px] lg:min-h-[168px] overflow-hidden`}
                >
                  {/* Top row: Numero + Icona + Conteggio numerico tabellare */}
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl ${sez.coloreBg} border ${sez.coloreBordo} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <Icona className={`w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5 ${sez.coloreTesto}`} />
                      </div>
                      <span className="text-[10px] sm:text-xs font-mono font-black text-slate-400 tabular-nums shrink-0">
                        #{sez.numero}
                      </span>
                    </div>

                    <div className="text-right leading-none shrink-0">
                      <div className={`text-xs sm:text-base lg:text-lg font-mono font-black tabular-nums ${sez.coloreTesto}`}>
                        {sez.statNumero}
                      </div>
                      <div className="text-[8.5px] sm:text-[10px] text-slate-400 font-semibold truncate max-w-[68px] hidden sm:block">
                        {sez.statLabel}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Titolo & Sottotitolo compatto */}
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <h3 className="text-[11px] sm:text-xs lg:text-sm font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-tight leading-tight line-clamp-2">
                      {sez.titolo}
                    </h3>
                    <p className="text-[9.5px] sm:text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-1 sm:line-clamp-2">
                      {sez.sottotitolo}
                    </p>
                  </div>

                  {/* Footer (su tablet/desktop mostra azione rapida Accedi) */}
                  <div className="hidden sm:flex items-center justify-between pt-1.5 border-t border-slate-800/70 w-full">
                    <span className="text-[10px] font-bold text-slate-400 truncate">
                      {sez.statLabel}
                    </span>
                    <span className={`text-[10px] lg:text-[11px] font-black uppercase flex items-center gap-0.5 ${sez.coloreTesto} shrink-0`}>
                      <span>Apri</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
