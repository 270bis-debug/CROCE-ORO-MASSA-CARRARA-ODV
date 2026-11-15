/**
 * Store centralizzato per i Dati Ufficiali della Carta Intestata
 * Croce Oro Massa Carrara OdV.
 *
 * Tutti i documenti PDF generati nell'applicazione (Fogli di Viaggio,
 * Domande di Iscrizione, Ricevute Tesseramento, Schede Vestiario, Note di Debito, ecc.)
 * attingono sempre e in tempo reale ai dati forniti da questo modulo.
 */

export interface DatiCartaIntestata {
  denominazione: string;
  sedeLegale: string;
  sedeMassa: string;
  sedeCarrara: string;
  sedePietrasanta: string;
  centraleTel: string;
  codiceFiscale: string;
  sitoWeb: string;
  email: string;
  pec: string;
  // Riferimenti Social Ufficiali (opzionali: mostrati solo se compilati)
  socialFacebook?: string;
  socialInstagram?: string;
  socialYouTube?: string;
  socialTikTok?: string;
  socialLinkedIn?: string;
  socialAltro?: string;
  // Coordinate bancarie e postali ufficiali
  intestatarioConti: string;
  bancaPoste: string;
  ibanPoste: string;
  ccPostale: string;
  bancaAppoggio: string;
  ibanBanca: string;
}

export const DATI_CARTA_INTESTATA_DEFAULT: DatiCartaIntestata = {
  denominazione: 'CROCE ORO MASSA CARRARA OdV',
  sedeLegale: 'Via Como, 12 Massa (MS)',
  sedeMassa: 'Via Delle Jare 9',
  sedeCarrara: 'Strada Comunale Monteverde 49',
  sedePietrasanta: 'Piazza Villeparisis, 14',
  centraleTel: '0585 625410',
  codiceFiscale: '92035360459',
  sitoWeb: 'www.croceoro.org',
  email: 'volontari@croceoro.org',
  pec: 'croceoromassacarrara@pec.it',
  socialFacebook: '',
  socialInstagram: '',
  socialYouTube: '',
  socialTikTok: '',
  socialLinkedIn: '',
  socialAltro: '',
  intestatarioConti: 'CROCE ORO MASSA CARRARA ODV',
  bancaPoste: 'POSTE ITALIANE',
  ibanPoste: 'IT40P0760113600001007035676',
  ccPostale: '00001007035676',
  bancaAppoggio: 'Credit Agricole',
  ibanBanca: 'IT79M0623024500000046980317',
};

const STORAGE_KEY = 'croce_oro_dati_carta_intestata';
const EVENT_NAME = 'croce_oro_carta_intestata_updated';

export function pulisciDenominazioneNoPA(
  val?: string,
  fallback: string = DATI_CARTA_INTESTATA_DEFAULT.denominazione
): string {
  const raw = String(val || '').trim();
  if (!raw) return fallback;
  if (/pubblica\s+assistenza|\bP\.A\./i.test(raw)) {
    const stripped = raw
      .replace(/pubblica\s+assistenza\s*/gi, '')
      .replace(/\bP\.A\.\s*/gi, '')
      .trim();
    if (!stripped || /^croce\s*oro$/i.test(stripped)) {
      return fallback;
    }
    return stripped;
  }
  return raw;
}

export function normalizeDatiCartaIntestata(raw: Partial<DatiCartaIntestata> | null | undefined): DatiCartaIntestata {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    denominazione: pulisciDenominazioneNoPA(src.denominazione, DATI_CARTA_INTESTATA_DEFAULT.denominazione),
    sedeLegale: src.sedeLegale !== undefined ? String(src.sedeLegale) : DATI_CARTA_INTESTATA_DEFAULT.sedeLegale,
    sedeMassa: src.sedeMassa !== undefined ? String(src.sedeMassa) : DATI_CARTA_INTESTATA_DEFAULT.sedeMassa,
    sedeCarrara: src.sedeCarrara !== undefined ? String(src.sedeCarrara) : DATI_CARTA_INTESTATA_DEFAULT.sedeCarrara,
    sedePietrasanta: src.sedePietrasanta !== undefined ? String(src.sedePietrasanta) : DATI_CARTA_INTESTATA_DEFAULT.sedePietrasanta,
    centraleTel: src.centraleTel !== undefined ? String(src.centraleTel) : DATI_CARTA_INTESTATA_DEFAULT.centraleTel,
    codiceFiscale: src.codiceFiscale !== undefined ? String(src.codiceFiscale) : DATI_CARTA_INTESTATA_DEFAULT.codiceFiscale,
    sitoWeb: src.sitoWeb !== undefined ? String(src.sitoWeb) : DATI_CARTA_INTESTATA_DEFAULT.sitoWeb,
    email: src.email !== undefined ? String(src.email) : DATI_CARTA_INTESTATA_DEFAULT.email,
    pec: src.pec !== undefined ? String(src.pec) : DATI_CARTA_INTESTATA_DEFAULT.pec,
    socialFacebook: String(src.socialFacebook ?? '').trim(),
    socialInstagram: String(src.socialInstagram ?? '').trim(),
    socialYouTube: String(src.socialYouTube ?? '').trim(),
    socialTikTok: String(src.socialTikTok ?? '').trim(),
    socialLinkedIn: String(src.socialLinkedIn ?? '').trim(),
    socialAltro: String(src.socialAltro ?? '').trim(),
    intestatarioConti: pulisciDenominazioneNoPA(src.intestatarioConti, DATI_CARTA_INTESTATA_DEFAULT.intestatarioConti),
    bancaPoste: src.bancaPoste !== undefined ? String(src.bancaPoste) : DATI_CARTA_INTESTATA_DEFAULT.bancaPoste,
    ibanPoste: src.ibanPoste !== undefined ? String(src.ibanPoste) : DATI_CARTA_INTESTATA_DEFAULT.ibanPoste,
    ccPostale: src.ccPostale !== undefined ? String(src.ccPostale) : DATI_CARTA_INTESTATA_DEFAULT.ccPostale,
    bancaAppoggio: src.bancaAppoggio !== undefined ? String(src.bancaAppoggio) : DATI_CARTA_INTESTATA_DEFAULT.bancaAppoggio,
    ibanBanca: src.ibanBanca !== undefined ? String(src.ibanBanca) : DATI_CARTA_INTESTATA_DEFAULT.ibanBanca,
  };
}

/**
 * Restituisce i riferimenti social compilati separati da " • ".
 * Se nessun social è compilato restituisce stringa vuota ''.
 */
export function formattaSocialCartaIntestata(info?: Partial<DatiCartaIntestata> | null): string {
  if (!info) return '';
  const canali: Array<{ label: string; value?: string; prefixRegex?: RegExp }> = [
    { label: 'Facebook', value: info.socialFacebook, prefixRegex: /^(facebook|fb)\s*:/i },
    { label: 'Instagram', value: info.socialInstagram, prefixRegex: /^(instagram|ig)\s*:/i },
    { label: 'YouTube', value: info.socialYouTube, prefixRegex: /^(youtube|yt)\s*:/i },
    { label: 'TikTok', value: info.socialTikTok, prefixRegex: /^tiktok\s*:/i },
    { label: 'LinkedIn', value: info.socialLinkedIn, prefixRegex: /^linkedin\s*:/i },
    { label: 'Social', value: info.socialAltro, prefixRegex: /^[^:]{2,20}:/ },
  ];

  const parti: string[] = [];
  for (const c of canali) {
    const val = String(c.value ?? '').trim();
    if (!val) continue;
    if (c.prefixRegex && c.prefixRegex.test(val)) {
      parti.push(val);
    } else {
      parti.push(`${c.label}: ${val}`);
    }
  }
  return parti.join(' • ');
}

// Cache in memoria sincronizzata
let cacheDati: DatiCartaIntestata | null = null;

/**
 * Recupera i dati correnti per la carta intestata.
 * Legge prioritariamente dalla cache / localStorage o restituisce i valori ufficiali di default.
 */
export function getDatiCartaIntestata(): DatiCartaIntestata {
  if (cacheDati) {
    return { ...cacheDati };
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const d = normalizeDatiCartaIntestata(parsed);
          cacheDati = d;
          return { ...cacheDati };
        }
      }
    } catch (e) {
      console.warn('[CartaIntestataStore] Errore lettura localStorage:', e);
    }
  }

  cacheDati = { ...DATI_CARTA_INTESTATA_DEFAULT };
  return { ...cacheDati };
}

/**
 * Aggiorna immediatamente cache in memoria + localStorage (effettivo subito su ogni PDF generato),
 * senza attendere la risposta di rete.
 */
export function aggiornaCacheLocaleCartaIntestata(nuovi: Partial<DatiCartaIntestata>): DatiCartaIntestata {
  const correnti = getDatiCartaIntestata();
  const aggiornati = normalizeDatiCartaIntestata({
    ...correnti,
    ...nuovi,
  });

  cacheDati = aggiornati;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(aggiornati));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: aggiornati }));
    } catch {}
  }
  return { ...aggiornati };
}

/**
 * Applica aggiornamenti remoti ricevuti da WebSocket o Firestore in tempo reale.
 */
export function applicaDatiCartaIntestataRemoti(nuovi: Partial<DatiCartaIntestata>): DatiCartaIntestata {
  return aggiornaCacheLocaleCartaIntestata(nuovi);
}

/**
 * Salva i nuovi dati per la carta intestata nel localStorage, aggiorna la cache,
 * notifica tutti i componenti sottoscritti e invia l'aggiornamento al server.
 */
export function salvaDatiCartaIntestata(nuovi: Partial<DatiCartaIntestata>): DatiCartaIntestata {
  const aggiornati = aggiornaCacheLocaleCartaIntestata(nuovi);

  if (typeof window !== 'undefined') {
    // Sincronizzazione asincrona con il server
    fetch('/api/carta-intestata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aggiornati),
    }).catch(err => {
      console.warn('[CartaIntestataStore] Sync server fallita (verrà riprovata al prossimo salvataggio):', err);
    });
  }

  return { ...aggiornati };
}

/**
 * Ripristina i dati ufficiali di default
 */
export function ripristinaDatiCartaIntestataDefault(): DatiCartaIntestata {
  return salvaDatiCartaIntestata(DATI_CARTA_INTESTATA_DEFAULT);
}

/**
 * Carica i dati dal server (se presenti) per sincronizzare client
 */
export async function sincronizzaDatiCartaIntestataDaServer(): Promise<DatiCartaIntestata> {
  if (typeof window === 'undefined') return getDatiCartaIntestata();

  try {
    const res = await fetch('/api/carta-intestata');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.denominazione) {
        const uniti = normalizeDatiCartaIntestata(data);
        cacheDati = uniti;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(uniti));
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: uniti }));
        return { ...uniti };
      }
    }
  } catch (err) {
    // Silenzioso, usa localStorage o default
  }

  return getDatiCartaIntestata();
}

/**
 * Hook / listener per ascoltare i cambiamenti della carta intestata
 */
export function ascoltaModificheCartaIntestata(cb: (dati: DatiCartaIntestata) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: any) => {
    if (e.detail) {
      cb(e.detail);
    } else {
      cb(getDatiCartaIntestata());
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cacheDati = null;
      cb(getDatiCartaIntestata());
    }
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
