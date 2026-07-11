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
    const duration = capture ? 0.052 : 0.036;
    const buffer = this.context.createBuffer(
      1,
      Math.ceil(this.context.sampleRate * duration),
      this.context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const decay = Math.pow(1 - index / data.length, capture ? 4.2 : 5.2);
      const attack = Math.min(1, index / Math.max(1, data.length * 0.035));
      data[index] = (Math.random() * 2 - 1) * decay * attack;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = capture ? 2100 : 2650;
    filter.Q.value = 1.8;
    envelope.gain.setValueAtTime(capture ? 0.17 : 0.135, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(start);
    source.stop(start + duration);

    this.tone(capture ? 420 : 520, start, duration + 0.012, 0.025, "triangle");
  }

  private speak(text: string) {
    if (!this.enabled || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const japaneseVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
    const preferredNames = /nanami|haruka|ayumi|女性|female/i;
    utterance.voice =
      japaneseVoices.find((voice) => preferredNames.test(voice.name)) ??
      japaneseVoices[0] ??
      null;
    utterance.lang = "ja-JP";
    utterance.rate = 1.02;
    utterance.pitch = 1.32;
    utterance.volume = Math.min(0.72, this.volume * 0.9);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  playStart() {
    this.speak("お願いします");
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
    this.speak("ありがとうございました");
  }
}

export const gameAudio = new GameAudio();
