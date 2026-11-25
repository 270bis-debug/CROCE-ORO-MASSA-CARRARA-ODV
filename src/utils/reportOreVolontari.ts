import { jsPDF } from 'jspdf';
import { formatDateTimeItaly, formatISODateItaly } from './italianTime';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi,
} from './pdfInstitutionalLayout';
import { Volontario } from '../components/DatabaseVolontariModal';
import { CorsoFormazione, TurnoSedeOperativa } from '../types/adminTypes';

export type TipoCertificatoServizio =
  | 'attestato_servizio'
  | 'crediti_scolastici'
  | 'protezione_civile';

export interface RiepilogoOreVolontario {
  volontarioId: string;
  nomeCompleto: string;
  matricola: string;
  codiceFiscale: string;
  qualifica: string;
  sezione: string;
  oreTimbrature: number;
  conteggioTimbratureValide: number;
  oreTurni: number;
  conteggioTurni: number;
  oreFormazione: number;
  conteggioCorsi: number;
  serviziSvolti: number;
  totaleOreComplessive: number;
}

function parseOrarioMinuti(hhmm?: string): number | null {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function calcolaOreFascia(inizio?: string, fine?: string, fascia?: string): number {
  let i = parseOrarioMinuti(inizio);
  let f = parseOrarioMinuti(fine);
  if ((i === null || f === null) && fascia) {
    const parts = fascia.split(/[-–]/);
    if (parts.length >= 2) {
      i = parseOrarioMinuti(parts[0]);
      f = parseOrarioMinuti(parts[1]);
    }
  }
  if (i === null || f === null) return 0;
  let diff = f - i;
  if (diff <= 0) diff += 24 * 60; // Turno notturno a cavallo della mezzanotte
  if (diff <= 0 || diff > 24 * 60) return 0;
  return Math.round((diff / 60) * 100) / 100;
}

function estraiDataIso(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const itMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (itMatch) return `${itMatch[3]}-${itMatch[2]}-${itMatch[1]}`;
  return '';
}

function isInPeriodo(dataIso: string, dataDa: string, dataA: string): boolean {
  if (!dataIso) return false;
  if (dataDa && dataIso < dataDa) return false;
  if (dataA && dataIso > dataA) return false;
  return true;
}

function matchVolontarioNome(v: Volontario, nomeTesto?: string): boolean {
  if (!nomeTesto) return false;
  const target = nomeTesto.toLowerCase().trim();
  const full1 = `${v.nome || ''} ${v.cognome || ''}`.toLowerCase().trim();
  const full2 = `${v.cognome || ''} ${v.nome || ''}`.toLowerCase().trim();
  return Boolean(
    (full1 && (target === full1 || target.includes(full1))) ||
      (full2 && (target === full2 || target.includes(full2)))
  );
}

export function calcolaRiepilogoOreVolontari(params: {
  volontari: Volontario[];
  timbrature: any[];
  turni: TurnoSedeOperativa[];
  corsi: CorsoFormazione[];
  serviziArchivio: any[];
  dataDa: string;
  dataA: string;
}): RiepilogoOreVolontario[] {
  const { volontari, timbrature, turni, corsi, serviziArchivio, dataDa, dataA } = params;

  return (volontari || [])
    .filter((v) => v && v.approvato !== false)
    .map((v) => {
      const nomeCompleto = `${v.nome || ''} ${v.cognome || ''}`.trim() || v.matricola || 'Volontario';

      // 1. Ore da Timbrature valide (esclude autoChiusa24h / validaPerConteggio === false!)
      let oreTimbrature = 0;
      let conteggioTimbratureValide = 0;
      for (const t of timbrature || []) {
        if (!t) continue;
        if (t.autoChiusa24h === true || t.validaPerConteggio === false) continue;
        const belongs =
          (t.volontarioId && t.volontarioId === v.id) ||
          matchVolontarioNome(v, t.volontarioNome);
        if (!belongs) continue;
        const dIso = estraiDataIso(t.data || t.oraEntrata || t.timestampEntrata);
        if (!isInPeriodo(dIso, dataDa, dataA)) continue;

        let oreSessione = 0;
        if (typeof t.durataMinuti === 'number' && t.durataMinuti > 0 && t.durataMinuti <= 1440) {
          oreSessione = t.durataMinuti / 60;
        } else if (t.oraEntrata && t.oraUscita && !t.autoChiusa24h) {
          const tIn = Date.parse(t.oraEntrata);
          const tOut = Date.parse(t.oraUscita);
          if (Number.isFinite(tIn) && Number.isFinite(tOut) && tOut > tIn) {
            const h = (tOut - tIn) / 3600000;
            if (h > 0 && h <= 24) oreSessione = h;
          } else {
            oreSessione = calcolaOreFascia(t.oraEntrata, t.oraUscita);
          }
        }
        if (oreSessione > 0) {
          oreTimbrature += oreSessione;
          conteggioTimbratureValide += 1;
        }
      }

      // 2. Ore da Turni di servizio assegnati
      let oreTurni = 0;
      let conteggioTurni = 0;
      for (const turno of turni || []) {
        if (!turno) continue;
        const dIso = estraiDataIso(turno.data);
        if (!isInPeriodo(dIso, dataDa, dataA)) continue;
        const equip: any = (turno as any).equipaggio || {};
        const candidati = [
          turno.autista,
          turno.caposervizio,
          turno.soccorritore2,
          turno.terzoSoccorritore,
          turno.operatoreCentrale,
          turno.centralinista,
          turno.osservatore,
          equip.autista,
          equip.caposervizio,
          equip.soccorritore2,
          equip.terzoSoccorritore,
          equip.operatoreCentrale,
          equip.centralinista,
          equip.osservatore,
          ...(Array.isArray((turno as any).equipaggioExtra) ? (turno as any).equipaggioExtra : []),
        ];
        const assegnato = candidati.some(
          (slot: any) =>
            slot &&
            ((slot.id && slot.id === v.id) ||
              (slot.volontarioId && slot.volontarioId === v.id) ||
              matchVolontarioNome(v, slot.nome || slot.volontarioNome))
        );
        if (!assegnato) continue;
        const h = calcolaOreFascia(turno.orarioInizio, turno.orarioFine, turno.fasciaOraria);
        if (h > 0) {
          oreTurni += h;
          conteggioTurni += 1;
        }
      }

      // 3. Ore di Formazione / Corsi frequentati
      let oreFormazione = 0;
      let conteggioCorsi = 0;
      for (const corso of corsi || []) {
        if (!corso || corso.stato === 'Annullato') continue;
        const iscritti = Array.isArray((corso as any).iscritti) ? (corso as any).iscritti : [];
        const iscritto = iscritti.find(
          (i: any) =>
            i &&
            ((i.volontarioId && i.volontarioId === v.id) ||
              matchVolontarioNome(v, i.nomeCompleto || i.volontarioNome))
        );
        if (!iscritto) continue;
        const dCorso = estraiDataIso(corso.dataFine || corso.dataInizio);
        if (!isInPeriodo(dCorso, dataDa, dataA)) continue;
        const oreSvolte = Number(iscritto.oreFrequenza || iscritto.oreFrequentate || 0);
        const oreFallback =
          oreSvolte > 0
            ? oreSvolte
            : iscritto.stato === 'Promosso' || iscritto.stato === 'Completato'
              ? Number(corso.oreTotali || 0)
              : 0;
        if (oreFallback > 0) {
          oreFormazione += oreFallback;
          conteggioCorsi += 1;
        }
      }

      // 4. Conteggio Servizi / Interventi in Archivio
      let serviziSvolti = 0;
      for (const s of serviziArchivio || []) {
        if (!s) continue;
        const dIso = estraiDataIso(s.data || s.dataServizio || s.dataOra);
        if (!isInPeriodo(dIso, dataDa, dataA)) continue;
        const eqText = [
          s.autista,
          s.caposervizio,
          s.soccorritore,
          s.soccorritore2,
          s.terzoSoccorritore,
          s.equipaggio,
          s.operatore,
          s.volontario,
        ]
          .filter(Boolean)
          .join(' ');
        if (matchVolontarioNome(v, eqText)) {
          serviziSvolti += 1;
        }
      }

      const oreTimbRound = Math.round(oreTimbrature * 10) / 10;
      const oreTurniRound = Math.round(oreTurni * 10) / 10;
      const oreFormRound = Math.round(oreFormazione * 10) / 10;
      // Totale operativo: prende il maggiore tra timbrature reali e turni assegnati + ore formazione (evita doppio conteggio turno+timbratura dello stesso turno!)
      const oreServizioEffettive = Math.max(oreTimbRound, oreTurniRound);
      const totaleOreComplessive = Math.round((oreServizioEffettive + oreFormRound) * 10) / 10;

      return {
        volontarioId: v.id,
        nomeCompleto,
        matricola: v.matricola || '-',
        codiceFiscale: (v.codiceFiscale || '-').toUpperCase(),
        qualifica: v.qualifica || 'Volontario',
        sezione: v.sezioneAppartenenzaNome || 'Sede Centrale',
        oreTimbrature: oreTimbRound,
        conteggioTimbratureValide,
        oreTurni: oreTurniRound,
        conteggioTurni,
        oreFormazione: oreFormRound,
        conteggioCorsi,
        serviziSvolti,
        totaleOreComplessive,
      };
    })
    .sort((a, b) => b.totaleOreComplessive - a.totaleOreComplessive || a.nomeCompleto.localeCompare(b.nomeCompleto, 'it'));
}

export function generaPdfCertificatoServizio(params: {
  riepilogo: RiepilogoOreVolontario;
  volontario?: Volontario;
  tipo: TipoCertificatoServizio;
  dataDa: string;
  dataA: string;
  noteAggiuntive?: string;
  firmatario?: string;
}): void {
  const { riepilogo, volontario, tipo, dataDa, dataA, noteAggiuntive, firmatario } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const dataDaIt = dataDa ? dataDa.split('-').reverse().join('/') : '-';
  const dataAIt = dataA ? dataA.split('-').reverse().join('/') : '-';
  const oggiIt = formatISODateItaly().split('-').reverse().join('/');
  const protocollo = `CERT-${formatISODateItaly().replace(/-/g, '')}-${riepilogo.matricola.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '001'}`;

  const titoliMap: Record<TipoCertificatoServizio, { header: string; titolo: string; norma: string }> = {
    attestato_servizio: {
      header: 'ATTESTATO DI SERVIZIO VOLONTARIO (ART. 17 D.LGS. 117/2017)',
      titolo: 'ATTESTATO DI SERVIZIO VOLONTARIO',
      norma: 'Rilasciato ai sensi del D.Lgs. 3 luglio 2017, n. 117 (Codice del Terzo Settore) per gli usi consentiti dalla legge.',
    },
    crediti_scolastici: {
      header: 'CERTIFICAZIONE ORE VOLONTARIATO - CREDITI SCOLASTICI / UNIVERSITARI / PCTO',
      titolo: 'CERTIFICATO ORE PER CREDITI FORMATIVI / SCOLASTICI / PCTO',
      norma: 'Rilasciato ai fini del riconoscimento di crediti scolastici, universitari o percorsi PCTO per attività di volontariato socio-sanitario e di protezione civile.',
    },
    protezione_civile: {
      header: 'ATTESTATO IMPIEGO VOLONTARIO PROTEZIONE CIVILE (D.LGS. 1/2018)',
      titolo: 'ATTESTATO DI ATTIVITA E IMPIEGO IN PROTEZIONE CIVILE',
      norma: 'Rilasciato ai sensi degli artt. 39 e 40 del D.Lgs. 2 gennaio 2018, n. 1 (Codice della Protezione Civile) e normativa regionale vigente.',
    },
  };

  const meta = titoliMap[tipo];

  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: meta.header,
    badge: {
      riga1Tag: 'PROTOCOLLO',
      riga2Valore: protocollo,
      riga3Sotto: `Emesso il ${oggiIt}`,
    },
    pageWidth,
    margin,
  });

  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: `Documento Ufficiale ${protocollo} • Generato il ${formatDateTimeItaly()} • Croce Oro Massa Carrara OdV`,
    pageWidth,
    pageHeight,
    margin,
  });

  let y = 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(29, 26, 96);
  doc.text(sanitizeWinAnsi(meta.titolo), pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const luogoNascitaVal = [volontario?.comuneNascita, volontario?.provinciaNascita ? `(${volontario.provinciaNascita})` : ''].filter(Boolean).join(' ');
  const nascitaStr =
    volontario?.dataNascita || luogoNascitaVal
      ? `, nato/a${luogoNascitaVal ? ` a ${luogoNascitaVal}` : ''}${volontario?.dataNascita ? ` il ${volontario.dataNascita}` : ''}`
      : '';
  const intro = sanitizeWinAnsi(
    `Si attesta che il/la Sig./Sig.ra ${riepilogo.nomeCompleto}${nascitaStr}, Codice Fiscale ${riepilogo.codiceFiscale}, iscritto/a nel Registro dei Volontari di Croce Oro Massa Carrara OdV con matricola ${riepilogo.matricola} (Qualifica: ${riepilogo.qualifica}, Sezione: ${riepilogo.sezione}), ha svolto attivamente servizio volontario e gratuito presso la nostra Organizzazione nel periodo compreso dal ${dataDaIt} al ${dataAIt}.`
  );
  const introLines = doc.splitTextToSize(intro, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 5.6 + 8;

  // Riepilogo Ore Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 52, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('RIEPILOGO CERTIFICATO DELLE ATTIVITA E DELLE ORE SVOLTE', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    sanitizeWinAnsi(`• Ore rilevate da Timbrature Presenza valide: ${riepilogo.oreTimbrature.toFixed(1)} ore (${riepilogo.conteggioTimbratureValide} presenze registrate)`),
    margin + 6,
    y + 17
  );
  doc.text(
    sanitizeWinAnsi(`• Ore da Calendario Turni Operativi assegnati: ${riepilogo.oreTurni.toFixed(1)} ore (${riepilogo.conteggioTurni} turni svolti)`),
    margin + 6,
    y + 24
  );
  doc.text(
    sanitizeWinAnsi(`• Ore di Formazione, Corsi e Aggiornamento: ${riepilogo.oreFormazione.toFixed(1)} ore (${riepilogo.conteggioCorsi} corsi/moduli)`),
    margin + 6,
    y + 31
  );
  doc.text(
    sanitizeWinAnsi(`• Servizi / Interventi documentati in archivio: ${riepilogo.serviziSvolti} servizi`),
    margin + 6,
    y + 38
  );

  doc.setFillColor(29, 26, 96);
  doc.roundedRect(margin + 5, y + 41.5, contentWidth - 10, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(251, 191, 36);
  doc.text(
    sanitizeWinAnsi(`TOTALE ORE COMPLESSIVE CERTIFICATE NEL PERIODO: ${riepilogo.totaleOreComplessive.toFixed(1)} ORE`),
    pageWidth / 2,
    y + 46.8,
    { align: 'center' }
  );

  y += 62;

  if (noteAggiuntive && noteAggiuntive.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(29, 26, 96);
    doc.text('NOTE E SPECIFICHE AGGIUNTIVE:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const noteLines = doc.splitTextToSize(sanitizeWinAnsi(noteAggiuntive), contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 8;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const normaLines = doc.splitTextToSize(sanitizeWinAnsi(meta.norma), contentWidth);
  doc.text(normaLines, margin, y);
  y += normaLines.length * 5 + 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(`Massa-Carrara, li ${oggiIt}`), margin, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Il Presidente / Legale Rappresentante', pageWidth - margin - 68, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(sanitizeWinAnsi(firmatario || 'Croce Oro Massa Carrara OdV'), pageWidth - margin - 68, y + 6);
  doc.setDrawColor(100, 116, 139);
  doc.line(pageWidth - margin - 68, y + 18, pageWidth - margin, y + 18);

  const safeName = riepilogo.nomeCompleto.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`Certificato_${tipo}_${safeName}_${formatISODateItaly()}.pdf`);
}

export function esportaRiepilogoOreCsv(
  righe: RiepilogoOreVolontario[],
  dataDa: string,
  dataA: string
): void {
  const headers = [
    'Matricola',
    'Volontario',
    'Codice Fiscale',
    'Qualifica',
    'Sezione',
    'Ore Timbrature Valide',
    'N. Timbrature',
    'Ore Turni',
    'N. Turni',
    'Ore Formazione',
    'N. Corsi',
    'Servizi Archivio',
    'Totale Ore Certificate',
  ];
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = righe.map((r) =>
    [
      r.matricola,
      r.nomeCompleto,
      r.codiceFiscale,
      r.qualifica,
      r.sezione,
      r.oreTimbrature.toFixed(1).replace('.', ','),
      r.conteggioTimbratureValide,
      r.oreTurni.toFixed(1).replace('.', ','),
      r.conteggioTurni,
      r.oreFormazione.toFixed(1).replace('.', ','),
      r.conteggioCorsi,
      r.serviziSvolti,
      r.totaleOreComplessive.toFixed(1).replace('.', ','),
    ]
      .map(esc)
      .join(';')
  );
  const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Report_Ore_Volontari_${dataDa}_al_${dataA}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
