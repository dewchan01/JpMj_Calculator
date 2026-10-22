import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { registerLocaleData } from '@angular/common';
import zhHant from '@angular/common/locales/zh-Hant';
import zhHantExtra from '@angular/common/locales/extra/zh-Hant';
registerLocaleData(zhHant, 'zh-TW', zhHantExtra);
bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
}).catch((e: unknown) => console.error(e));
