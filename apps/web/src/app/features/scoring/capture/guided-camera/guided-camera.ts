import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/i18n';
import { DialogBackdrop } from '../../../../shared/dialog-backdrop';
import { ErrorNotice } from '../../../../shared/error-notice/error-notice';
import { captureZones, type CaptureZone, type GuidedPhoto } from '../guided-layout';

@Component({
  selector: 'app-guided-camera',
  imports: [TranslatePipe, DialogBackdrop, ErrorNotice],
  templateUrl: './guided-camera.html',
  styleUrl: './guided-camera.css',
})
export class GuidedCamera {
  readonly players = input.required<readonly { id: string; name: string }[]>();
  readonly winnerId = input.required<string>();
  readonly playerCount = input.required<3 | 4>();
  readonly disabled = input(false);
  readonly captured = output<GuidedPhoto>();
  readonly sources = signal<string[]>([]);
  readonly zones = computed(() => captureZones(this.sources(), this.playerCount() === 3));
  readonly active = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly aspect = signal(4 / 3);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('camera');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private stream?: MediaStream;
  private generation = 0;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }
  get otherPlayers() {
    const index = this.players().findIndex((player) => player.id === this.winnerId());
    return [1, 2, 3].slice(0, this.players().length - 1).map((offset) => ({
      ...this.players()[(index + this.players().length - offset) % this.players().length],
      position:
        offset === 1
          ? 'Previous player'
          : this.players().length === 4 && offset === 2
            ? 'Opposite player'
            : 'Next player',
    }));
  }
  zoneLabel(zone: CaptureZone): string {
    if (zone.id.startsWith('meld-')) return 'Meld area';
    return zone.kind === 'hand'
      ? 'Concealed hand area'
      : zone.kind === 'ankan'
        ? 'Concealed Kan area'
        : zone.kind === 'kita'
          ? 'North extraction area'
          : 'Meld area';
  }
  changeSource(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value !== 'ankan' && !this.otherPlayers.some((player) => player.id === value)) return;
    this.sources.update((values) => values.map((source, i) => (i === index ? value : source)));
  }
  updateAspect(): void {
    const video = this.video().nativeElement;
    if (video.videoWidth && video.videoHeight)
      this.aspect.set(video.videoWidth / video.videoHeight);
  }
  async open(): Promise<void> {
    if (this.disabled()) return;
    this.stop();
    const generation = this.generation;
    this.error.set('');
    this.sources.set(
      Array.from(
        { length: 4 },
        (_, i) => this.otherPlayers[i % this.otherPlayers.length]?.id ?? '',
      ),
    );
    this.dialog().nativeElement.showModal();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const video = this.video().nativeElement;
      video.srcObject = stream;
      await video.play();
      if (generation !== this.generation) return;
      this.aspect.set(video.videoWidth / video.videoHeight);
      this.active.set(true);
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      this.error.set('Camera unavailable. Allow camera access or choose a saved photo.');
    }
  }
  async takePhoto(): Promise<void> {
    if (!this.active() || this.busy()) return;
    this.busy.set(true);
    const generation = this.generation;
    const video = this.video().nativeElement;
    const zones = structuredClone(this.zones());
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Camera unavailable');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (generation !== this.generation) return;
      if (!blob) throw new Error('Camera unavailable');
      const photo: GuidedPhoto = {
        file: new File([blob], 'guided-hand.png', { type: 'image/png' }),
        zones,
      };
      this.close();
      this.captured.emit(photo);
    } catch {
      if (generation === this.generation) this.error.set('Could not capture photo. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
  close(): void {
    this.stop();
    this.dialog().nativeElement.close();
  }
  stop(): void {
    this.generation++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.active.set(false);
    const video = this.video()?.nativeElement;
    if (video) video.srcObject = null;
  }
}
