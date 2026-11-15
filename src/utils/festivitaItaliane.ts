/**
 * festivitaItaliane.ts
 * Utility per il calcolo delle festività nazionali italiane, domeniche e giorni prefestivi.
 * Utilizzato nel Database Turni per pianificazione, ricorrenze e duplicazione presenze.
 */

/**
 * Calcolo della Domenica di Pasqua con l'algoritmo di Meeus/Jones/Butcher (Computus gregoriano)
 */
export function calcolaPasqua(anno: number): { mese: number; giorno: number } {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Marzo, 4 = Aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return { mese, giorno };
}

export interface InfoFestivita {
  data: string; // YYYY-MM-DD
  nome: string;
}

/**
 * Restituisce l'elenco di tutte le festività nazionali ufficiali per un determinato anno
 */
export function getFestivitaNazionaliAnno(anno: number): InfoFestivita[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  
  // Festività a data fissa
  const fisse: Array<{ mese: number; giorno: number; nome: string }> = [
    { mese: 1, giorno: 1, nome: 'Capodanno' },
    { mese: 1, giorno: 6, nome: 'Epifania' },
    { mese: 4, giorno: 25, nome: 'Festa della Liberazione' },
    { mese: 5, giorno: 1, nome: 'Festa dei Lavoratori' },
    { mese: 6, giorno: 2, nome: 'Festa della Repubblica' },
    { mese: 8, giorno: 15, nome: 'Assunzione / Ferragosto' },
    { mese: 10, giorno: 4, nome: 'San Francesco d’Assisi (Santo Patrono)' },
    { mese: 11, giorno: 1, nome: 'Tutti i Santi' },
    { mese: 12, giorno: 8, nome: 'Immacolata Concezione' },
    { mese: 12, giorno: 25, nome: 'Natale' },
    { mese: 12, giorno: 26, nome: 'Santo Stefano' }
  ];

  const risultato: InfoFestivita[] = fisse.map((f) => ({
    data: `${anno}-${pad(f.mese)}-${pad(f.giorno)}`,
    nome: f.nome
  }));

  // Pasqua e Lunedì dell'Angelo (Pasquetta)
  const pasqua = calcolaPasqua(anno);
  const dataPasqua = new Date(Date.UTC(anno, pasqua.mese - 1, pasqua.giorno));
  const pasquaStr = `${anno}-${pad(pasqua.mese)}-${pad(pasqua.giorno)}`;
  risultato.push({ data: pasquaStr, nome: 'Pasqua' });

  // Pasquetta = Pasqua + 1 giorno
  const dataPasquetta = new Date(dataPasqua.getTime() + 24 * 60 * 60 * 1000);
  const pasquettaStr = `${dataPasquetta.getUTCFullYear()}-${pad(dataPasquetta.getUTCMonth() + 1)}-${pad(dataPasquetta.getUTCDate())}`;
  risultato.push({ data: pasquettaStr, nome: "Lunedì dell'Angelo (Pasquetta)" });

  return risultato;
}

/**
 * Verifica se una data è un giorno Festivo (Domenica o Festività Nazionale Italiana)
 */
export function isGiornoFestivo(dataStr: string): { isFestivo: boolean; motivo?: string } {
  try {
    const d = new Date(dataStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return { isFestivo: false };

    // Controllo festività nazionale
    const anno = d.getUTCFullYear();
    const festNazionali = getFestivitaNazionaliAnno(anno);
    const fest = festNazionali.find((f) => f.data === dataStr);
    if (fest) {
      return { isFestivo: true, motivo: `Festivo Nazionale: ${fest.nome}` };
    }

    // Domenica (0)
    if (d.getUTCDay() === 0) {
      return { isFestivo: true, motivo: 'Domenica' };
    }

    return { isFestivo: false };
  } catch {
    return { isFestivo: false };
  }
}

/**
 * Verifica se una data è un giorno Prefestivo:
 * - Sabato (vigilia ordinaria della domenica)
 * - Il giorno immediatamente precedente a una qualsiasi festività nazionale
 */
export function isGiornoPrefestivo(dataStr: string): { isPrefestivo: boolean; motivo?: string } {
  try {
    const d = new Date(dataStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return { isPrefestivo: false };

    // Giorno successivo (calendario puro UTC a mezzogiorno, immune a DST)
    const dom = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const yDom = dom.getUTCFullYear();
    const mDom = String(dom.getUTCMonth() + 1).padStart(2, '0');
    const dDom = String(dom.getUTCDate()).padStart(2, '0');
    const domStr = `${yDom}-${mDom}-${dDom}`;

    const festDomani = isGiornoFestivo(domStr);
    if (festDomani.isFestivo && festDomani.motivo) {
      return {
        isPrefestivo: true,
        motivo: `Prefestivo (${festDomani.motivo.startsWith('Festivo Nazionale') ? `Vigilia di ${festDomani.motivo.replace('Festivo Nazionale: ', '')}` : 'Vigilia della Domenica'})`
      };
    }

    // Sabato (6)
    if (d.getUTCDay() === 6) {
      return { isPrefestivo: true, motivo: 'Sabato (Prefestivo)' };
    }

    return { isPrefestivo: false };
  } catch {
    return { isPrefestivo: false };
  }
}

/**
 * Restituisce la classificazione sintetica di un giorno
 */
export function getDettaglioTipoGiorno(dataStr: string): {
  tipo: 'festivo' | 'prefestivo' | 'feriale';
  etichetta: string;
  descrizione: string;
  badgeBg: string;
  badgeText: string;
} {
  const fest = isGiornoFestivo(dataStr);
  if (fest.isFestivo) {
    return {
      tipo: 'festivo',
      etichetta: 'Festivo',
      descrizione: fest.motivo || 'Giorno Festivo',
      badgeBg: 'bg-red-950/80 border-red-500/50',
      badgeText: 'text-red-300'
    };
  }

  const prefest = isGiornoPrefestivo(dataStr);
  if (prefest.isPrefestivo) {
    return {
      tipo: 'prefestivo',
      etichetta: 'Prefestivo',
      descrizione: prefest.motivo || 'Giorno Prefestivo',
      badgeBg: 'bg-amber-950/80 border-amber-500/50',
      badgeText: 'text-amber-300'
    };
  }

  return {
    tipo: 'feriale',
    etichetta: 'Feriale',
    descrizione: 'Giorno Feriale Ordinario',
    badgeBg: 'bg-slate-900 border-slate-700',
    badgeText: 'text-slate-300'
  };
}
