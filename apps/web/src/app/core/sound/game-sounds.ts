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
export const recordedCalls: Partial<Record<CallSound, string>> = {
  pon: 'pon',
  chi: 'chi',
  daiminkan: 'kan',
  kakan: 'kan',
  ankan: 'kan',
  riichi: 'riichi',
  ron: 'ron',
  tsumo: 'tsumo',
};

@Service()
export class GameSounds {
  readonly enabled = signal(this.readPreference());
  readonly previews = Object.keys(callSounds) as CallSound[];
  private context?: AudioContext;
  private audio?: HTMLAudioElement;
  private playback = 0;

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
    if (!enabled) {
      this.playback++;
      this.audio?.pause();
    }
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
    const playback = ++this.playback;
    this.audio?.pause();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.unlock();
    const recording = recordedCalls[call];
    if (recording && typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(
          new URL('sounds/ichihime/' + recording + '.mp3', document.baseURI).href,
        );
        this.audio = audio;
        audio.volume = 0.7;
        let failed = false;
        const fallback = () => {
          if (failed || playback !== this.playback || !this.enabled()) return;
          failed = true;
          this.playFallback(call);
        };
        audio.onerror = fallback;
        void audio.play().catch(fallback);
        return;
      } catch {
        /* Use device speech if media playback is unavailable. */
      }
    }
    this.playFallback(call);
  }

  private playFallback(call: CallSound): void {
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
