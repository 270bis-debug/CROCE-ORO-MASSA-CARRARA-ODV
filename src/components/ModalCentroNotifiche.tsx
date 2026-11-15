import React, { useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  X,
  Search,
  Filter,
  AlertTriangle,
  Radio,
  Megaphone,
  MessageSquare,
  Calendar,
  GraduationCap,
  Info,
  ExternalLink,
  Clock,
  Sparkles,
  Inbox
} from 'lucide-react';
import { NotificaRicevutaAccount, CategoriaNotificaAccount } from '../types/adminTypes';
import { CroceOroLogo } from './CroceOroLogo';

interface ModalCentroNotificheProps {
  aperta: boolean;
  onChiudi: () => void;
  notifiche: NotificaRicevutaAccount[];
  onSegnaComeLetta: (notificaId: string) => void;
  onSegnaTutteComeLette: () => void;
  onAzioneNotifica?: (linkAzione: NotificaRicevutaAccount['linkAzione']) => void;
}

export const ModalCentroNotifiche: React.FC<ModalCentroNotificheProps> = ({
  aperta,
  onChiudi,
  notifiche,
  onSegnaComeLetta,
  onSegnaTutteComeLette,
  onAzioneNotifica
}) => {
  const [filtroCategoria, setFiltroCategoria] = useState<'tutte' | 'non_lette' | CategoriaNotificaAccount>('tutte');
  const [ricerca, setRicerca] = useState('');

  const conteggioNonLette = useMemo(() => {
    return notifiche.filter((n) => !n.letta).length;
  }, [notifiche]);

  const notificheFiltrate = useMemo(() => {
    return notifiche
      .filter((n) => {
        if (filtroCategoria === 'non_lette' && n.letta) return false;
        if (
          filtroCategoria !== 'tutte' &&
          filtroCategoria !== 'non_lette' &&
          n.categoria !== filtroCategoria
        ) {
          return false;
        }
        if (ricerca.trim()) {
          const q = ricerca.toLowerCase().trim();
          const matchTit = n.titolo.toLowerCase().includes(q);
          const matchMsg = n.messaggio.toLowerCase().includes(q);
          if (!matchTit && !matchMsg) return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [notifiche, filtroCategoria, ricerca]);

  if (!aperta) return null;

  const renderIconaCategoria = (cat: CategoriaNotificaAccount) => {
    switch (cat) {
      case 'servizio':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'radio':
        return <Radio className="w-4 h-4 text-blue-400" />;
      case 'bacheca':
        return <Megaphone className="w-4 h-4 text-violet-400" />;
      case 'commento':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'turno':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      case 'corso':
        return <GraduationCap className="w-4 h-4 text-amber-400" />;
      case 'sistema':
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLabelCategoria = (cat: CategoriaNotificaAccount) => {
    switch (cat) {
      case 'servizio':
        return 'Servizio / Missione';
      case 'radio':
        return 'Comunicazione Radio';
      case 'bacheca':
        return 'Bacheca Ufficiale';
      case 'commento':
        return 'Commento Bacheca';
      case 'turno':
        return 'Turno di Servizio';
      case 'corso':
        return 'Formazione & Corsi';
      case 'sistema':
      default:
        return 'Avviso di Sistema';
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border-2 border-violet-500/80 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-4">
        
        {/* ------------------------------------------------------------- */}
        {/* HEADER MODALE CENTRO NOTIFICHE                                */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-violet-500/40 p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-400/50 text-violet-300 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <Bell className="w-6 h-6 text-violet-300" />
              {conteggioNonLette > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white font-black text-[9px] border-2 border-slate-900 animate-pulse">
                  {conteggioNonLette}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-700/60">
                  Centro Notifiche
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  Archivio Permanente (Mai Cancellate)
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide mt-0.5 flex items-center gap-2">
                <span>Registro Storico Notifiche Ricevute</span>
              </h3>
              <p className="text-[11px] text-slate-300">
                {conteggioNonLette > 0 ? (
                  <span className="text-amber-300 font-semibold">
                    Hai <strong>{conteggioNonLette}</strong> {conteggioNonLette === 1 ? 'notifica non letta' : 'notifiche non lette'} su {notifiche.length} archiviate.
                  </span>
                ) : (
                  <span className="text-emerald-300 font-semibold">
                    ✓ Tutte le {notifiche.length} notifiche archiviate risultano già lette.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pulsante Segna tutte come lette */}
            {conteggioNonLette > 0 && (
              <button
                type="button"
                onClick={onSegnaTutteComeLette}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-emerald-400/60"
                title="Segna tutte le notifiche come lette"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Segna Tutte Come Lette</span>
                <span className="sm:hidden">Tutte Lette</span>
              </button>
            )}

            <button
              type="button"
              onClick={onChiudi}
              className="p-2 rounded-xl bg-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
              title="Chiudi centro notifiche"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* BARRA FILTRI CATEGORIA & RICERCA                              */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-900/95 p-3 border-b border-slate-800 space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Input Cerca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca nello storico notifiche..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-1 focus:ring-violet-500 focus:outline-none"
              />
              {ricerca && (
                <button
                  type="button"
                  onClick={() => setRicerca('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Pulsante Segna Tutte (Mobile extra bar se non visibile sopra) */}
            {conteggioNonLette > 0 && (
              <button
                type="button"
                onClick={onSegnaTutteComeLette}
                className="sm:hidden px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Segna {conteggioNonLette} Non Lette Come Lette</span>
              </button>
            )}
          </div>

          {/* Chips Filtro Categoria */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setFiltroCategoria('tutte')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 border ${
                filtroCategoria === 'tutte'
                  ? 'bg-violet-600 text-white border-violet-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <span>Tutte</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900/60 text-[10px] font-black">
                {notifiche.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('non_lette')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 border ${
                filtroCategoria === 'non_lette'
                  ? 'bg-amber-600 text-white border-amber-400'
                  : conteggioNonLette > 0
                  ? 'bg-amber-950/60 text-amber-300 hover:bg-amber-900/80 border-amber-700/60'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
              }`}
            >
              <span>Non Lette</span>
              {conteggioNonLette > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                  {conteggioNonLette}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900/60 text-[10px] font-black">
                  0
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('servizio')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 border ${
                filtroCategoria === 'servizio'
                  ? 'bg-red-700 text-white border-red-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>Servizi</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('radio')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 border ${
                filtroCategoria === 'radio'
                  ? 'bg-blue-700 text-white border-blue-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <Radio className="w-3 h-3 text-blue-400" />
              <span>Radio</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('bacheca')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 border ${
                filtroCategoria === 'bacheca'
                  ? 'bg-violet-700 text-white border-violet-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <Megaphone className="w-3 h-3 text-violet-400" />
              <span>Bacheca</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('commento')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 border ${
                filtroCategoria === 'commento'
                  ? 'bg-purple-700 text-white border-purple-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <MessageSquare className="w-3 h-3 text-purple-400" />
              <span>Commenti</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('turno')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 border ${
                filtroCategoria === 'turno'
                  ? 'bg-emerald-700 text-white border-emerald-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <Calendar className="w-3 h-3 text-emerald-400" />
              <span>Turni</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroCategoria('corso')}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 border ${
                filtroCategoria === 'corso'
                  ? 'bg-amber-700 text-white border-amber-400'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60'
              }`}
            >
              <GraduationCap className="w-3 h-3 text-amber-400" />
              <span>Corsi</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* LISTA NOTIFICHE ARCHIVIATE                                    */}
        {/* ------------------------------------------------------------- */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {notificheFiltrate.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/50 rounded-2xl border-2 border-dashed border-slate-800 text-slate-400 space-y-2">
              <Inbox className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="font-bold text-white text-sm">
                Nessuna notifica trovata in questa sezione
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tutte le notifiche ricevute dal tuo account rimangono salvate perennemente in questo registro senza mai essere cancellate.
              </p>
            </div>
          ) : (
            notificheFiltrate.map((notif) => {
              const isNonLetta = !notif.letta;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (isNonLetta) onSegnaComeLetta(notif.id);
                  }}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isNonLetta
                      ? 'bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border-violet-500/80 shadow-lg shadow-violet-950/40 ring-1 ring-violet-500/40 border-l-4 border-l-amber-400'
                      : 'bg-slate-950/70 border-slate-800/80 opacity-80 hover:opacity-100 hover:border-slate-700'
                  }`}
                >
                  {/* Riga Superiore: Badge Categoria, Stato Letta/Non Letta e Data/Ora */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-bold text-slate-200">
                        {renderIconaCategoria(notif.categoria)}
                        <span>{getLabelCategoria(notif.categoria)}</span>
                      </span>

                      {/* Stato Non Letta vs Già Letta */}
                      {isNonLetta ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9.5px] font-black uppercase flex items-center gap-1 shadow-sm animate-pulse">
                          <Sparkles className="w-3 h-3 fill-slate-950" />
                          <span>Nuova (Non Letta)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 text-[9.5px] font-medium flex items-center gap-1">
                          <Check className="w-3 h-3 text-slate-500" />
                          <span>Già Letta</span>
                        </span>
                      )}

                      {notif.priorita === 'Urgente' && (
                        <span className="px-1.5 py-0.2 rounded-full bg-red-950 text-red-300 border border-red-700 text-[9px] font-black uppercase">
                          Urgente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10.5px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-violet-400" />
                      <span>{notif.dataOra}</span>
                    </div>
                  </div>

                  {/* Corpo Notifica */}
                  <div className="py-2.5 space-y-1">
                    <h4
                      className={`text-xs sm:text-sm font-bold tracking-wide ${
                        isNonLetta ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {notif.titolo}
                    </h4>
                    <p
                      className={`text-xs leading-relaxed whitespace-pre-line ${
                        isNonLetta ? 'text-slate-200 font-normal' : 'text-slate-400 font-normal'
                      }`}
                    >
                      {notif.messaggio}
                    </p>
                  </div>

                  {/* Azioni in basso: Segna come Letta manuale e Link Azione rapida */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs">
                    <div>
                      {isNonLetta ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSegnaComeLetta(notif.id);
                          }}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Clicca per segnare come già letta</span>
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-slate-500 font-medium">
                          Archiviata in modo permanente
                        </span>
                      )}
                    </div>

                    {notif.linkAzione && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isNonLetta) onSegnaComeLetta(notif.id);
                          onChiudi();
                          onAzioneNotifica?.(notif.linkAzione);
                        }}
                        className="px-3 py-1 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer transition-all shadow-sm active:scale-95"
                      >
                        <span>
                          {notif.linkAzione.tipo === 'bacheca'
                            ? 'Apri Bacheca'
                            : notif.linkAzione.tipo === 'turno'
                            ? 'Vedi Turno'
                            : notif.linkAzione.tipo === 'corso'
                            ? 'Vedi Corso'
                            : notif.linkAzione.tipo === 'radio'
                            ? 'Ascolta Radio'
                            : 'Visualizza'}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* FOOTER MODALE                                                 */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-950 p-3 sm:p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <CroceOroLogo size="sm" className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">
              Registro Storico Permanente Notifiche • Croce Oro Massa Carrara OdV
            </span>
          </div>

          <div className="flex items-center gap-2">
            {conteggioNonLette > 0 && (
              <button
                type="button"
                onClick={onSegnaTutteComeLette}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase cursor-pointer transition-all shadow-sm"
              >
                Segna Tutte Come Lette ({conteggioNonLette})
              </button>
            )}

            <button
              type="button"
              onClick={onChiudi}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
