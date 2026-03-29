import logger from "@/utils/logger";

const TARGET_SAMPLE_RATE = 16000;
const MIC_PROCESSOR_BUFFER_SIZE = 512;
const MIC_DIAGNOSTIC_LOG_EVERY_N_CHUNKS = 25;

const AudioContextCtor: typeof AudioContext | undefined =
  window.AudioContext ||
  (
    window as Window & {
      webkitAudioContext?: typeof AudioContext;
    }
  ).webkitAudioContext;

function concatFloat32Arrays(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) {
    return b;
  }
  if (b.length === 0) {
    return a;
  }
  const combined = new Float32Array(a.length + b.length);
  combined.set(a, 0);
  combined.set(b, a.length);
  return combined;
}

function clampToPcm16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pcm16BytesToFloat32(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const floats = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i += 1) {
    const sample = view.getInt16(i * 2, true);
    floats[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return floats;
}

export class PcmPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private pendingSources = new Set<AudioBufferSourceNode>();
  private onPlaybackStateChange?: (active: boolean) => void;

  constructor(onPlaybackStateChange?: (active: boolean) => void) {
    this.onPlaybackStateChange = onPlaybackStateChange;
  }

  private ensureContext(): AudioContext {
    if (!AudioContextCtor) {
      throw new Error("Audio playback is not supported in this browser.");
    }
    if (!this.context) {
      this.context = new AudioContextCtor({ sampleRate: TARGET_SAMPLE_RATE });
      this.nextStartTime = this.context.currentTime;
    }
    return this.context;
  }

  async enqueueBase64Pcm16(base64Audio: string): Promise<void> {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    const floats = new Float32Array(pcm16BytesToFloat32(base64ToUint8(base64Audio)));
    if (floats.length === 0) {
      return;
    }

    const audioBuffer = context.createBuffer(1, floats.length, TARGET_SAMPLE_RATE);
    audioBuffer.copyToChannel(floats, 0);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime + 0.02, this.nextStartTime);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.pendingSources.add(source);
    this.onPlaybackStateChange?.(true);
    source.onended = () => {
      this.pendingSources.delete(source);
      if (this.pendingSources.size === 0) {
        this.onPlaybackStateChange?.(false);
      }
    };
    source.start(startAt);
  }

  async stop(): Promise<void> {
    for (const source of this.pendingSources) {
      try {
        source.stop();
      } catch {
        // no-op
      }
      source.disconnect();
    }
    this.pendingSources.clear();
    this.onPlaybackStateChange?.(false);
    this.nextStartTime = 0;
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}

export class MicCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muted = false;
  private buffer = new Float32Array(0);
  private resamplePosition = 0;
  private chunkCount = 0;
  private chunkLogSampleRate: number | null = null;
  private lastChunkSentAt = 0;
  private readonly onChunk: (base64Audio: string) => void;

  constructor(onChunk: (base64Audio: string) => void) {
    this.onChunk = onChunk;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private ensureContext(): AudioContext {
    if (!AudioContextCtor) {
      throw new Error("Audio capture is not supported in this browser.");
    }
    if (!this.context) {
      this.context = new AudioContextCtor();
    }
    return this.context;
  }

  private downmixToMono(inputBuffer: AudioBuffer): Float32Array {
    const channelCount = inputBuffer.numberOfChannels;
    const frameCount = inputBuffer.length;
    const mono = new Float32Array(frameCount);

    for (let channel = 0; channel < channelCount; channel += 1) {
      const samples = inputBuffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i += 1) {
        mono[i] += samples[i] / channelCount;
      }
    }

    return mono;
  }

  private emitResampledChunk(chunk: Float32Array, sourceRate: number): void {
    if (chunk.length === 0) {
      return;
    }

    if (this.chunkLogSampleRate === null) {
      this.chunkLogSampleRate = sourceRate;
      logger.info("Adult voice mic capture configured", {
        inputSampleRate: sourceRate,
        processorFrames: MIC_PROCESSOR_BUFFER_SIZE,
        expectedChunkMs: Math.round((MIC_PROCESSOR_BUFFER_SIZE / sourceRate) * 1000),
        targetSampleRate: TARGET_SAMPLE_RATE,
      });
    }

    this.buffer = new Float32Array(concatFloat32Arrays(this.buffer, chunk));

    if (sourceRate === TARGET_SAMPLE_RATE) {
      const pcm16 = new Int16Array(this.buffer.length);
      for (let i = 0; i < this.buffer.length; i += 1) {
        pcm16[i] = clampToPcm16(this.buffer[i]);
      }
      this.buffer = new Float32Array(0);
      this.resamplePosition = 0;
      const now = performance.now();
      const elapsedSinceLastChunkMs =
        this.lastChunkSentAt > 0 ? Math.round(now - this.lastChunkSentAt) : null;
      this.chunkCount += 1;
      this.lastChunkSentAt = now;
      if (this.chunkCount % MIC_DIAGNOSTIC_LOG_EVERY_N_CHUNKS === 0) {
        logger.debug("Adult voice mic chunks sent", {
          chunkCount: this.chunkCount,
          inputSampleRate: sourceRate,
          processorFrames: MIC_PROCESSOR_BUFFER_SIZE,
          elapsedSinceLastChunkMs,
        });
      }
      this.onChunk(uint8ToBase64(new Uint8Array(pcm16.buffer)));
      return;
    }

    const ratio = sourceRate / TARGET_SAMPLE_RATE;
    const samples: number[] = [];
    let position = this.resamplePosition;

    while (position + 1 < this.buffer.length) {
      const leftIndex = Math.floor(position);
      const rightIndex = leftIndex + 1;
      const frac = position - leftIndex;
      const sample =
        this.buffer[leftIndex] * (1 - frac) + this.buffer[rightIndex] * frac;
      samples.push(sample);
      position += ratio;
    }

    if (samples.length === 0) {
      this.resamplePosition = position;
      return;
    }

    const consumed = Math.floor(position);
    this.buffer = this.buffer.slice(consumed);
    this.resamplePosition = position - consumed;

    const pcm16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      pcm16[i] = clampToPcm16(samples[i]);
    }
    const now = performance.now();
    const elapsedSinceLastChunkMs =
      this.lastChunkSentAt > 0 ? Math.round(now - this.lastChunkSentAt) : null;
    this.chunkCount += 1;
    this.lastChunkSentAt = now;
    if (this.chunkCount % MIC_DIAGNOSTIC_LOG_EVERY_N_CHUNKS === 0) {
      logger.debug("Adult voice mic chunks sent", {
        chunkCount: this.chunkCount,
        inputSampleRate: sourceRate,
        processorFrames: MIC_PROCESSOR_BUFFER_SIZE,
        elapsedSinceLastChunkMs,
      });
    }
    this.onChunk(uint8ToBase64(new Uint8Array(pcm16.buffer)));
  }

  async start(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sourceNode = context.createMediaStreamSource(this.stream);
    this.processorNode = context.createScriptProcessor(
      MIC_PROCESSOR_BUFFER_SIZE,
      this.sourceNode.channelCount,
      1,
    );
    this.processorNode.onaudioprocess = (event) => {
      if (this.muted) {
        return;
      }
      const mono = this.downmixToMono(event.inputBuffer);
      this.emitResampledChunk(mono, event.inputBuffer.sampleRate);
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(context.destination);
  }

  async stop(): Promise<void> {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.buffer = new Float32Array(0);
    this.resamplePosition = 0;
    this.chunkCount = 0;
    this.chunkLogSampleRate = null;
    this.lastChunkSentAt = 0;
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
