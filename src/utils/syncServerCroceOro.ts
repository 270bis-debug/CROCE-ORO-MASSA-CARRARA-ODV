/**
 * Utilità per la Sincronizzazione e Salvataggio Dati sul Dominio www.croceoro.org
 * Spazio hosting disponibile: 10 GB
 * Croce Oro Massa Carrara OdV
 */
import { formatISODateItaly } from './italianTime';

export const DOMINIO_CROCE_ORO = 'www.croceoro.org';
export const ENDPOINT_DEFAULT = 'https://www.croceoro.org/api/sync_croceoro.php';
export const TOKEN_DEFAULT = 'CROCE_ORO_API_KEY_2026_MASSA';
export const SPAZIO_HOSTING_TOTALE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB = 10.737.418.240 byte

export interface PacchettoDatiCroceOro {
  versione: string;
  dataGenerazione: string;
  associazione: string;
  dominio: string;
  operatore: string;
  statistiche: {
    totaleServizi: number;
    totaleVolontari: number;
    totaleTimbrature: number;
    totaleMezzi: number;
    totaleManutenzioni: number;
    totaleDonazioni: number;
    totaleCorsi: number;
    totaleSedi: number;
    totaleTurni: number;
    totaleContatti: number;
    totaleArticoliMagazzino: number;
  };
  dati: {
    serviziArchivio: any[];
    volontari: any[];
    timbrature: any[];
    mezzi: any[];
    manutenzioni: any[];
    donazioni?: any[];
    tessere?: any[];
    noteDiDebito?: any[];
    corsi?: any[];
    sedi?: any[];
    turni?: any[];
    bacheca?: any[];
    contatti?: any[];
    magazzino?: any[];
  };
}

export interface RegistroBackupLocale {
  id: string;
  data: string;
  operatore: string;
  nomeFile: string;
  dimensioneByte: number;
  dimensioneFormattata: string;
  esito: 'successo' | 'locale_scaricato' | 'errore';
  dettagli: string;
  serverUrl: string;
}

// Helper per ottenere le impostazioni correnti di sincronizzazione
export function getImpostazioniSyncServer() {
  const url = localStorage.getItem('croceoro_server_sync_url') || ENDPOINT_DEFAULT;
  const token = localStorage.getItem('croceoro_server_sync_token') || TOKEN_DEFAULT;
  const autoSync = localStorage.getItem('croceoro_server_sync_auto') === 'true';
  const ultimoSync = localStorage.getItem('croceoro_server_sync_last_time') || null;
  
  let cronologia: RegistroBackupLocale[] = [];
  try {
    const raw = localStorage.getItem('croceoro_server_sync_history');
    if (raw) cronologia = JSON.parse(raw);
  } catch (e) {
    cronologia = [];
  }

  return { url, token, autoSync, ultimoSync, cronologia };
}

// Salva impostazioni
export function salvaImpostazioniSyncServer(url: string, token: string, autoSync: boolean) {
  localStorage.setItem('croceoro_server_sync_url', url.trim());
  localStorage.setItem('croceoro_server_sync_token', token.trim());
  localStorage.setItem('croceoro_server_sync_auto', autoSync ? 'true' : 'false');
}

// Formatta byte in KB, MB o GB
export function formattaDimensione(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Aggiunge un record alla cronologia
export function registraBackupInCronologia(record: Omit<RegistroBackupLocale, 'id'>) {
  const nuovoRecord: RegistroBackupLocale = {
    ...record,
    id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  };
  try {
    const raw = localStorage.getItem('croceoro_server_sync_history');
    const list: RegistroBackupLocale[] = raw ? JSON.parse(raw) : [];
    list.unshift(nuovoRecord);
    // Conserva gli ultimi 50 log
    const trimmed = list.slice(0, 50);
    localStorage.setItem('croceoro_server_sync_history', JSON.stringify(trimmed));
    localStorage.setItem('croceoro_server_sync_last_time', nuovoRecord.data);
  } catch (e) {
    console.error('Errore salvataggio cronologia backup:', e);
  }
}

// Testa la connessione HTTP con l'endpoint su www.croceoro.org
export async function testaConnessioneServer(endpointUrl?: string, token?: string): Promise<{
  ok: boolean;
  messaggio: string;
  datiServer?: any;
}> {
  const targetUrl = endpointUrl || getImpostazioniSyncServer().url;
  const targetToken = token || getImpostazioniSyncServer().token;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CroceOro-Token': targetToken
      },
      body: JSON.stringify({
        azione: 'ping',
        clientTime: new Date().toISOString(),
        mittente: 'Croce Oro Massa Carrara Gestione'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      if (resp.status === 404) {
        return {
          ok: false,
          messaggio: `Endpoint 404: Il file 'sync_croceoro.php' non è ancora stato caricato nella cartella 'api/' del server www.croceoro.org. Scarica lo script e caricalo via cPanel o FTP.`
        };
      }
      if (resp.status === 403 || resp.status === 401) {
        return {
          ok: false,
          messaggio: `Accesso non autorizzato (HTTP ${resp.status}): Il Token di sicurezza non corrisponde a quello configurato nello script PHP del server.`
        };
      }
      return {
        ok: false,
        messaggio: `Risposta anomala dal server (HTTP ${resp.status}): ${resp.statusText}`
      };
    }

    const json = await resp.json();
    if (json.success) {
      return {
        ok: true,
        messaggio: json.message || 'Connessione stabilita con successo a www.croceoro.org!',
        datiServer: json
      };
    } else {
      return {
        ok: false,
        messaggio: json.error || 'Il server ha risposto con un errore di configurazione.',
        datiServer: json
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        messaggio: 'Timeout di rete: Il dominio www.croceoro.org non ha risposto entro 10 secondi.'
      };
    }
    // Tipico errore CORS se lo script non è ancora presente
    return {
      ok: false,
      messaggio: `Impossibile raggiungere ${targetUrl}. Causa probabile: lo script PHP 'sync_croceoro.php' non è ancora stato posizionato nella cartella 'api/' di www.croceoro.org oppure il certificato SSL/CORS non è ancora configurato.`
    };
  }
}

// Invia il pacchetto completo dei dati a www.croceoro.org
export async function inviaBackupAlServer(
  pacchetto: PacchettoDatiCroceOro,
  endpointUrl?: string,
  token?: string
): Promise<{
  ok: boolean;
  messaggio: string;
  dimensioneByte: number;
  nomeFileServer?: string;
  spazioOccupatoTotale?: string;
  spazioRimanente?: string;
}> {
  const targetUrl = endpointUrl || getImpostazioniSyncServer().url;
  const targetToken = token || getImpostazioniSyncServer().token;
  
  const payloadString = JSON.stringify({
    azione: 'salva_backup',
    dataOra: new Date().toISOString(),
    pacchetto
  });
  const dimensioneByte = new Blob([payloadString]).size;
  const dimFormattata = formattaDimensione(dimensioneByte);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per backup

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CroceOro-Token': targetToken
      },
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} - ${resp.statusText}`);
    }

    const json = await resp.json();
    if (!json.success) {
      throw new Error(json.error || 'Errore restituito dal server');
    }

    // Registra successo
    registraBackupInCronologia({
      data: new Date().toISOString(),
      operatore: pacchetto.operatore,
      nomeFile: json.nomeFile || `backup_croceoro_${formatISODateItaly()}.json`,
      dimensioneByte,
      dimensioneFormattata: dimFormattata,
      esito: 'successo',
      dettagli: `Salvataggio remoto riuscito su www.croceoro.org. File: ${json.nomeFile || 'archivio'}. Spazio residuo: ${json.spazioRimanente || '10 GB'}.`,
      serverUrl: targetUrl
    });

    return {
      ok: true,
      messaggio: `Backup inviato e salvato con successo sui 10 GB di www.croceoro.org! Dimensione: ${dimFormattata}`,
      dimensioneByte,
      nomeFileServer: json.nomeFile,
      spazioOccupatoTotale: json.spazioOccupatoTotale,
      spazioRimanente: json.spazioRimanente
    };
  } catch (err: any) {
    // Registra errore in cronologia
    registraBackupInCronologia({
      data: new Date().toISOString(),
      operatore: pacchetto.operatore,
      nomeFile: `backup_croceoro_${formatISODateItaly()}.json`,
      dimensioneByte,
      dimensioneFormattata: dimFormattata,
      esito: 'errore',
      dettagli: `Errore trasmissione verso ${targetUrl}: ${err.message}`,
      serverUrl: targetUrl
    });

    return {
      ok: false,
      messaggio: `Errore durante il salvataggio su ${targetUrl}: ${err.message}. Puoi comunque scaricare la copia di backup sul tuo computer.`,
      dimensioneByte
    };
  }
}

// Scarica il file JSON di backup direttamente sul dispositivo locale
export function scaricaBackupLocale(pacchetto: PacchettoDatiCroceOro, nomePersonalizzato?: string) {
  const dataStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nomeFile = nomePersonalizzato || `backup_croceoro_${dataStr}.json`;
  const jsonContent = JSON.stringify(pacchetto, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  registraBackupInCronologia({
    data: new Date().toISOString(),
    operatore: pacchetto.operatore,
    nomeFile,
    dimensioneByte: blob.size,
    dimensioneFormattata: formattaDimensione(blob.size),
    esito: 'locale_scaricato',
    dettagli: `File scaricato con successo sul computer locale (${formattaDimensione(blob.size)}).`,
    serverUrl: 'Dispositivo Locale'
  });

  return { nomeFile, dimensione: formattaDimensione(blob.size) };
}

// Genera lo script PHP pronto per www.croceoro.org
export function generaScriptPHP(tokenConfigurato: string = TOKEN_DEFAULT): string {
  return `<?php
/**
 * ==============================================================================
 * CROCE ORO MASSA CARRARA OdV - SCRIPT DI BACKUP & SYNC SERVER (10 GB STORAGE)
 * ==============================================================================
 * Posizione consigliata sul server: /public_html/api/sync_croceoro.php
 * Dominio: https://www.croceoro.org
 * Versione: 2.4.6
 *
 * Funzionalità:
 * 1. Riceve in modo sicuro i backup completi dell'applicazione Croce Oro via POST
 * 2. Salva gli archivi JSON timestampati nella cartella protetta /storage_croceoro/backups/
 * 3. Gestisce le intestazioni CORS per consentire il salvataggio da browser e app
 * 4. Calcola lo spazio utilizzato rispetto alla quota di 10 GB
 * 5. Offre endpoint per test (ping), salvataggio, elenco backup e download
 * ==============================================================================
 */

// 1. INTESTAZIONI CORS (Cross-Origin Resource Sharing)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CroceOro-Token');
header('Content-Type: application/json; charset=utf-8');

// Gestione preflight OPTIONS del browser
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. CONFIGURAZIONE CHIAVE DI SICUREZZA
// Questa chiave deve corrispondere a quella impostata nel gestionale Croce Oro
define('CROCE_ORO_SECRET_TOKEN', '${tokenConfigurato}');

// 3. CARTELLA DI SALVATAGGIO DEI BACKUP SUI 10 GB DI SPAZIO
// Si posiziona un livello sopra public_html per massima sicurezza (o dentro una cartella protetta)
$storageDir = __DIR__ . '/../storage_croceoro/backups/';
if (!file_exists($storageDir)) {
    @mkdir($storageDir, 0755, true);
    // Protegge la cartella con .htaccess per impedire l'accesso diretto da web ai file
    @file_put_contents($storageDir . '.htaccess', "Deny from all\\nOptions -Indexes");
}

// Helper: Formatta dimensione in KB, MB o GB
function formattaBytes($bytes) {
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1024 * 1024) return round($bytes / 1024, 1) . ' KB';
    if ($bytes < 1024 * 1024 * 1024) return round($bytes / (1024 * 1024), 2) . ' MB';
    return round($bytes / (1024 * 1024 * 1024), 2) . ' GB';
}

// Helper: Calcola dimensione totale cartella backup
function calcolaDimensioneCartella($dir) {
    $size = 0;
    if (is_dir($dir)) {
        foreach (scandir($dir) as $file) {
            if ($file !== '.' && $file !== '..' && $file !== '.htaccess') {
                $path = $dir . '/' . $file;
                if (is_file($path)) $size += filesize($path);
            }
        }
    }
    return $size;
}

// 4. VERIFICA TOKEN DI AUTORIZZAZIONE
$receivedToken = '';
if (isset($_SERVER['HTTP_X_CROCEORO_TOKEN'])) {
    $receivedToken = $_SERVER['HTTP_X_CROCEORO_TOKEN'];
} elseif (isset($_GET['token'])) {
    $receivedToken = $_GET['token'];
}

if ($receivedToken !== CROCE_ORO_SECRET_TOKEN) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Non autorizzato: Token di sicurezza non valido o assente.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 5. LETTURA PAYLOAD JSON
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$azione = isset($data['azione']) ? $data['azione'] : (isset($_GET['azione']) ? $_GET['azione'] : 'ping');

// 6. GESTIONE AZIONI
switch ($azione) {

    // A) PING / TEST DI CONNESSIONE
    case 'ping':
        $spazioUsato = calcolaDimensioneCartella($storageDir);
        $spazioQuota10GB = 10 * 1024 * 1024 * 1024;
        $spazioDisponibile = max(0, $spazioQuota10GB - $spazioUsato);

        echo json_encode([
            'success' => true,
            'message' => 'Connessione attiva con il server www.croceoro.org!',
            'serverTime' => date('Y-m-d H:i:s'),
            'dominio' => 'www.croceoro.org',
            'cartellaStorage' => realpath($storageDir) ?: $storageDir,
            'spazioOccupatoTotale' => formattaBytes($spazioUsato),
            'spazioRimanente' => formattaBytes($spazioDisponibile),
            'quotaMassima' => '10 GB',
            'phpVersion' => phpversion()
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    // B) SALVATAGGIO NUOVO BACKUP COMPLETO
    case 'salva_backup':
        if (!isset($data['pacchetto'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Pacchetto dati mancante nella richiesta.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $timestamp = date('Y-m-d_H-i-s');
        $nomeFile = 'backup_croceoro_' . $timestamp . '.json';
        $percorsoCompleto = $storageDir . $nomeFile;

        $jsonPayload = json_encode($data['pacchetto'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $salvato = @file_put_contents($percorsoCompleto, $jsonPayload);

        if ($salvato === false) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Impossibile scrivere il file di backup su disco. Verifica i permessi della cartella.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Salva anche una copia "ultimo_backup.json" per recupero istantaneo
        @file_put_contents($storageDir . 'ultimo_backup.json', $jsonPayload);

        $spazioUsato = calcolaDimensioneCartella($storageDir);
        $spazioQuota10GB = 10 * 1024 * 1024 * 1024;
        $spazioDisponibile = max(0, $spazioQuota10GB - $spazioUsato);

        echo json_encode([
            'success' => true,
            'message' => 'Backup salvato con successo sui 10 GB di www.croceoro.org!',
            'nomeFile' => $nomeFile,
            'bytesSalvati' => $salvato,
            'dimensione' => formattaBytes($salvato),
            'dataSalvataggio' => date('Y-m-d H:i:s'),
            'spazioOccupatoTotale' => formattaBytes($spazioUsato),
            'spazioRimanente' => formattaBytes($spazioDisponibile)
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    // C) ELENCO BACKUP SALVATI SUL SERVER
    case 'elenco_backup':
        $files = [];
        if (is_dir($storageDir)) {
            foreach (scandir($storageDir) as $file) {
                if (strpos($file, 'backup_croceoro_') === 0 && strpos($file, '.json') !== false) {
                    $path = $storageDir . $file;
                    $files[] = [
                        'nomeFile' => $file,
                        'dimensioneByte' => filesize($path),
                        'dimensione' => formattaBytes(filesize($path)),
                        'dataModifica' => date('Y-m-d H:i:s', filemtime($path))
                    ];
                }
            }
        }
        // Ordina dal più recente
        usort($files, function($a, $b) {
            return strcmp($b['nomeFile'], $a['nomeFile']);
        });

        echo json_encode([
            'success' => true,
            'totaleFile' => count($files),
            'elenco' => $files,
            'spazioOccupatoTotale' => formattaBytes(calcolaDimensioneCartella($storageDir))
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    // D) RECUPERO ULTIMO BACKUP
    case 'recupera_ultimo':
        $ultimoFile = $storageDir . 'ultimo_backup.json';
        if (!file_exists($ultimoFile)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Nessun backup trovato sul server.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $contenuto = file_get_contents($ultimoFile);
        $dati = json_decode($contenuto, true);
        echo json_encode([
            'success' => true,
            'dataSalvataggio' => date('Y-m-d H:i:s', filemtime($ultimoFile)),
            'pacchetto' => $dati
        ], JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Azione non riconosciuta: ' . htmlspecialchars($azione)], JSON_UNESCAPED_UNICODE);
        break;
}
?>`;
}

// Scarica il file PHP già pronto sul computer dell'amministratore per caricarlo su cPanel
export function scaricaFilePHPPronto(token?: string) {
  const content = generaScriptPHP(token || getImpostazioniSyncServer().token);
  const blob = new Blob([content], { type: 'application/x-httpd-php;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sync_croceoro.php';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
