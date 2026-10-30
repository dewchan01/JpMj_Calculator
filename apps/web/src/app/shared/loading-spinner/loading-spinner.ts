import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.html',
  styleUrl: './loading-spinner.css',
  host: { 'aria-hidden': 'true' },
})
export class LoadingSpinner {}
