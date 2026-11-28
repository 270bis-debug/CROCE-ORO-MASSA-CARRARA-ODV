// Shared Serverless SMTP Mailer for Croce Oro Massa Carrara (Vercel + Cloud Run)
// Reads SMTP credentials strictly from process.env (zero hardcoded passwords)
import nodemailer from 'nodemailer';

const MITTENTE_UFFICIALE = 'CROCE ORO MASSA CARRARA OdV - Sistemi Automatizzati';
const DEFAULT_FROM_ADDR = 'sistemiautomatizzati@croceoro.org';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function collectRecipients(body: any, fallbackEmails: string[] = []): string[] {
  const found = new Set<string>();
  const tryAdd = (v: unknown) => {
    if (isValidEmail(v)) found.add(v.trim().toLowerCase());
  };

  if (body && typeof body === 'object') {
    tryAdd(body.email);
    tryAdd(body.destinatario);
    tryAdd(body.to);
    tryAdd(body.emailDestinatario);
    tryAdd(body.emailVolontario);
    tryAdd(body.emailTesoreria);
    tryAdd(body.emailPresidente);
    tryAdd(body.emailAmministratore);
    const arrays = [
      body.destinatari,
      body.emails,
      body.toList,
      body.volontari,
      body.destinatariEmail,
      body.destinatariLista,
    ];
    for (const arr of arrays) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (typeof item === 'string') {
          tryAdd(item);
        } else if (item && typeof item === 'object') {
          tryAdd((item as any).email);
          tryAdd((item as any).emailNotifiche);
          tryAdd((item as any).indirizzo);
        }
      }
    }
  }

  if (found.size === 0) {
    for (const fb of fallbackEmails) tryAdd(fb);
  }
  return Array.from(found).slice(0, 80);
}

function buildSmtpTransporter(): {
  transporter: ReturnType<typeof nodemailer.createTransport> | null;
  from: string;
  error?: string;
} {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from =
    (process.env.SMTP_FROM || '').trim() ||
    `"${MITTENTE_UFFICIALE}" <${user && user.includes('@') ? user : DEFAULT_FROM_ADDR}>`;

  if (!host || !user || !pass) {
    return {
      transporter: null,
      from,
      error:
        'Servizio SMTP non configurato sul server. Imposta SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS nelle variabili d’ambiente.',
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return { transporter, from };
}

function wrapBrandedEmail(title: string, badge: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:20px;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
    <div style="background:#1d1a60;padding:18px 22px;color:#ffffff;border-bottom:4px solid #e7b80b;">
      <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#fde047;font-weight:bold;">${escapeHtml(badge)}</div>
      <div style="font-size:18px;font-weight:bold;margin-top:4px;">${escapeHtml(title)}</div>
    </div>
    <div style="padding:20px 22px;font-size:14px;line-height:1.55;color:#334155;">
      ${bodyHtml}
    </div>
    <div style="background:#f8fafc;padding:12px 22px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">
      Croce Oro Massa Carrara OdV &bull; Centrale Operativa H24: 0585 625410 &bull; Messaggio generato automaticamente
    </div>
  </div>
</body>
</html>`;
}

export function isServerlessEmailPathname(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return (
    p.includes('/notifica-') ||
    p.includes('/invia-email') ||
    p.includes('/invia-sollecito-firma-pin') ||
    p.includes('/promemoria-turni/') ||
    p.includes('/elimina-note-debito-notifica')
  );
}

export async function handleServerlessEmailRoute(
  pathname: string,
  body: any
): Promise<{ status: number; payload: Record<string, any> }> {
  const p = pathname.toLowerCase();

  // Sync-log endpoints are local-storage/Firestore log acknowledgments
  if (p.endsWith('/sync-log')) {
    return { status: 200, payload: { ok: true, success: true, mode: 'cloud-firestore' } };
  }

  const { transporter, from, error: smtpError } = buildSmtpTransporter();
  if (!transporter) {
    return {
      status: 503,
      payload: {
        ok: false,
        success: false,
        inviata: false,
        code: 'smtp_not_configured',
        error: smtpError,
      },
    };
  }

  const defaultAdminEmail = (process.env.SMTP_ADMIN_EMAIL || 'volontari@croceoro.org').trim();
  const defaultTreasuryEmail = (process.env.SMTP_TREASURY_EMAIL || 'tesoreria@croceoro.org').trim();

  let subject = 'Notifica Croce Oro Massa Carrara OdV';
  let badge = 'SISTEMA AUTOMATIZZATO CROCE ORO';
  let bodyHtml = '';
  let recipients: string[] = [];
  const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];

  if (p.endsWith('/invia-sollecito-firma-pin')) {
    const nome = escapeHtml(body?.volontarioNome || body?.nome || 'Volontario');
    const motivo = escapeHtml(body?.motivo || body?.messaggio || 'Completamento firma digitale e aggiornamento PIN personale');
    const urlApp = escapeHtml(body?.appUrl || 'https://www.croceoro.org');
    subject = '⚠️ Sollecito adeguamento profilo — Croce Oro Massa Carrara';
    badge = 'ADEGUAMENTO PROFILO VOLONTARIO';
    bodyHtml = `<p>Gentile <strong>${nome}</strong>,</p>
      <p>è richiesto il completamento del tuo profilo operativo: <strong>${motivo}</strong>.</p>
      <p>Accedi all'app Croce Oro all'indirizzo <a href="${urlApp}" style="color:#1d1a60;font-weight:bold;">${urlApp}</a> per completare subito l'operazione.</p>`;
    recipients = collectRecipients(body);
  } else if (p.endsWith('/invia-email-invito-reset-pin')) {
    const nome = escapeHtml(body?.nomeCompleto || body?.volontarioNome || 'Volontario');
    const pinProv = escapeHtml(body?.pinProvvisorio || '');
    const link = typeof body?.resetUrl === 'string' && /^https?:\/\//i.test(body.resetUrl) ? body.resetUrl : 'https://www.croceoro.org';
    subject = '🔐 Attivazione / Reset PIN Personale — Croce Oro Massa Carrara';
    badge = 'SICUREZZA ACCESSO';
    bodyHtml = `<p>Gentile <strong>${nome}</strong>,</p>
      <p>è stato predisposto il ripristino del tuo PIN di accesso personale all'app Croce Oro Massa Carrara.</p>
      ${pinProv ? `<p>PIN provvisorio di verifica: <strong style="font-size:18px;letter-spacing:2px;">${pinProv}</strong></p>` : ''}
      <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1d1a60;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Imposta nuovo PIN personale</a></p>`;
    recipients = collectRecipients(body);
  } else if (p.endsWith('/notifica-presa-visione')) {
    const titolo = escapeHtml(body?.titolo || body?.postTitolo || 'Comunicazione in Bacheca');
    const autore = escapeHtml(body?.autore || 'Direzione');
    const dettagli = escapeHtml(body?.riepilogo || body?.messaggio || 'Riepilogo aggiornato delle prese visione in bacheca.');
    subject = `📋 Riepilogo Presa Visione: ${body?.titolo || body?.postTitolo || 'Bacheca'}`;
    badge = 'BACHECA DI SEZIONE';
    bodyHtml = `<p>Comunicazione: <strong>${titolo}</strong> (Autore: ${autore})</p><p>${dettagli}</p>`;
    recipients = collectRecipients(body, [defaultAdminEmail]);
  } else if (p.endsWith('/notifica-guasto-mezzo')) {
    const mezzo = escapeHtml(body?.mezzo || body?.targa || 'Mezzo di flotta');
    const segnalatore = escapeHtml(body?.volontarioNome || body?.operatore || 'Equipaggio');
    const desc = escapeHtml(body?.descrizione || body?.note || 'Segnalazione guasto/sinistro inviata da terminale di bordo.');
    const gravita = escapeHtml(body?.gravita || body?.urgenza || 'Segnalazione');
    subject = `🔧 Segnalazione Guasto/Sinistro Mezzo: ${body?.mezzo || body?.targa || ''}`;
    badge = 'GESTIONE FLOTTA & MANUTENZIONE';
    bodyHtml = `<p><strong>Mezzo:</strong> ${mezzo}<br/><strong>Segnalato da:</strong> ${segnalatore}<br/><strong>Gravità:</strong> ${gravita}</p>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:10px 12px;border-radius:6px;">${desc}</p>`;
    recipients = collectRecipients(body, [defaultAdminEmail]);
  } else if (
    p.endsWith('/invia-email-tesoreria') ||
    p.endsWith('/invia-email-ricevuta-tesoriere') ||
    p.endsWith('/invia-email-documento-contabile')
  ) {
    const oggetto = String(body?.oggetto || body?.subject || 'Documento Contabile / Tesoreria — Croce Oro Massa Carrara');
    const testo = escapeHtml(body?.testo || body?.messaggio || body?.descrizione || 'In allegato il documento generato dal gestionale Croce Oro.');
    subject = oggetto.slice(0, 180);
    badge = 'TESORERIA & CONTABILITÀ';
    bodyHtml = `<p>${testo.replace(/\n/g, '<br/>')}</p>`;
    recipients = collectRecipients(body, [defaultTreasuryEmail]);
    const pdfB64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : typeof body?.allegatoBase64 === 'string' ? body.allegatoBase64 : '';
    if (pdfB64 && pdfB64.length < 8_000_000) {
      const cleanB64 = pdfB64.includes(',') ? pdfB64.split(',')[1] : pdfB64;
      const filename = String(body?.nomeFile || body?.fileName || 'documento_croce_oro.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      attachments.push({
        filename,
        content: Buffer.from(cleanB64, 'base64'),
        contentType: 'application/pdf',
      });
    }
  } else if (p.endsWith('/invia-email-guida-installazione')) {
    const oggetto = String(
      body?.oggetto ||
        '📱 Guida Installazione App Croce Oro (Apple & Android • Chrome & Safari) — PDF Ufficiale'
    );
    const urlApp = escapeHtml(body?.appUrl || 'https://croce-oro-massa-carrarra.vercel.app/');
    const mittenteNome = escapeHtml(body?.operatore || 'Presidenza / Sistemi Informativi');
    subject = oggetto.slice(0, 180);
    badge = 'GUIDA INSTALLAZIONE APP (SOP-00)';
    bodyHtml = `<p>In allegato trovi il documento <strong>PDF ufficiale</strong> della guida passo-passo per scaricare e installare l'applicazione <strong>Croce Oro Massa Carrara OdV</strong>.</p>
      <p style="background:#f8fafc;border-left:4px solid #e7b80b;padding:10px 14px;border-radius:6px;">
        <strong>Indirizzo ufficiale app:</strong> <a href="${urlApp}" style="color:#1d1a60;font-weight:bold;">${urlApp}</a><br/>
        <strong>Dispositivi coperti:</strong> Apple (iPhone / iPad) con Safari e Google Chrome &bull; Android con Google Chrome e altri browser.<br/>
        <strong>Archivio in App:</strong> Consultabile anche in <em>Archivio Documenti &amp; Procedure Operative (SOP)</em>.
      </p>
      <p style="font-size:12px;color:#64748b;">Invio richiesto da: ${mittenteNome}</p>`;
    recipients = collectRecipients(body, ['presidenza@croceoro.org']);
    const pdfB64 =
      typeof body?.pdfBase64 === 'string'
        ? body.pdfBase64
        : typeof body?.allegatoBase64 === 'string'
        ? body.allegatoBase64
        : '';
    if (pdfB64 && pdfB64.length < 8_000_000) {
      const cleanB64 = pdfB64.includes(',') ? pdfB64.split(',')[1] : pdfB64;
      const filename = String(
        body?.nomeFile || body?.fileName || 'Guida_Installazione_App_Croce_Oro.pdf'
      ).replace(/[^a-zA-Z0-9._-]/g, '_');
      attachments.push({
        filename,
        content: Buffer.from(cleanB64, 'base64'),
        contentType: 'application/pdf',
      });
    }
  } else {
    // Generic structured handler for all remaining operational notification routes
    // (turni scoperti, promemoria turni, compleanni, scadenze mezzi/attestati/fiscali, reintegro magazzino, convocazioni, modifiche admin, cauzione, note debito)
    const rawTitle = String(
      body?.oggetto ||
        body?.subject ||
        body?.titolo ||
        `Notifica Operativa (${p.split('/').filter(Boolean).pop() || 'sistema'})`
    );
    const rawMsg = String(
      body?.messaggio ||
        body?.testo ||
        body?.dettagli ||
        body?.descrizione ||
        body?.riepilogo ||
        'Aggiornamento automatico dal gestionale Croce Oro Massa Carrara OdV.'
    );
    subject = rawTitle.slice(0, 180);
    badge = 'CENTRALE OPERATIVA & GESTIONALE';
    bodyHtml = `<p>${escapeHtml(rawMsg).replace(/\n/g, '<br/>')}</p>`;
    recipients = collectRecipients(body, [defaultAdminEmail]);
  }

  if (recipients.length === 0) {
    return {
      status: 400,
      payload: {
        ok: false,
        success: false,
        inviata: false,
        error: 'Nessun indirizzo email destinatario valido specificato.',
      },
    };
  }

  const html = wrapBrandedEmail(subject, badge, bodyHtml);
  let sentCount = 0;
  const failed: string[] = [];

  for (const recipient of recipients) {
    try {
      await transporter.sendMail({
        from,
        to: recipient,
        subject,
        html,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      sentCount++;
    } catch {
      failed.push(recipient);
    }
  }

  if (sentCount === 0) {
    return {
      status: 502,
      payload: {
        ok: false,
        success: false,
        inviata: false,
        inviate: 0,
        error: 'Invio SMTP fallito verso tutti i destinatari. Verifica credenziali e server SMTP.',
      },
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      success: true,
      inviata: true,
      inviate: sentCount,
      fallite: failed.length,
    },
  };
}
