import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { Volontario } from '../DatabaseVolontariModal';
import { RuoloTurno, TurnoSedeOperativa } from '../../types/adminTypes';
import {
  calcolaAffinitaVolontarioTurno,
  ContestoAffinitaTurno,
  AffinitaVolontarioDettaglio,
} from '../../utils/affinitaVolontari';

interface StelleAffinitaProps {
  /** Affinità in percentuale 0..100 */
  percentuale: number;
  size?: 'xs' | 'sm';
  mostraPercentuale?: boolean;
}

const STAR_PATH =
  'M12 2.25l2.92 5.91 6.53.95-4.72 4.6 1.11 6.5L12 17.14l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.25z';

/**
 * 5 stelline di affinità (ciascuna vale 20%: 1★=20%, 2★=40%, 3★=60%, 4★=80%, 5★=100%).
 * Le stelline passano progressivamente dal BLU (poca affinità) all'ORO (alta affinità),
 * inclusa la colorazione parziale/a metà della singola stella (es. metà oro e metà blu).
 */
export const StelleAffinita: React.FC<StelleAffinitaProps> = ({
  percentuale,
  size = 'sm',
  mostraPercentuale = true,
}) => {
  const uid = useId();
  const clamped = Math.max(0, Math.min(100, Math.round(percentuale)));
  const iconDim = size === 'xs' ? 12 : 14;

  return (
    <span
      className="inline-flex items-center gap-1 shrink-0"
      title={`Affinità ${clamped}% (ogni stella = 20%: blu bassa affinità, oro alta affinità)`}
    >
      <span className="inline-flex items-center gap-0.5" aria-label={`Affinità ${clamped}%`}>
        {[0, 1, 2, 3, 4].map((idx) => {
          const goldPct = Math.max(0, Math.min(100, ((clamped - idx * 20) / 20) * 100));
          const isFullGold = goldPct >= 99.5;
          const isFullBlue = goldPct <= 0.5;
          const gradId = `star-aff-${uid}-${idx}`;

          return (
            <svg
              key={idx}
              width={iconDim}
              height={iconDim}
              viewBox="0 0 24 24"
              className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]"
            >
              {!isFullGold && !isFullBlue && (
                <defs>
                  <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset={`${goldPct}%`} stopColor="#fbbf24" />
                    <stop offset={`${goldPct}%`} stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              )}
              <path
                d={STAR_PATH}
                fill={isFullGold ? '#fbbf24' : isFullBlue ? '#3b82f6' : `url(#${gradId})`}
                stroke={isFullGold ? '#f59e0b' : isFullBlue ? '#60a5fa' : '#eab308'}
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
          );
        })}
      </span>
      {mostraPercentuale && (
        <span
          className={`font-mono font-black leading-none ${
            size === 'xs' ? 'text-[9.5px]' : 'text-[10.5px]'
          } ${
            clamped >= 70
              ? 'text-amber-300'
              : clamped >= 40
              ? 'text-amber-200/90'
              : 'text-blue-300'
          }`}
        >
          {clamped}%
        </span>
      )}
    </span>
  );
};

interface SelectVolontarioAffinitaProps {
  label: string;
  value: string;
  onChange: (volId: string) => void;
  volontari: Volontario[];
  ruoloTarget: RuoloTurno;
  contestoTurno: ContestoAffinitaTurno;
  tuttiTurni: TurnoSedeOperativa[];
  placeholder?: string;
}

export const SelectVolontarioAffinita: React.FC<SelectVolontarioAffinitaProps> = ({
  label,
  value,
  onChange,
  volontari,
  ruoloTarget,
  contestoTurno,
  tuttiTurni,
  placeholder = '-- Nessuno --',
}) => {
  const [aperto, setAperto] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [ricerca, setRicerca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleAperto = () => {
    setAperto((prev) => {
      const next = !prev;
      if (next && containerRef.current && typeof window !== 'undefined') {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 270 && spaceAbove > spaceBelow);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!aperto) {
      setRicerca('');
      return;
    }
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAperto(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAperto(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    const t = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [aperto]);

  const opzioniConAffinita = useMemo(() => {
    const items: Array<{ vol: Volontario; affinita: AffinitaVolontarioDettaglio }> = volontari.map(
      (vol) => ({
        vol,
        affinita: calcolaAffinitaVolontarioTurno(vol, ruoloTarget, contestoTurno, tuttiTurni),
      })
    );
    // Ordina dal volontario con maggiore affinità a quello con minore affinità (poi alfabetico)
    items.sort((a, b) => {
      if (b.affinita.percentuale !== a.affinita.percentuale) {
        return b.affinita.percentuale - a.affinita.percentuale;
      }
      const nomeA = `${a.vol.nome} ${a.vol.cognome}`.toLowerCase();
      const nomeB = `${b.vol.nome} ${b.vol.cognome}`.toLowerCase();
      return nomeA.localeCompare(nomeB, 'it');
    });
    return items;
  }, [volontari, ruoloTarget, contestoTurno, tuttiTurni]);

  const selezionato = useMemo(
    () => opzioniConAffinita.find((item) => item.vol.id === value) || null,
    [opzioniConAffinita, value]
  );

  const opzioniFiltrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return opzioniConAffinita;
    return opzioniConAffinita.filter(({ vol }) => {
      const full = `${vol.nome} ${vol.cognome} ${vol.qualifica || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [opzioniConAffinita, ricerca]);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-slate-300 font-semibold mb-1">{label}</label>

      <button
        type="button"
        onClick={toggleAperto}
        className={`w-full px-2.5 py-2 rounded-xl bg-slate-950 border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
          aperto
            ? 'border-amber-400/80 ring-1 ring-amber-400/30'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        {selezionato ? (
          <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
            <span className="truncate text-white font-semibold text-xs">
              {selezionato.vol.nome} {selezionato.vol.cognome}
            </span>
            <StelleAffinita percentuale={selezionato.affinita.percentuale} size="xs" />
          </div>
        ) : (
          <span className="text-slate-400 text-xs truncate">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            aperto ? 'rotate-180 text-amber-300' : ''
          }`}
        />
      </button>

      {aperto && (
        <div
          className={`absolute left-0 right-0 z-[80] rounded-xl bg-slate-950 border border-slate-600 shadow-2xl shadow-black/80 overflow-hidden ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {volontari.length > 5 && (
            <div className="p-2 border-b border-slate-800 bg-slate-900/90">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Cerca volontario..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[11px] placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/70">
            {/* Opzione Nessuno */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setAperto(false);
              }}
              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                !value
                  ? 'bg-slate-800/90 text-white font-bold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <span>{placeholder}</span>
              {!value && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
            </button>

            {opzioniFiltrate.length === 0 ? (
              <div className="px-3 py-3 text-center text-[11px] text-slate-500">
                Nessun volontario trovato.
              </div>
            ) : (
              opzioniFiltrate.map(({ vol, affinita }) => {
                const isSelected = vol.id === value;
                return (
                  <button
                    key={vol.id}
                    type="button"
                    onClick={() => {
                      onChange(vol.id);
                      setAperto(false);
                    }}
                    className={`w-full px-2.5 py-2 text-left transition-colors cursor-pointer space-y-1 ${
                      isSelected
                        ? 'bg-amber-950/40 text-white'
                        : 'hover:bg-slate-900/90 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white truncate">
                            {vol.nome} {vol.cognome}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {vol.qualifica || 'Volontario'}
                          {affinita.qualificatoRuolo ? ' · Idoneo' : ''}
                        </div>
                      </div>
                      <StelleAffinita percentuale={affinita.percentuale} size="xs" />
                    </div>

                    {/* Dettaglio affinità sui 4 fattori: Tipo turno, Mansione, Fascia oraria, Giorno settimanale */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[9.5px] font-mono text-slate-400">
                      <span className={affinita.criteri.tipoTurno >= 60 ? 'text-amber-300/90' : 'text-blue-300/80'}>
                        Tipo {affinita.criteri.tipoTurno}%
                      </span>
                      <span className="text-slate-700">•</span>
                      <span className={affinita.criteri.mansione >= 60 ? 'text-amber-300/90' : 'text-blue-300/80'}>
                        Mans. {affinita.criteri.mansione}%
                      </span>
                      <span className="text-slate-700">•</span>
                      <span className={affinita.criteri.fasciaOraria >= 60 ? 'text-amber-300/90' : 'text-blue-300/80'}>
                        {affinita.etichettaFascia} {affinita.criteri.fasciaOraria}%
                      </span>
                      <span className="text-slate-700">•</span>
                      <span className={affinita.criteri.giornoSettimanale >= 60 ? 'text-amber-300/90' : 'text-blue-300/80'}>
                        {affinita.etichettaGiorno} {affinita.criteri.giornoSettimanale}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
