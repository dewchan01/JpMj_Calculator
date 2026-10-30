import { Component, inject } from '@angular/core';
import { BackgroundMusic } from '../../core/sound/background-music';
import { AudioControls } from '../../core/sound/audio-controls';
import { TranslatePipe } from '../../core/i18n/i18n';
import { ErrorNotice } from '../error-notice/error-notice';

@Component({
  selector: 'app-music-settings',
  imports: [TranslatePipe, ErrorNotice],
  templateUrl: './music-settings.html',
  styleUrl: './music-settings.css',
})
export class MusicSettings {
  readonly music = inject(BackgroundMusic);
  readonly audio = inject(AudioControls);
}
