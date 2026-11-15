import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Sparkles, HelpCircle, Car, Wrench, CheckCircle2 } from 'lucide-react';
import {
  FLOTTA_SUGGERIMENTI,
  SuggerimentoMezzo,
  MezzoFuoriServizio,
  MOTIVI_FUORI_SERVIZIO_LABELS
} from '../data/suggerimentiMezzi';

interface GuidaMezziCentraleProps {
  mezzoSelezionato: string;
  mezzoConsigliato?: string;
  onSelezionaMezzo: (sigla: string) => void;
  ambitoCorrente?: string;
  mezziFuoriServizio?: Record<string, MezzoFuoriServizio>;
  onApriGestioneStatoFlotta?: () => void;
}

export const GuidaMezziCentrale: React.FC<GuidaMezziCentraleProps> = ({
  mezzoSelezionato,
  mezzoConsigliato,
  onSelezionaMezzo,
  ambitoCorrente,
  mezziFuoriServizio = {},
  onApriGestioneStatoFlotta
}) => {
  const [aperto, setAperto] = useState<boolean>(true);
  const [filtroFlotta, setFiltroFlotta] = useState<'tutti' | 'vet' | 'pc'>(() => {
    if (ambitoCorrente === 'SERVIZIO VETERINARIO') return 'vet';
    if (ambitoCorrente === 'PROTEZIONE CIVILE') return 'pc';
    return 'tutti';
  });

  const flottaVet = FLOTTA_SUGGERIMENTI.filter(m => m.flotta === 'vet');
  const flottaPC = FLOTTA_SUGGERIMENTI.filter(m => m.flotta === 'pc');

  const siglaSelezionata = (mezzoSelezionato || '').split(' ')[0].toUpperCase();
  const siglaConsigliata = (mezzoConsigliato || '').split(' ')[0].toUpperCase();

  const renderCardMezzo = (m: SuggerimentoMezzo) => {
    const isSelected = siglaSelezionata === m.sigla.toUpperCase() || (mezzoSelezionato || '').includes(m.sigla);
    const isConsigliato = siglaConsigliata === m.sigla.toUpperCase();
    const statoFS = mezziFuoriServizio[m.sigla.toUpperCase()];
    const isFuoriServizio = Boolean(statoFS);

    return (
      <div
        key={m.sigla}
        onClick={() => {
          if (!isFuoriServizio) {
            onSelezionaMezzo(m.sigla);
          }
        }}
        className={`p-3 rounded-xl border transition-all text-left relative flex flex-col justify-between ${
          isFuoriServizio
            ? 'bg-red-950/20 border-red-500/50 opacity-90'
            : isSelected
            ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400 cursor-pointer'
            : isConsigliato
            ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400 cursor-pointer'
            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900 cursor-pointer'
        }`}
      >
        <div>
          {/* Header con Titolo e Badge Stato */}
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base">{m.icona}</span>
              <strong className="text-xs font-black text-white">
                {m.sigla}
              </strong>
              <span className="text-[11px] font-bold text-amber-300">
                — {m.nomeEsteso}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              {isFuoriServizio ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] uppercase shadow animate-pulse">
                  <Wrench className="w-2.5 h-2.5" /> Fuori Servizio
                </span>
              ) : isSelected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase shadow-sm">
                  <Check className="w-3 h-3" /> Assegnato
                </span>
              ) : isConsigliato ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] uppercase">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" /> Algoritmo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase">
                  ● In Servizio
                </span>
              )}
            </div>
          </div>

          {/* Dettagli Tipologia e Impiego Operativo richiesti */}
          <div className="space-y-1 text-[11px] text-slate-300 leading-snug">
            <p>
              <strong className="text-slate-400">Tipologia:</strong> {m.tipologia}
            </p>
            <p>
              <strong className="text-amber-400">Impiego operativo:</strong> {m.impiegoOperativo}
            </p>
            {isFuoriServizio && statoFS && (
              <div className="mt-1.5 p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-[10px] text-red-200">
                <strong>🚨 Motivo:</strong> {MOTIVI_FUORI_SERVIZIO_LABELS[statoFS.motivo] || statoFS.motivo}
                {statoFS.note && <div className="italic text-slate-300 mt-0.5">"{statoFS.note}"</div>}
              </div>
            )}
          </div>
        </div>

        {/* Bottone Assegna Rapido o Avviso Fuori Servizio */}
        <div className="mt-2.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400">
            Terminale: {m.etichettaVolontario}
          </span>
          {isFuoriServizio ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onApriGestioneStatoFlotta) onApriGestioneStatoFlotta();
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/50 transition-all cursor-pointer flex items-center gap-1"
            >
              <Wrench className="w-3 h-3 text-red-400" />
              <span>Gestisci Stato</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelezionaMezzo(m.sigla);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
              }`}
            >
              {isSelected ? '✓ Selezionato' : `Assegna ${m.sigla}`}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 bg-slate-950/90 border border-amber-500/30 rounded-2xl overflow-hidden shadow-xl">
      {/* Header Collassabile della Guida */}
      <div className="w-full p-3 bg-slate-900/90 flex items-center justify-between gap-2 text-left transition-colors border-b border-slate-800">
        <button
          type="button"
          onClick={() => setAperto(prev => !prev)}
          className="flex items-center gap-2 flex-1 text-left cursor-pointer group focus:outline-none"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/30 transition-colors">
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-400 group-hover:text-amber-300 uppercase flex items-center gap-2 transition-colors">
              <span>Suggerimenti Scelta Mezzo per Centrale & Amministratore</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                8 Mezzi
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Guida operativa dettagliata con tipologia e impiego per assegnare il mezzo ideale
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {onApriGestioneStatoFlotta && (
            <button
              type="button"
              onClick={onApriGestioneStatoFlotta}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
              title="Gestisci disponibilità, riparazioni e manutenzione della flotta"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stato Flotta & Manutenzione</span>
              <span className="sm:hidden">Manutenzione</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setAperto(prev => !prev)}
            className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="hidden sm:inline">
              {aperto ? 'Nascondi Dettagli' : 'Mostra Dettagli'}
            </span>
            {aperto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Contenuto Guida con i 2 Gruppi di Flotta */}
      {aperto && (
        <div className="p-3.5 space-y-4">
          {/* Selettore Filtro Rapido Flotta */}
          <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
              Filtra:
            </span>
            <button
              type="button"
              onClick={() => setFiltroFlotta('tutti')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filtroFlotta === 'tutti'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Tutti gli 8 Mezzi
            </button>
            <button
              type="button"
              onClick={() => setFiltroFlotta('vet')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filtroFlotta === 'vet'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              🐾 Flotta Vet (4)
            </button>
            <button
              type="button"
              onClick={() => setFiltroFlotta('pc')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filtroFlotta === 'pc'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              🌲 Flotta PC (4)
            </button>
          </div>

          {/* 1. Flotta Servizio Veterinario & Emergenza */}
          {(filtroFlotta === 'tutti' || filtroFlotta === 'vet') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  <span>🐾 1. Flotta Servizio Veterinario & Emergenza (4 Mezzi)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  T4609 • T4606 • T4614 • T4608
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {flottaVet.map(renderCardMezzo)}
              </div>
            </div>
          )}

          {/* 2. Flotta Protezione Civile */}
          {(filtroFlotta === 'tutti' || filtroFlotta === 'pc') && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                  <span>🌲 2. Flotta Protezione Civile (4 Mezzi)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  T4613 • T4607 • T4611 • T4615
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {flottaPC.map(renderCardMezzo)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
