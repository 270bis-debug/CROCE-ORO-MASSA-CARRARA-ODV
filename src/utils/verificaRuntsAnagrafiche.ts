import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import { disegnaHeaderIstituzionale, disegnaFooterIstituzionale, sanitizeWinAnsi } from './pdfInstitutionalLayout';
import { formatDateTimeItaly, formatISODateItaly, getItalianDateParts } from './italianTime';

export type GravitaAnomaliaRunts = 'critico' | 'avviso';

export interface AnomaliaCampoRunts {
  chiave: string;
  etichetta: string;
  gravita: GravitaAnomaliaRunts;
  dettaglio: string;
}

export interface EsitoVerificaVolontarioRunts {
  volontario: Volontario;
  nomeCompleto: string;
  sezione: string;
  punteggioPercentuale: number;
  anomalie: AnomaliaCampoRunts[];
  criticiCount: number;
  avvisiCount: number;
  conformeRunts: boolean;
}

export interface RiepilogoVerificaRunts {
  totaleAnalizzati: number;
  conformiTotali: number;
  conCritici: number;
  soloAvvisi: number;
  percentualeMediaCompletezza: number;
  conteggioPerCampo: Record<string, { etichetta: string; gravita: GravitaAnomaliaRunts; count: number }>;
  dettagli: EsitoVerificaVolontarioRunts[];
}

const CF_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPR-T][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i;

export function verificaCompletezzaAnagraficheRunts(volontari: Volontario[]): RiepilogoVerificaRunts {
  const oggiIso = formatISODateItaly();
  const annoCorrente = getItalianDateParts().year;
  const attivi = (volontari || []).filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi);

  const conteggioPerCampo: Record<string, { etichetta: string; gravita: GravitaAnomaliaRunts; count: number }> = {};
  const registra = (chiave: string, etichetta: string, gravita: GravitaAnomaliaRunts) => {
    if (!conteggioPerCampo[chiave]) {
      conteggioPerCampo[chiave] = { etichetta, gravita, count: 0 };
    }
    conteggioPerCampo[chiave].count += 1;
  };

  const dettagli: EsitoVerificaVolontarioRunts[] = attivi.map((v) => {
    const anomalie: AnomaliaCampoRunts[] = [];
    const totalChecks = 11;

    const cf = (v.codiceFiscale || '').trim().toUpperCase();
    if (!cf) {
      anomalie.push({ chiave: 'cf', etichetta: 'Codice Fiscale', gravita: 'critico', dettaglio: 'Mancante (obbligatorio RUNTS / Assicurazione)' });
      registra('cf', 'Codice Fiscale mancante o non valido', 'critico');
    } else if (!CF_REGEX.test(cf)) {
      anomalie.push({ chiave: 'cf', etichetta: 'Codice Fiscale', gravita: 'critico', dettaglio: `Formato non valido (${cf})` });
      registra('cf', 'Codice Fiscale mancante o non valido', 'critico');
    }

    if (!v.dataNascita || !/^\d{4}-\d{2}-\d{2}$/.test(v.dataNascita.trim())) {
      anomalie.push({ chiave: 'nascita', etichetta: 'Data di Nascita', gravita: 'critico', dettaglio: 'Mancante o incompleta' });
      registra('nascita', 'Data di Nascita mancante', 'critico');
    }

    if (!v.comuneNascita || !v.comuneNascita.trim()) {
      anomalie.push({ chiave: 'comuneNascita', etichetta: 'Comune di Nascita', gravita: 'critico', dettaglio: 'Non indicato' });
      registra('comuneNascita', 'Comune di Nascita mancante', 'critico');
    }

    if (!v.indirizzoResidenza || v.indirizzoResidenza.trim().length < 5) {
      anomalie.push({ chiave: 'residenza', etichetta: 'Indirizzo Residenza', gravita: 'critico', dettaglio: 'Mancante o incompleto' });
      registra('residenza', 'Indirizzo di Residenza mancante', 'critico');
    }

    if (!v.telefono || v.telefono.replace(/\D/g, '').length < 7) {
      anomalie.push({ chiave: 'telefono', etichetta: 'Telefono', gravita: 'critico', dettaglio: 'Recapito telefonico mancante' });
      registra('telefono', 'Telefono mancante', 'critico');
    }

    if (!v.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) {
      anomalie.push({ chiave: 'email', etichetta: 'Email', gravita: 'critico', dettaglio: 'Indirizzo email mancante o non valido' });
      registra('email', 'Email mancante o non valida', 'critico');
    }

    if (!v.domandaIscrizioneFirmata) {
      anomalie.push({ chiave: 'domanda', etichetta: 'Domanda Iscrizione', gravita: 'avviso', dettaglio: 'Domanda firmata non archiviata' });
      registra('domanda', 'Domanda di iscrizione firmata assente', 'avviso');
    }

    if (!v.firmaBase64 && !v.hasFirma) {
      anomalie.push({ chiave: 'firma', etichetta: 'Firma Digitale', gravita: 'avviso', dettaglio: 'Firma autografa non acquisita' });
      registra('firma', 'Firma digitale non acquisita', 'avviso');
    }

    if (!v.documentoIdentita?.numero) {
      anomalie.push({ chiave: 'documento', etichetta: 'Documento Identità', gravita: 'avviso', dettaglio: 'Documento non registrato' });
      registra('documento', 'Documento identità mancante/scaduto', 'avviso');
    } else if (v.documentoIdentita.dataScadenza && v.documentoIdentita.dataScadenza < oggiIso) {
      anomalie.push({ chiave: 'documento', etichetta: 'Documento Identità', gravita: 'critico', dettaglio: `Scaduto il ${v.documentoIdentita.dataScadenza}` });
      registra('documento', 'Documento identità mancante/scaduto', 'critico');
    }

    if (!v.sezioneAppartenenzaNome) {
      anomalie.push({ chiave: 'sezione', etichetta: 'Sezione Territoriale', gravita: 'avviso', dettaglio: 'Sezione non assegnata' });
      registra('sezione', 'Sezione territoriale non assegnata', 'avviso');
    }

    if (!v.esenteQuotaAssociativa && !(v.tesseramento?.rinnovata && Number(v.tesseramento?.annoRiferimento || 0) >= annoCorrente)) {
      anomalie.push({ chiave: 'tessera', etichetta: `Tesseramento ${annoCorrente}`, gravita: 'avviso', dettaglio: `Quota sociale ${annoCorrente} non rinnovata` });
      registra('tessera', `Quota sociale ${annoCorrente} non rinnovata`, 'avviso');
    }

    const criticiCount = anomalie.filter((a) => a.gravita === 'critico').length;
    const avvisiCount = anomalie.filter((a) => a.gravita === 'avviso').length;
    const punteggioPercentuale = Math.max(0, Math.round(((totalChecks - anomalie.length) / totalChecks) * 100));

    return {
      volontario: v,
      nomeCompleto: `${v.cognome || ''} ${v.nome || ''}`.trim() || v.matricola || 'Volontario',
      sezione: v.sezioneAppartenenzaNome || 'Non assegnata',
      punteggioPercentuale,
      anomalie,
      criticiCount,
      avvisiCount,
      conformeRunts: criticiCount === 0 && avvisiCount === 0,
    };
  });

  dettagli.sort((a, b) => b.criticiCount - a.criticiCount || b.avvisiCount - a.avvisiCount || a.nomeCompleto.localeCompare(b.nomeCompleto, 'it'));

  const conformiTotali = dettagli.filter((d) => d.conformeRunts).length;
  const conCritici = dettagli.filter((d) => d.criticiCount > 0).length;
  const soloAvvisi = dettagli.filter((d) => d.criticiCount === 0 && d.avvisiCount > 0).length;
  const percentualeMediaCompletezza =
    dettagli.length > 0
      ? Math.round(dettagli.reduce((sum, d) => sum + d.punteggioPercentuale, 0) / dettagli.length)
      : 100;

  return {
    totaleAnalizzati: dettagli.length,
    conformiTotali,
    conCritici,
    soloAvvisi,
    percentualeMediaCompletezza,
    conteggioPerCampo,
    dettagli,
  };
}

export function esportaVerificaRuntsCsv(riepilogo: RiepilogoVerificaRunts): void {
  const headers = ['Cognome e Nome', 'Matricola', 'Sezione', 'Completezza %', 'Critici', 'Avvisi', 'Dati Mancanti / Anomalie'];
  const esc = (v?: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = riepilogo.dettagli.map((d) =>
    [
      d.nomeCompleto,
      d.volontario.matricola || '-',
      d.sezione,
      `${d.punteggioPercentuale}%`,
      d.criticiCount,
      d.avvisiCount,
      d.anomalie.length === 0 ? 'Anagrafica completa' : d.anomalie.map((a) => `${a.etichetta} (${a.dettaglio})`).join(' | '),
    ]
      .map(esc)
      .join(';')
  );
  const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Verifica_Anagrafiche_RUNTS_${formatISODateItaly()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generaPdfVerificaRunts(riepilogo: RiepilogoVerificaRunts): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const oggi = formatISODateItaly();
  const dataOra = formatDateTimeItaly();

  const drawChrome = (pageNum: number) => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: 'VERIFICA COMPLETEZZA ANAGRAFICHE RUNTS & ASSICURAZIONE VOLONTARI',
      badge: {
        riga1Tag: 'AUDIT RUNTS',
        riga2Valore: `${riepilogo.percentualeMediaCompletezza}% COMPLETEZZA`,
        riga3Sotto: `${riepilogo.conCritici} critici • ${riepilogo.conformiTotali}/${riepilogo.totaleAnalizzati} conformi`,
      },
      pageWidth,
      margin,
    });
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${pageNum} • Verifica Anagrafiche RUNTS (Art. 17-18 D.Lgs. 117/2017) • Generato il ${dataOra}`,
      pageWidth,
      pageHeight,
      margin,
    });
  };

  let pageNum = 1;
  drawChrome(pageNum);
  let y = 37;

  const incompleti = riepilogo.dettagli.filter((d) => !d.conformeRunts);

  doc.setFillColor(29, 26, 96);
  doc.rect(margin, y, contentWidth, 7.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text('VOLONTARIO', margin + 2, y + 5);
  doc.text('SEZIONE', margin + 62, y + 5);
  doc.text('COMPL.', margin + 106, y + 5);
  doc.text('CRITICI', margin + 123, y + 5);
  doc.text('DATI MANCANTI / ANOMALIE RILEVATE', margin + 140, y + 5);
  y += 9;

  if (incompleti.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(5, 150, 105);
    doc.text('Tutte le anagrafiche dei volontari attivi risultano complete e conformi ai requisiti RUNTS.', margin + 4, y + 8);
  } else {
    incompleti.forEach((d, idx) => {
      const testoAnomalie = sanitizeWinAnsi(d.anomalie.map((a) => `${a.etichetta}: ${a.dettaglio}`).join(' • '));
      const lines = doc.splitTextToSize(testoAnomalie, contentWidth - 142);
      const rowH = Math.max(6.8, lines.length * 3.8 + 2.6);

      if (y + rowH > pageHeight - 20) {
        doc.addPage();
        pageNum += 1;
        drawChrome(pageNum);
        y = 37;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 1, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + rowH - 1, margin + contentWidth, y + rowH - 1);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizeWinAnsi(d.nomeCompleto).slice(0, 32), margin + 2, y + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(sanitizeWinAnsi(d.sezione).slice(0, 24), margin + 62, y + 3.6);
      doc.text(`${d.punteggioPercentuale}%`, margin + 106, y + 3.6);
      doc.setTextColor(d.criticiCount > 0 ? 220 : 217, d.criticiCount > 0 ? 38 : 119, d.criticiCount > 0 ? 38 : 6);
      doc.setFont('helvetica', 'bold');
      doc.text(String(d.criticiCount), margin + 126, y + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(lines, margin + 140, y + 3.6);
      y += rowH;
    });
  }

  doc.save(`Verifica_Anagrafiche_RUNTS_CroceOro_${oggi}.pdf`);
}
