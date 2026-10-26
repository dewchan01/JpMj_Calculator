import { Service, signal } from '@angular/core';

export const callSounds = {
  pon: 'ポン',
  kita: 'ペーします',
  chi: 'チー',
  daiminkan: 'カン',
  kakan: 'カン',
  ankan: '暗槓',
  riichi: 'リーチ',
  doubleRiichi: 'ダブルリーチ',
  ron: 'ロン',
  tsumo: 'ツモ',
} as const;
export type CallSound = keyof typeof callSounds;

@Service()
export class GameSounds {
  readonly enabled = signal(this.readPreference());
  readonly previews = Object.keys(callSounds) as CallSound[];
  private context?: AudioContext;

  private readPreference(): boolean {
    try {
      return localStorage.getItem('riichi-sound') !== 'off';
    } catch {
      return true;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    try {
      localStorage.setItem('riichi-sound', enabled ? 'on' : 'off');
    } catch {
      /* In-memory setting still works. */
    }
    if (!enabled && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  unlock(): void {
    if (!this.enabled()) return;
    try {
      if (typeof AudioContext !== 'undefined') {
        this.context ??= new AudioContext();
        void this.context.resume().catch(() => undefined);
      }
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
    } catch {
      /* Audio is optional. */
    }
  }

  play(call: CallSound): void {
    if (!this.enabled()) return;
    this.unlock();
    try {
      if (
        typeof speechSynthesis !== 'undefined' &&
        typeof SpeechSynthesisUtterance !== 'undefined'
      ) {
        const voice = speechSynthesis
          .getVoices()
          .find((voice) => voice.localService && /^ja\b/i.test(voice.lang));
        if (voice) {
          const utterance = new SpeechSynthesisUtterance(callSounds[call]);
          utterance.lang = 'ja-JP';
          utterance.voice = voice;
          utterance.volume = 0.7;
          utterance.onerror = (event) => {
            if (this.enabled() && !['canceled', 'interrupted'].includes(event.error))
              this.tone(call);
          };
          speechSynthesis.cancel();
          speechSynthesis.speak(utterance);
          return;
        }
      }
      this.tone(call);
    } catch {
      /* Sound must never interrupt a recorded action. */
    }
  }

  private tone(call: CallSound): void {
    const context = this.context;
    if (!context || context.state === 'closed') return;
    if (context.state !== 'running') {
      void context
        .resume()
        .then(() => {
          if (this.enabled() && context.state === 'running') this.tone(call);
        })
        .catch(() => undefined);
      return;
    }
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      const frequency = 440 + this.previews.indexOf(call) * 55;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.3, start + 0.12);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.21);
    } catch {
      /* Devices may suspend audio while the page is hidden. */
    }
  }
}
