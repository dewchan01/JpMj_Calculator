import { Service, computed, inject } from '@angular/core';
import { BackgroundMusic } from './background-music';
import { GameSounds } from './game-sounds';

@Service()
export class AudioControls {
  private readonly music = inject(BackgroundMusic);
  readonly sounds = inject(GameSounds);
  readonly enabled = computed(() => this.music.volume() > 0);

  toggle(): void {
    this.music.setEnabled(!this.enabled());
  }

  toggleSounds(): void {
    this.sounds.setEnabled(!this.sounds.enabled());
    if (this.sounds.enabled()) this.sounds.unlock();
  }

  setVolume(volume: number): void {
    this.music.setVolume(volume);
  }
}
