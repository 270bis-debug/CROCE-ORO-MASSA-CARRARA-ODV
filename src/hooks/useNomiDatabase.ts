import { useState, useEffect } from 'react';
import {
  MacroCategoriaId,
  NOMI_DATABASE_STORAGE_KEY,
  NOMI_SOTTOSEZIONI_STORAGE_KEY,
  getNomiDatabaseCustom,
  getNomiSottosezioniCustom,
  getTitoloDatabase,
  getTitoloSottosezione,
} from '../constants/macroCategorie';

export function useNomiDatabaseCustom(): Record<string, string> {
  const [nomiDbCustom, setNomiDbCustom] = useState<Record<string, string>>(() => getNomiDatabaseCustom());

  useEffect(() => {
    const refresh = () => setNomiDbCustom(getNomiDatabaseCustom());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === NOMI_DATABASE_STORAGE_KEY) {
        refresh();
      }
    };
    window.addEventListener('croceoro_nomi_db_updated', refresh as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('croceoro_nomi_db_updated', refresh as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return nomiDbCustom;
}

export function useTitoloDatabase(id: MacroCategoriaId | string, defaultTitle: string): string {
  const nomiDbCustom = useNomiDatabaseCustom();
  return getTitoloDatabase(id, defaultTitle, nomiDbCustom);
}

export function useNomiSottosezioniCustom(): Record<string, string> {
  const [nomiSubCustom, setNomiSubCustom] = useState<Record<string, string>>(() => getNomiSottosezioniCustom());

  useEffect(() => {
    const refresh = () => setNomiSubCustom(getNomiSottosezioniCustom());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === NOMI_SOTTOSEZIONI_STORAGE_KEY || e.key === NOMI_DATABASE_STORAGE_KEY) {
        refresh();
      }
    };
    window.addEventListener('croceoro_nomi_db_updated', refresh as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('croceoro_nomi_db_updated', refresh as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return nomiSubCustom;
}

export function useTitoloSottosezione(dbId: MacroCategoriaId | string, subId: string, defaultTitle: string): string {
  const nomiSubCustom = useNomiSottosezioniCustom();
  return getTitoloSottosezione(dbId, subId, defaultTitle, nomiSubCustom);
}

