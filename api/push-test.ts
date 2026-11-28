// Vercel Serverless Function: POST /api/push-test
// Invia una notifica Push reale ad alta priorità direttamente al dispositivo chiamante autenticato
import type { IncomingMessage, ServerResponse } from 'http';
import webpush from 'web-push';
import { applyStrictCors, readJsonBody, verifyApiCaller } from '../server-lib/apiAuth';

export default async function handler(
  req: IncomingMessage & { method?: string; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  const sendJson = (status: number, data: any) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json(data);
    }
    res.statusCode = status;
    return res.end(JSON.stringify(data));
  };

  if (!applyStrictCors(req, res, 'POST, OPTIONS')) {
    return sendJson(403, { success: false, error: 'Origine non autorizzata.' });
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(405, { success: false, error: 'Metodo non consentito' });
  }

  const caller = await verifyApiCaller(req);
  if (!caller.authorized) {
    return sendJson(401, { success: false, error: caller.reason || 'Non autorizzato' });
  }

  const pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub || !priv) {
    return sendJson(503, {
      success: false,
      error: 'Chiavi VAPID non configurate sul server (imposta VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).',
    });
  }
  webpush.setVapidDetails('mailto:centrale@croceoromassacarrara.it', pub, priv);

  const body = await readJsonBody(req, 64_000);
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
        body: 'Test riuscito! Questo dispositivo riceve chiamate radio, missioni e avvisi bacheca anche a schermo spento.',
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
