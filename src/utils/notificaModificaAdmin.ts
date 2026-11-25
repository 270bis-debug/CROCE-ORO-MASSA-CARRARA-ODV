/**
 * Utility per inviare automaticamente una notifica via email all'Amministratore
 * ogni volta che un volontario o operatore di centrale effettua modifiche o nuovi inserimenti
 * nelle macro categorie del portale gestionale.
 * Mittente: CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati (sistemiautomatizzati@croceoro.org)
 */
import { formatDateTimeItaly } from './italianTime';

export interface DatiNotificaModifica {
  operatoreNome?: string;
  operatoreRuolo?: string;
  macroCategoria: string;
  azione: 'Modifica Scheda' | 'Nuovo Inserimento' | 'Aggiornamento Dati' | string;
  dettaglio: string;
  elementoNome?: string;
}

export function inviaNotificaModificaAdmin(dati: DatiNotificaModifica): Promise<boolean>;
export function inviaNotificaModificaAdmin(
  macroCategoria: string,
  azione: string,
  dettaglio: string,
  operatoreNome?: string,
  elementoNome?: string
): Promise<boolean>;
export async function inviaNotificaModificaAdmin(
  arg1: DatiNotificaModifica | string,
  arg2?: string,
  arg3?: string,
  arg4?: string,
  arg5?: string
): Promise<boolean> {
  let payload: DatiNotificaModifica;
  if (typeof arg1 === 'object') {
    payload = {
      ...arg1,
      operatoreNome: arg1.operatoreNome || 'Operatore Delegato'
    };
  } else {
    payload = {
      macroCategoria: arg1,
      azione: arg2 || 'Modifica',
      dettaglio: arg3 || '',
      operatoreNome: arg4 || 'Operatore Delegato',
      elementoNome: arg5
    };
  }

  try {
    const res = await fetch('/api/notifica-modifica-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        dataOra: formatDateTimeItaly()
      })
    });
    const json = await res.json().catch(() => ({}));
    return !!json.success;
  } catch (err) {
    console.warn('[Notifica Modifica Admin] Impossibile inviare notifica email automatica:', err);
    return false;
  }
}

export const notificaModificaGestionale = inviaNotificaModificaAdmin;
