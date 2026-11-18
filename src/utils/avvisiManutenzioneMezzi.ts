import { useState, useEffect } from 'react';
import { MezzoFlotta, InterventoManutenzione, DotazioneMagazzinoMezzo } from '../types/adminTypes';
import { formatDateTimeItaly } from './italianTime';

export const EMAIL_RESPONSABILE_PARCO_MEZZI = 'mezzi@croceoro.org';
export const EMAIL_PRESIDENZA_CROCE_ORO = 'presidenza@croceoro.org';
export const EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT = `${EMAIL_RESPONSABILE_PARCO_MEZZI}, ${EMAIL_PRESIDENZA_CROCE_ORO}`;

export interface AlertManutenzioneProgrammata {
  id: string;
  mezzoSigla: string;
  modello?: string;
  targa?: string;
  tipo:
    | 'Tagliando Programmato'
    | 'Revisione Ministeriale'
    | 'Polizza Assicurativa'
    | 'Bollo Auto'
    | 'Intervento Meccanico'
    | 'Revisione Bombola Ossigeno'
    | 'Controllo Estintore / Dotazione'
    | 'Altra Scadenza Mezzo';
  dataScadenza: string;
  giorniRimanenti: number;
  scaduta: boolean;
  dettagli: string;
  officina?: string;
  sedeStazionamento?: string;
}

/**
 * Ottiene l'elenco degli indirizzi email configurati per gli avvisi del parco mezzi
 * (Predefiniti: mezzi@croceoro.org e presidenza@croceoro.org)
 */
export function getEmailResponsabileMezzi(): string {
  try {
    const salvata = localStorage.getItem('croceoro_email_responsabile_mezzi');
    if (!salvata || salvata.trim() === '' || salvata === 'parcomezzi@croceoro.org' || salvata.includes('nicodemimarmi@gmail.com') || !salvata.includes('mezzi@croceoro.org')) {
      // Sincronizzazione automatica con i due destinatari ufficiali
      localStorage.setItem('croceoro_email_responsabile_mezzi', EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT);
      return EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT;
    }
    return salvata;
  } catch {
    return EMAIL_RESPONSABILE_PARCO_MEZZI_DEFAULT;
  }
}

/**
 * Salva l'email o l'elenco di email del responsabile parco mezzi nelle impostazioni locali
 */
export function salvaEmailResponsabileMezzi(email: string) {
  try {
    localStorage.setItem('croceoro_email_responsabile_mezzi', email.trim());
  } catch {}
}

export interface RegolaNotificaScadenzeMezzi {
  giorniPreavvisoScadenzario: number;
  giorniSogliaNotificaEmail: number;
  invioAutomaticoAttivo: boolean;
  regolaTestuale: string;
  ultimoAggiornamentoDa?: string;
  ultimoAggiornamentoCarica?: string;
  ultimoAggiornamentoDataOra?: string;
  updatedAt?: number;
}

export const REGOLA_NOTIFICA_SCADENZE_STORAGE_KEY = 'croceoro_regola_notifica_scadenze_mezzi_v1';
export const REGOLA_NOTIFICA_SCADENZE_EVENT = 'croceoro_regola_scadenze_mezzi_updated';

export const REGOLA_NOTIFICA_SCADENZE_DEFAULT: RegolaNotificaScadenzeMezzi = {
  giorniPreavvisoScadenzario: 30,
  giorniSogliaNotificaEmail: 15,
  invioAutomaticoAttivo: true,
  regolaTestuale:
    'Invia avviso automatico email a Responsabile Mezzi e Presidenza entro 15 giorni dalla scadenza (rilevazione scadenzario a 30 giorni) per assicurazioni, tagliandi, revisioni, bolli e dotazioni.'
};

export function normalizzaRegolaNotificaScadenzeMezzi(raw: any): RegolaNotificaScadenzeMezzi {
  const src = raw && typeof raw === 'object' ? raw : {};
  const sogliaNotifica = Math.max(1, Math.min(365, Math.round(Number(src.giorniSogliaNotificaEmail) || REGOLA_NOTIFICA_SCADENZE_DEFAULT.giorniSogliaNotificaEmail)));
  const preavvisoScad = Math.max(sogliaNotifica, Math.min(365, Math.round(Number(src.giorniPreavvisoScadenzario) || REGOLA_NOTIFICA_SCADENZE_DEFAULT.giorniPreavvisoScadenzario)));
  const regolaTestuale = String(src.regolaTestuale || '').trim() ||
    `Invia avviso automatico email a Responsabile Mezzi e Presidenza entro ${sogliaNotifica} giorni dalla scadenza (rilevazione scadenzario a ${preavvisoScad} giorni).`;
  return {
    giorniPreavvisoScadenzario: preavvisoScad,
    giorniSogliaNotificaEmail: sogliaNotifica,
    invioAutomaticoAttivo: src.invioAutomaticoAttivo !== false,
    regolaTestuale,
    ultimoAggiornamentoDa: src.ultimoAggiornamentoDa ? String(src.ultimoAggiornamentoDa) : undefined,
    ultimoAggiornamentoCarica: src.ultimoAggiornamentoCarica ? String(src.ultimoAggiornamentoCarica) : undefined,
    ultimoAggiornamentoDataOra: src.ultimoAggiornamentoDataOra ? String(src.ultimoAggiornamentoDataOra) : undefined,
    updatedAt: typeof src.updatedAt === 'number' && Number.isFinite(src.updatedAt) ? src.updatedAt : undefined
  };
}

export function getRegolaNotificaScadenzeMezzi(): RegolaNotificaScadenzeMezzi {
  if (typeof window === 'undefined') return { ...REGOLA_NOTIFICA_SCADENZE_DEFAULT };
  try {
    const raw = localStorage.getItem(REGOLA_NOTIFICA_SCADENZE_STORAGE_KEY);
    if (raw) {
      return normalizzaRegolaNotificaScadenzeMezzi(JSON.parse(raw));
    }
  } catch {}
  return { ...REGOLA_NOTIFICA_SCADENZE_DEFAULT };
}

export function salvaRegolaNotificaScadenzeMezzi(
  regola: Partial<RegolaNotificaScadenzeMezzi>,
  skipServerPost: boolean = false
): RegolaNotificaScadenzeMezzi {
  const corrente = getRegolaNotificaScadenzeMezzi();
  const norm = normalizzaRegolaNotificaScadenzeMezzi({
    ...corrente,
    ...regola,
    updatedAt: typeof regola.updatedAt === 'number' && regola.updatedAt > 0 ? regola.updatedAt : Date.now()
  });
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(REGOLA_NOTIFICA_SCADENZE_STORAGE_KEY, JSON.stringify(norm));
      window.dispatchEvent(new CustomEvent(REGOLA_NOTIFICA_SCADENZE_EVENT));
    } catch {}
    if (!skipServerPost) {
      fetch('/api/regola-scadenze-mezzi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regola: norm })
      }).catch(() => {});
    }
  }
  return norm;
}

export function applicaRegolaNotificaScadenzeDaSync(regola?: any): boolean {
  if (!regola || typeof regola !== 'object') return false;
  const local = getRegolaNotificaScadenzeMezzi();
  const incomingTs = typeof regola.updatedAt === 'number' ? regola.updatedAt : 0;
  const localTs = typeof local.updatedAt === 'number' ? local.updatedAt : 0;
  if (incomingTs > 0 && localTs > incomingTs) return false;
  salvaRegolaNotificaScadenzeMezzi(regola, true);
  return true;
}

export function useRegolaNotificaScadenzeMezzi(): RegolaNotificaScadenzeMezzi {
  const [regola, setRegola] = useState<RegolaNotificaScadenzeMezzi>(() => getRegolaNotificaScadenzeMezzi());

  useEffect(() => {
    const refresh = () => setRegola(getRegolaNotificaScadenzeMezzi());
    const storageHandler = (e: StorageEvent) => {
      if (!e.key || e.key === REGOLA_NOTIFICA_SCADENZE_STORAGE_KEY) refresh();
    };
    window.addEventListener(REGOLA_NOTIFICA_SCADENZE_EVENT, refresh);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(REGOLA_NOTIFICA_SCADENZE_EVENT, refresh);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  return regola;
}

/**
 * Calcola tutti gli interventi di manutenzione e scadenze programmate
 * in scadenza entro un certo numero di giorni (default 30 giorni) o già scadute.
 */
export function calcolaManutenzioniInScadenza(
  mezzi: MezzoFlotta[] = [],
  manutenzioni: InterventoManutenzione[] = [],
  sogliaGiorni = 30,
  dataRiferimento = new Date(),
  dotazioni: DotazioneMagazzinoMezzo[] = []
): AlertManutenzioneProgrammata[] {
  const oggiMs = dataRiferimento.getTime();
  const alerts: AlertManutenzioneProgrammata[] = [];

  const msPerGiorno = 1000 * 60 * 60 * 24;

  // 1. Controlla gli interventi di manutenzione programmata salvati
  manutenzioni.forEach((m) => {
    if (m.scadenzaProssimaData) {
      const scadenzaMs = new Date(m.scadenzaProssimaData).getTime();
      if (!isNaN(scadenzaMs)) {
        const diffGiorni = Math.ceil((scadenzaMs - oggiMs) / msPerGiorno);
        if (diffGiorni <= sogliaGiorni) {
          const mezzoMatch = mezzi.find(v => v.sigla === m.mezzoSigla);
          alerts.push({
            id: `manut-alert-${m.id}`,
            mezzoSigla: m.mezzoSigla,
            modello: mezzoMatch?.modello,
            targa: mezzoMatch?.targa,
            tipo: m.tipoIntervento === 'Tagliando Ordinario' ? 'Tagliando Programmato' : 'Intervento Meccanico',
            dataScadenza: m.scadenzaProssimaData,
            giorniRimanenti: diffGiorni,
            scaduta: diffGiorni < 0,
            dettagli: m.descrizione || `Prossimo ${m.tipoIntervento} programmato`,
            officina: m.officinaEsecutrice,
            sedeStazionamento: mezzoMatch?.sedeStazionamento
          });
        }
      }
    }
  });

  // 2. Controlla scadenze dei mezzi (Revisione Ministeriale, Polizza Assicurativa, Bollo Auto)
  mezzi.forEach((m) => {
    // A. Revisione Ministeriale
    if (m.scadenzaRevisione) {
      const revMs = new Date(m.scadenzaRevisione).getTime();
      if (!isNaN(revMs)) {
        const diffGiorni = Math.ceil((revMs - oggiMs) / msPerGiorno);
        if (diffGiorni <= sogliaGiorni) {
          alerts.push({
            id: `rev-alert-${m.id}`,
            mezzoSigla: m.sigla,
            modello: m.modello,
            targa: m.targa,
            tipo: 'Revisione Ministeriale',
            dataScadenza: m.scadenzaRevisione,
            giorniRimanenti: diffGiorni,
            scaduta: diffGiorni < 0,
            dettagli: `Collaudo biennale MCTC / Motorizzazione Civile`,
            sedeStazionamento: m.sedeStazionamento
          });
        }
      }
    }

    // B. Assicurazione RCA
    if (m.scadenzaAssicurazione) {
      const assMs = new Date(m.scadenzaAssicurazione).getTime();
      if (!isNaN(assMs)) {
        const diffGiorni = Math.ceil((assMs - oggiMs) / msPerGiorno);
        if (diffGiorni <= sogliaGiorni) {
          alerts.push({
            id: `ass-alert-${m.id}`,
            mezzoSigla: m.sigla,
            modello: m.modello,
            targa: m.targa,
            tipo: 'Polizza Assicurativa',
            dataScadenza: m.scadenzaAssicurazione,
            giorniRimanenti: diffGiorni,
            scaduta: diffGiorni < 0,
            dettagli: `Rinnovo polizza RCA & Kasko mezzi di soccorso`,
            sedeStazionamento: m.sedeStazionamento
          });
        }
      }
    }

    // C. Bollo Auto
    if (m.scadenzaBollo) {
      const bolloMs = new Date(m.scadenzaBollo).getTime();
      if (!isNaN(bolloMs)) {
        const diffGiorni = Math.ceil((bolloMs - oggiMs) / msPerGiorno);
        if (diffGiorni <= sogliaGiorni) {
          alerts.push({
            id: `bollo-alert-${m.id}`,
            mezzoSigla: m.sigla,
            modello: m.modello,
            targa: m.targa,
            tipo: 'Bollo Auto',
            dataScadenza: m.scadenzaBollo,
            giorniRimanenti: diffGiorni,
            scaduta: diffGiorni < 0,
            dettagli: `Tassa automobilistica regionale / esenzione OdV`,
            sedeStazionamento: m.sedeStazionamento
          });
        }
      }
    }
  });

  // 3. Controlla scadenze delle dotazioni dei mezzi (Revisione/Collaudo bombole O2, estintori, dotazioni di bordo)
  if (Array.isArray(dotazioni)) {
    dotazioni.forEach((d) => {
      const dataScad = d.dataScadenzaRevisione || d.dataScadenzaCollaudo;
      if (dataScad) {
        const dMs = new Date(dataScad).getTime();
        if (!isNaN(dMs)) {
          const diffGiorni = Math.ceil((dMs - oggiMs) / msPerGiorno);
          if (diffGiorni <= sogliaGiorni) {
            const mezzoMatch = mezzi.find(v => v.sigla === d.mezzoSigla);
            const isBombola = d.categoria === 'Ossigeno & Respirazione' || d.nomeOggetto.toLowerCase().includes('bombola') || d.nomeOggetto.toLowerCase().includes('o2');
            const isEstintore = d.categoria === 'Antincendio' || d.nomeOggetto.toLowerCase().includes('estintore');
            alerts.push({
              id: `dot-alert-${d.id}`,
              mezzoSigla: d.mezzoSigla || 'Scorta Centrale',
              modello: mezzoMatch?.modello,
              targa: mezzoMatch?.targa,
              tipo: isBombola ? 'Revisione Bombola Ossigeno' : (isEstintore ? 'Controllo Estintore / Dotazione' : 'Altra Scadenza Mezzo'),
              dataScadenza: dataScad,
              giorniRimanenti: diffGiorni,
              scaduta: diffGiorni < 0,
              dettagli: `${d.nomeOggetto}${d.matricola ? ` (Matr: ${d.matricola})` : ''} - Scadenza collaudo/revisione dotazione mezzo`,
              sedeStazionamento: mezzoMatch?.sedeStazionamento
            });
          }
        }
      }
    });
  }

  // Ordina per urgenza (prima le scadute, poi le più vicine alla scadenza)
  return alerts.sort((a, b) => a.giorniRimanenti - b.giorniRimanenti);
}

/**
 * Costruisce l'URL mailto con il destinatario principale e i destinatari in copia (Cc),
 * garantendo che l'avviso arrivi sia a nicodemimarmi@gmail.com che a presidenza@croceoro.org
 */
export function costruisciMailtoUrl(
  destinatariInput: string,
  oggetto: string,
  corpo: string
): string {
  const destinatari = destinatariInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const principale = destinatari[0] || EMAIL_RESPONSABILE_PARCO_MEZZI;
  const ccList = destinatari.slice(1);
  const ccQuery = ccList.length > 0 ? `&cc=${encodeURIComponent(ccList.join(','))}` : '';

  return `mailto:${encodeURIComponent(principale)}?subject=${encodeURIComponent(oggetto)}${ccQuery}&body=${encodeURIComponent(corpo)}`;
}

/**
 * Genera il testo completo e l'oggetto per l'email di avviso al responsabile parco mezzi
 */
export function generaTestoEmailAvviso(
  alert: AlertManutenzioneProgrammata,
  emailDestinatario?: string
): { oggetto: string; corpo: string; mailtoUrl: string } {
  const dest = emailDestinatario || getEmailResponsabileMezzi();
  const statoTesto = alert.scaduta
    ? `SCADUTO da ${Math.abs(alert.giorniRimanenti)} giorni`
    : `IN SCADENZA tra ${alert.giorniRimanenti} giorni (entro il ${alert.dataScadenza})`;

  const oggetto = `[PARCO MEZZI CROCE ORO] Avviso Scadenza: ${alert.tipo} - Mezzo ${alert.mezzoSigla} (${alert.targa || 'N.D.'})`;
  
  const corpo = `CROCE ORO MASSA CARRARA OdV
SERVIZIO GESTIONE PARCO MEZZI & AUTOPARCO
--------------------------------------------------------------------------------
AVVISO AUTOMATICO SCADENZA PROGRAMMATA - INTERVENTO RICHIESTO
--------------------------------------------------------------------------------

Destinatari notificati:
• Responsabile Parco Mezzi: ${EMAIL_RESPONSABILE_PARCO_MEZZI}
• Presidenza Croce Oro: ${EMAIL_PRESIDENZA_CROCE_ORO}

Il sistema informativo centrale segnala un intervento in scadenza programmata per la flotta:

• MEZZO: ${alert.mezzoSigla}
• MODELLO: ${alert.modello || 'Non specificato'}
• TARGA: ${alert.targa || 'N.D.'}
• SEDE ASSEGNATA: ${alert.sedeStazionamento || 'Sede Centrale'}

• TIPO SCADENZA: ${alert.tipo}
• DATA SCADENZA: ${alert.dataScadenza}
• STATO ATTUALE: ${statoTesto}
• DETTAGLI: ${alert.dettagli}
${alert.officina ? `• OFFICINA / FORNITORE CONSIGLIATO: ${alert.officina}` : ''}

AZIONI RICHIESTE:
1. Verificare lo stato operativo del mezzo e concordare tempestivamente l'intervento o il rinnovo con l'officina convenzionata.
2. Se necessario, predisporre la temporanea messa 'Fuori Servizio' o 'In Manutenzione' dal portale gestionale.
3. Al termine dell'intervento, registrare la fattura e la nuova scadenza nella sezione 'Mezzi & Flotta'.

Data notifica automatica: ${formatDateTimeItaly()}
Portale Gestionale Amministrativo • Croce Oro Massa Carrara OdV`;

  const mailtoUrl = costruisciMailtoUrl(dest, oggetto, corpo);

  return { oggetto, corpo, mailtoUrl };
}

/**
 * Genera un report riassuntivo via email di tutte le scadenze entro 15 giorni
 */
export function generaReportCumulativoEmail(
  alerts: AlertManutenzioneProgrammata[],
  emailDestinatario?: string,
  sogliaGiorni: number = 15
): { oggetto: string; corpo: string; mailtoUrl: string; totaleAlerts: number } {
  const dest = emailDestinatario || getEmailResponsabileMezzi();
  const alertFiltrati = alerts.filter(a => a.giorniRimanenti <= sogliaGiorni);

  const oggetto = `[PARCO MEZZI CROCE ORO] Riepilogo Scadenze Flotta (Entro ${sogliaGiorni} gg: ${alertFiltrati.length} veicoli)`;

  let corpo = `CROCE ORO MASSA CARRARA OdV
REPORT CUMULATIVO SCADENZE FLOTTA & MANUTENZIONE (ENTRO ${sogliaGiorni} GIORNI)
Data generazione: ${formatDateTimeItaly()}

DESTINATARI NOTIFICA AUTOMATICA:
• Responsabile Parco Mezzi: ${EMAIL_RESPONSABILE_PARCO_MEZZI}
• Presidenza Croce Oro: ${EMAIL_PRESIDENZA_CROCE_ORO}
--------------------------------------------------------------------------------
Totale veicoli con interventi urgenti o in scadenza: ${alertFiltrati.length}
--------------------------------------------------------------------------------\n\n`;

  if (alertFiltrati.length === 0) {
    corpo += `Nessun mezzo ha interventi o scadenze nei prossimi ${sogliaGiorni} giorni. Tutti i veicoli risultano in regola.\n`;
  } else {
    alertFiltrati.forEach((a, idx) => {
      const urgenza = a.scaduta
        ? `[SCADUTA DA ${Math.abs(a.giorniRimanenti)} GG]`
        : `[SCADENZA TRA ${a.giorniRimanenti} GG - ${a.dataScadenza}]`;

      corpo += `${idx + 1}. MEZZO: ${a.mezzoSigla} (${a.targa || 'N.D.'}) - ${a.modello || ''}\n`;
      corpo += `   • Tipo: ${a.tipo}\n`;
      corpo += `   • Stato: ${urgenza}\n`;
      corpo += `   • Sede: ${a.sedeStazionamento || 'Centrale'}\n`;
      corpo += `   • Dettagli: ${a.dettagli}\n\n`;
    });
  }

  corpo += `--------------------------------------------------------------------------------
Accedere al Portale Amministratore (Sezione 3: Mezzi & Flotta) per aggiornare gli interventi eseguiti.
Croce Oro Massa Carrara OdV`;

  const mailtoUrl = costruisciMailtoUrl(dest, oggetto, corpo);

  return { oggetto, corpo, mailtoUrl, totaleAlerts: alertFiltrati.length };
}

/**
 * Invia l'avviso via client di posta aprendo il mailto o fallback
 */
export function inviaEmailAvvisoManutenzione(
  alert: AlertManutenzioneProgrammata,
  emailDestinatario?: string
): boolean {
  const { mailtoUrl } = generaTestoEmailAvviso(alert, emailDestinatario);
  try {
    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (e) {
    console.error('Errore apertura mailto:', e);
    return false;
  }
}
