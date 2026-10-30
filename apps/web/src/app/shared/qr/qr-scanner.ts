import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';
import { DialogBackdrop } from '../dialog-backdrop';
import { ErrorNotice } from '../error-notice/error-notice';
import { Toast } from '../toast/toast';
import { scanQrImage } from './scan-qr';

@Component({
  selector: 'app-qr-scanner',
  imports: [TranslatePipe, DialogBackdrop, ErrorNotice],
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.css',
})
export class QrScanner {
  private readonly toast = inject(Toast);
  readonly disabled = input(false);
  readonly label = input('Scan room QR code');
  readonly instruction = input(
    'Keep the QR code in view. It will join automatically when recognized.',
  );
  readonly scanned = output<string>();
  readonly error = signal('');
  readonly active = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('scanner');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('preview');
  private stream?: MediaStream;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async open(): Promise<void> {
    if (this.disabled()) return;
    this.stop();
    const generation = this.generation;
    this.error.set('');
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
      this.active.set(true);
      void this.readFrame(generation);
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      this.error.set('Camera unavailable. Allow camera access or choose a QR image.');
    }
  }

  private async readFrame(generation: number): Promise<void> {
    if (generation !== this.generation) return;
    const video = this.video().nativeElement;
    if (video.readyState >= 2 && video.videoWidth) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0);
        try {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
          if (blob && generation === this.generation) {
            const value = await scanQrImage(
              new File([blob], 'camera.png', { type: 'image/png' }),
              false,
            );
            if (generation === this.generation) {
              this.close();
              this.scanned.emit(value);
              return;
            }
          }
        } catch {
          // A frame without a readable QR is normal; keep the camera preview running.
        }
      }
    }
    if (generation === this.generation)
      this.timer = setTimeout(() => void this.readFrame(generation), 500);
  }

  async chooseImage(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.stop();
    const generation = this.generation;
    this.error.set('');
    try {
      const value = await scanQrImage(file);
      if (generation !== this.generation) return;
      this.close();
      this.scanned.emit(value);
    } catch (error) {
      if (generation === this.generation)
        this.toast.error(error instanceof Error ? error.message : 'No QR code found.');
    }
  }

  close(): void {
    this.stop();
    this.dialog().nativeElement.close();
  }

  stop(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.active.set(false);
    const video = this.video()?.nativeElement;
    if (video) video.srcObject = null;
  }
}
