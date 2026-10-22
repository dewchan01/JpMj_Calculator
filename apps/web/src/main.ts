import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app/app';
import { appRouter } from './app/app-router';
import { registerLocaleData } from '@angular/common';
import zhHant from '@angular/common/locales/zh-Hant';
import zhHantExtra from '@angular/common/locales/extra/zh-Hant';
registerLocaleData(zhHant, 'zh-TW', zhHantExtra);
bootstrapApplication(App, {
  providers: [
    appRouter,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
}).catch((e: unknown) => console.error(e));
