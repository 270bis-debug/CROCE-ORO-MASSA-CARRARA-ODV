import {
  TesseraAssociativa,
  NotaDiDebito,
  InterventoManutenzione,
  MovimentoAltreEntrateUscite,
  VoceCostoGestione
} from '../types/adminTypes';
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
  conteggioAltreEntrate: number;
  totaleAltreEntrate: number; // in euro (da Altre Entrate/Uscite)
  conteggioCostiGestioneEntrate: number;
  totaleCostiGestioneEntrate: number; // in euro (rimborsi/entrate da Costi di Gestione)
  totaleEntrate: number; // somma entrate mese
  // USCITE
  conteggioManutenzioni: number;
  totaleManutenzioni: number; // in euro
  conteggioRifornimenti: number;
  totaleCarburante: number; // in euro
  conteggioAltreUscite: number;
  totaleAltreUscite: number; // in euro (da Altre Entrate/Uscite)
  conteggioCostiGestioneUscite: number;
  totaleCostiGestioneUscite: number; // in euro (costi da Costi di Gestione)
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
    totaleAltreEntrate: number;
    conteggioAltreEntrate: number;
    totaleCostiGestioneEntrate: number;
    conteggioCostiGestioneEntrate: number;
    totaleEntrate: number;
    totaleManutenzioni: number;
    conteggioManutenzioni: number;
    totaleCarburante: number;
    conteggioRifornimenti: number;
    totaleAltreUscite: number;
    conteggioAltreUscite: number;
    totaleCostiGestioneUscite: number;
    conteggioCostiGestioneUscite: number;
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
  rifornimenti: RifornimentoCarburante[] = [],
  altreEntrateUscite: MovimentoAltreEntrateUscite[] = [],
  costiGestione: VoceCostoGestione[] = []
): ProspettoAnnualeCommercialista {
  const mesi: RigaProspettoMensile[] = [];

  const extractIsoDate = (raw?: string): string => {
    const str = (raw || '').trim();
    if (!str) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const mIt = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
    if (mIt) return `${mIt[3]}-${mIt[2]}-${mIt[1]}`;
    return str;
  };

  for (let m = 0; m < 12; m++) {
    const meseNum = m + 1;
    const meseStr = `${anno}-${String(meseNum).padStart(2, '0')}`;

    // 1. Donazioni da missioni o donazioni registrate nel mese
    let conteggioDon = 0;
    let sommaDon = 0;
    serviziArchivio.forEach((s) => {
      const dataS = extractIsoDate(s.dataDonazione || s.data || s.dataServizio || '');
      if (dataS.startsWith(meseStr)) {
        const importo =
          parseFloat(
            s.donazioneLibera ||
              s.importoDonazione ||
              s.offertaLibera ||
              (s.donazione && (s.donazione.somma ?? s.donazione.importo)) ||
              (s.datiDestinazione && s.datiDestinazione.donazione && s.datiDestinazione.donazione.somma) ||
              '0'
          ) || 0;
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
      const dataT = extractIsoDate(t.dataEmissione || '');
      if (dataT.startsWith(meseStr) && t.stato !== 'Annullata') {
        conteggioTess++;
        sommaTess += (t.quotaVersata || 0);
      }
    });

    // 3. Note di Debito / Rimborsi sanitari emessi nel mese
    let conteggioNote = 0;
    let sommaNote = 0;
    noteDiDebito.forEach((nd) => {
      const dataN = extractIsoDate(nd.dataEmissione || '');
      if (dataN.startsWith(meseStr) && nd.stato !== 'Annullata') {
        conteggioNote++;
        sommaNote += (nd.importoTotale || 0);
      }
    });

    // 4. Altre Entrate / Uscite (manuali)
    let conteggioAltreEnt = 0;
    let sommaAltreEnt = 0;
    let conteggioAltreUsc = 0;
    let sommaAltreUsc = 0;
    (altreEntrateUscite || []).forEach((mov) => {
      const dataMov = extractIsoDate(mov.data || '');
      const imp = Number(mov.importo) || 0;
      if (dataMov.startsWith(meseStr) && imp > 0) {
        if (mov.tipo === 'entrata') {
          conteggioAltreEnt++;
          sommaAltreEnt += imp;
        } else {
          conteggioAltreUsc++;
          sommaAltreUsc += imp;
        }
      }
    });

    // 5. Costi di Gestione (manuali: uscite + eventuali entrate/rimborsi)
    let conteggioGestUsc = 0;
    let sommaGestUsc = 0;
    let conteggioGestEnt = 0;
    let sommaGestEnt = 0;
    (costiGestione || []).forEach((voce) => {
      const dataV = extractIsoDate(voce.data || '');
      const imp = Number(voce.importo) || 0;
      if (dataV.startsWith(meseStr) && imp > 0) {
        if (voce.tipo === 'entrata') {
          conteggioGestEnt++;
          sommaGestEnt += imp;
        } else {
          conteggioGestUsc++;
          sommaGestUsc += imp;
        }
      }
    });

    // Totale Entrate del Mese
    const totaleEntrateMese =
      Math.round((sommaDon + sommaTess + sommaNote + sommaAltreEnt + sommaGestEnt) * 100) / 100;

    // 6. Uscite: Manutenzioni Flotta
    let conteggioManut = 0;
    let sommaManut = 0;
    manutenzioni.forEach((man) => {
      const dataM = extractIsoDate(man.dataIntervento || '');
      if (dataM.startsWith(meseStr)) {
        conteggioManut++;
        sommaManut += (man.costoTotale || 0);
      }
    });

    // 7. Uscite: Carburante Flotta
    let conteggioRif = 0;
    let sommaRif = 0;
    rifornimenti.forEach((r) => {
      const dataR = extractIsoDate(r.data || '');
      if (dataR.startsWith(meseStr)) {
        conteggioRif++;
        sommaRif += (r.costoTotale || 0);
      }
    });

    // Totale Uscite del Mese
    const totaleUsciteMese =
      Math.round((sommaManut + sommaRif + sommaAltreUsc + sommaGestUsc) * 100) / 100;
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
      conteggioAltreEntrate: conteggioAltreEnt,
      totaleAltreEntrate: Math.round(sommaAltreEnt * 100) / 100,
      conteggioCostiGestioneEntrate: conteggioGestEnt,
      totaleCostiGestioneEntrate: Math.round(sommaGestEnt * 100) / 100,
      totaleEntrate: totaleEntrateMese,
      conteggioManutenzioni: conteggioManut,
      totaleManutenzioni: Math.round(sommaManut * 100) / 100,
      conteggioRifornimenti: conteggioRif,
      totaleCarburante: Math.round(sommaRif * 100) / 100,
      conteggioAltreUscite: conteggioAltreUsc,
      totaleAltreUscite: Math.round(sommaAltreUsc * 100) / 100,
      conteggioCostiGestioneUscite: conteggioGestUsc,
      totaleCostiGestioneUscite: Math.round(sommaGestUsc * 100) / 100,
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
  const totaleAltreEntrate = Math.round(mesi.reduce((acc, m) => acc + m.totaleAltreEntrate, 0) * 100) / 100;
  const conteggioAltreEntrate = mesi.reduce((acc, m) => acc + m.conteggioAltreEntrate, 0);
  const totaleCostiGestioneEntrate = Math.round(mesi.reduce((acc, m) => acc + m.totaleCostiGestioneEntrate, 0) * 100) / 100;
  const conteggioCostiGestioneEntrate = mesi.reduce((acc, m) => acc + m.conteggioCostiGestioneEntrate, 0);
  const totaleEntrate = Math.round(mesi.reduce((acc, m) => acc + m.totaleEntrate, 0) * 100) / 100;

  const totaleManutenzioni = Math.round(mesi.reduce((acc, m) => acc + m.totaleManutenzioni, 0) * 100) / 100;
  const conteggioManutenzioni = mesi.reduce((acc, m) => acc + m.conteggioManutenzioni, 0);
  const totaleCarburante = Math.round(mesi.reduce((acc, m) => acc + m.totaleCarburante, 0) * 100) / 100;
  const conteggioRifornimenti = mesi.reduce((acc, m) => acc + m.conteggioRifornimenti, 0);
  const totaleAltreUscite = Math.round(mesi.reduce((acc, m) => acc + m.totaleAltreUscite, 0) * 100) / 100;
  const conteggioAltreUscite = mesi.reduce((acc, m) => acc + m.conteggioAltreUscite, 0);
  const totaleCostiGestioneUscite = Math.round(mesi.reduce((acc, m) => acc + m.totaleCostiGestioneUscite, 0) * 100) / 100;
  const conteggioCostiGestioneUscite = mesi.reduce((acc, m) => acc + m.conteggioCostiGestioneUscite, 0);
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
      totaleAltreEntrate,
      conteggioAltreEntrate,
      totaleCostiGestioneEntrate,
      conteggioCostiGestioneEntrate,
      totaleEntrate,
      totaleManutenzioni,
      conteggioManutenzioni,
      totaleCarburante,
      conteggioRifornimenti,
      totaleAltreUscite,
      conteggioAltreUscite,
      totaleCostiGestioneUscite,
      conteggioCostiGestioneUscite,
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
    'N. Altre Entrate',
    'Altre Entrate (€)',
    'N. Entrate Gestione',
    'Entrate Costi Gestione (€)',
    'TOTALE ENTRATE (€)',
    'N. Manutenzioni',
    'Manutenzione Mezzi (€)',
    'N. Rifornimenti',
    'Carburante Flotta (€)',
    'N. Altre Uscite',
    'Altre Uscite (€)',
    'N. Costi Gestione',
    'Costi di Gestione (€)',
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
    m.conteggioAltreEntrate,
    m.totaleAltreEntrate.toFixed(2).replace('.', ','),
    m.conteggioCostiGestioneEntrate,
    m.totaleCostiGestioneEntrate.toFixed(2).replace('.', ','),
    m.totaleEntrate.toFixed(2).replace('.', ','),
    m.conteggioManutenzioni,
    m.totaleManutenzioni.toFixed(2).replace('.', ','),
    m.conteggioRifornimenti,
    m.totaleCarburante.toFixed(2).replace('.', ','),
    m.conteggioAltreUscite,
    m.totaleAltreUscite.toFixed(2).replace('.', ','),
    m.conteggioCostiGestioneUscite,
    m.totaleCostiGestioneUscite.toFixed(2).replace('.', ','),
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
    prospetto.totali.conteggioAltreEntrate,
    prospetto.totali.totaleAltreEntrate.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioCostiGestioneEntrate,
    prospetto.totali.totaleCostiGestioneEntrate.toFixed(2).replace('.', ','),
    prospetto.totali.totaleEntrate.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioManutenzioni,
    prospetto.totali.totaleManutenzioni.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioRifornimenti,
    prospetto.totali.totaleCarburante.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioAltreUscite,
    prospetto.totali.totaleAltreUscite.toFixed(2).replace('.', ','),
    prospetto.totali.conteggioCostiGestioneUscite,
    prospetto.totali.totaleCostiGestioneUscite.toFixed(2).replace('.', ','),
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
