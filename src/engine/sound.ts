/**
 * Authentic wooden Chinese Chess sound engine.
 * Supports two real-recorded wooden sound packs ("crisp" & "classic") + "off",
 * parsed synchronously from 16-bit PCM WAV files for zero-codec-failure playback
 * across macOS Safari, iOS Safari, Chrome, and Edge.
 */

export type SoundPack = 'crisp' | 'classic' | 'off';

const STORAGE_KEY = 'xiangqi_sound_pack_v1';

const SOUND_URLS: Record<string, string> = {
  crisp_move: './sounds/crisp_move.wav',
  crisp_cap: './sounds/crisp_cap.wav',
  classic_click: './sounds/classic_click.wav',
  classic_move: './sounds/classic_move.wav',
  classic_cap: './sounds/classic_cap.wav',
};

export function loadSoundPack(): SoundPack {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'crisp' || saved === 'classic' || saved === 'off') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'crisp';
}

export function saveSoundPack(pack: SoundPack): void {
  try {
    localStorage.setItem(STORAGE_KEY, pack);
  } catch {
    // ignore storage errors
  }
}

function jitter(spread = 0.04): number {
  return 1 + (Math.random() * 2 - 1) * spread;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadingPromise: Promise<void> | null = null;
  public pack: SoundPack = loadSoundPack();

  public setPack(pack: SoundPack): void {
    this.pack = pack;
    saveSoundPack(pack);
  }

  private getContext(): AudioContext | null {
    if (this.pack === 'off') return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        // Gentle limiter so boosted crisp/classic packs stay loud & punchy without harsh clipping
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -8;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.002;
        comp.release.value = 0.08;
        comp.connect(this.ctx.destination);
        this.compressor = comp;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.compressor ?? ctx.destination;
  }

  /** Preload and decode all 16-bit PCM WAV samples into AudioBuffers */
  public preload(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise;
    if (typeof window === 'undefined') return Promise.resolve();

    this.loadingPromise = Promise.allSettled(
      Object.entries(SOUND_URLS).map(async ([key, url]) => {
        const res = await fetch(url);
        if (!res.ok) return;
        const arrBuf = await res.arrayBuffer();
        const ctx = this.getContext();
        if (!ctx) return;
        const audioBuf = this.parsePcmWav(ctx, arrBuf);
        if (audioBuf) {
          this.buffers.set(key, audioBuf);
        }
      })
    ).then(() => undefined);

    return this.loadingPromise;
  }

  private parsePcmWav(ctx: AudioContext, arrBuf: ArrayBuffer): AudioBuffer | null {
    if (arrBuf.byteLength < 44) return null;
    const view = new DataView(arrBuf);
    const sampleRate = view.getUint32(24, true) || 22050;
    const numSamples = Math.floor((arrBuf.byteLength - 44) / 2);
    if (numSamples <= 0) return null;

    const audioBuf = ctx.createBuffer(1, numSamples, sampleRate);
    const channel = audioBuf.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      channel[i] = view.getInt16(44 + i * 2, true) / 32768;
    }
    return audioBuf;
  }

  private playBuffer(
    key: string,
    rate = 1.0,
    gainVal = 1.4,
    delay = 0,
    lowpassFreq?: number
  ): boolean {
    const ctx = this.getContext();
    if (!ctx) return false;
    const buf = this.buffers.get(key);
    if (!buf) {
      // Trigger lazy preload for next interaction
      this.preload();
      return false;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const gain = ctx.createGain();
    gain.gain.value = gainVal;

    const out = this.getOutputNode(ctx);
    if (lowpassFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassFreq;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(out);
    src.start(ctx.currentTime + delay);
    return true;
  }

  /** Soft wooden finger tap when selecting a piece */
  playSelect(): void {
    if (this.pack === 'off') return;
    this.preload();

    if (this.pack === 'crisp') {
      this.playBuffer('crisp_move', 1.42 * jitter(0.03), 0.42, 0, 1900);
    } else if (this.pack === 'classic') {
      this.playBuffer('classic_click', 1.0 * jitter(0.02), 1.25, 0);
    }
  }

  /** Loud, crisp wooden clack when placing a piece on the board */
  playMove(): void {
    if (this.pack === 'off') return;
    this.preload();

    if (this.pack === 'crisp') {
      this.playBuffer('crisp_move', 1.02 * jitter(0.045), 1.55, 0);
    } else if (this.pack === 'classic') {
      this.playBuffer('classic_move', 1.0 * jitter(0.03), 1.6, 0);
    }
  }

  /** Heavy, punchy double-contact wooden slap when capturing an enemy piece */
  playCapture(): void {
    if (this.pack === 'off') return;
    this.preload();

    if (this.pack === 'crisp') {
      this.playBuffer('crisp_move', 1.32 * jitter(0.03), 0.72, 0);
      this.playBuffer('crisp_cap', 0.98 * jitter(0.04), 1.75, 0.022);
    } else if (this.pack === 'classic') {
      this.playBuffer('classic_cap', 1.0 * jitter(0.03), 1.75, 0);
    }
  }

  /** Authoritative check accent: subtle low-mid antique bronze bell over the wooden slap */
  playCheck(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.045;
    const out = this.getOutputNode(ctx);

    const freqs = [440, 659.25];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(idx === 0 ? 0.14 : 0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  /** Gentle pentatonic guzheng-inspired arpeggio for game end */
  playGameOver(victory: boolean): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.06;
    const out = this.getOutputNode(ctx);
    const notes = victory
      ? [392.0, 440.0, 523.25, 659.25, 783.99]
      : [523.25, 440.0, 392.0, 329.63];

    notes.forEach((freq, i) => {
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }
}

export const soundEngine = new SoundEngine();
