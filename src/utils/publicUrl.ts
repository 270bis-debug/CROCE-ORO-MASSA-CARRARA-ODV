import firebaseConfig from '../../firebase-applet-config.json';

export const PUBLIC_URL_STORAGE_KEY = 'CROCE_ORO_PUBLIC_URL';

export function isProtectedAiStudioHost(urlOrHost: string): boolean {
  const val = (urlOrHost || '').trim().toLowerCase();
  if (!val) return true;
  try {
    const parsed = val.includes('://') ? new URL(val) : new URL(`https://${val}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.run.app') ||
      host.includes('aistudio.google.com') ||
      host.includes('googleusercontent.com') ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0'
    );
  } catch {
    return (
      val.includes('.run.app') ||
      val.includes('aistudio.google.com') ||
      val.includes('localhost') ||
      val.includes('127.0.0.1')
    );
  }
}

export function normalizePublicUrlInput(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  let withProto = trimmed;
  if (!/^https?:\/\//i.test(withProto)) {
    withProto = `https://${withProto}`;
  }
  return withProto.replace(/\/+$/, '');
}

export function getConfiguredPublicUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(PUBLIC_URL_STORAGE_KEY) || '';
    const norm = normalizePublicUrlInput(saved);
    if (!norm || isProtectedAiStudioHost(norm)) return '';
    return norm;
  } catch {
    return '';
  }
}

export function saveConfiguredPublicUrlLocal(url: string): string {
  if (typeof window === 'undefined') return '';
  const norm = normalizePublicUrlInput(url);
  try {
    if (!norm || isProtectedAiStudioHost(norm)) {
      localStorage.removeItem(PUBLIC_URL_STORAGE_KEY);
      return '';
    }
    localStorage.setItem(PUBLIC_URL_STORAGE_KEY, norm);
    return norm;
  } catch {
    return norm;
  }
}

export function capturePublicUrlIfApplicable(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (!isProtectedAiStudioHost(origin)) {
    const existing = getConfiguredPublicUrl();
    // Non sovrascrivere se l'admin ha già configurato manualmente una pagina specifica (es. .html su croceoro.org)
    if (!existing) {
      return saveConfiguredPublicUrlLocal(origin);
    }
    return existing;
  }
  return getConfiguredPublicUrl();
}

export function resolvePublicResetBaseUrl(): {
  baseUrl: string;
  isPublicNonGoogle: boolean;
} {
  const configured = getConfiguredPublicUrl();
  if (configured && !isProtectedAiStudioHost(configured)) {
    return { baseUrl: configured, isPublicNonGoogle: true };
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/+$/, '');
    if (!isProtectedAiStudioHost(origin)) {
      return { baseUrl: origin, isPublicNonGoogle: true };
    }
    return { baseUrl: origin, isPublicNonGoogle: false };
  }
  return { baseUrl: '', isPublicNonGoogle: false };
}

export function buildPublicResetUrl(params: {
  id: string;
  token: string;
  baseUrlOverride?: string;
}): {
  url: string;
  isPublicNonGoogle: boolean;
} {
  const override = params.baseUrlOverride ? normalizePublicUrlInput(params.baseUrlOverride) : '';
  const resolved = override && !isProtectedAiStudioHost(override)
    ? { baseUrl: override, isPublicNonGoogle: true }
    : resolvePublicResetBaseUrl();

  const qs = `id=${encodeURIComponent(params.id)}&token=${encodeURIComponent(params.token)}`;
  if (!resolved.baseUrl) {
    return { url: `/reset-pin?${qs}`, isPublicNonGoogle: false };
  }

  const lower = resolved.baseUrl.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return { url: `${resolved.baseUrl}?${qs}`, isPublicNonGoogle: resolved.isPublicNonGoogle };
  }
  return { url: `${resolved.baseUrl}/reset-pin?${qs}`, isPublicNonGoogle: resolved.isPublicNonGoogle };
}

function escapeHtmlSafe(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Genera una pagina HTML pubblica 100% autonoma (zero dipendenze, zero account Google/AI Studio richiesto)
 * utilizzabile sia come file statico ospitato su www.croceoro.org/reset-pin.html sia come allegato email.
 */
export function generaPaginaHtmlResetPinAutonoma(opts?: {
  tokenId?: string;
  volunteerId?: string;
  displayName?: string;
  qualifica?: string;
}): string {
  const presetToken = opts?.tokenId || '';
  const presetVolId = opts?.volunteerId || '';
  const presetName = opts?.displayName || '';
  const presetQualifica = opts?.qualifica || '';
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId;
  const apiKey = firebaseConfig.apiKey;
  const anno = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Attivazione PIN - Croce Oro Massa Carrara OdV</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background-color: #ffffff;
      color: #0f172a;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .wrap { max-width: 480px; margin: 0 auto; width: 100%; }
    header { text-align: center; padding: 14px 0 18px; }
    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    h1 { margin: 0; font-size: 22px; font-weight: 900; color: #1d1a60; text-transform: uppercase; letter-spacing: 0.4px; }
    .sub { margin: 4px 0 0; font-size: 12px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 1px; }
    .card {
      background: #ffffff;
      border: 2px solid #1d1a60;
      border-radius: 22px;
      padding: 22px 18px;
      box-shadow: 0 12px 30px rgba(29, 26, 96, 0.12);
    }
    .card.err { border-color: #ef4444; text-align: center; }
    .card.ok { border-color: #16a34a; text-align: center; }
    .info-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1d1a60; margin-bottom: 6px; }
    input[type="password"], input[type="text"], input[type="tel"] {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 2px solid #1d1a60;
      background: #ffffff;
      color: #0f172a;
      font-family: monospace;
      font-size: 22px;
      font-weight: 900;
      text-align: center;
      letter-spacing: 8px;
      outline: none;
    }
    .btn {
      width: 100%;
      padding: 15px;
      border-radius: 14px;
      background: #1d1a60;
      color: #fbbf24;
      border: 2px solid #fbbf24;
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      margin-top: 12px;
    }
    .btn:disabled { background: #94a3b8; color: #ffffff; border-color: #cbd5e1; cursor: not-allowed; }
    .msg-err {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fef2f2;
      border: 2px solid #ef4444;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
    }
    footer { text-align: center; padding: 20px 0 6px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Croce Oro Massa Carrara</h1>
      <p class="sub">Organizzazione di Volontariato &bull; OdV</p>
      <div class="badge">Portale Autonomo &bull; Nessun Account Google Richiesto</div>
    </header>

    <main id="app-root">
      <div class="card" style="text-align:center; padding:32px 18px;">
        <p style="margin:0; font-weight:700; color:#334155;">Verifica credenziali in corso...</p>
      </div>
    </main>

    <footer>
      <strong>&copy; ${anno} Croce Oro Massa Carrara OdV</strong> &bull; Centrale Operativa Radio &amp; Emergenze
    </footer>
  </div>

  <script>
    (function () {
      var PROJECT_ID = ${JSON.stringify(projectId)};
      var DB_ID = ${JSON.stringify(databaseId)};
      var API_KEY = ${JSON.stringify(apiKey)};
      var PRESET_TOKEN = ${JSON.stringify(presetToken)};
      var PRESET_VOL_ID = ${JSON.stringify(presetVolId)};
      var PRESET_NAME = ${JSON.stringify(presetName)};
      var PRESET_QUALIFICA = ${JSON.stringify(presetQualifica)};

      var qs = new URLSearchParams(window.location.search || '');
      var token = (qs.get('token') || qs.get('resetToken') || PRESET_TOKEN || '').trim();
      var root = document.getElementById('app-root');

      function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      var baseFs = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(PROJECT_ID) +
        '/databases/' + encodeURIComponent(DB_ID) + '/documents';

      function getField(docObj, key) {
        var f = docObj && docObj.fields && docObj.fields[key];
        if (!f) return '';
        return f.stringValue || f.integerValue || f.timestampValue || '';
      }

      function renderError(msg) {
        root.innerHTML =
          '<div class="card err">' +
            '<h2 style="margin:0 0 10px; font-size:18px; color:#991b1b; text-transform:uppercase;">Link Non Disponibile</h2>' +
            '<p style="margin:0 0 14px; font-size:13px; color:#334155; line-height:1.5;">' + esc(msg) + '</p>' +
            '<div class="info-box" style="font-size:12px; color:#475569;">Contatta la <strong>Centrale Operativa</strong> della Croce Oro Massa Carrara per richiedere un nuovo invito.</div>' +
          '</div>';
      }

      function renderSuccess(nome) {
        root.innerHTML =
          '<div class="card ok">' +
            '<div style="display:inline-block; padding:4px 12px; border-radius:9999px; background:#dcfce7; border:1px solid #86efac; color:#166534; font-size:11px; font-weight:800; text-transform:uppercase;">Attivazione Completata</div>' +
            '<h2 style="margin:10px 0 12px; font-size:20px; color:#14532d; text-transform:uppercase;">Nuovo PIN Personale Impostato!</h2>' +
            '<div class="info-box" style="text-align:left; font-size:13px; color:#1e293b; line-height:1.6;">' +
              '<p style="margin:0 0 8px;">Gentile <strong>' + esc(nome) + '</strong>, il tuo nuovo PIN personale a 4 cifre &egrave; stato salvato nel database protetto.</p>' +
              '<p style="margin:0; font-weight:800; color:#1d1a60;">Da adesso puoi accedere direttamente sui terminali e tablet dell&apos;Associazione con il tuo nuovo PIN.</p>' +
            '</div>' +
          '</div>';
      }

      function renderForm(docObj) {
        var displayName = getField(docObj, 'displayName') || PRESET_NAME || 'Operatore Croce Oro';
        var qualifica = getField(docObj, 'qualifica') || PRESET_QUALIFICA || 'Volontario';
        var volunteerId = getField(docObj, 'volunteerId') || PRESET_VOL_ID;
        var createdAtTs = getField(docObj, 'createdAt') || new Date().toISOString();
        var pinProvvServer = getField(docObj, 'pinProvvisorio');

        root.innerHTML =
          '<div class="card">' +
            '<div class="info-box">' +
              '<span style="font-size:11px; font-weight:800; text-transform:uppercase; color:#b45309;">Account in Attivazione</span>' +
              '<h2 style="margin:4px 0; font-size:18px; color:#0f172a;">' + esc(displayName) + '</h2>' +
              '<p style="margin:0; font-size:12px; color:#475569;">Qualifica: <strong style="color:#0f172a;">' + esc(qualifica) + '</strong></p>' +
            '</div>' +
            '<form id="pin-form" autocomplete="off">' +
              '<div style="margin-bottom:14px;">' +
                '<label class="label" for="pinProvv">1. PIN Provvisorio (dalla mail)</label>' +
                '<input id="pinProvv" type="password" inputmode="numeric" maxlength="4" placeholder="••••" required />' +
              '</div>' +
              '<div style="margin-bottom:14px;">' +
                '<label class="label" for="pinNuovo">2. Nuovo PIN Personale (4 cifre)</label>' +
                '<input id="pinNuovo" type="password" inputmode="numeric" maxlength="4" placeholder="••••" required />' +
              '</div>' +
              '<div style="margin-bottom:10px;">' +
                '<label class="label" for="pinConf">3. Conferma Nuovo PIN Personale</label>' +
                '<input id="pinConf" type="password" inputmode="numeric" maxlength="4" placeholder="••••" required />' +
              '</div>' +
              '<div id="err-box" class="msg-err" style="display:none;"></div>' +
              '<button id="btn-submit" type="submit" class="btn">Salva Nuovo PIN ed Attiva Profilo</button>' +
            '</form>' +
          '</div>';

        var form = document.getElementById('pin-form');
        var errBox = document.getElementById('err-box');
        var btn = document.getElementById('btn-submit');

        function showErr(m) {
          errBox.textContent = m;
          errBox.style.display = 'block';
        }

        ['pinProvv', 'pinNuovo', 'pinConf'].forEach(function (id) {
          var el = document.getElementById(id);
          el.addEventListener('input', function () {
            el.value = el.value.replace(/\\D/g, '').slice(0, 4);
            errBox.style.display = 'none';
          });
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var provv = document.getElementById('pinProvv').value.trim();
          var nuovo = document.getElementById('pinNuovo').value.trim();
          var conf = document.getElementById('pinConf').value.trim();

          if (!/^\\d{4}$/.test(provv)) return showErr('Inserisci il PIN provvisorio a 4 cifre ricevuto nella email.');
          if (!/^\\d{4}$/.test(nuovo)) return showErr('Il nuovo PIN deve essere composto esattamente da 4 cifre numeriche.');
          if (nuovo === '4451') return showErr('Questo codice PIN è riservato al sistema. Scegli un altro numero.');
          if (nuovo !== conf) return showErr('I due campi del nuovo PIN non coincidono.');
          if (provv === nuovo) return showErr('Il nuovo PIN deve essere diverso dal PIN provvisorio.');

          btn.disabled = true;
          btn.textContent = 'Salvataggio PIN in corso...';

          var docName = 'projects/' + PROJECT_ID + '/databases/' + DB_ID + '/documents/pin_resets/' + token;
          var commitBody = {
            writes: [
              {
                update: {
                  name: docName,
                  fields: {
                    tokenId: { stringValue: token },
                    volunteerId: { stringValue: volunteerId },
                    displayName: { stringValue: displayName },
                    qualifica: { stringValue: qualifica },
                    pinProvvisorio: { stringValue: pinProvvServer || provv },
                    pinProvvisorioVerifica: { stringValue: provv },
                    status: { stringValue: 'completed' },
                    nuovoPin: { stringValue: nuovo },
                    createdAt: { timestampValue: createdAtTs }
                  }
                },
                updateMask: {
                  fieldPaths: ['status', 'nuovoPin', 'pinProvvisorioVerifica']
                },
                updateTransforms: [
                  { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
                  { fieldPath: 'completedAt', setToServerValue: 'REQUEST_TIME' }
                ],
                currentDocument: { exists: true }
              }
            ]
          };

          fetch(baseFs + ':commit?key=' + encodeURIComponent(API_KEY), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commitBody)
          })
            .then(function (r) {
              return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
            })
            .then(function (res) {
              if (res.ok) {
                renderSuccess(displayName);
              } else {
                btn.disabled = false;
                btn.textContent = 'Salva Nuovo PIN ed Attiva Profilo';
                var errTxt = (res.body && res.body.error && res.body.error.message) || '';
                if (res.status === 403 || errTxt.indexOf('PERMISSION_DENIED') !== -1) {
                  showErr('PIN Provvisorio errato oppure link già utilizzato in precedenza. Verifica il codice nella mail.');
                } else {
                  showErr(errTxt || 'Errore durante il salvataggio. Riprova tra qualche istante.');
                }
              }
            })
            .catch(function () {
              btn.disabled = false;
              btn.textContent = 'Salva Nuovo PIN ed Attiva Profilo';
              showErr('Errore di rete durante il salvataggio. Controlla la connessione Internet.');
            });
        });
      }

      if (!token || token.indexOf('rst-') !== 0) {
        renderError('Link di attivazione mancante o non valido. Apri il link completo ricevuto nella email o usa l\\'allegato originale.');
        return;
      }

      fetch(baseFs + '/pin_resets/' + encodeURIComponent(token) + '?key=' + encodeURIComponent(API_KEY))
        .then(function (r) {
          return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
        })
        .then(function (res) {
          if (!res.ok) {
            if (res.status === 404) {
              renderError('Questo link di attivazione non è più valido, è scaduto o è stato sostituito da un nuovo invito.');
            } else {
              renderError('Impossibile verificare la richiesta di reset (HTTP ' + res.status + '). Riprova tra poco.');
            }
            return;
          }
          var st = getField(res.body, 'status');
          if (st === 'completed' || st === 'applied') {
            renderSuccess(getField(res.body, 'displayName') || PRESET_NAME || 'Operatore');
            return;
          }
          renderForm(res.body);
        })
        .catch(function () {
          renderError('Connessione Internet assente o server non raggiungibile. Riprova quando sei connesso.');
        });
    })();
  </script>
</body>
</html>`;
}

export function scaricaPaginaHtmlResetPinPubblica(): void {
  if (typeof window === 'undefined') return;
  const html = generaPaginaHtmlResetPinAutonoma();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reset-pin.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
