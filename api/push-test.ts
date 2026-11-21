// Vercel Serverless Function: POST /api/push-test
// Invia una notifica Push reale ad alta priorità direttamente al dispositivo chiamante (senza dipendere da ais-pre)
import type { IncomingMessage, ServerResponse } from 'http';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BBIgy7sPt5aiNKmumUH57K28pFivVG3qKun0xMT7ZLJq8Kc6c_hCzawksKptqyOI0pIXRZ7I6tmEr9D_jM4a6bc';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '19czcRLqXXAWjqLkkhHa53NQ5erahFRbIcJ-mTOOqBE';

webpush.setVapidDetails('mailto:centrale@croceoromassacarrara.it', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function readJsonBody(req: IncomingMessage & { body?: any }): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk || '');
      if (raw.length > 64_000) {
        try {
          req.destroy();
        } catch {}
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(
  req: IncomingMessage & { method?: string; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const sendJson = (status: number, data: any) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json(data);
    }
    res.statusCode = status;
    return res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(405, { success: false, error: 'Metodo non consentito' });
  }

  const body = await readJsonBody(req);
  const sub = body?.subscription;
  if (
    !sub ||
    typeof sub.endpoint !== 'string' ||
    !sub.endpoint.startsWith('https://') ||
    !sub.keys?.p256dh ||
    !sub.keys?.auth
  ) {
    return sendJson(400, {
      success: false,
      error: 'Sottoscrizione Push mancante. Premi prima "Attiva Walkie-Talkie Background".',
    });
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: String(sub.endpoint),
        keys: {
          p256dh: String(sub.keys.p256dh),
          auth: String(sub.keys.auth),
        },
      },
      JSON.stringify({
        title: '📻 WALKIE-TALKIE BACKGROUND ATTIVO',
        body: 'Test riuscito! Questo dispositivo riceve chiamate radio (Emergenza, Gruppi, Tutti) anche a schermo spento.',
        tag: `radio-test-${Date.now()}`,
        soundType: 'cicalino',
        urgenza: 'GIALLO',
        requireInteraction: false,
        tipo: 'radio_channel_on',
        isEmergency: false,
        channelId: 'general',
        speakerName: 'Test Radio Croce Oro',
      }),
      { urgency: 'high', TTL: 60, headers: { Urgency: 'high' } }
    );
    return sendJson(200, { success: true });
  } catch (err: any) {
    return sendJson(502, {
      success: false,
      error: `Invio Push rifiutato dal servizio browser (${err?.statusCode || 'errore rete'}). Riattiva le notifiche.`,
    });
  }
}
