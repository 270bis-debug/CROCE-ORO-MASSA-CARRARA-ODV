/**
 * Helper per determinare se l'applicazione è acceduta da un normale browser web
 * (Google Chrome, Mozilla Firefox, Safari, Edge su PC/desktop/laptop/tablet/smartphone)
 * rispetto a una PWA / applicazione installata come Standalone su tablet/dispositivi dedicati.
 * 
 * Regola richiesta: Solo Quando si fa accesso da web i colori di sfondo devono essere per forza bianco
 * e tutti i pulsanti devono essere iper-visibili anche su browser obsoleti (vecchi Chrome e Firefox).
 */

export const isAccessoDaWeb = (): boolean => {
  if (typeof window === 'undefined') return true;

  // 1. Se è la pagina dedicata di reset PIN inviata via email -> SEMPRE Accesso Web
  const pathname = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (
    pathname.includes('/reset-pin') ||
    pathname.includes('/imposta-pin') ||
    search.includes('resettoken') ||
    search.includes('token_reset') ||
    hash.includes('reset-pin')
  ) {
    return true;
  }

  // 2. Controllo query string esplicita (?simulaWeb=0/1, ?web=1 o ?web=0)
  if (search.includes('simulaweb=1') || search.includes('web=1') || search.includes('mode=web') || search.includes('sfondo=bianco')) {
    return true;
  }
  if (search.includes('simulaweb=0') || search.includes('web=0') || search.includes('mode=device')) {
    return false;
  }

  // 3. Preferenza salvata manualmente dall'utente
  try {
    const salvato = localStorage.getItem('CROCE_ORO_SFONDO_WEB_BIANCO');
    if (salvato === 'true') return true;
    if (salvato === 'false') return false;
  } catch {}

  // 4. Rilevamento automatico browser standard vs PWA standalone:
  // Se NON è standalone (quindi è un normale browser desktop o mobile Chrome/Firefox), è accesso web!
  const isStandalone = Boolean(
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as any).standalone === true ||
    (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
  );

  return !isStandalone;
};

export const setPreferenzaAccessoWeb = (valore: boolean): void => {
  try {
    localStorage.setItem('CROCE_ORO_SFONDO_WEB_BIANCO', valore ? 'true' : 'false');
    applicaTemaWebSeNecessario();
  } catch {}
};

/**
 * Applica direttamente le classi e le proprietà di stile forzate al document e body
 * per garantire retrocompatibilità totale con vecchie versioni di Chrome e Firefox.
 */
export const applicaTemaWebSeNecessario = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;
  const web = isAccessoDaWeb();
  try {
    if (web) {
      document.documentElement.classList.add('accesso-web-sfondo-bianco');
      document.body.classList.add('accesso-web-sfondo-bianco');
      document.documentElement.setAttribute('data-accesso-web', 'true');
      document.documentElement.style.backgroundColor = '#ffffff';
      document.body.style.backgroundColor = '#ffffff';
    } else {
      document.documentElement.classList.remove('accesso-web-sfondo-bianco');
      document.body.classList.remove('accesso-web-sfondo-bianco');
      document.documentElement.removeAttribute('data-accesso-web');
      document.body.removeAttribute('data-accesso-web');
      document.documentElement.style.backgroundColor = '#020617';
      document.body.style.backgroundColor = '#020617';
      document.body.style.color = '#f8fafc';
    }
  } catch {}
  return web;
};

// Esecuzione automatica immediata all'avvio dello script
if (typeof window !== 'undefined') {
  applicaTemaWebSeNecessario();
}
