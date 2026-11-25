import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileDown,
  TrendingUp,
  Ambulance,
  Clock,
  Users,
  Fuel,
  ShieldCheck,
  Wrench,
  Calendar,
} from 'lucide-react';
import { Volontario } from '../DatabaseVolontariModal';
import { CorsoFormazione, InterventoManutenzione, MezzoFlotta, TurnoSedeOperativa } from '../../types/adminTypes';
import { RifornimentoCarburante } from '../../types/consumiTypes';
import { SegnalazioneGuastoMezzo } from '../../utils/guastiMezziStore';
import {
  calcolaReportAnnualeDirettivo,
  generaPdfRelazioneAnnualeDirettivo,
} from '../../utils/statisticheAnnualiOdv';
import { getItalianDateParts } from '../../utils/italianTime';

interface PannelloStatisticheDirettivoProps {
  volontari: Volontario[];
  mezziFlotta: MezzoFlotta[];
  turniSedi: TurnoSedeOperativa[];
  timbrature: any[];
  serviziArchivio: any[];
  rifornimenti: RifornimentoCarburante[];
  manutenzioni: InterventoManutenzione[];
  guastiMezzi: SegnalazioneGuastoMezzo[];
  corsi: CorsoFormazione[];
  operatoreCorrente: string;
}

export const PannelloStatisticheDirettivo: React.FC<PannelloStatisticheDirettivoProps> = ({
  volontari,
  mezziFlotta,
  turniSedi,
  timbrature,
  serviziArchivio,
  rifornimenti,
  manutenzioni,
  guastiMezzi,
  corsi,
  operatoreCorrente,
}) => {
  const annoCorrente = getItalianDateParts().year;
  const [anno, setAnno] = useState<number>(annoCorrente);

  const anniDisponibili = useMemo(() => {
    const set = new Set<number>([annoCorrente, annoCorrente - 1, annoCorrente - 2]);
    return Array.from(set).sort((a, b) => b - a);
  }, [annoCorrente]);

  const report = useMemo(
    () =>
      calcolaReportAnnualeDirettivo({
        anno,
        volontari,
        mezzi: mezziFlotta,
        turni: turniSedi,
        timbrature,
        serviziArchivio,
        rifornimenti,
        manutenzioni,
        guasti: guastiMezzi,
        corsi,
      }),
    [anno, volontari, mezziFlotta, turniSedi, timbrature, serviziArchivio, rifornimenti, manutenzioni, guastiMezzi, corsi]
  );

  const maxServiziMese = Math.max(1, ...report.mensili.map((m) => m.servizi));
  const maxOreMese = Math.max(1, ...report.mensili.map((m) => m.oreVolontariato));
  const maxSpesaMese = Math.max(1, ...report.mensili.map((m) => m.spesaCarburante + m.spesaManutenzioni));
  const maxKmMezzo = Math.max(1, ...report.perMezzo.map((m) => m.kmServizi));

  return (
    <div className="space-y-4">
      {/* Header controllo anno + PDF */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
            Area Riservata al Consiglio Direttivo
          </div>
          <h4 className="text-sm sm:text-base font-black text-white">
            Statistiche & Relazione Annuale Associazione — {anno}
          </h4>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={anno}
              onChange={(e) => setAnno(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer"
            >
              {anniDisponibili.map((y) => (
                <option key={y} value={y} className="bg-slate-900">
                  Anno {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => generaPdfRelazioneAnnualeDirettivo(report, operatoreCorrente)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase inline-flex items-center gap-1.5 cursor-pointer shadow"
          >
            <FileDown className="w-4 h-4" />
            <span>Scarica Relazione PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Ambulance className="w-3.5 h-3.5 text-sky-400" /> Servizi
          </div>
          <div className="text-xl font-black text-white mt-1 tabular-nums">{report.totaleServizi}</div>
          <div className="text-[10px] text-slate-400">{report.totaleKmFlotta} km percorsi</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-400" /> Ore Volontari
          </div>
          <div className="text-xl font-black text-emerald-300 mt-1 tabular-nums">{report.totaleOreVolontariato} h</div>
          <div className="text-[10px] text-slate-400">Timbrature valide</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Copertura Turni
          </div>
          <div className="text-xl font-black text-indigo-300 mt-1 tabular-nums">{report.tassoCoperturaTurniMedio}%</div>
          <div className="text-[10px] text-slate-400">Media annua turni</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-amber-400" /> Volontari / Soci
          </div>
          <div className="text-xl font-black text-amber-300 mt-1 tabular-nums">{report.volontariAttivi}</div>
          <div className="text-[10px] text-slate-400">{report.tesseratiAnno} tesserati {anno}</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Fuel className="w-3.5 h-3.5 text-orange-400" /> Carburante
          </div>
          <div className="text-xl font-black text-orange-300 mt-1 tabular-nums">€ {report.totaleSpesaCarburante.toFixed(0)}</div>
          <div className="text-[10px] text-slate-400">{report.totaleLitriCarburante} litri</div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-rose-400" /> Manut. & Guasti
          </div>
          <div className="text-xl font-black text-rose-300 mt-1 tabular-nums">€ {report.totaleSpesaManutenzioni.toFixed(0)}</div>
          <div className="text-[10px] text-slate-400">{report.totaleGuastiSegnalati} guasti segnalati</div>
        </div>
      </div>

      {/* GRAFICO 1: Servizi e Ore Mensili (SVG Responsive) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-black uppercase text-white flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>Servizi & Ore Volontariato per Mese</span>
            </h5>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 text-sky-300"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" /> Servizi</span>
              <span className="inline-flex items-center gap-1 text-emerald-300"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Ore</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 480 175" className="w-full min-w-[320px] h-44">
              {[0, 0.25, 0.5, 0.75, 1].map((g) => (
                <line
                  key={g}
                  x1="12"
                  x2="470"
                  y1={20 + (1 - g) * 125}
                  y2={20 + (1 - g) * 125}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
              ))}
              {report.mensili.map((m, idx) => {
                const groupX = 18 + idx * 38;
                const hServ = Math.max(2, (m.servizi / maxServiziMese) * 120);
                const hOre = Math.max(2, (m.oreVolontariato / maxOreMese) * 120);
                return (
                  <g key={m.etichetta}>
                    <rect
                      x={groupX}
                      y={145 - hServ}
                      width="12"
                      height={hServ}
                      rx="3"
                      fill="#0ea5e9"
                    >
                      <title>{`${m.etichetta}: ${m.servizi} servizi`}</title>
                    </rect>
                    <rect
                      x={groupX + 14}
                      y={145 - hOre}
                      width="12"
                      height={hOre}
                      rx="3"
                      fill="#10b981"
                    >
                      <title>{`${m.etichetta}: ${m.oreVolontariato} ore`}</title>
                    </rect>
                    <text x={groupX + 13} y="162" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontWeight="700">
                      {m.etichetta}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* GRAFICO 2: Copertura Turni % & Costi Flotta Mensili */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-black uppercase text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Copertura Turni (%) & Spesa Flotta Mensile</span>
            </h5>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 text-indigo-300"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Copertura %</span>
              <span className="inline-flex items-center gap-1 text-amber-300"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Spesa €</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 480 175" className="w-full min-w-[320px] h-44">
              {[0, 25, 50, 75, 100].map((pct) => (
                <line
                  key={pct}
                  x1="12"
                  x2="470"
                  y1={20 + ((100 - pct) / 100) * 125}
                  y2={20 + ((100 - pct) / 100) * 125}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
              ))}
              {report.mensili.map((m, idx) => {
                const groupX = 18 + idx * 38;
                const hCop = Math.max(2, (m.coperturaPercent / 100) * 120);
                const spesaTot = m.spesaCarburante + m.spesaManutenzioni;
                const hSpesa = Math.max(2, (spesaTot / maxSpesaMese) * 120);
                return (
                  <g key={m.etichetta}>
                    <rect x={groupX} y={145 - hCop} width="12" height={hCop} rx="3" fill="#6366f1">
                      <title>{`${m.etichetta}: copertura turni ${m.coperturaPercent}% (${m.turniCoperti}/${m.turniTotali})`}</title>
                    </rect>
                    <rect x={groupX + 14} y={145 - hSpesa} width="12" height={hSpesa} rx="3" fill="#f59e0b">
                      <title>{`${m.etichetta}: € ${spesaTot.toFixed(2)} (Carb. € ${m.spesaCarburante.toFixed(0)} + Manut. € ${m.spesaManutenzioni.toFixed(0)})`}</title>
                    </rect>
                    <text x={groupX + 13} y="162" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontWeight="700">
                      {m.etichetta}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* SEZIONI & TIPOLOGIE SERVIZIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <h5 className="text-xs font-black uppercase text-white">Ripartizione per Sezione Territoriale</h5>
          <div className="space-y-2">
            {report.perSezione.slice(0, 8).map((s) => (
              <div key={s.sezione} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">{s.sezione}</div>
                  <div className="text-[10px] text-slate-400">{s.volontari} volontari attivi</div>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <div className="text-sky-300 font-black">{s.servizi} servizi</div>
                  <div className="text-[10.5px] text-emerald-300">{s.ore} ore</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
          <h5 className="text-xs font-black uppercase text-white">Tipologie Servizi Svolti ({anno})</h5>
          {report.perTipologiaServizio.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">Nessun servizio registrato nell'anno selezionato.</div>
          ) : (
            <div className="space-y-2">
              {report.perTipologiaServizio.map((cat) => (
                <div key={cat.categoria} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-bold truncate">{cat.categoria}</span>
                    <span className="font-mono text-amber-300 font-black shrink-0">{cat.count} ({cat.percent}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-sky-400 rounded-full" style={{ width: `${Math.max(4, cat.percent)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FLOTTA MEZZI */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <h5 className="text-xs font-black uppercase text-white">Analisi Flotta Mezzi (Chilometri, Carburante, Manutenzioni & Guasti)</h5>
        <div className="space-y-2">
          {report.perMezzo.slice(0, 10).map((m) => (
            <div key={m.sigla} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-white">
                  {m.sigla} <span className="font-normal text-slate-400">• {m.modello}</span>
                </span>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                  <span className="text-sky-300 font-bold">{m.kmServizi} km</span>
                  <span className="text-orange-300">{m.litriCarburante} L (€ {m.spesaCarburante.toFixed(0)})</span>
                  <span className="text-rose-300">Manut. € {m.spesaManutenzioni.toFixed(0)}</span>
                  {m.guastiSegnalati > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 font-black">
                      {m.guastiSegnalati} guasti
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${Math.max(3, Math.round((m.kmServizi / maxKmMezzo) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
