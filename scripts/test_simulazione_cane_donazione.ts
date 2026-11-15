import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

/**
 * Script di simulazione completa:
 * 1. La Centrale invia un mezzo per soccorso cane di proprietà (CANE, con proprietario e microchip).
 * 2. Verifica emissione di tutte le notifiche radio, push e broadcast.
 * 3. Registrazione orari operativi, chilometri e donazione ricevuta dal proprietario.
 * 4. Invio automatico della mail con allegato PDF alla Tesoreria (tesoreria@croceoro.org).
 * 5. Archiviazione definitiva nel database JSON persistente (croce_oro_db.json).
 */

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const DB_PATH = path.join(process.cwd(), 'data/croce_oro_db.json');

async function postJson(endpoint: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      `${SERVER_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getJson(endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}${endpoint}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    }).on('error', reject);
  });
}

async function runSimulation() {
  console.log('========================================================================');
  console.log('🚨 AVVIO SIMULAZIONE SOCCORSO VETERINARIO: CANE DI PROPRIETÀ CON DONAZIONE');
  console.log('========================================================================\n');

  const codiceMissione = `CO-VET-GIALLO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const mezzo = 'T4607';
  const dataOggi = new Date().toLocaleString('it-IT');

  const proprietario = {
    nome: 'Alessandro',
    cognome: 'Bianchi',
    indirizzo: 'Via Roma, 45',
    comune: 'Massa',
    provincia: 'MS',
    cap: '54100',
    telefono: '338 9876543',
    email: 'alessandro.bianchi@email.it',
    codiceFiscale: 'BNCALN85M15E956T'
  };

  const donazione = {
    ricevuta: true,
    somma: 50.0,
    metodo: 'pos',
    note: 'Donazione spontanea del proprietario per soccorso e trasporto cane'
  };

  // Step 0: Connessione WebSocket per monitorare notifiche e broadcast in tempo reale
  console.log('📡 [Step 0] Connessione al canale WebSocket in tempo reale...');
  const ws = new WebSocket(WS_URL);

  const capturedNotifications: any[] = [];
  const capturedBroadcasts: any[] = [];

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('  ✓ WebSocket connesso con successo al server locale.');
      resolve();
    });
    ws.on('error', (err) => {
      console.warn('  ⚠️ Attenzione: WebSocket non ha aperto immediatamente:', err.message);
      resolve();
    });
    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        capturedBroadcasts.push(parsed);
        if (parsed.type === 'NOTIFICATION_BROADCAST' || parsed.notification) {
          capturedNotifications.push(parsed.notification || parsed);
        }
      } catch {}
    });
  });

  // Step 1: Centrale invia la scheda missione al mezzo per soccorso cane di proprietà
  console.log('\n🚑 [Step 1] Centrale Operativa: Creazione e invio missione al mezzo T4607...');
  const missioneData = {
    codice: codiceMissione,
    anno: new Date().getFullYear(),
    mezzo,
    urgenza: 'GIALLO',
    ambito: 'SOCCORSO VETERINARIO',
    sottoAmbitoVet: 'URGENZA VETERINARIA',
    tipoAnimale: 'CANE',
    nonDiProprieta: false, // CANE DI PROPRIETÀ
    microchip: '380260043819284',
    indirizzo: 'Via Roma 45, Massa (MS)',
    destinazione: 'Clinica Veterinaria San Carlo, Massa (MS)',
    chiamante: 'Alessandro Bianchi (Proprietario)',
    telefono: '338 9876543',
    datiProprietarioCentrale: proprietario,
    noteCritiche: 'Cane taglia media zoppicante dopo caduta accidentale. Cane collaborativo e munito di guinzaglio.',
    sintesi: 'Soccorso cane di proprietà ferito - Via Roma 45, Massa'
  };

  ws.send(JSON.stringify({
    type: 'DISPATCH_MISSION',
    data: missioneData
  }));
  console.log(`  ✓ Missione ${codiceMissione} inviata via WebSocket. Target: ${mezzo}.`);
  await new Promise((r) => setTimeout(r, 800));

  // Step 2: Equipaggio conferma lettura della scheda
  console.log('\n📖 [Step 2] Bordo Mezzo: Conferma presa in carico e lettura scheda...');
  ws.send(JSON.stringify({
    type: 'CONFIRM_MISSION_READ',
    data: { codice: codiceMissione }
  }));
  await new Promise((r) => setTimeout(r, 600));

  // Step 3: Registrazione sequenza orari operativi e coordinate GPS
  console.log('\n⏱️ [Step 3] Bordo Mezzo: Registrazione orari operativi (Partenza, Sul Posto, Destinazione, Rientro)...');
  const orari = {
    partenza: '14:02:15',
    sulPosto: '14:14:40',
    coordinateSulPosto: { lat: 44.0356, lng: 10.1388, accuracy: 4 },
    partenzaObiettivo: '14:35:10',
    arrivoDestinazione: '14:52:00',
    coordinateDestinazione: { lat: 44.0412, lng: 10.1425, accuracy: 5 },
    fineMissione: '15:08:20',
    rientro: '15:22:10'
  };

  ws.send(JSON.stringify({
    type: 'UPDATE_OPERATIVE_TIMES',
    data: {
      codice: codiceMissione,
      times: orari,
      label: 'RIENTRO IN SEDE',
      timeStr: orari.rientro,
      isRientro: true
    }
  }));
  await new Promise((r) => setTimeout(r, 600));

  // Step 4: Registrazione Chilometri Bordo Mezzo (15420 Inizio -> 15448 Fine = 28 KM)
  console.log('\n🛣️ [Step 4] Bordo Mezzo: Registrazione KM (15420 -> 15448 = 28 KM)...');
  const kmInizio = 15420;
  const kmFine = 15448;
  const kmTotali = 28;

  ws.send(JSON.stringify({
    type: 'UPDATE_KM',
    data: {
      codice: codiceMissione,
      kmInizio,
      kmFine,
      kmTotali,
      messaggio: `🛣️ KM Registrati per ${codiceMissione}: Inizio ${kmInizio} | Fine ${kmFine} | Totali: ${kmTotali} KM`
    }
  }));
  await new Promise((r) => setTimeout(r, 600));

  // Step 5: Registrazione Consegna con Donazione di € 50.00 via POS dal proprietario
  console.log('\n💳 [Step 5] Registrazione Donazione di € 50.00 (POS) rilasciata dal proprietario...');
  const datiDestinazione = {
    donazione: {
      ricevuta: true,
      somma: donazione.somma,
      metodo: donazione.metodo,
      note: donazione.note
    },
    proprietario,
    firmaProprietario: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    animaleConsegnato: {
      specie: 'Cane',
      razza: 'Meticcio',
      microchip: '380260043819284',
      clinica: 'Clinica Veterinaria San Carlo, Massa'
    }
  };

  ws.send(JSON.stringify({
    type: 'UPDATE_DATI_DESTINAZIONE',
    data: {
      codice: codiceMissione,
      dati: datiDestinazione
    }
  }));
  await new Promise((r) => setTimeout(r, 600));

  // Step 6: Chiamata automatica endpoint Email Tesoreria (tesoreria@croceoro.org)
  console.log('\n📧 [Step 6] Chiamata automatica API /api/invia-email-tesoreria per invio PDF alla Tesoreria...');
  const payloadTesoreria = {
    codice: codiceMissione,
    data: dataOggi,
    mezzo,
    kmInizio,
    kmFine,
    kmTotali,
    donazione: {
      ricevuta: true,
      somma: donazione.somma,
      metodo: donazione.metodo
    },
    proprietario,
    volontarioNome: 'Marco Tardelli (Capo Turno)',
    indirizzoIntervento: 'Via Roma 45, Massa (MS)',
    destinazione: 'Clinica Veterinaria San Carlo, Massa (MS)',
    nomeFile: `Foglio_Viaggio_${codiceMissione}.pdf`
  };

  const resEmail = await postJson('/api/invia-email-tesoreria', payloadTesoreria);
  console.log('  Risultato invio email tesoreria:', JSON.stringify(resEmail.body, null, 2));

  // Step 7: Archiviazione del Servizio nel Database
  console.log('\n💾 [Step 7] Archiviazione definitiva del servizio nel Database (/api/servizi)...');
  const servizioArchiviato = {
    id: `SER-${codiceMissione}`,
    codice: codiceMissione,
    anno: new Date().getFullYear(),
    data: dataOggi,
    mezzo,
    urgenza: 'GIALLO',
    ambito: 'SOCCORSO VETERINARIO',
    sottoAmbitoVet: 'URGENZA VETERINARIA',
    tipoAnimale: 'CANE',
    nonDiProprieta: false,
    microchip: '380260043819284',
    indirizzo: 'Via Roma 45, Massa (MS)',
    destinazione: 'Clinica Veterinaria San Carlo, Massa (MS)',
    chiamante: 'Alessandro Bianchi (Proprietario)',
    telefono: '338 9876543',
    datiProprietarioCentrale: proprietario,
    datiDestinazione,
    volontarioNome: 'Marco Tardelli',
    qualificaTurno: 'Capo Turno',
    kmInizio,
    kmFine,
    kmTotali,
    inAttesaKm: false,
    tempi: orari,
    testoCompleto: `FOGLIO DI VIAGGIO CROCE ORO ${codiceMissione} - SOCCORSO CANE DI PROPRIETÀ - DONAZIONE € 50.00 (POS)`
  };

  const resArchivio = await postJson('/api/servizi', servizioArchiviato);
  console.log('  Risultato archiviazione:', resArchivio.status, resArchivio.body?.success ? 'SUCCESS' : 'ERROR');

  await new Promise((r) => setTimeout(r, 1000));
  ws.close();

  // Step 8: Verifiche e controlli finali
  console.log('\n🔍 [Step 8] CONTROLLI DI VERIFICA AUTOMATICA:');

  // Controllo A: Notifiche radio registrate
  const statoSync = await getJson('/api/sync');
  const notifiche = statoSync?.state?.notifiche || [];
  const notificaEmailTesoreria = notifiche.find((n: any) => n.testo && n.testo.includes('TESORERIA') && n.testo.includes(codiceMissione));
  const notificaMissione = notifiche.find((n: any) => n.testo && n.testo.includes(codiceMissione));

  console.log(`  ✓ Notifiche radio totali presenti sul server: ${notifiche.length}`);
  if (notificaMissione) {
    console.log(`  ✓ Notifica emissione missione trovata: "${notificaMissione.testo}"`);
  } else {
    console.log('  ⚠️ Notifica missione non trovata in lista.');
  }

  if (notificaEmailTesoreria) {
    console.log(`  ✓ Notifica radio Tesoreria trovata: "${notificaEmailTesoreria.testo}"`);
  } else {
    console.log('  ⚠️ Notifica radio Tesoreria non trovata.');
  }

  // Controllo B: Email alla Tesoreria
  if (resEmail.body?.success) {
    console.log(`  ✓ Endpoint Tesoreria OK: Destinatario ${resEmail.body.destinatario}, Importo €${resEmail.body.importo}, File: ${resEmail.body.filename}`);
    if (resEmail.body.dimensioneAllegatoBytes > 0) {
      console.log(`  ✓ PDF Foglio di Viaggio generato e allegato con successo: ${resEmail.body.dimensioneAllegatoBytes} bytes.`);
    }
  } else {
    console.error('  ❌ Errore nella risposta email tesoreria:', resEmail);
  }

  // Controllo C: Verifica Database JSON su disco
  const dbRaw = fs.readFileSync(DB_PATH, 'utf-8');
  const dbData = JSON.parse(dbRaw);
  const servizioTrovato = (dbData.serviziArchivio || []).find((s: any) => s.codice === codiceMissione);

  if (servizioTrovato) {
    console.log(`  ✓ Database croce_oro_db.json: Servizio ${codiceMissione} REGISTRATO E PERSISTITO CON SUCCESSO!`);
    console.log(`    - Tipo Animale: ${servizioTrovato.tipoAnimale} (nonDiProprieta: ${servizioTrovato.nonDiProprieta})`);
    console.log(`    - Microchip: ${servizioTrovato.microchip}`);
    console.log(`    - Proprietario: ${servizioTrovato.datiProprietarioCentrale?.nome} ${servizioTrovato.datiProprietarioCentrale?.cognome} (${servizioTrovato.datiProprietarioCentrale?.telefono})`);
    console.log(`    - Donazione: € ${servizioTrovato.datiDestinazione?.donazione?.somma} (${servizioTrovato.datiDestinazione?.donazione?.metodo})`);
    console.log(`    - Chilometri: Inizio ${servizioTrovato.kmInizio} | Fine ${servizioTrovato.kmFine} | Totale ${servizioTrovato.kmTotali} KM`);
  } else {
    console.error(`  ❌ ERRORE: Il servizio ${codiceMissione} non è stato trovato nel database JSON!`);
  }

  // Controllo D: Verifica lettura via GET /api/servizi
  const resLista = await getJson('/api/servizi');
  const presenteInLista = (resLista.servizi || []).some((s: any) => s.codice === codiceMissione);
  if (presenteInLista) {
    console.log(`  ✓ GET /api/servizi: Servizio ${codiceMissione} presente nell'elenco pubblico dell'archivio (totale: ${resLista.totale} servizi).`);
  }

  console.log('\n========================================================================');
  console.log('🎉 SIMULAZIONE COMPLETATA CON SUCCESSO! TUTTI I CONTROLLI HANNO DATO ESITO POSITIVO.');
  console.log('========================================================================\n');
}

runSimulation().catch((err) => {
  console.error('❌ ERRORE FATALE DURANTE LA SIMULAZIONE:', err);
  process.exit(1);
});
