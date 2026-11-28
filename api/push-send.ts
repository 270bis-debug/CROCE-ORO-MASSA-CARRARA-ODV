// Vercel Serverless Function: POST /api/push-send
// Inoltra notifiche Web Push autenticate ad alta priorità (Missioni, Emergenza, Radio, Bacheca, Turni)
import type { IncomingMessage, ServerResponse } from 'http';
import webpush from 'web-push';
import { applyStrictCors, readJsonBody, verifyApiCaller } from '../server-lib/apiAuth';

function configureWebPush(): { ok: boolean; error?: string } {
  const pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!pub || !priv) {
    return {
      ok: false,
      error: 'Chiavi VAPID non configurate sul server (imposta VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).',
    };
  }
  webpush.setVapidDetails('mailto:centrale@croceoromassacarrara.it', pub, priv);
  return { ok: true };
}

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

  const vapidStatus = configureWebPush();
  if (!vapidStatus.ok) {
    return sendJson(503, { success: false, error: vapidStatus.error });
  }

  const body = await readJsonBody(req, 512_000);
  const rawSubs = Array.isArray(body?.subscriptions) ? body.subscriptions.slice(0, 250) : [];
  const notifPayload = body?.payload && typeof body.payload === 'object' ? body.payload : null;
  if (rawSubs.length === 0 || !notifPayload) {
    return sendJson(200, { success: true, sent: 0, expiredEndpoints: [] });
  }

  const isBachecaNotif =
    notifPayload.tipo === 'bacheca_post' ||
    notifPayload.tipo === 'bacheca_corso' ||
    notifPayload.tipo === 'bacheca_commento';
  const isMissionNotif =
    notifPayload.tipo === 'mission_dispatch' ||
    notifPayload.tipo === 'mission_ring';
  const isTurnoNotif = notifPayload.tipo === 'turno_update';

  const rawPreview =
    isBachecaNotif && notifPayload.postPreview && typeof notifPayload.postPreview === 'object'
      ? notifPayload.postPreview
      : null;
  const postPreview =
    rawPreview && rawPreview.id && rawPreview.titolo
      ? {
          id: String(rawPreview.id).slice(0, 128),
          titolo: String(rawPreview.titolo).slice(0, 200),
          contenuto: String(rawPreview.contenuto || '').slice(0, 600),
          sezioneTargetId: String(rawPreview.sezioneTargetId || 'tutte').slice(0, 128),
          sezioneTargetNome: String(rawPreview.sezioneTargetNome || 'Tutte le Sezioni Territoriali').slice(0, 140),
          priorita: String(rawPreview.priorita || 'Ordinaria').slice(0, 32),
          categoria: String(rawPreview.categoria || 'Comunicazione Generale').slice(0, 64),
          dataPubblicazione: String(rawPreview.dataPubblicazione || '').slice(0, 24),
          oraPubblicazione: String(rawPreview.oraPubblicazione || '').slice(0, 16),
          autore: String(rawPreview.autore || 'Direzione').slice(0, 100),
          attiva: true,
          evidenziata: Boolean(rawPreview.evidenziata),
          richiedePresaVisione: Boolean(rawPreview.richiedePresaVisione),
          updatedAt: typeof rawPreview.updatedAt === 'number' ? rawPreview.updatedAt : Date.now(),
        }
      : undefined;

  const serializedPayload = JSON.stringify({
    title: String(notifPayload.title || '📻 RADIO CROCE ORO').slice(0, 140),
    body: String(notifPayload.body || 'Comunicazione operativa in arrivo.').slice(0, 260),
    tag: String(notifPayload.tag || `croce-oro-${Date.now()}`).slice(0, 80),
    urgenza: String(notifPayload.urgenza || (notifPayload.isEmergency || isMissionNotif ? 'ROSSO' : 'GIALLO')),
    soundType: String(notifPayload.soundType || (isMissionNotif ? 'sirena' : 'cicalino')),
    tipo: String(notifPayload.tipo || 'radio_ptt'),
    codice: String(notifPayload.codice || '').slice(0, 64),
    postId: String(notifPayload.postId || '').slice(0, 128),
    ...(postPreview ? { postPreview } : {}),
    channelId: String(notifPayload.channelId || 'general').slice(0, 96),
    transmissionId: String(notifPayload.transmissionId || '').slice(0, 96),
    speakerName: String(notifPayload.speakerName || '').slice(0, 120),
    source: String(notifPayload.source || 'Centrale Operativa').slice(0, 120),
    isEmergency: Boolean(notifPayload.isEmergency || isMissionNotif),
    requireInteraction: Boolean(notifPayload.requireInteraction ?? (notifPayload.isEmergency || isMissionNotif)),
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
            TTL: isBachecaNotif || isTurnoNotif ? 86400 : isMissionNotif ? 600 : notifPayload.isEmergency ? 120 : 60,
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
