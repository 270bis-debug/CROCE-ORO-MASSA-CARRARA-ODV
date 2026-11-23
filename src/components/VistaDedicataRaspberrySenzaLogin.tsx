import React, { useCallback, useEffect, useState } from 'react';
import {
  ComunicazioneBacheca,
  SedeAssociativaCompleta,
  TimbraturaVolontario,
} from '../types/adminTypes';
import { realtime } from '../services/realtime';
import {
  normalizzaComunicazioniBacheca,
  normalizzaListaSediAssociative,
} from '../utils/sediNormalize';
import {
  RaspberryDisplayConfig,
  getRaspberrySedeIdFromUrl,
  loadRaspberryDisplayConfig,
  sanitizeRaspberryDisplayConfig,
  saveRaspberryDisplayConfigLocal,
} from '../utils/raspberryDisplayConfig';
import { VistaDisplayRaspberrySezione } from './VistaDisplayRaspberrySezione';

interface VistaDedicataRaspberrySenzaLoginProps {
  initialSedi: SedeAssociativaCompleta[];
  initialComunicazioni: ComunicazioneBacheca[];
  initialTimbrature: TimbraturaVolontario[];
}

export const VistaDedicataRaspberrySenzaLogin: React.FC<VistaDedicataRaspberrySenzaLoginProps> = ({
  initialSedi,
  initialComunicazioni,
  initialTimbrature,
}) => {
  const [sedi, setSedi] = useState<SedeAssociativaCompleta[]>(() => {
    try {
      const saved = localStorage.getItem('CROCE_ORO_SEDI_COMPLETE');
      if (saved) return normalizzaListaSediAssociative(JSON.parse(saved));
    } catch {}
    return normalizzaListaSediAssociative(initialSedi);
  });

  const [comunicazioni, setComunicazioni] = useState<ComunicazioneBacheca[]>(() => {
    try {
      const saved = localStorage.getItem('CROCE_ORO_BACHECA_COMUNICAZIONI');
      if (saved) return normalizzaComunicazioniBacheca(JSON.parse(saved));
    } catch {}
    return normalizzaComunicazioniBacheca(initialComunicazioni);
  });

  const [timbrature, setTimbrature] = useState<TimbraturaVolontario[]>(() => {
    try {
      const saved = localStorage.getItem('CROCE_ORO_TIMBRATURE_VOLONTARI');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return Array.isArray(initialTimbrature) ? initialTimbrature : [];
  });

  const [config, setConfig] = useState<RaspberryDisplayConfig>(() =>
    loadRaspberryDisplayConfig(initialSedi[0]?.id)
  );
  const [ultimoAggiornamento, setUltimoAggiornamento] = useState<Date>(() => new Date());

  const urlSedeId = getRaspberrySedeIdFromUrl();
  const sezioneEffettivaId = urlSedeId || config.sezionePredefinitaId || sedi[0]?.id || '';

  const ricaricaDati = useCallback(() => {
    realtime.refreshPublicRaspberryBoard().catch(() => {});

    if (!realtime.isServerlessStatic()) {
      fetch('/api/sedi', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list = Array.isArray(data) ? data : Array.isArray(data?.sedi) ? data.sedi : null;
          if (list && list.length > 0) {
            const norm = normalizzaListaSediAssociative(list);
            setSedi(norm);
            try {
              localStorage.setItem('CROCE_ORO_SEDI_COMPLETE', JSON.stringify(norm));
            } catch {}
          }
        })
        .catch(() => {});

      fetch('/api/bacheca', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list = Array.isArray(data) ? data : Array.isArray(data?.bacheca) ? data.bacheca : null;
          if (list) {
            setComunicazioni(normalizzaComunicazioniBacheca(list));
          }
        })
        .catch(() => {});

      fetch('/api/timbrature', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list = Array.isArray(data) ? data : Array.isArray(data?.timbrature) ? data.timbrature : null;
          if (list) {
            setTimbrature(list);
          }
        })
        .catch(() => {});

      fetch('/api/raspberry-config', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.config && typeof data.config === 'object') {
            const clean = saveRaspberryDisplayConfigLocal(data.config);
            setConfig(clean);
          }
        })
        .catch(() => {});
    }

    setUltimoAggiornamento(new Date());
  }, []);

  useEffect(() => {
    realtime.attachPublicRaspberryListener();
    ricaricaDati();

    const unsubBoard = realtime.on('RASPBERRY_BOARD_UPDATED', (payload: any) => {
      if (Array.isArray(payload?.sedi) && payload.sedi.length > 0) {
        setSedi(normalizzaListaSediAssociative(payload.sedi));
      }
      if (Array.isArray(payload?.bacheca)) {
        setComunicazioni(normalizzaComunicazioniBacheca(payload.bacheca));
      }
      if (Array.isArray(payload?.timbrature)) {
        setTimbrature(payload.timbrature);
      }
      if (payload?.config && typeof payload.config === 'object') {
        setConfig(sanitizeRaspberryDisplayConfig(payload.config));
      }
      setUltimoAggiornamento(new Date());
    });

    const unsubBacheca = realtime.on('BACHECA_UPDATED', (payload: any) => {
      if (Array.isArray(payload?.bacheca)) {
        setComunicazioni(normalizzaComunicazioniBacheca(payload.bacheca));
        setUltimoAggiornamento(new Date());
      }
    });

    const unsubTimb = realtime.on('TIMBRATURE_UPDATED', (payload: any) => {
      if (Array.isArray(payload?.timbrature)) {
        setTimbrature(payload.timbrature);
        setUltimoAggiornamento(new Date());
      }
    });

    const unsubSedi = realtime.on('SEDI_UPDATED', (payload: any) => {
      if (Array.isArray(payload?.sedi) && payload.sedi.length > 0) {
        setSedi(normalizzaListaSediAssociative(payload.sedi));
        setUltimoAggiornamento(new Date());
      }
    });

    const unsubCfg = realtime.on('RASPBERRY_CONFIG_UPDATED', (payload: any) => {
      if (payload?.config && typeof payload.config === 'object') {
        setConfig(sanitizeRaspberryDisplayConfig(payload.config));
        setUltimoAggiornamento(new Date());
      }
    });

    const unsubInit = realtime.on('INIT_SYNC', (payload: any) => {
      const s = payload?.state;
      if (!s) return;
      if (Array.isArray(s.sedi) && s.sedi.length > 0) {
        setSedi(normalizzaListaSediAssociative(s.sedi));
      }
      if (Array.isArray(s.bacheca)) {
        setComunicazioni(normalizzaComunicazioniBacheca(s.bacheca));
      }
      if (Array.isArray(s.timbrature)) {
        setTimbrature(s.timbrature);
      }
      if (s.raspberryDisplayConfig && typeof s.raspberryDisplayConfig === 'object') {
        setConfig(sanitizeRaspberryDisplayConfig(s.raspberryDisplayConfig));
      }
      setUltimoAggiornamento(new Date());
    });

    return () => {
      realtime.detachPublicRaspberryListener();
      unsubBoard();
      unsubBacheca();
      unsubTimb();
      unsubSedi();
      unsubCfg();
      unsubInit();
    };
  }, [ricaricaDati]);

  // Polling automatico silenzioso (auto-ripristino per Raspberry H24)
  useEffect(() => {
    const ms = Math.max(15, Number(config.refreshSecondi) || 30) * 1000;
    const id = window.setInterval(() => {
      ricaricaDati();
    }, ms);
    return () => window.clearInterval(id);
  }, [config.refreshSecondi, ricaricaDati]);

  return (
    <VistaDisplayRaspberrySezione
      sedi={sedi}
      sezioneSelezionataId={sezioneEffettivaId}
      comunicazioni={comunicazioni}
      timbrature={timbrature}
      config={config}
      isPreview={false}
      onRefreshManuale={ricaricaDati}
      ultimoAggiornamento={ultimoAggiornamento}
    />
  );
};
