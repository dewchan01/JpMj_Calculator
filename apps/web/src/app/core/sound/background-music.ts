import { DestroyRef, Service, computed, effect, inject, signal, untracked } from '@angular/core';

import { gameTracks, lobbyTracks, musicFile, musicTitles, riichiTracks } from './music-catalog';
export type MusicScene = 'lobby' | 'game' | 'riichi';

@Service()
export class BackgroundMusic {
  readonly lobbyTracks = lobbyTracks;
  readonly gameTracks = gameTracks;
  readonly riichiTracks = riichiTracks;
  readonly titles = musicTitles;
  readonly enabled = signal(this.read('riichi-music') !== 'off' && this.savedVolume() > 0);
  readonly lobby = signal<string>(this.read('riichi-lobby-music') ?? 'Lobby');
  readonly game = signal(this.savedTrack('riichi-game-music', gameTracks));
  readonly riichi = signal(this.savedTrack('riichi-riichi-music', riichiTracks));
  readonly volume = signal(this.enabled() ? this.savedVolume() : 0);
  private lastVolume = Math.max(
    0.05,
    Math.min(1, this.savedVolume() || Number(this.read('riichi-music-last-volume')) || 0.25),
  );
  readonly error = signal('');
  private readonly scene = signal<MusicScene>('lobby');
  private readonly hand = signal('');
  private readonly unlocked = signal(false);
  private readonly visible = signal(!document.hidden);
  private readonly selected = computed(() => {
    const scene = this.scene();
    this.hand();
    if (scene === 'lobby') return lobbyTracks.find((track) => track === this.lobby()) ?? 'Lobby';
    const tracks = scene === 'riichi' ? riichiTracks : gameTracks;
    const chosen = scene === 'riichi' ? this.riichi() : this.game();
    const fixed = tracks.find((track) => track === chosen);
    if (fixed) return fixed;
    return tracks[Math.floor(Math.random() * tracks.length)];
  });
  private audio?: HTMLAudioElement;
  private source = '';
  private generation = 0;
  private pending?: HTMLAudioElement;

  constructor() {
    const unlock = () => {
      this.unlocked.set(true);
      // Retry inside the user gesture, where browsers permit media playback.
      if (this.audio?.paused && !this.pending)
        untracked(() =>
          this.play(this.selected(), this.enabled() && this.visible(), this.volume()),
        );
    };
    const visibility = () => this.visible.set(!document.hidden);
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility);
      this.generation++;
      this.audio?.pause();
    });
    effect(() => {
      const track = this.selected();
      const playing = this.enabled() && this.unlocked() && this.visible();
      const volume = this.volume();
      untracked(() => this.play(track, playing, volume));
    });
  }

  setScene(scene: MusicScene, hand = ''): void {
    this.hand.set(hand);
    this.scene.set(scene);
  }
  setEnabled(enabled: boolean): void {
    this.setVolume(enabled ? this.lastVolume : 0);
  }
  setLobby(track: string): void {
    if (!lobbyTracks.some((value) => value === track)) return;
    this.unlocked.set(true);
    this.lobby.set(track);
    this.save('riichi-lobby-music', track);
    this.playSelection();
  }
  setGame(track: string): void {
    if (track !== 'random' && !gameTracks.some((value) => value === track)) return;
    this.game.set(track);
    this.save('riichi-game-music', track);
    this.unlocked.set(true);
    this.playSelection();
  }
  setRiichi(track: string): void {
    if (track !== 'random' && !riichiTracks.some((value) => value === track)) return;
    this.riichi.set(track);
    this.save('riichi-riichi-music', track);
    this.unlocked.set(true);
    this.playSelection();
  }
  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    const volume = Math.max(0, Math.min(1, value));
    if (volume > 0) {
      this.lastVolume = volume;
      this.save('riichi-music-last-volume', String(volume));
    }
    this.volume.set(volume);
    this.enabled.set(volume > 0);
    this.save('riichi-music', volume > 0 ? 'on' : 'off');
    this.save('riichi-music-volume', String(volume));
    this.unlocked.set(true);
    if (this.audio) this.audio.volume = volume;
    this.playSelection();
  }
  private playSelection(): void {
    // Start within the select/input event rather than waiting for the reactive effect.
    untracked(() =>
      this.play(
        this.selected(),
        this.enabled() && this.unlocked() && this.visible(),
        this.volume(),
      ),
    );
  }
  private play(track: string, playing: boolean, volume: number): void {
    if (!playing) {
      this.generation++;
      this.pending = undefined;
      this.audio?.pause();
      this.error.set('');
      return;
    }
    if (this.source !== track) {
      this.generation++;
      this.pending = undefined;
      this.audio?.pause();
      this.source = track;
      this.audio = new Audio(new URL('sounds/music/' + musicFile(track), document.baseURI).href);
      this.audio.loop = true;
      this.audio.preload = 'none';
      this.error.set('');
    }
    const audio = this.audio!;
    audio.volume = volume;
    if (this.pending === audio) return;
    if (!audio.paused) {
      this.error.set('');
      return;
    }
    const generation = ++this.generation;
    this.pending = audio;
    void audio
      .play()
      .then(() => {
        if (generation === this.generation && audio === this.audio) {
          this.pending = undefined;
          this.error.set('');
        }
        if (
          generation !== this.generation &&
          (audio !== this.audio || !this.enabled() || !this.visible())
        )
          audio.pause();
      })
      .catch((error: unknown) => {
        if (generation !== this.generation || audio !== this.audio) return;
        this.pending = undefined;
        const name = error instanceof Error ? error.name : '';
        // Pausing/switching and autoplay restrictions are recoverable, not file errors.
        this.error.set(
          name === 'AbortError' || name === 'NotAllowedError'
            ? ''
            : 'Could not play background music.',
        );
      });
  }
  private savedVolume(): number {
    const saved = this.read('riichi-music-volume');
    const value = saved === null ? 0.25 : Number(saved);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.25;
  }
  private savedTrack(key: string, tracks: readonly string[]): string {
    const saved = this.read(key);
    return saved && tracks.includes(saved) ? saved : 'random';
  }
  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private save(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep the in-memory preference. */
    }
  }
}
