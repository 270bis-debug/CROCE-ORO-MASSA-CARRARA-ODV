import { TesseraAssociativa, NotaDiDebito, InterventoManutenzione } from '../types/adminTypes';
import { RifornimentoCarburante } from '../types/consumiTypes';
import { formatDateItaly, formatTimeItaly } from './italianTime';

export const NOMI_MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export interface RigaProspettoMensile {
  meseNumero: number; // 1-12
  nomeMese: string;
  // ENTRATE
  conteggioDonazioni: number;
  totaleDonazioni: number; // in euro
  conteggioTessere: number;
  totaleTessere: number; // in euro
  conteggioNoteDebito: number;
  totaleNoteDebito: number; // in euro
  totaleEntrate: number; // somma entrate mese
  // USCITE
  conteggioManutenzioni: number;
  totaleManutenzioni: number; // in euro
  conteggioRifornimenti: number;
  totaleCarburante: number; // in euro
  totaleUscite: number; // somma uscite mese
  // SALDO
  saldoNetto: number; // entrate - uscite
}

export interface ProspettoAnnualeCommercialista {
  anno: number;
  mesi: RigaProspettoMensile[];
  totali: {
    totaleDonazioni: number;
    conteggioDonazioni: number;
    totaleTessere: number;
    conteggioTessere: number;
    totaleNoteDebito: number;
    conteggioNoteDebito: number;
    totaleEntrate: number;
    totaleManutenzioni: number;
    conteggioManutenzioni: number;
    totaleCarburante: number;
    conteggioRifornimenti: number;
    totaleUscite: number;
    saldoNettoEsercizio: number;
  };
}

/**
 * Calcola il prospetto contabile aggregato mese per mese per il commercialista
 */
export function calcolaProspettoCommercialista(
  anno: number,
  serviziArchivio: any[] = [],
  tessere: TesseraAssociativa[] = [],
  noteDiDebito: NotaDiDebito[] = [],
  manutenzioni: InterventoManutenzione[] = [],
  rifornimenti: RifornimentoCarburante[] = []
): ProspettoAnnualeCommercialista {
  const mesi: RigaProspettoMensile[] = [];

  for (let m = 0; m < 12; m++) {
    const meseNum = m + 1;
    const meseStr = `${anno}-${String(meseNum).padStart(2, '0')}`;

    // 1. Donazioni da missioni o donazioni registrate nel mese
    let conteggioDon = 0;
    let sommaDon = 0;
    serviziArchivio.forEach((s) => {
      const dataS = s.data || s.dataServizio || '';
      if (dataS.startsWith(meseStr)) {
        const importo = parseFloat(s.donazioneLibera || s.importoDonazione || s.offertaLibera || (s.donazione && s.donazione.somma) || '0') || 0;
        if (importo > 0) {
          conteggioDon++;
          sommaDon += importo;
        }
      }
    });

    // 2. Quote Tesseramento soci
    let conteggioTess = 0;
    let sommaTess = 0;
    tessere.forEach((t) => {
      const dataT = t.dataEmissione || '';
      if (dataT.startsWith(meseStr) && t.stato !== 'Annullata') {
        conteggioTess++;
        sommaTess += (t.quotaVersata || 0);
      }
    });

    // 3. Note di Debito / Rimborsi sanitari emessi nel mese
    let conteggioNote = 0;
    let sommaNote = 0;
    noteDiDebito.forEach((nd) => {
      const dataN = nd.dataEmissione || '';
      if (dataN.startsWith(meseStr) && nd.stato !== 'Annullata') {
        conteggioNote++;
        sommaNote += (nd.importoTotale || 0);
      }
    });

    // Totale Entrate del Mese
    const totaleEntrateMese = Math.round((sommaDon + sommaTess + sommaNote) * 100) / 100;

    // 4. Uscite: Manutenzioni Flotta
    let conteggioManut = 0;
    let sommaManut = 0;
    manutenzioni.forEach((man) => {
      const dataM = man.dataIntervento || '';
      if (dataM.startsWith(meseStr)) {
        conteggioManut++;
        sommaManut += (man.costoTotale || 0);
      }
    });

    // 5. Uscite: Carburante Flotta
    let conteggioRif = 0;
    let sommaRif = 0;
    rifornimenti.forEach((r) => {
      const dataR = r.data || '';
      if (dataR.startsWith(meseStr)) {
        conteggioRif++;
        sommaRif += (r.costoTotale || 0);
      }
    });

    // Totale Uscite del Mese
    const totaleUsciteMese = Math.round((sommaManut + sommaRif) * 100) / 100;
    const saldoNettoMese = Math.round((totaleEntrateMese - totaleUsciteMese) * 100) / 100;

    mesi.push({
      meseNumero: meseNum,
      nomeMese: NOMI_MESI[m],
      conteggioDonazioni: conteggioDon,
      totaleDonazioni: Math.round(sommaDon * 100) / 100,
      conteggioTessere: conteggioTess,
      totaleTessere: Math.round(sommaTess * 100) / 100,
      conteggioNoteDebito: conteggioNote,
      totaleNoteDebito: Math.round(sommaNote * 100) / 100,
      totaleEntrate: totaleEntrateMese,
      conteggioManutenzioni: conteggioManut,
      totaleManutenzioni: Math.round(sommaManut * 100) / 100,
      conteggioRifornimenti: conteggioRif,
      totaleCarburante: Math.round(sommaRif * 100) / 100,
      totaleUscite: totaleUsciteMese,
      saldoNetto: saldoNettoMese
    });
  }

  // Totali annuali
  const totaleDonazioni = Math.round(mesi.reduce((acc, m) => acc + m.totaleDonazioni, 0) * 100) / 100;
  const conteggioDonazioni = mesi.reduce((acc, m) => acc + m.conteggioDonazioni, 0);
  const totaleTessere = Math.round(mesi.reduce((acc, m) => acc + m.totaleTessere, 0) * 100) / 100;
  const conteggioTessere = mesi.reduce((acc, m) => acc + m.conteggioTessere, 0);
  const totaleNoteDebito = Math.round(mesi.reduce((acc, m) => acc + m.totaleNoteDebito, 0) * 100) / 100;
  const conteggioNoteDebito = mesi.reduce((acc, m) => acc + m.conteggioNoteDebito, 0);
  const totaleEntrate = Math.round(mesi.reduce((acc, m) => acc + m.totaleEntrate, 0) * 100) / 100;

  const totaleManutenzioni = Math.round(mesi.reduce((acc, m) => acc + m.totaleManutenzioni, 0) * 100) / 100;
  const conteggioManutenzioni = mesi.reduce((acc, m) => acc + m.conteggioManutenzioni, 0);
  const totaleCarburante = Math.round(mesi.reduce((acc, m) => acc + m.totaleCarburante, 0) * 100) / 100;
  const conteggioRifornimenti = mesi.reduce((acc, m) => acc + m.conteggioRifornimenti, 0);
  const totaleUscite = Math.round(mesi.reduce((acc, m) => acc + m.totaleUscite, 0) * 100) / 100;

  const saldoNettoEsercizio = Math.round((totaleEntrate - totaleUscite) * 100) / 100;

  return {
    anno,
    mesi,
    totali: {
      totaleDonazioni,
      conteggioDonazioni,
      totaleTessere,
      conteggioTessere,
      totaleNoteDebito,
      conteggioNoteDebito,
      totaleEntrate,
      totaleManutenzioni,
      conteggioManutenzioni,
      totaleCarburante,
      conteggioRifornimenti,
      totaleUscite,
      saldoNettoEsercizio
    }
  };
}

/**
 * Esporta il prospetto annuale per il commercialista in formato CSV compatibile Excel
 */
export function scaricaProspettoCommercialistaCSV(
  prospetto: ProspettoAnnualeCommercialista
): string {
  const headers = [
    'Mese',
    'N. Donazioni',
    'Donazioni (€)',
    'N. Tessere',
    'Tesseramento Soci (€)',
    'N. Note Debito',
    'Note di Debito / Rimborsi (€)',
    'TOTALE ENTRATE (€)',
    'N. Manutenzioni',
    'Manutenzione Mezzi (€)',
    'N. Rifornimenti',
    'Carburante Flotta (€)',
    'TOTALE USCITE (€)',
    'SALDO NETTO (€)'
  ];

  const rows = prospetto.mesi.map((m) => [
    `"${m.nomeMese} ${prospetto.anno}"`,
    m.conteggioDonazioni,
    m.totaleDonazioni.toFixed(2).replace('.', ','),
    m.conteggioTessere,
    m.totaleTessere.toFixed(2).replace('.', ','),
    m.conteggioNoteDebito,
    m.totaleNoteDebito.toFixed(2).replace('.', ','),
    m.totaleEntrate.toFixed(2).replace('.', ','),
    m.conteggioManutenzioni,
    m.totaleManutenzioni.toFixed(2).replace('.', ','),
    m.conteggioRifornimenti,
    m.totaleCarburante.toFixed(2).replace('.', ','),
    m.totaleUscite.toFixed(2).replace('.', ','),
    m.saldoNetto.toFixed(2).replace('.', ',')
  ]);

  // Riga Totali Annuali
  const rowTotale = [
    `"TOTALE ANNO ${prospetto.anno}"`,
    prospetto.totali.conteggioDonazioni,
    prospetto.totali.totaleDonazioni.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioTessere,
    prospetto.totali.totaleTessere.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioNoteDebito,
    prospetto.totali.totaleNoteDebito.toFixed(2).replace('.', ','),
    prospetto.totali.totaleEntrate.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioManutenzioni,
    prospetto.totali.totaleManutenzioni.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioRifornimenti,
    prospetto.totali.totaleCarburante.toFixed(2).replace('.', ','),
    prospetto.totali.totaleUscite.toFixed(2).replace('.', ','),
    prospetto.totali.saldoNettoEsercizio.toFixed(2).replace('.', ',')
  ];

  const csvContent =
    '\uFEFF' + // UTF-8 BOM per visualizzazione corretta accenti in Excel
    `"CROCE ORO MASSA CARRARA OdV - PROSPETTO MENSILE CONTABILITÀ PER IL COMMERCIALISTA (ANNO ${prospetto.anno})"\n` +
    `"Generato il: ${formatDateItaly()} ore ${formatTimeItaly()}"\n\n` +
    headers.join(';') + '\n' +
    rows.map(r => r.join(';')).join('\n') + '\n' +
    rowTotale.join(';');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nomeFile = `prospetto_commercialista_croceoro_${prospetto.anno}.csv`;
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return nomeFile;
}
