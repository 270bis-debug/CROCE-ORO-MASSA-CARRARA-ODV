import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import { CorsoFormazione, InterventoManutenzione, MezzoFlotta, TurnoSedeOperativa } from '../types/adminTypes';
import { RifornimentoCarburante } from '../types/consumiTypes';
import { SegnalazioneGuastoMezzo } from './guastiMezziStore';
import { disegnaHeaderIstituzionale, disegnaFooterIstituzionale, sanitizeWinAnsi } from './pdfInstitutionalLayout';
import { formatDateTimeItaly, formatISODateItaly } from './italianTime';

export interface StatisticaMensileOdv {
  meseIndex: number; // 0..11
  etichetta: string; // Gen..Dic
  servizi: number;
  oreVolontariato: number;
  turniTotali: number;
  turniCoperti: number;
  coperturaPercent: number;
  spesaCarburante: number;
  spesaManutenzioni: number;
}

export interface StatisticaMezzoAnnuale {
  sigla: string;
  modello: string;
  kmServizi: number;
  litriCarburante: number;
  spesaCarburante: number;
  spesaManutenzioni: number;
  guastiSegnalati: number;
}

export interface ReportAnnualeDirettivo {
  anno: number;
  totaleServizi: number;
  totaleOreVolontariato: number;
  totaleKmFlotta: number;
  totaleLitriCarburante: number;
  totaleSpesaCarburante: number;
  totaleSpesaManutenzioni: number;
  totaleGuastiSegnalati: number;
  volontariAttivi: number;
  tesseratiAnno: number;
  corsiConclusiAnno: number;
  tassoCoperturaTurniMedio: number;
  mensili: StatisticaMensileOdv[];
  perSezione: Array<{ sezione: string; servizi: number; ore: number; volontari: number }>;
  perTipologiaServizio: Array<{ categoria: string; count: number; percent: number }>;
  perMezzo: StatisticaMezzoAnnuale[];
}

const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function estraiAnnoEMese(raw?: string): { anno: number; mese: number } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { anno: Number(iso[1]), mese: Number(iso[2]) - 1 };
  const it = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (it) return { anno: Number(it[3]), mese: Number(it[2]) - 1 };
  return null;
}

function isTurnoCoperto(t: TurnoSedeOperativa): boolean {
  const slots = [
    t.autista,
    t.caposervizio,
    t.soccorritore2,
    t.terzoSoccorritore,
    t.operatoreCentrale,
    t.centralinista,
    t.osservatore,
  ].filter(Boolean);
  const minRichiesti = Array.isArray(t.mansioniRichieste) && t.mansioniRichieste.length > 0
    ? t.mansioniRichieste.length
    : 2;
  return slots.length >= Math.min(minRichiesti, 2);
}

export function calcolaReportAnnualeDirettivo(params: {
  anno: number;
  volontari: Volontario[];
  mezzi: MezzoFlotta[];
  turni: TurnoSedeOperativa[];
  timbrature: any[];
  serviziArchivio: any[];
  rifornimenti: RifornimentoCarburante[];
  manutenzioni: InterventoManutenzione[];
  guasti: SegnalazioneGuastoMezzo[];
  corsi: CorsoFormazione[];
}): ReportAnnualeDirettivo {
  const { anno, volontari, mezzi, turni, timbrature, serviziArchivio, rifornimenti, manutenzioni, guasti, corsi } = params;

  const mensili: StatisticaMensileOdv[] = MESI_SHORT.map((etichetta, meseIndex) => ({
    meseIndex,
    etichetta,
    servizi: 0,
    oreVolontariato: 0,
    turniTotali: 0,
    turniCoperti: 0,
    coperturaPercent: 0,
    spesaCarburante: 0,
    spesaManutenzioni: 0,
  }));

  const sezioniMap = new Map<string, { sezione: string; servizi: number; ore: number; volontari: number }>();
  const ensureSez = (nome?: string) => {
    const key = (nome || 'Sede Centrale').trim() || 'Sede Centrale';
    if (!sezioniMap.has(key)) sezioniMap.set(key, { sezione: key, servizi: 0, ore: 0, volontari: 0 });
    return sezioniMap.get(key)!;
  };

  const tipoServMap = new Map<string, number>();
  const mezzoMap = new Map<string, StatisticaMezzoAnnuale>();
  for (const m of mezzi || []) {
    mezzoMap.set(m.sigla, {
      sigla: m.sigla,
      modello: m.modello || m.tipo || 'Mezzo Operativo',
      kmServizi: 0,
      litriCarburante: 0,
      spesaCarburante: 0,
      spesaManutenzioni: 0,
      guastiSegnalati: 0,
    });
  }
  const ensureMezzo = (sigla?: string) => {
    const s = (sigla || 'N/D').trim().split(' ')[0] || 'N/D';
    if (!mezzoMap.has(s)) {
      mezzoMap.set(s, {
        sigla: s,
        modello: 'Mezzo Flotta',
        kmServizi: 0,
        litriCarburante: 0,
        spesaCarburante: 0,
        spesaManutenzioni: 0,
        guastiSegnalati: 0,
      });
    }
    return mezzoMap.get(s)!;
  };

  // 1. Volontari & Tesseramento
  const volAttivi = (volontari || []).filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi);
  let tesseratiAnno = 0;
  for (const v of volAttivi) {
    ensureSez(v.sezioneAppartenenzaNome).volontari += 1;
    if (v.esenteQuotaAssociativa || (v.tesseramento?.rinnovata && Number(v.tesseramento?.annoRiferimento || 0) >= anno)) {
      tesseratiAnno += 1;
    }
  }

  // 2. Servizi archivio
  let totaleServizi = 0;
  let totaleKmFlotta = 0;
  for (const s of serviziArchivio || []) {
    if (!s || s.annullata) continue;
    const dm = estraiAnnoEMese(s.data || s.dataServizio || s.dataOra || s.orarioInvio);
    if (!dm || dm.anno !== anno) continue;
    totaleServizi += 1;
    if (dm.mese >= 0 && dm.mese < 12) mensili[dm.mese].servizi += 1;
    ensureSez(s.sedeNome || s.sezione || s.comune).servizi += 1;

    const cat = String(s.tipologiaServizio || s.categoriaServizio || s.codiceColore || s.tipoIntervento || 'Servizio Ordinario').trim();
    tipoServMap.set(cat, (tipoServMap.get(cat) || 0) + 1);

    const kmPercorsi = Number(s.kmTotali || s.kmPercorsi || (Number(s.kmFine || 0) > Number(s.kmInizio || 0) ? Number(s.kmFine) - Number(s.kmInizio) : 0) || 0);
    if (kmPercorsi > 0 && kmPercorsi < 3000) {
      totaleKmFlotta += kmPercorsi;
      if (s.mezzo || s.mezzoSigla) {
        ensureMezzo(s.mezzoSigla || s.mezzo).kmServizi += kmPercorsi;
      }
    }
  }

  // 3. Ore volontariato (esclude NFC autoChiusa24h / validaPerConteggio === false)
  let totaleOreVolontariato = 0;
  for (const t of timbrature || []) {
    if (!t || t.autoChiusa24h === true || t.validaPerConteggio === false) continue;
    const dm = estraiAnnoEMese(t.data || t.oraEntrata || t.timestampEntrata);
    if (!dm || dm.anno !== anno) continue;
    let ore = 0;
    if (typeof t.durataMinuti === 'number' && t.durataMinuti > 0 && t.durataMinuti <= 1440) {
      ore = t.durataMinuti / 60;
    } else if (t.oraEntrata && t.oraUscita) {
      const tIn = Date.parse(t.oraEntrata);
      const tOut = Date.parse(t.oraUscita);
      if (Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn) {
        const h = (tOut - tIn) / 3600000;
        if (h > 0 && h <= 24) ore = h;
      }
    }
    if (ore > 0) {
      totaleOreVolontariato += ore;
      if (dm.mese >= 0 && dm.mese < 12) mensili[dm.mese].oreVolontariato += ore;
      ensureSez(t.sedeNome || t.luogoNome).ore += ore;
    }
  }

  // 4. Copertura Turni
  let sumTurniTot = 0;
  let sumTurniCop = 0;
  for (const tr of turni || []) {
    const dm = estraiAnnoEMese(tr?.data);
    if (!dm || dm.anno !== anno) continue;
    sumTurniTot += 1;
    const cop = isTurnoCoperto(tr);
    if (cop) sumTurniCop += 1;
    if (dm.mese >= 0 && dm.mese < 12) {
      mensili[dm.mese].turniTotali += 1;
      if (cop) mensili[dm.mese].turniCoperti += 1;
    }
  }

  // 5. Rifornimenti Carburante
  let totaleLitriCarburante = 0;
  let totaleSpesaCarburante = 0;
  for (const r of rifornimenti || []) {
    const dm = estraiAnnoEMese(r?.data);
    if (!dm || dm.anno !== anno) continue;
    const l = Number(r.litri || 0);
    const c = Number(r.costoTotale || 0);
    totaleLitriCarburante += l;
    totaleSpesaCarburante += c;
    if (dm.mese >= 0 && dm.mese < 12) mensili[dm.mese].spesaCarburante += c;
    const mz = ensureMezzo(r.mezzoSigla);
    mz.litriCarburante += l;
    mz.spesaCarburante += c;
  }

  // 6. Manutenzioni & Guasti
  let totaleSpesaManutenzioni = 0;
  for (const mn of manutenzioni || []) {
    const dm = estraiAnnoEMese((mn as any)?.dataIntervento || (mn as any)?.data);
    if (!dm || dm.anno !== anno) continue;
    const costo = Number((mn as any)?.costoTotale || (mn as any)?.costo || 0);
    totaleSpesaManutenzioni += costo;
    if (dm.mese >= 0 && dm.mese < 12) mensili[dm.mese].spesaManutenzioni += costo;
    if ((mn as any)?.mezzoSigla) {
      ensureMezzo((mn as any).mezzoSigla).spesaManutenzioni += costo;
    }
  }

  let totaleGuastiSegnalati = 0;
  for (const g of guasti || []) {
    const dm = estraiAnnoEMese(g?.dataOra);
    if (!dm || dm.anno !== anno) continue;
    totaleGuastiSegnalati += 1;
    ensureMezzo(g.mezzoSigla).guastiSegnalati += 1;
  }

  // 7. Corsi conclusi
  const corsiConclusiAnno = (corsi || []).filter((c) => {
    const dm = estraiAnnoEMese(c.dataFine || c.dataInizio);
    return dm && dm.anno === anno && c.stato !== 'Annullato';
  }).length;

  // Finalizza arrotondamenti mensili
  mensili.forEach((m) => {
    m.oreVolontariato = Math.round(m.oreVolontariato * 10) / 10;
    m.spesaCarburante = Math.round(m.spesaCarburante * 100) / 100;
    m.spesaManutenzioni = Math.round(m.spesaManutenzioni * 100) / 100;
    m.coperturaPercent = m.turniTotali > 0 ? Math.round((m.turniCoperti / m.turniTotali) * 100) : 0;
  });

  const perTipologiaServizio = Array.from(tipoServMap.entries())
    .map(([categoria, count]) => ({
      categoria,
      count,
      percent: totaleServizi > 0 ? Math.round((count / totaleServizi) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const perSezione = Array.from(sezioniMap.values())
    .map((s) => ({ ...s, ore: Math.round(s.ore * 10) / 10 }))
    .sort((a, b) => b.servizi - a.servizi || b.ore - a.ore);

  const perMezzo = Array.from(mezzoMap.values())
    .map((m) => ({
      ...m,
      kmServizi: Math.round(m.kmServizi),
      litriCarburante: Math.round(m.litriCarburante * 10) / 10,
      spesaCarburante: Math.round(m.spesaCarburante * 100) / 100,
      spesaManutenzioni: Math.round(m.spesaManutenzioni * 100) / 100,
    }))
    .sort((a, b) => b.kmServizi - a.kmServizi || b.spesaCarburante - a.spesaCarburante);

  return {
    anno,
    totaleServizi,
    totaleOreVolontariato: Math.round(totaleOreVolontariato * 10) / 10,
    totaleKmFlotta: Math.round(totaleKmFlotta),
    totaleLitriCarburante: Math.round(totaleLitriCarburante * 10) / 10,
    totaleSpesaCarburante: Math.round(totaleSpesaCarburante * 100) / 100,
    totaleSpesaManutenzioni: Math.round(totaleSpesaManutenzioni * 100) / 100,
    totaleGuastiSegnalati,
    volontariAttivi: volAttivi.length,
    tesseratiAnno,
    corsiConclusiAnno,
    tassoCoperturaTurniMedio: sumTurniTot > 0 ? Math.round((sumTurniCop / sumTurniTot) * 100) : 0,
    mensili,
    perSezione,
    perTipologiaServizio,
    perMezzo,
  };
}

export function generaPdfRelazioneAnnualeDirettivo(report: ReportAnnualeDirettivo, firmatario: string = 'Il Consiglio Direttivo'): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const dataOra = formatDateTimeItaly();

  const drawChrome = (pageNum: number) => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: `RELAZIONE ANNUALE ATTIVITA & STATISTICHE DIRETTIVO — ANNO ${report.anno}`,
      badge: {
        riga1Tag: 'RELAZIONE ODV',
        riga2Valore: `ANNO ${report.anno}`,
        riga3Sotto: 'Riservato Direttivo / Assemblea',
      },
      pageWidth,
      margin,
    });
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${pageNum} • Relazione Annuale Croce Oro Massa Carrara OdV • ${dataOra}`,
      pageWidth,
      pageHeight,
      margin,
    });
  };

  drawChrome(1);
  let y = 40;

  // KPI Box
  const kpis = [
    { label: 'Servizi Svolti', val: String(report.totaleServizi) },
    { label: 'Ore Volontariato', val: `${report.totaleOreVolontariato} h` },
    { label: 'Volontari Attivi', val: `${report.volontariAttivi} (${report.tesseratiAnno} tess.)` },
    { label: 'Copertura Turni', val: `${report.tassoCoperturaTurniMedio}%` },
    { label: 'Km Flotta', val: `${report.totaleKmFlotta} km` },
    { label: 'Carburante + Manut.', val: `EUR ${(report.totaleSpesaCarburante + report.totaleSpesaManutenzioni).toFixed(0)}` },
  ];

  const cardW = (contentWidth - 8) / 3;
  kpis.forEach((k, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = margin + col * (cardW + 4);
    const cy = y + row * 18;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(191, 163, 83);
    doc.roundedRect(x, cy, cardW, 15, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label.toUpperCase(), x + 3, cy + 5);
    doc.setFontSize(11);
    doc.setTextColor(29, 26, 96);
    doc.text(sanitizeWinAnsi(k.val), x + 3, cy + 12);
  });
  y += 42;

  // Tabella Andamento Mensile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text(`ANDAMENTO MENSILE ANNO ${report.anno}`, margin, y);
  y += 4;

  doc.setFillColor(29, 26, 96);
  doc.rect(margin, y, contentWidth, 6.5, 'F');
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  doc.text('MESE', margin + 2, y + 4.4);
  doc.text('SERVIZI', margin + 26, y + 4.4);
  doc.text('ORE VOL.', margin + 52, y + 4.4);
  doc.text('TURNI COPERTI', margin + 82, y + 4.4);
  doc.text('CARBURANTE', margin + 122, y + 4.4);
  doc.text('MANUTENZIONI', margin + 154, y + 4.4);
  y += 7.5;

  report.mensili.forEach((m, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, contentWidth, 5.8, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);
    doc.text(m.etichetta, margin + 2, y + 3.4);
    doc.text(String(m.servizi), margin + 26, y + 3.4);
    doc.text(`${m.oreVolontariato} h`, margin + 52, y + 3.4);
    doc.text(`${m.turniCoperti}/${m.turniTotali} (${m.coperturaPercent}%)`, margin + 82, y + 3.4);
    doc.text(`EUR ${m.spesaCarburante.toFixed(2)}`, margin + 122, y + 3.4);
    doc.text(`EUR ${m.spesaManutenzioni.toFixed(2)}`, margin + 154, y + 3.4);
    y += 5.8;
  });

  y += 8;
  if (y > 235) {
    doc.addPage();
    drawChrome(2);
    y = 40;
  }

  // Riepilogo Flotta Mezzi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('RIEPILOGO FLOTTA MEZZI (KM, CARBURANTE, MANUTENZIONI, GUASTI)', margin, y);
  y += 4;

  doc.setFillColor(29, 26, 96);
  doc.rect(margin, y, contentWidth, 6.5, 'F');
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  doc.text('MEZZO', margin + 2, y + 4.4);
  doc.text('KM SERVIZI', margin + 56, y + 4.4);
  doc.text('LITRI', margin + 86, y + 4.4);
  doc.text('CARBURANTE', margin + 110, y + 4.4);
  doc.text('MANUT.', margin + 142, y + 4.4);
  doc.text('GUASTI', margin + 166, y + 4.4);
  y += 7.5;

  report.perMezzo.slice(0, 14).forEach((mz, idx) => {
    if (y > pageHeight - 28) {
      doc.addPage();
      drawChrome(2);
      y = 40;
    }
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, contentWidth, 5.8, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeWinAnsi(`${mz.sigla} ${mz.modello}`).slice(0, 28), margin + 2, y + 3.4);
    doc.text(`${mz.kmServizi} km`, margin + 56, y + 3.4);
    doc.text(`${mz.litriCarburante} L`, margin + 86, y + 3.4);
    doc.text(`EUR ${mz.spesaCarburante.toFixed(2)}`, margin + 110, y + 3.4);
    doc.text(`EUR ${mz.spesaManutenzioni.toFixed(2)}`, margin + 142, y + 3.4);
    doc.text(String(mz.guastiSegnalati), margin + 168, y + 3.4);
    y += 5.8;
  });

  y += 10;
  if (y < pageHeight - 25) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizeWinAnsi(`Relazione predisposta da: ${firmatario} — Croce Oro Massa Carrara OdV`), margin, y);
  }

  doc.save(`Relazione_Annuale_Direttivo_CroceOro_${report.anno}_${formatISODateItaly()}.pdf`);
}
