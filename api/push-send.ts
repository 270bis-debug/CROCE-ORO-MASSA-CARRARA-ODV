// Vercel Serverless Function: POST /api/push-send
// Inoltra notifiche Web Push ad alta priorità ai dispositivi autorizzati (Emergenza, Canale Tutti, Gruppi Radio, PTT)
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
      if (raw.length > 512_000) {
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
  const rawSubs = Array.isArray(body?.subscriptions) ? body.subscriptions.slice(0, 250) : [];
  const notifPayload = body?.payload && typeof body.payload === 'object' ? body.payload : null;
  if (rawSubs.length === 0 || !notifPayload) {
    return sendJson(200, { success: true, sent: 0, expiredEndpoints: [] });
  }

  const isBachecaNotif = notifPayload.tipo === 'bacheca_post' || notifPayload.tipo === 'bacheca_corso';
  const serializedPayload = JSON.stringify({
    title: String(notifPayload.title || '📻 RADIO CROCE ORO').slice(0, 140),
    body: String(notifPayload.body || 'Comunicazione radio in arrivo.').slice(0, 260),
    tag: String(notifPayload.tag || `radio-${Date.now()}`).slice(0, 80),
    urgenza: String(notifPayload.urgenza || (notifPayload.isEmergency ? 'ROSSO' : 'GIALLO')),
    soundType: String(notifPayload.soundType || 'cicalino'),
    tipo: String(notifPayload.tipo || 'radio_ptt'),
    postId: String(notifPayload.postId || '').slice(0, 128),
    channelId: String(notifPayload.channelId || 'general'),
    transmissionId: String(notifPayload.transmissionId || ''),
    speakerName: String(notifPayload.speakerName || ''),
    isEmergency: Boolean(notifPayload.isEmergency),
    requireInteraction: Boolean(notifPayload.requireInteraction ?? notifPayload.isEmergency),
    timestamp: Date.now(),
  });

  let sent = 0;
  const expiredEndpoints: string[] = [];

  await Promise.all(
    rawSubs.map(async (entry: any) => {
      const endpoint = typeof entry?.endpoint === 'string' ? entry.endpoint.trim() : '';
      const p256dh = typeof entry?.p256dh === 'string' ? entry.p256dh.trim() : '';
      const auth = typeof entry?.auth === 'string' ? entry.auth.trim() : '';
      if (!endpoint.startsWith('https://') || !p256dh || !auth) return;
      try {
        await webpush.sendNotification(
          { endpoint, keys: { p256dh, auth } },
          serializedPayload,
          {
            urgency: 'high',
            TTL: isBachecaNotif ? 86400 : notifPayload.isEmergency ? 120 : 60,
            headers: { Urgency: 'high' },
          }
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(endpoint);
        }
      }
    })
  );

  return sendJson(200, { success: true, sent, expiredEndpoints });
}
