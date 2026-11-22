// soundEngine.ts - Motore Audio per Croce Oro Massa Carrara
// Gestisce il canale audio in background per far squillare il telefono anche con SCHERMO BLOCCATO

class SoundEngine {
  private audioElement: HTMLAudioElement | null = null;
  private isStandbyActive: boolean = false;
  private isCurrentlyRinging: boolean = false;
  private currentRingType: 'telefono' | 'sirena' = 'telefono';
  private vibrationInterval: any = null;
  private audioCtx: AudioContext | null = null;
  private beeperInterval: any = null;
  private isBeeperActive: boolean = false;
  private radioAudioElement: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
      this.initRadioAudioElement();
      this.setupMediaSession();
    }
  }

  private initRadioAudioElement() {
    if (this.radioAudioElement) return;
    try {
      this.radioAudioElement = new Audio('/cicalino_radio.wav');
      this.radioAudioElement.id = 'croce-oro-radio-audio';
      this.radioAudioElement.preload = 'auto';
      this.radioAudioElement.loop = true;
      (this.radioAudioElement as any).playsInline = true;
      this.radioAudioElement.setAttribute('playsinline', 'true');
      this.radioAudioElement.setAttribute('webkit-playsinline', 'true');
      this.radioAudioElement.addEventListener('error', (e) => {
        console.warn('[SoundEngine] Errore radioAudioElement:', e);
      });
    } catch {}
  }

  private initAudioElement() {
    if (this.audioElement) return;

    this.audioElement = new Audio();
    this.audioElement.id = 'croce-oro-emergency-audio';
    this.audioElement.preload = 'auto';
    this.audioElement.loop = true;
    (this.audioElement as any).playsInline = true;
    this.audioElement.setAttribute('playsinline', 'true');
    this.audioElement.setAttribute('webkit-playsinline', 'true');

    // Se l'audio termina per errore o disconnessione, ripristina standby
    this.audioElement.addEventListener('error', (e) => {
      console.warn('[SoundEngine] Errore riproduzione audio:', e);
    });
  }

  public clearMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    } catch {}
  }

  private setupMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      // NON impostare metadata all'avvio: la scheda multimediale di sistema deve apparire
      // solo durante una suoneria/allarme reale e scomparire subito al termine.
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.isCurrentlyRinging) {
          this.stopEmergencyRing();
        } else if (this.isBeeperActive) {
          this.stopCicalinoRetromarcia();
        } else {
          this.clearMediaSession();
        }
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        this.stopEmergencyRing();
        this.stopCicalinoRetromarcia();
        this.clearMediaSession();
      });

      navigator.mediaSession.setActionHandler('play', null);
    } catch (e) {
      console.warn('[SoundEngine] MediaSession non completamente configurabile:', e);
    }
  }

  // 1. PREPARA/SBLOCCA IL MOTORE AUDIO (senza alcun loop continuo che tenga acceso il DAC/altoparlante o la scheda player)
  public async startStandbyAudio(): Promise<boolean> {
    this.initAudioElement();
    if (this.isCurrentlyRinging) return true;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume().catch(() => {});
        }
      }
      // Assicura che nessun file standby sia in riproduzione continua (evita fruscio e scheda multimediale bloccata)
      if (this.audioElement && !this.audioElement.paused && !this.isCurrentlyRinging) {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      }
      if (!this.isCurrentlyRinging && !this.isBeeperActive) {
        this.clearMediaSession();
      }
      this.isStandbyActive = true;
      return true;
    } catch {
      this.isStandbyActive = false;
      return false;
    }
  }

  // 2. FA SQUILLARE IL TELEFONO AL MASSIMO VOLUME (Anche da Schermo Bloccato)
  public async playEmergencyRing(tipo: 'telefono' | 'sirena' = 'telefono', sorgente: string = 'Centrale Operativa'): Promise<boolean> {
    this.initAudioElement();
    if (!this.audioElement) return false;

    this.isCurrentlyRinging = true;
    this.currentRingType = tipo;

    const audioFile = tipo === 'sirena' ? '/sirena_emergenza.mp3' : '/suoneria_telefono.mp3';

    try {
      this.audioElement.src = audioFile;
      this.audioElement.loop = true;
      this.audioElement.volume = 1.0; // MASSIMO VOLUME
      this.audioElement.currentTime = 0;
      await this.audioElement.play();
    } catch (err) {
      console.warn('[SoundEngine] Errore play audio ring:', err);
      // Fallback rapido provando a riprodurre comunque
      try {
        await this.audioElement.play();
      } catch {}
    }

    // Aggiorna la schermata di blocco del telefono
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: tipo === 'sirena' ? '🚨 ALLARME SIRENA EMERGENZA' : '🔔 SQUILLO TELEFONO SOCCORSO',
          artist: `Chiamata da: ${sorgente}`,
          album: 'Croce Oro Massa Carrara',
          artwork: [
            { src: '/icon-512-v2.png', sizes: '512x512', type: 'image/png' },
            { src: '/logo_croce_oro_v2.png', sizes: '1024x1024', type: 'image/png' }
          ]
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    }

    // Avvia ciclo di vibrazione continua
    this.startEmergencyVibration();

    return true;
  }

  // 3. SILENZIA SUONERIA E RILASCIA COMPLETAMENTE IL CANALE AUDIO/MEDIASESSION
  public stopEmergencyRing() {
    this.isCurrentlyRinging = false;
    this.stopEmergencyVibration();

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch {}
    }

    if (!this.isBeeperActive) {
      this.clearMediaSession();
    }
  }

  private startEmergencyVibration() {
    this.stopEmergencyVibration();
    if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

    try {
      navigator.vibrate([1000, 300, 1000, 300, 1500, 300, 1500]);
    } catch {}

    this.vibrationInterval = setInterval(() => {
      if (!this.isCurrentlyRinging) {
        this.stopEmergencyVibration();
        return;
      }
      try {
        navigator.vibrate([1000, 300, 1000, 300, 1500, 300, 1500]);
      } catch {}
    }, 3500);
  }

  private stopEmergencyVibration() {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  public getIsRinging(): boolean {
    return this.isCurrentlyRinging;
  }

  public getIsStandbyActive(): boolean {
    return this.isStandbyActive;
  }

  // 4. CICALINO DI RETROMARCIA PER COMUNICAZIONI RADIO (SUONA FINCHÉ NON VIENE SILENZIATO)
  public startCicalinoRetromarcia(sorgente: string = 'Comunicazione Radio') {
    this.stopCicalinoRetromarcia();
    this.isBeeperActive = true;

    // 1. Riproduzione audio elemento loop continuo su file reale /cicalino_radio.wav (supporta background e blocco schermo)
    this.initRadioAudioElement();
    if (this.radioAudioElement) {
      try {
        this.radioAudioElement.currentTime = 0;
        this.radioAudioElement.volume = 1.0;
        this.radioAudioElement.play().catch(() => {});
      } catch (err) {
        console.warn('[SoundEngine] Errore play radioAudioElement:', err);
      }
    }

    // 2. Sintetizzatore AudioContext simultaneo per risonanza immediata
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[SoundEngine] Errore inizializzazione AudioContext per cicalino:', e);
    }

    const playBeep = () => {
      if (!this.isBeeperActive) return;
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Tono acuto a impulsi tipico cicalino retromarcia veicoli di soccorso (1150 Hz)
        osc.type = 'square';
        osc.frequency.setValueAtTime(1150, now);

        // Inviluppo percussivo pulito
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.85, now + 0.015);
        gain.gain.setValueAtTime(0.85, now + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.26);

        // Vibrazione sincronizzata ad impulso di retromarcia
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(220);
          } catch {}
        }
      } catch (err) {
        console.warn('[SoundEngine] Errore esecuzione beep cicalino:', err);
      }
    };

    playBeep();
    // Ciclo continuo cicalino: 250ms suono + 250ms silenzio = 500ms
    this.beeperInterval = setInterval(playBeep, 500);

    // Aggiorna MediaSession se supportata
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '📻 COMUNICAZIONE RADIO IN ARRIVO',
          artist: `${sorgente} (Cicalino Attivo)`,
          album: 'Croce Oro Massa Carrara',
          artwork: [
            { src: '/icon-512-v2.png', sizes: '512x512', type: 'image/png' },
            { src: '/logo_croce_oro_v2.png', sizes: '1024x1024', type: 'image/png' }
          ]
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    }
  }

  public stopCicalinoRetromarcia() {
    this.isBeeperActive = false;
    if (this.radioAudioElement) {
      try {
        this.radioAudioElement.pause();
        this.radioAudioElement.currentTime = 0;
      } catch {}
    }
    if (this.beeperInterval) {
      clearInterval(this.beeperInterval);
      this.beeperInterval = null;
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
    if (!this.isCurrentlyRinging) {
      this.clearMediaSession();
    }
  }

  public getIsBeeperActive(): boolean {
    return this.isBeeperActive;
  }

  // 5. NOTIFICA RADIO DEI CARABINIERI (SELETTIVA CCIR + SQUELCH BURST TIPICO RADIO, ATTIVA ANCHE IN SILENZIOSO)
  public playCarabinieriRadioSound(sorgente: string = 'Centrale Operativa') {
    try {
      // Vibrazione tipica trasmissione radio
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 60, 140]);
        } catch {}
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Master gain ad alto volume (suona anche con device silenzioso via WebAudio)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.95, now);
      masterGain.connect(ctx.destination);

      // Sequenza Selettiva Polizia / Carabinieri (Toni CCIR tipici di apertura canale radio + Roger Beep)
      // Tono 1: 1124 Hz per 65ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1124, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.8, now + 0.01);
      gain1.gain.setValueAtTime(0.8, now + 0.06);
      gain1.gain.linearRampToValueAtTime(0.001, now + 0.065);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.07);

      // Tono 2: 1981 Hz per 65ms
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1981, now + 0.065);
      gain2.gain.setValueAtTime(0.001, now + 0.065);
      gain2.gain.linearRampToValueAtTime(0.85, now + 0.075);
      gain2.gain.setValueAtTime(0.85, now + 0.125);
      gain2.gain.linearRampToValueAtTime(0.001, now + 0.13);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.065);
      osc2.stop(now + 0.135);

      // Tono 3: 1124 Hz per 65ms
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1124, now + 0.13);
      gain3.gain.setValueAtTime(0.001, now + 0.13);
      gain3.gain.linearRampToValueAtTime(0.8, now + 0.14);
      gain3.gain.setValueAtTime(0.8, now + 0.19);
      gain3.gain.linearRampToValueAtTime(0.001, now + 0.195);
      osc3.connect(gain3);
      gain3.connect(masterGain);
      osc3.start(now + 0.13);
      osc3.stop(now + 0.20);

      // Roger Beep acuto di conferma canale radio (1760 Hz per 80ms)
      const oscRoger = ctx.createOscillator();
      const gainRoger = ctx.createGain();
      oscRoger.type = 'sine';
      oscRoger.frequency.setValueAtTime(1760, now + 0.20);
      gainRoger.gain.setValueAtTime(0.001, now + 0.20);
      gainRoger.gain.linearRampToValueAtTime(0.9, now + 0.21);
      gainRoger.gain.setValueAtTime(0.9, now + 0.27);
      gainRoger.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
      oscRoger.connect(gainRoger);
      gainRoger.connect(masterGain);
      oscRoger.start(now + 0.20);
      oscRoger.stop(now + 0.30);

      // Coda di rumore squelch ("kshh-chk" tipica delle radio di pattuglia)
      const bufferSize = ctx.sampleRate * 0.08; // 80ms di rumore
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      // Filtro passa-banda radiofonico (1200 Hz - 3500 Hz)
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now + 0.29);
      filter.Q.setValueAtTime(1.8, now + 0.29);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now + 0.29);
      noiseGain.gain.linearRampToValueAtTime(0.45, now + 0.30);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.37);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      whiteNoise.start(now + 0.29);
      whiteNoise.stop(now + 0.38);
    } catch (err) {
      console.warn('[SoundEngine] Errore riproduzione suono radio Carabinieri:', err);
    }
  }

  // 6. NOTIFICA GENERICA PER TUTTO IL RESTO (BACHECA, COMMENTI, TURNI, FORMAZIONE, TIMBRATURE)
  // Suoneria distinta, elegante a tre toni melodici (Eb5 -> G5 -> Bb5), segue le impostazioni di volume del device
  public playStandardNotificationChime() {
    try {
      // Vibrazione standard dispositivo
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([120, 60, 120]);
        } catch {}
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        const now = this.audioCtx.currentTime;

        // Arpeggio a 3 note armoniche (Eb5 622Hz -> G5 784Hz -> Bb5 932Hz)
        // Nota 1: Eb5 (622.25 Hz)
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(622.25, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        // Nota 2: G5 (783.99 Hz)
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(783.99, now + 0.08);
        gain2.gain.setValueAtTime(0.001, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.38, now + 0.095);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.20);

        // Nota 3: Bb5 (932.33 Hz) con decadimento morbido a campana
        const osc3 = this.audioCtx.createOscillator();
        const gain3 = this.audioCtx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(932.33, now + 0.16);
        gain3.gain.setValueAtTime(0.001, now + 0.16);
        gain3.gain.exponentialRampToValueAtTime(0.42, now + 0.18);
        gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc3.connect(gain3);
        gain3.connect(this.audioCtx.destination);
        osc3.start(now + 0.16);
        osc3.stop(now + 0.46);
      }
    } catch (err) {
      console.warn('[SoundEngine] Errore riproduzione chime notifica generica:', err);
    }
  }

  // 7. PROMEMORIA TIMBRATURA IN RITARDO (+10 MIN DOPO INIZIO O FINE TURNO/CORSO)
  // Suono distinto a doppio richiamo bitonale (D5 -> A5 ripetuto), chiaramente diverso dalla notifica standard e NON sirena
  public playTimbraturaLateReminderSound() {
    try {
      // Pattern di vibrazione specifico diverso dal singolo impulso standard e diverso dalla sirena continua
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([350, 120, 350, 120, 500]);
        } catch {}
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        const now = this.audioCtx.currentTime;
        const pulses = [
          { start: 0, freq: 587.33, dur: 0.16 },      // D5
          { start: 0.16, freq: 880.0, dur: 0.22 },    // A5
          { start: 0.48, freq: 587.33, dur: 0.16 },   // D5 (secondo richiamo)
          { start: 0.64, freq: 1046.5, dur: 0.32 }    // C6 finale
        ];

        for (const p of pulses) {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(p.freq, now + p.start);
          gain.gain.setValueAtTime(0.001, now + p.start);
          gain.gain.linearRampToValueAtTime(0.55, now + p.start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + p.start + p.dur);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + p.start);
          osc.stop(now + p.start + p.dur + 0.02);
        }
      }
    } catch (err) {
      console.warn('[SoundEngine] Errore riproduzione promemoria timbratura:', err);
    }
  }
}

export const soundEngine = new SoundEngine();
