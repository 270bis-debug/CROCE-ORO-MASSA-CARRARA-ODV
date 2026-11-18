import { useState, useEffect } from 'react';
import {
  MacroCategoriaId,
  NOMI_DATABASE_STORAGE_KEY,
  getNomiDatabaseCustom,
  getTitoloDatabase,
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
