import { Service, computed, inject } from '@angular/core';
import { BackgroundMusic } from './background-music';
import { GameSounds } from './game-sounds';

@Service()
export class AudioControls {
  private readonly music = inject(BackgroundMusic);
  private readonly sounds = inject(GameSounds);
  readonly enabled = computed(() => this.music.volume() > 0);

  constructor() {
    this.sounds.setEnabled(this.enabled());
  }

  toggle(): void {
    this.music.setEnabled(!this.enabled());
    this.sounds.setEnabled(this.enabled());
    if (this.enabled()) this.sounds.unlock();
  }

  setVolume(volume: number): void {
    this.music.setVolume(volume);
    this.sounds.setEnabled(this.enabled());
    if (this.enabled()) this.sounds.unlock();
  }
}
