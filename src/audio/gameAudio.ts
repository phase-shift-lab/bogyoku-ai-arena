import { parseSfen } from "shogiops/sfen";
import { parseUsi } from "shogiops/util";

export interface MoveAudioCue {
  readonly capture: boolean;
  readonly promotion: boolean;
  readonly check: boolean;
}

export function classifyMoveAudio(
  previousSfen: string,
  currentSfen: string,
  usi: string,
): MoveAudioCue {
  const previous = parseSfen("standard", previousSfen, true).unwrap();
  const current = parseSfen("standard", currentSfen, true).unwrap();
  const move = parseUsi(usi);
  return {
    capture: Boolean(move && previous.board.get(move.to)),
    promotion: usi.endsWith("+"),
    check: current.isCheck(),
  };
}

type ExtendedWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private enabled = true;
  private volume = 0.6;

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  async unlock() {
    if (!this.enabled) return;
    const Context =
      window.AudioContext ?? (window as ExtendedWindow).webkitAudioContext;
    if (!Context) return;
    if (!this.context) {
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    gain = 0.12,
    type: OscillatorType = "triangle",
  ) {
    if (!this.enabled || !this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(Math.max(0.001, gain), start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private woodClick(start: number, capture: boolean) {
    if (!this.enabled || !this.context || !this.master) return;
    const duration = capture ? 0.075 : 0.052;
    const buffer = this.context.createBuffer(
      1,
      Math.ceil(this.context.sampleRate * duration),
      this.context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const decay = Math.pow(1 - index / data.length, capture ? 2.5 : 3.5);
      data[index] = (Math.random() * 2 - 1) * decay;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = capture ? 1450 : 1850;
    filter.Q.value = 1.15;
    envelope.gain.setValueAtTime(capture ? 0.2 : 0.14, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(start);
    source.stop(start + duration);

    this.tone(capture ? 155 : 190, start, duration + 0.025, 0.055, "sine");
  }

  playStart() {
    const now = this.context?.currentTime;
    if (now === undefined) return;
    // D minor pentatonic: a restrained koto/shakuhachi-like opening phrase.
    [293.66, 349.23, 440, 523.25, 440, 349.23].forEach((note, index) => {
      const start = now + index * 0.42;
      this.tone(note, start, 0.55, 0.038, "triangle");
      this.tone(note * 2, start + 0.012, 0.16, 0.012, "sine");
    });
  }

  playMove(cue: MoveAudioCue) {
    const now = this.context?.currentTime;
    if (now === undefined) return;
    this.woodClick(now, cue.capture);
    if (cue.promotion) {
      this.tone(440, now + 0.11, 0.2, 0.035);
      this.tone(523.25, now + 0.25, 0.24, 0.03);
    }
    if (cue.check) {
      this.tone(349.23, now + 0.17, 0.14, 0.035, "triangle");
      this.tone(349.23, now + 0.38, 0.14, 0.03, "triangle");
    }
  }

  playFinish() {
    const now = this.context?.currentTime;
    if (now === undefined) return;
    [440, 349.23, 293.66, 220].forEach((note, index) =>
      this.tone(note, now + index * 0.38, 0.55, 0.038),
    );
  }
}

export const gameAudio = new GameAudio();
