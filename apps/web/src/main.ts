import { isDevMode, ErrorHandler } from '@angular/core';
import { DiagnosticErrorHandler } from './app/core/diagnostic-error-handler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app/app';
import { appRouter } from './app/app-router';
import { registerLocaleData } from '@angular/common';
import zhHant from '@angular/common/locales/zh-Hant';
import zhHantExtra from '@angular/common/locales/extra/zh-Hant';
import zhHans from '@angular/common/locales/zh-Hans';
import zhHansExtra from '@angular/common/locales/extra/zh-Hans';
import ja from '@angular/common/locales/ja';
import jaExtra from '@angular/common/locales/extra/ja';
registerLocaleData(ja, 'ja', jaExtra);
registerLocaleData(zhHans, 'zh-CN', zhHansExtra);
registerLocaleData(zhHant, 'zh-TW', zhHantExtra);
bootstrapApplication(App, {
  providers: [
    { provide: ErrorHandler, useClass: DiagnosticErrorHandler },
    appRouter,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
}).catch((e: unknown) => console.error(e));
