// vhfRadioEngine.ts - Motore Audio HD Radio VHF/UHF Push-To-Talk & Messaggi Vocali
// Codec supportati:
// 1. Opus 48 kHz HD Voice @ 48 kbps (WebCodecs AudioEncoder / AudioDecoder - priorità automatica quando tutti i client lo supportano)
// 2. IMA-ADPCM 24 kHz Super-Wideband HD (4:1, sync per pacchetto, filtro anti-aliasing sinc, compatibile al 100% con iOS/Android/Desktop)
// 3. Fallback decodifica PCM16 retrocompatibile
// Pipeline AudioWorklet off-main-thread sia in cattura TX che in riproduzione RX con Adaptive Jitter Buffer circolare (zero click/scatti).

export type RadioAudioCodec = 'opus' | 'adpcm24' | 'pcm16';

export interface EncodedAudioPacket {
  codec: RadioAudioCodec;
  payloadBase64: string;
  sampleRate: number;
}

// Tabelle standard IMA-ADPCM DVI4
const IMA_INDEX_TABLE = new Int8Array([
  -1, -1, -1, -1, 2, 4, 6, 8,
  -1, -1, -1, -1, 2, 4, 6, 8,
]);

const IMA_STEP_TABLE = new Int16Array([
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17,
  19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
  50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307,
  337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
  876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
  2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358,
  5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
  15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
]);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function int16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  return bytesToBase64(bytes);
}

function base64ToInt16(base64: string): Int16Array {
  const bytes = base64ToBytes(base64);
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

// Ricampionatore ad alta fedeltà con filtro passa-basso Blackman-Sinc anti-aliasing in discesa
function resampleFloat32(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate || input.length === 0) {
    return input;
  }

  let working = input;

  // Se stiamo riducendo la frequenza (es. 48kHz -> 24kHz), applica filtro passa-basso FIR prima di decimare
  if (targetRate < sourceRate) {
    const fc = (0.43 * targetRate) / sourceRate; //Cutoff sicuro sotto Nyquist target
    const halfTaps = 7; // 15 tap FIR
    const kernel = new Float32Array(halfTaps * 2 + 1);
    let sum = 0;
    for (let k = -halfTaps; k <= halfTaps; k++) {
      const idx = k + halfTaps;
      const sinc = k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k);
      const n = idx / (halfTaps * 2);
      const window = 0.42 - 0.5 * Math.cos(2 * Math.PI * n) + 0.08 * Math.cos(4 * Math.PI * n);
      kernel[idx] = sinc * window;
      sum += kernel[idx];
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

    const filtered = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let acc = 0;
      for (let k = -halfTaps; k <= halfTaps; k++) {
        const sIdx = Math.min(input.length - 1, Math.max(0, i + k));
        acc += input[sIdx] * kernel[k + halfTaps];
      }
      filtered[i] = acc;
    }
    working = filtered;
  }

  const ratio = sourceRate / targetRate;
  const outLen = Math.max(1, Math.floor(working.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx0 = Math.floor(pos);
    const idx1 = Math.min(working.length - 1, idx0 + 1);
    const frac = pos - idx0;
    out[i] = working[idx0] * (1 - frac) + working[idx1] * frac;
  }
  return out;
}

function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    out[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return out;
}

// Codifica blocco IMA-ADPCM auto-sincronizzato (4 byte header + N/2 byte nibble)
function encodeImaAdpcmBlock(pcm: Int16Array): Uint8Array {
  if (pcm.length === 0) return new Uint8Array(0);
  let predictor = pcm[0];
  let stepIndex = 0;

  const dataByteLen = Math.ceil((pcm.length - 1) / 2);
  const out = new Uint8Array(4 + dataByteLen);
  // Header 4 byte: predictor Int16 LE, stepIndex Uint8, oddFlag Uint8
  out[0] = predictor & 0xff;
  out[1] = (predictor >> 8) & 0xff;
  out[2] = stepIndex & 0xff;
  out[3] = pcm.length % 2 === 0 ? 1 : 0; // flag parità campione finale

  let outPos = 4;
  let highNibble = false;
  let currentByte = 0;

  for (let i = 1; i < pcm.length; i++) {
    const sample = pcm[i];
    const step = IMA_STEP_TABLE[stepIndex];
    let diff = sample - predictor;
    let code = 0;
    if (diff < 0) {
      code = 8;
      diff = -diff;
    }
    let delta = step >> 3;
    if (diff >= step) {
      code |= 4;
      diff -= step;
      delta += step;
    }
    const step2 = step >> 1;
    if (diff >= step2) {
      code |= 2;
      diff -= step2;
      delta += step2;
    }
    const step4 = step >> 2;
    if (diff >= step4) {
      code |= 1;
      delta += step4;
    }

    if (code & 8) {
      predictor -= delta;
    } else {
      predictor += delta;
    }
    if (predictor > 32767) predictor = 32767;
    else if (predictor < -32768) predictor = -32768;

    stepIndex += IMA_INDEX_TABLE[code];
    if (stepIndex < 0) stepIndex = 0;
    else if (stepIndex > 88) stepIndex = 88;

    if (!highNibble) {
      currentByte = code & 0x0f;
      highNibble = true;
    } else {
      currentByte |= (code & 0x0f) << 4;
      out[outPos++] = currentByte;
      highNibble = false;
      currentByte = 0;
    }
  }
  if (highNibble) {
    out[outPos++] = currentByte;
  }
  return out;
}

function decodeImaAdpcmBlock(bytes: Uint8Array): Float32Array {
  if (bytes.length < 4) return new Float32Array(0);
  let predictor = (bytes[0] | (bytes[1] << 8));
  if (predictor >= 0x8000) predictor -= 0x10000;
  let stepIndex = Math.min(88, Math.max(0, bytes[2]));
  const hasOddBytePad = bytes[3] === 1;

  const payloadBytes = bytes.length - 4;
  const totalNibbles = payloadBytes * 2 - (hasOddBytePad ? 0 : 1);
  const sampleCount = 1 + Math.max(0, totalNibbles);
  const out = new Float32Array(sampleCount);
  out[0] = predictor / 32768;

  let outIdx = 1;
  for (let b = 4; b < bytes.length && outIdx < sampleCount; b++) {
    const packed = bytes[b];
    for (let shift = 0; shift <= 4 && outIdx < sampleCount; shift += 4) {
      const code = (packed >> shift) & 0x0f;
      const step = IMA_STEP_TABLE[stepIndex];
      let delta = step >> 3;
      if (code & 4) delta += step;
      if (code & 2) delta += step >> 1;
      if (code & 1) delta += step >> 2;
      if (code & 8) predictor -= delta;
      else predictor += delta;
      if (predictor > 32767) predictor = 32767;
      else if (predictor < -32768) predictor = -32768;

      stepIndex += IMA_INDEX_TABLE[code];
      if (stepIndex < 0) stepIndex = 0;
      else if (stepIndex > 88) stepIndex = 88;

      out[outIdx++] = predictor / 32768;
    }
  }
  return out;
}

// Sorgenti AudioWorklet inline (eseguite sul real-time audio thread dedicato)
const CAPTURE_WORKLET_CODE = `
class VhfCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.blockSize = (options.processorOptions && options.processorOptions.blockSize) || 1920;
    this.buffer = new Float32Array(this.blockSize);
    this.writeIndex = 0;
    this.sumSq = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i];
      this.buffer[this.writeIndex++] = s;
      this.sumSq += s * s;
      if (this.writeIndex >= this.blockSize) {
        const rms = Math.sqrt(this.sumSq / this.blockSize);
        const level = Math.min(100, Math.round(rms * 320));
        const copy = new Float32Array(this.buffer);
        this.port.postMessage({ samples: copy, level }, [copy.buffer]);
        this.writeIndex = 0;
        this.sumSq = 0;
      }
    }
    return true;
  }
}
registerProcessor('vhf-capture-processor', VhfCaptureProcessor);
`;

const RX_RING_WORKLET_CODE = `
class VhfRxRingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sr = (options.processorOptions && options.processorOptions.sampleRate) || 48000;
    this.capacity = Math.max(16384, Math.floor(sr * 2));
    this.ring = new Float32Array(this.capacity);
    this.readIdx = 0;
    this.writeIdx = 0;
    this.count = 0;
    this.prebufferThreshold = Math.floor(sr * 0.085); // 85ms jitter buffer anti-scatti
    this.maxBuffered = Math.floor(sr * 0.36);        // 360ms cap anti-latenza
    this.playing = false;
    this.lastOut = 0;

    this.port.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === 'clear') {
        this.readIdx = 0;
        this.writeIdx = 0;
        this.count = 0;
        this.playing = false;
        this.lastOut = 0;
        return;
      }
      if (msg.type === 'push' && msg.samples) {
        const samples = msg.samples;
        // Se si accumula troppo ritardo di rete, avanza dolcemente il readIdx
        if (this.count + samples.length > this.maxBuffered) {
          const drop = Math.min(this.count, this.count + samples.length - Math.floor(this.maxBuffered * 0.55));
          this.readIdx = (this.readIdx + drop) % this.capacity;
          this.count -= drop;
        }
        for (let i = 0; i < samples.length; i++) {
          if (this.count >= this.capacity) {
            this.readIdx = (this.readIdx + 1) % this.capacity;
            this.count--;
          }
          this.ring[this.writeIdx] = samples[i];
          this.writeIdx = (this.writeIdx + 1) % this.capacity;
          this.count++;
        }
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const ch = out[0];

    if (!this.playing) {
      if (this.count >= this.prebufferThreshold) {
        this.playing = true;
      } else {
        ch.fill(0);
        return true;
      }
    }

    for (let i = 0; i < ch.length; i++) {
      if (this.count > 0) {
        const s = this.ring[this.readIdx];
        this.readIdx = (this.readIdx + 1) % this.capacity;
        this.count--;
        ch[i] = s;
        this.lastOut = s;
      } else {
        // Soft decay verso 0 su underrun per zero click/pop
        this.lastOut *= 0.85;
        ch[i] = Math.abs(this.lastOut) < 0.0001 ? 0 : this.lastOut;
        if (i === ch.length - 1 && Math.abs(this.lastOut) < 0.0005) {
          this.playing = false;
        }
      }
    }
    return true;
  }
}
registerProcessor('vhf-rx-ring-processor', VhfRxRingProcessor);
`;

class VhfRadioEngine {
  private audioCtx: AudioContext | null = null;
  private rxChainInput: GainNode | null = null;
  private rxWorkletNode: AudioWorkletNode | null = null;
  private workletsLoadedCtx: WeakSet<AudioContext> = new WeakSet();
  private workletLoadingPromise: Promise<boolean> | null = null;

  // Fallback RX scheduler
  private activeRxSources: Set<AudioBufferSourceNode> = new Set();
  private nextPlaybackTime: number = 0;

  // Stato TX microfono PTT
  private captureStream: MediaStream | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  private captureWorkletNode: AudioWorkletNode | null = null;
  private captureProcessor: ScriptProcessorNode | null = null;
  private captureMuteGain: GainNode | null = null;
  private isCapturing: boolean = false;
  private captureRequested: boolean = false;
  private pendingAdpcmSamples: number[] = [];

  // WebCodecs Opus TX / RX
  private opusSupportedCache: boolean | null = null;
  private opusEncoder: any = null;
  private opusTxTimestampUs: number = 0;
  private opusDecoder: any = null;
  private opusRxSpeakerId: string | null = null;
  private opusRxTimestampUs: number = 0;
  private activeTxCodec: RadioAudioCodec = 'adpcm24';
  private lastRxCodec: RadioAudioCodec | null = null;

  // Subscriber diretti senza forzare re-render dell'albero App
  private txLevelListeners: Set<(level: number) => void> = new Set();
  private codecListeners: Set<(info: { txCodec: RadioAudioCodec; rxCodec: RadioAudioCodec | null }) => void> = new Set();

  // Stato registratore messaggi audio (chat radio)
  private mediaRecorder: MediaRecorder | null = null;
  private recorderStream: MediaStream | null = null;
  private recorderChunks: Blob[] = [];
  private recorderStartedAt: number = 0;

  private readonly ADPCM_SAMPLE_RATE = 24000;
  private readonly ADPCM_FRAME_SAMPLES = 960; // 40ms @ 24kHz -> 484 byte ADPCM (~12.1 KB/s)
  private readonly OPUS_SAMPLE_RATE = 48000;

  // Messaggio vocale preregistrato "ATTENZIONE CHIAMATA EMERGENZA IN ARRIVO"
  private emergencyAudioBuffer: AudioBuffer | null = null;
  private emergencyLoadPromise: Promise<AudioBuffer | null> | null = null;
  private activeEmergencyCancel: (() => void) | null = null;

  public subscribeTxLevel(cb: (level: number) => void): () => void {
    this.txLevelListeners.add(cb);
    return () => this.txLevelListeners.delete(cb);
  }

  public subscribeCodecInfo(
    cb: (info: { txCodec: RadioAudioCodec; rxCodec: RadioAudioCodec | null }) => void
  ): () => void {
    this.codecListeners.add(cb);
    cb({ txCodec: this.activeTxCodec, rxCodec: this.lastRxCodec });
    return () => this.codecListeners.delete(cb);
  }

  private notifyTxLevel(lvl: number) {
    this.txLevelListeners.forEach((cb) => {
      try {
        cb(lvl);
      } catch {}
    });
  }

  private notifyCodecInfo() {
    const info = { txCodec: this.activeTxCodec, rxCodec: this.lastRxCodec };
    this.codecListeners.forEach((cb) => {
      try {
        cb(info);
      } catch {}
    });
  }

  public getActiveTxCodec(): RadioAudioCodec {
    return this.activeTxCodec;
  }

  public getLastRxCodec(): RadioAudioCodec | null {
    return this.lastRxCodec;
  }

  // Verifica reale se il browser supporta WebCodecs Opus (Encoder + Decoder)
  public async supportsOpusCodec(): Promise<boolean> {
    if (this.opusSupportedCache !== null) return this.opusSupportedCache;
    if (typeof window === 'undefined') return false;

    const Enc = (window as any).AudioEncoder;
    const Dec = (window as any).AudioDecoder;
    if (typeof Enc !== 'function' || typeof Dec !== 'function') {
      this.opusSupportedCache = false;
      return false;
    }

    try {
      const encSupport = await Enc.isConfigSupported({
        codec: 'opus',
        sampleRate: this.OPUS_SAMPLE_RATE,
        numberOfChannels: 1,
        bitrate: 48000,
      });
      const decSupport = await Dec.isConfigSupported({
        codec: 'opus',
        sampleRate: this.OPUS_SAMPLE_RATE,
        numberOfChannels: 1,
      });
      this.opusSupportedCache = Boolean(encSupport?.supported && decSupport?.supported);
    } catch {
      this.opusSupportedCache = false;
    }
    return this.opusSupportedCache;
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      try {
        this.audioCtx = new AudioCtxClass({
          latencyHint: 'interactive',
          sampleRate: 48000,
        });
      } catch {
        this.audioCtx = new AudioCtxClass();
      }
      this.rxChainInput = null;
      this.rxWorkletNode = null;
      this.workletLoadingPromise = null;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private async ensureWorkletsLoaded(ctx: AudioContext): Promise<boolean> {
    if (this.workletsLoadedCtx.has(ctx)) return true;
    if (!ctx.audioWorklet || typeof Blob === 'undefined' || typeof URL === 'undefined') {
      return false;
    }
    if (this.workletLoadingPromise) {
      return this.workletLoadingPromise;
    }

    this.workletLoadingPromise = (async () => {
      try {
        const capBlob = new Blob([CAPTURE_WORKLET_CODE], { type: 'application/javascript' });
        const rxBlob = new Blob([RX_RING_WORKLET_CODE], { type: 'application/javascript' });
        const capUrl = URL.createObjectURL(capBlob);
        const rxUrl = URL.createObjectURL(rxBlob);
        try {
          await ctx.audioWorklet.addModule(capUrl);
          await ctx.audioWorklet.addModule(rxUrl);
          this.workletsLoadedCtx.add(ctx);
          return true;
        } finally {
          URL.revokeObjectURL(capUrl);
          URL.revokeObjectURL(rxUrl);
        }
      } catch (err) {
        console.warn('[VhfRadio] AudioWorklet non disponibile, uso fallback standard:', err);
        return false;
      } finally {
        this.workletLoadingPromise = null;
      }
    })();

    return this.workletLoadingPromise;
  }

  public async unlockAudio(): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
    this.preloadEmergencyAnnouncement().catch(() => {});
    await this.ensureWorkletsLoaded(ctx);
  }

  public async preloadEmergencyAnnouncement(): Promise<AudioBuffer | null> {
    if (this.emergencyAudioBuffer) return this.emergencyAudioBuffer;
    if (this.emergencyLoadPromise) return this.emergencyLoadPromise;
    if (typeof window === 'undefined' || typeof fetch !== 'function') return null;

    this.emergencyLoadPromise = (async () => {
      try {
        const ctx = this.ensureAudioContext();
        if (!ctx) return null;
        const res = await fetch('/annuncio_emergenza.wav', { cache: 'force-cache' });
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        this.emergencyAudioBuffer = decoded;
        return decoded;
      } catch {
        return null;
      } finally {
        this.emergencyLoadPromise = null;
      }
    })();

    return this.emergencyLoadPromise;
  }

  // Catena filtro HD Voice naturale e nitida (niente più taglio nasale 280-3600 Hz o saturazione gain 1.65)
  private getOrCreateRxChain(ctx: AudioContext): GainNode {
    if (this.rxChainInput) return this.rxChainInput;

    const inputNode = ctx.createGain();
    inputNode.gain.value = 1.0;

    // 1. Rimozione leggera sub-bassi/vento (<85 Hz) mantenendo tutto il calore naturale della voce
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 85;
    highPass.Q.value = 0.7;

    // 2. Chiarezza ed intelligibilità consonanti (presenza morbida a 2.6 kHz)
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2600;
    presence.Q.value = 0.85;
    presence.gain.value = 2.5;

    // 3. Filtro wideband a 11.5 kHz (zero fruscio ad alta frequenza ma massima fedeltà vocale HD)
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 11500;
    lowPass.Q.value = 0.7;

    // 4. Livellatore morbido broadcast (ratio 2.5:1 senza schiacciamento o distorsione)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 12;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.16;

    const masterOut = ctx.createGain();
    masterOut.gain.value = 1.15;

    inputNode.connect(highPass);
    highPass.connect(presence);
    presence.connect(lowPass);
    lowPass.connect(compressor);
    compressor.connect(masterOut);
    masterOut.connect(ctx.destination);

    this.rxChainInput = inputNode;
    return inputNode;
  }

  private getOrCreateRxWorklet(ctx: AudioContext): AudioWorkletNode | null {
    if (!this.workletsLoadedCtx.has(ctx)) return null;
    if (this.rxWorkletNode) return this.rxWorkletNode;

    try {
      const node = new AudioWorkletNode(ctx, 'vhf-rx-ring-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { sampleRate: ctx.sampleRate },
      });
      const chain = this.getOrCreateRxChain(ctx);
      node.connect(chain);
      this.rxWorkletNode = node;
      return node;
    } catch {
      return null;
    }
  }

  // Chiamata Selettiva Radio Forze dell'Ordine Italiane (CCIR / ZVEI 5-toni + portante VHF)
  public playItalianPoliceSelcall(mode: 'standard' | 'group' | 'emergency' = 'standard') {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1750;
      filter.Q.value = 0.75;

      const master = ctx.createGain();
      master.gain.value = mode === 'emergency' ? 0.42 : 0.3;
      filter.connect(master);
      master.connect(ctx.destination);

      const toneSets: number[][] =
        mode === 'emergency'
          ? [
              [2260, 1981, 2400, 1981, 2260],
              [1124, 1981, 2260, 1981, 2400],
            ]
          : mode === 'group'
          ? [[1446, 1981, 2260, 1830]]
          : [[1981, 1600, 1446, 2260, 1981]];

      const stepDur = mode === 'emergency' ? 0.048 : 0.056;
      let cursor = now;

      toneSets.forEach((seq, seqIdx) => {
        if (seqIdx > 0) cursor += 0.065;
        seq.forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, cursor);
          g.gain.setValueAtTime(0.001, cursor);
          g.gain.linearRampToValueAtTime(0.95, cursor + 0.005);
          g.gain.setValueAtTime(0.95, cursor + stepDur - 0.006);
          g.gain.exponentialRampToValueAtTime(0.001, cursor + stepDur);
          osc.connect(g);
          g.connect(filter);
          osc.start(cursor);
          osc.stop(cursor + stepDur + 0.004);
          cursor += stepDur;
        });
      });

      // Coda portante FM / squelch ("kshhh") tipica delle radio CC/PS italiane
      const sqLen = Math.floor(ctx.sampleRate * (mode === 'emergency' ? 0.085 : 0.055));
      const noiseBuf = ctx.createBuffer(1, sqLen, ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < sqLen; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.value = 2150;
      nFilter.Q.value = 1.7;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, cursor);
      nGain.gain.linearRampToValueAtTime(mode === 'emergency' ? 0.24 : 0.16, cursor + 0.008);
      nGain.gain.exponentialRampToValueAtTime(0.001, cursor + (mode === 'emergency' ? 0.085 : 0.055));
      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(cursor);
      noise.stop(cursor + 0.095);

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(mode === 'emergency' ? [180, 60, 180, 60, 260] : [70, 40, 90]);
        } catch {}
      }
    } catch {}
  }

  // Apertura comunicazione radio VHF/TETRA Forze dell'Ordine Italiane (microswitch + squelch + grant chirp / selettiva)
  public playVhfKeyUp(mode: boolean | 'normal' | 'priority' | 'emergency' = false) {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const normalizedMode: 'normal' | 'priority' | 'emergency' =
        mode === true ? 'priority' : mode === false ? 'normal' : mode;

      if (normalizedMode === 'emergency') {
        this.playItalianPoliceSelcall('emergency');
        return;
      }

      // 1. Click meccanico microinterruttore PTT
      const clickLen = Math.floor(ctx.sampleRate * 0.008);
      const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
      const cData = clickBuf.getChannelData(0);
      for (let i = 0; i < clickLen; i++) {
        cData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickLen * 0.28));
      }
      const clickSrc = ctx.createBufferSource();
      clickSrc.buffer = clickBuf;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'bandpass';
      clickFilter.frequency.value = 2800;
      clickFilter.Q.value = 2.5;
      const clickGain = ctx.createGain();
      clickGain.gain.value = 0.28;
      clickSrc.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickSrc.start(now);

      // 2. Toni apertura portante Forze dell'Ordine (Priorità Centrale CCIR o Grant Chirp TETRA PS/CC)
      const freqs =
        normalizedMode === 'priority'
          ? [1124, 1981, 2260] // Chiamata selettiva prioritaria Centrale
          : [1680, 2140];      // Doppio micro-chirp TETRA inizio parola
      const dur = normalizedMode === 'priority' ? 0.058 : 0.032;

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t0 = now + 0.008 + idx * dur;
        osc.frequency.setValueAtTime(f, t0);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(normalizedMode === 'priority' ? 0.28 : 0.2, t0 + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur - 0.002);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.004);
      });

      // 3. Breve soffio portante VHF di aggancio ponte radio
      const sqStart = now + 0.006;
      const bufSize = Math.floor(ctx.sampleRate * 0.038);
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1950;
      filter.Q.value = 1.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, sqStart);
      gain.gain.exponentialRampToValueAtTime(0.001, sqStart + 0.038);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(sqStart);
      noise.stop(sqStart + 0.044);
    } catch {}
  }

  // Fine comunicazione Forze dell'Ordine Italiane (Doppio Roger Beep + Coda Squelch VHF FM)
  public playVhfRogerBeep(mode: boolean | 'normal' | 'interrupted' | 'emergency' = false) {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const normalizedMode: 'normal' | 'interrupted' | 'emergency' =
        mode === true ? 'interrupted' : mode === false ? 'normal' : mode;

      let cursor = now;
      if (normalizedMode === 'interrupted') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(988, now);
        osc.frequency.setValueAtTime(587, now + 0.065);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        cursor = now + 0.125;
      } else {
        // Doppio tono caratteristico fine trasmissione radio PS / CC (alto -> medio nitido)
        const steps =
          normalizedMode === 'emergency'
            ? [
                { f: 2260, d: 0.042 },
                { f: 1680, d: 0.055 },
              ]
            : [
                { f: 2050, d: 0.036 },
                { f: 1520, d: 0.044 },
              ];
        steps.forEach((st) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(st.f, cursor);
          g.gain.setValueAtTime(0.001, cursor);
          g.gain.linearRampToValueAtTime(normalizedMode === 'emergency' ? 0.28 : 0.22, cursor + 0.006);
          g.gain.exponentialRampToValueAtTime(0.001, cursor + st.d);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(cursor);
          osc.stop(cursor + st.d + 0.005);
          cursor += st.d;
        });
      }

      // Coda di rilascio squelch VHF ("kshhh-chk") + micro-click sgancio
      const bufSize = Math.floor(ctx.sampleRate * 0.068);
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2150;
      filter.Q.value = 1.6;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, cursor);
      nGain.gain.linearRampToValueAtTime(0.18, cursor + 0.006);
      nGain.gain.exponentialRampToValueAtTime(0.001, cursor + 0.068);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(cursor);
      noise.stop(cursor + 0.075);
    } catch {}
  }

  // Segnale acustico di "VIA LIBERA / ORA PUOI PARLARE" per l'operatore al termine dell'annuncio registrato
  public playEmergencyGoAheadBeep() {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const tones = [
        { f: 1320, start: 0, dur: 0.055 },
        { f: 1760, start: 0.06, dur: 0.055 },
        { f: 2280, start: 0.12, dur: 0.09 },
      ];
      tones.forEach((t) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.f, now + t.start);
        g.gain.setValueAtTime(0.001, now + t.start);
        g.gain.linearRampToValueAtTime(0.32, now + t.start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + t.start);
        osc.stop(now + t.start + t.dur + 0.008);
      });
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([80, 40, 120]);
        } catch {}
      }
    } catch {}
  }

  public stopEmergencyAnnouncement() {
    if (this.activeEmergencyCancel) {
      try {
        this.activeEmergencyCancel();
      } catch {}
      this.activeEmergencyCancel = null;
    }
  }

  // Sequenza automatica emergenza:
  // 1) Selettiva Forze dell'Ordine (~0.62s)
  // 2) Voce preregistrata "ATTENZIONE CHIAMATA EMERGENZA IN ARRIVO" (~3.17s)
  // 3) Al termine esatto: beep di via libera (se mittente) e callback onEnded()
  public playEmergencyAnnouncement(options?: {
    isSender?: boolean;
    onProgress?: (remainingSec: number) => void;
    onEnded?: () => void;
  }): () => void {
    this.stopEmergencyAnnouncement();

    let cancelled = false;
    let progressTimer: any = null;
    let delayVoiceTimer: any = null;
    let safetyTimeoutTimer: any = null;
    let activeSrc: AudioBufferSourceNode | null = null;
    let activeHtmlAudio: HTMLAudioElement | null = null;

    const cleanup = () => {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (delayVoiceTimer) {
        clearTimeout(delayVoiceTimer);
        delayVoiceTimer = null;
      }
      if (safetyTimeoutTimer) {
        clearTimeout(safetyTimeoutTimer);
        safetyTimeoutTimer = null;
      }
      if (activeSrc) {
        try {
          activeSrc.onended = null;
          activeSrc.stop();
          activeSrc.disconnect();
        } catch {}
        activeSrc = null;
      }
      if (activeHtmlAudio) {
        try {
          activeHtmlAudio.onended = null;
          activeHtmlAudio.pause();
          activeHtmlAudio.src = '';
        } catch {}
        activeHtmlAudio = null;
      }
    };

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      cleanup();
      if (this.activeEmergencyCancel === cancel) {
        this.activeEmergencyCancel = null;
      }
      options?.onProgress?.(0);
      if (options?.isSender) {
        this.playEmergencyGoAheadBeep();
      }
      options?.onEnded?.();
    };

    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      cleanup();
      if (this.activeEmergencyCancel === cancel) {
        this.activeEmergencyCancel = null;
      }
    };

    this.activeEmergencyCancel = cancel;

    // 1. Selettiva emergenza immediata
    this.playItalianPoliceSelcall('emergency');

    const SELCALL_OFFSET_MS = 640;
    const ESTIMATED_TOTAL_MS = SELCALL_OFFSET_MS + 3220;
    const startedAt = Date.now();
    let expectedEndAt = startedAt + ESTIMATED_TOTAL_MS;

    options?.onProgress?.(Math.ceil(ESTIMATED_TOTAL_MS / 100) / 10);
    progressTimer = setInterval(() => {
      if (cancelled) return;
      const remMs = Math.max(0, expectedEndAt - Date.now());
      options?.onProgress?.(Math.ceil(remMs / 100) / 10);
    }, 100);

    // Timeout di sicurezza assoluto se l'audio fosse bloccato dall'OS
    safetyTimeoutTimer = setTimeout(() => {
      finish();
    }, ESTIMATED_TOTAL_MS + 1200);

    // 2. Avvia subito voce preregistrata dopo la selettiva
    delayVoiceTimer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const ctx = this.ensureAudioContext();
        const buf = await this.preloadEmergencyAnnouncement();
        if (cancelled) return;

        if (ctx && buf) {
          if (ctx.state === 'suspended') {
            try {
              await ctx.resume();
            } catch {}
          }
          expectedEndAt = Date.now() + Math.round(buf.duration * 1000) + 60;
          if (safetyTimeoutTimer) clearTimeout(safetyTimeoutTimer);
          safetyTimeoutTimer = setTimeout(() => finish(), Math.round(buf.duration * 1000) + 800);

          const src = ctx.createBufferSource();
          src.buffer = buf;
          const voiceGain = ctx.createGain();
          voiceGain.gain.value = 1.2;
          src.connect(voiceGain);
          voiceGain.connect(this.getOrCreateRxChain(ctx));
          activeSrc = src;
          src.onended = () => {
            finish();
          };
          src.start(ctx.currentTime);
          return;
        }
      } catch {}

      if (cancelled) return;

      // Fallback HTMLAudioElement su /annuncio_emergenza.wav
      try {
        const audio = new Audio('/annuncio_emergenza.wav');
        activeHtmlAudio = audio;
        audio.volume = 1.0;
        audio.onloadedmetadata = () => {
          if (!cancelled && audio.duration && isFinite(audio.duration)) {
            expectedEndAt = Date.now() + Math.round(audio.duration * 1000) + 60;
          }
        };
        audio.onended = () => finish();
        audio.onerror = () => finish();
        await audio.play();
        return;
      } catch {
        // Ultimo fallback Web Speech / timer
        try {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance('Attenzione! Chiamata emergenza in arrivo.');
            utter.lang = 'it-IT';
            utter.rate = 1.02;
            utter.onend = () => finish();
            utter.onerror = () => finish();
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utter);
            return;
          }
        } catch {}
      }
    }, SELCALL_OFFSET_MS);

    return cancel;
  }

  private closeOpusEncoder() {
    if (this.opusEncoder) {
      try {
        if (this.opusEncoder.state !== 'closed') {
          this.opusEncoder.close();
        }
      } catch {}
      this.opusEncoder = null;
    }
    this.opusTxTimestampUs = 0;
  }

  private closeOpusDecoder() {
    if (this.opusDecoder) {
      try {
        if (this.opusDecoder.state !== 'closed') {
          this.opusDecoder.close();
        }
      } catch {}
      this.opusDecoder = null;
    }
    this.opusRxSpeakerId = null;
    this.opusRxTimestampUs = 0;
  }

  private createOpusEncoderForTx(onPacket: (pkt: EncodedAudioPacket) => void): boolean {
    const Enc = typeof window !== 'undefined' ? (window as any).AudioEncoder : null;
    if (typeof Enc !== 'function') return false;

    try {
      const encoder = new Enc({
        output: (chunk: any) => {
          try {
            const bytes = new Uint8Array(chunk.byteLength);
            chunk.copyTo(bytes);
            if (bytes.length > 0 && this.isCapturing) {
              onPacket({
                codec: 'opus',
                payloadBase64: bytesToBase64(bytes),
                sampleRate: this.OPUS_SAMPLE_RATE,
              });
            }
          } catch {}
        },
        error: (err: any) => {
          console.warn('[VhfRadio] Errore Opus Encoder, passo ad ADPCM 24kHz:', err);
          this.closeOpusEncoder();
          this.activeTxCodec = 'adpcm24';
          this.notifyCodecInfo();
        },
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: this.OPUS_SAMPLE_RATE,
        numberOfChannels: 1,
        bitrate: 48000,
        opus: {
          application: 'voip',
          signal: 'voice',
          frameDuration: 20000,
          usedtx: false,
        },
      });
      this.opusEncoder = encoder;
      this.opusTxTimestampUs = 0;
      return true;
    } catch {
      try {
        // Riconfigurazione minima compatibile se sottocampi opus non supportati
        const encoder = new Enc({
          output: (chunk: any) => {
            try {
              const bytes = new Uint8Array(chunk.byteLength);
              chunk.copyTo(bytes);
              if (bytes.length > 0 && this.isCapturing) {
                onPacket({
                  codec: 'opus',
                  payloadBase64: bytesToBase64(bytes),
                  sampleRate: this.OPUS_SAMPLE_RATE,
                });
              }
            } catch {}
          },
          error: () => {
            this.closeOpusEncoder();
            this.activeTxCodec = 'adpcm24';
            this.notifyCodecInfo();
          },
        });
        encoder.configure({
          codec: 'opus',
          sampleRate: this.OPUS_SAMPLE_RATE,
          numberOfChannels: 1,
          bitrate: 48000,
        });
        this.opusEncoder = encoder;
        this.opusTxTimestampUs = 0;
        return true;
      } catch {
        this.opusEncoder = null;
        return false;
      }
    }
  }

  // Avvia acquisizione microfono HD (AudioWorklet off-main-thread + Codec Opus 48kHz / ADPCM 24kHz)
  public async startCapture(
    onPacket: (pkt: EncodedAudioPacket) => void,
    options?: {
      preferOpus?: boolean;
      onLevel?: (level0to100: number) => void;
      onError?: (msg: string) => void;
    }
  ): Promise<boolean> {
    this.stopCapture();
    this.captureRequested = true;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.captureRequested = false;
      options?.onError?.('Microfono non supportato su questo browser o connessione non sicura (HTTPS richiesto).');
      return false;
    }

    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) {
        this.captureRequested = false;
        options?.onError?.('AudioContext non disponibile sul dispositivo.');
        return false;
      }

      const workletsReady = await this.ensureWorkletsLoaded(ctx);
      const canUseOpus = Boolean(options?.preferOpus && (await this.supportsOpusCodec()));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
        },
        video: false,
      });

      // Se l'utente ha già rilasciato il tasto PTT durante la richiesta permessi, ferma subito
      if (!this.captureRequested) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }

      let useOpus = false;
      if (canUseOpus) {
        useOpus = this.createOpusEncoderForTx(onPacket);
      }
      this.activeTxCodec = useOpus ? 'opus' : 'adpcm24';
      this.notifyCodecInfo();

      this.captureStream = stream;
      this.pendingAdpcmSamples = [];

      const source = ctx.createMediaStreamSource(stream);
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;

      const processCapturedBlock = (samples: Float32Array, precomputedLevel?: number) => {
        if (!this.isCapturing) return;

        let level = precomputedLevel;
        if (level === undefined) {
          let sumSq = 0;
          for (let i = 0; i < samples.length; i++) {
            sumSq += samples[i] * samples[i];
          }
          level = Math.min(100, Math.round(Math.sqrt(sumSq / samples.length) * 320));
        }
        this.notifyTxLevel(level);
        options?.onLevel?.(level);

        // Path 1: WebCodecs Opus 48 kHz HD
        if (this.opusEncoder && this.opusEncoder.state === 'configured') {
          try {
            const audioAt48k =
              ctx.sampleRate === this.OPUS_SAMPLE_RATE
                ? samples
                : resampleFloat32(samples, ctx.sampleRate, this.OPUS_SAMPLE_RATE);
            const AudioDataClass = (window as any).AudioData;
            if (typeof AudioDataClass === 'function' && audioAt48k.length > 0) {
              const ad = new AudioDataClass({
                format: 'f32-planar',
                sampleRate: this.OPUS_SAMPLE_RATE,
                numberOfFrames: audioAt48k.length,
                numberOfChannels: 1,
                timestamp: this.opusTxTimestampUs,
                data: audioAt48k,
              });
              this.opusTxTimestampUs += Math.round((audioAt48k.length * 1_000_000) / this.OPUS_SAMPLE_RATE);
              this.opusEncoder.encode(ad);
              ad.close();
              return;
            }
          } catch {
            // Se Opus fallisce a runtime, passa istantaneamente ad ADPCM 24kHz senza interrompere TX
            this.closeOpusEncoder();
            this.activeTxCodec = 'adpcm24';
            this.notifyCodecInfo();
          }
        }

        // Path 2: HD Wideband IMA-ADPCM 24 kHz con filtro Sinc anti-aliasing
        const resampled24k = resampleFloat32(samples, ctx.sampleRate, this.ADPCM_SAMPLE_RATE);
        const pcm16 = float32ToInt16(resampled24k);
        for (let i = 0; i < pcm16.length; i++) {
          this.pendingAdpcmSamples.push(pcm16[i]);
        }

        while (this.pendingAdpcmSamples.length >= this.ADPCM_FRAME_SAMPLES) {
          const slice = this.pendingAdpcmSamples.splice(0, this.ADPCM_FRAME_SAMPLES);
          const encodedBytes = encodeImaAdpcmBlock(new Int16Array(slice));
          onPacket({
            codec: 'adpcm24',
            payloadBase64: bytesToBase64(encodedBytes),
            sampleRate: this.ADPCM_SAMPLE_RATE,
          });
        }
      };

      if (workletsReady) {
        const blockSize40ms = Math.round(ctx.sampleRate * 0.04); // 1920 @ 48kHz (40ms)
        const workletNode = new AudioWorkletNode(ctx, 'vhf-capture-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          processorOptions: { blockSize: blockSize40ms },
        });
        workletNode.port.onmessage = (ev) => {
          if (!ev.data?.samples) return;
          processCapturedBlock(ev.data.samples as Float32Array, ev.data.level);
        };
        source.connect(workletNode);
        workletNode.connect(muteGain);
        muteGain.connect(ctx.destination);
        this.captureWorkletNode = workletNode;
      } else {
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        processor.onaudioprocess = (ev) => {
          const inputData = ev.inputBuffer.getChannelData(0);
          processCapturedBlock(new Float32Array(inputData));
        };
        source.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(ctx.destination);
        this.captureProcessor = processor;
      }

      this.captureSource = source;
      this.captureMuteGain = muteGain;
      this.isCapturing = true;
      return true;
    } catch (err: any) {
      this.captureRequested = false;
      this.stopCapture();
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permesso microfono negato. Consenti accesso al microfono nelle impostazioni del browser.'
          : err?.message || 'Impossibile accedere al microfono per la radio PTT.';
      options?.onError?.(msg);
      return false;
    }
  }

  public stopCapture() {
    this.captureRequested = false;
    this.isCapturing = false;
    this.pendingAdpcmSamples = [];
    this.notifyTxLevel(0);
    this.closeOpusEncoder();

    if (this.captureWorkletNode) {
      try {
        this.captureWorkletNode.port.onmessage = null;
        this.captureWorkletNode.disconnect();
      } catch {}
      this.captureWorkletNode = null;
    }
    if (this.captureProcessor) {
      try {
        this.captureProcessor.onaudioprocess = null;
        this.captureProcessor.disconnect();
      } catch {}
      this.captureProcessor = null;
    }
    if (this.captureSource) {
      try {
        this.captureSource.disconnect();
      } catch {}
      this.captureSource = null;
    }
    if (this.captureMuteGain) {
      try {
        this.captureMuteGain.disconnect();
      } catch {}
      this.captureMuteGain = null;
    }
    if (this.captureStream) {
      this.captureStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.captureStream = null;
    }
  }

  private pushFloat32ToRx(ctx: AudioContext, floatSamples: Float32Array, sourceRate: number) {
    if (!floatSamples || floatSamples.length === 0) return;

    const atCtxRate =
      sourceRate === ctx.sampleRate
        ? floatSamples
        : resampleFloat32(floatSamples, sourceRate, ctx.sampleRate);

    // Path ottimale: AudioWorklet circolare continuo (zero boundary click)
    const rxWorklet = this.getOrCreateRxWorklet(ctx);
    if (rxWorklet) {
      const transferable = new Float32Array(atCtxRate);
      rxWorklet.port.postMessage({ type: 'push', samples: transferable }, [transferable.buffer]);
      return;
    }

    // Fallback Scheduler morbido con Jitter Buffer 90ms e fade-in/out 2ms anti-click
    const audioBuf = ctx.createBuffer(1, atCtxRate.length, ctx.sampleRate);
    const ch = audioBuf.getChannelData(0);
    ch.set(atCtxRate);

    const fadeSamples = Math.min(Math.floor(ch.length / 4), Math.floor(ctx.sampleRate * 0.002));
    for (let i = 0; i < fadeSamples; i++) {
      const w = i / Math.max(1, fadeSamples);
      ch[i] *= w;
      ch[ch.length - 1 - i] *= w;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    const rxInput = this.getOrCreateRxChain(ctx);
    source.connect(rxInput);

    const now = ctx.currentTime;
    if (this.nextPlaybackTime < now + 0.015 || this.nextPlaybackTime > now + 0.75) {
      this.nextPlaybackTime = now + 0.09;
    }
    const startAt = this.nextPlaybackTime;
    this.nextPlaybackTime = startAt + audioBuf.duration;

    this.activeRxSources.add(source);
    source.onended = () => {
      this.activeRxSources.delete(source);
    };
    source.start(startAt);
  }

  private ensureOpusDecoderForRx(speakerId: string, sampleRate: number) {
    const Dec = typeof window !== 'undefined' ? (window as any).AudioDecoder : null;
    if (typeof Dec !== 'function') return null;

    if (
      this.opusDecoder &&
      this.opusDecoder.state === 'configured' &&
      this.opusRxSpeakerId === speakerId
    ) {
      return this.opusDecoder;
    }

    this.closeOpusDecoder();

    try {
      const decoder = new Dec({
        output: (audioData: any) => {
          try {
            const ctx = this.ensureAudioContext();
            if (!ctx || ctx.state !== 'running') {
              audioData.close();
              return;
            }
            const frames = audioData.numberOfFrames;
            const sr = audioData.sampleRate || sampleRate || this.OPUS_SAMPLE_RATE;
            const floatOut = new Float32Array(frames);
            try {
              audioData.copyTo(floatOut, { planeIndex: 0, format: 'f32-planar' });
            } catch {
              const s16 = new Int16Array(frames);
              audioData.copyTo(s16, { planeIndex: 0, format: 's16' });
              for (let i = 0; i < frames; i++) floatOut[i] = s16[i] / 32768;
            }
            audioData.close();
            this.pushFloat32ToRx(ctx, floatOut, sr);
          } catch {
            try {
              audioData.close();
            } catch {}
          }
        },
        error: () => {
          this.closeOpusDecoder();
        },
      });

      decoder.configure({
        codec: 'opus',
        sampleRate: sampleRate || this.OPUS_SAMPLE_RATE,
        numberOfChannels: 1,
      });
      this.opusDecoder = decoder;
      this.opusRxSpeakerId = speakerId;
      this.opusRxTimestampUs = 0;
      return decoder;
    } catch {
      this.opusDecoder = null;
      return null;
    }
  }

  // Riproduce pacchetti RX decodificando automaticamente Opus 48kHz, ADPCM 24kHz o PCM16 legacy
  public enqueueEncodedChunk(packet: {
    speakerId?: string;
    codec?: RadioAudioCodec;
    payloadBase64?: string;
    pcm16Base64?: string;
    sampleRate?: number;
  }) {
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx || ctx.state !== 'running') return;
      if (!this.workletsLoadedCtx.has(ctx) && !this.workletLoadingPromise) {
        this.ensureWorkletsLoaded(ctx).catch(() => {});
      }

      const b64 = packet.payloadBase64 || packet.pcm16Base64;
      if (!b64) return;

      const codec: RadioAudioCodec = packet.codec || 'pcm16';
      if (this.lastRxCodec !== codec) {
        this.lastRxCodec = codec;
        this.notifyCodecInfo();
      }

      if (codec === 'opus') {
        const dec = this.ensureOpusDecoderForRx(
          packet.speakerId || 'remote',
          packet.sampleRate || this.OPUS_SAMPLE_RATE
        );
        const EncChunk = (window as any).EncodedAudioChunk;
        if (dec && typeof EncChunk === 'function') {
          const bytes = base64ToBytes(b64);
          const chunk = new EncChunk({
            type: 'key',
            timestamp: this.opusRxTimestampUs,
            data: bytes,
          });
          this.opusRxTimestampUs += 20000;
          dec.decode(chunk);
        }
        return;
      }

      if (codec === 'adpcm24') {
        const bytes = base64ToBytes(b64);
        const floats = decodeImaAdpcmBlock(bytes);
        this.pushFloat32ToRx(ctx, floats, packet.sampleRate || this.ADPCM_SAMPLE_RATE);
        return;
      }

      // Fallback PCM16 legacy
      const pcm16 = base64ToInt16(b64);
      if (!pcm16 || pcm16.length === 0) return;
      const floats = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        floats[i] = pcm16[i] / 32768;
      }
      this.pushFloat32ToRx(ctx, floats, packet.sampleRate || 16000);
    } catch {}
  }

  // Interrompe immediatamente tutta la coda audio in ascolto
  public interruptPlayback() {
    this.nextPlaybackTime = 0;
    this.closeOpusDecoder();
    if (this.rxWorkletNode) {
      try {
        this.rxWorkletNode.port.postMessage({ type: 'clear' });
      } catch {}
    }
    this.activeRxSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeRxSources.clear();
  }

  // -------------------------------------------------------------
  // REGISTRATORE MESSAGGI AUDIO ASINCRONI (CLIP IN CHAT RADIO)
  // -------------------------------------------------------------
  public async startAudioMessageRecording(onError?: (msg: string) => void): Promise<boolean> {
    this.cancelAudioMessageRecording();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError?.('Registrazione messaggi audio non supportata da questo browser.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
        },
      });

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType = candidates.find((m) => {
        try {
          return MediaRecorder.isTypeSupported(m);
        } catch {
          return false;
        }
      });

      const options: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 48000 }
        : { audioBitsPerSecond: 48000 };

      const recorder = new MediaRecorder(stream, options);
      this.recorderChunks = [];
      this.recorderStartedAt = Date.now();
      this.recorderStream = stream;
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          this.recorderChunks.push(ev.data);
        }
      };

      recorder.start(250);
      return true;
    } catch (err: any) {
      this.cancelAudioMessageRecording();
      onError?.(
        err?.name === 'NotAllowedError'
          ? 'Permesso microfono negato per la registrazione vocale.'
          : err?.message || 'Impossibile avviare la registrazione vocale.'
      );
      return false;
    }
  }

  public stopAndExportAudioMessage(): Promise<{
    dataUrl: string;
    durationSec: number;
    mimeType: string;
  } | null> {
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      const stream = this.recorderStream;
      if (!recorder || recorder.state === 'inactive') {
        this.cancelAudioMessageRecording();
        resolve(null);
        return;
      }

      const durationSec = Math.max(1, Math.round((Date.now() - this.recorderStartedAt) / 1000));
      const mimeType = recorder.mimeType || 'audio/webm';

      recorder.onstop = () => {
        const blob = new Blob(this.recorderChunks, { type: mimeType });
        stream?.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        this.mediaRecorder = null;
        this.recorderStream = null;
        this.recorderChunks = [];

        if (blob.size < 200) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          resolve(result ? { dataUrl: result, durationSec, mimeType } : null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };

      try {
        recorder.stop();
      } catch {
        this.cancelAudioMessageRecording();
        resolve(null);
      }
    });
  }

  public cancelAudioMessageRecording() {
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.onstop = null;
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }
    if (this.recorderStream) {
      this.recorderStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.recorderStream = null;
    }
    this.recorderChunks = [];
  }
}

export const vhfRadioEngine = new VhfRadioEngine();
