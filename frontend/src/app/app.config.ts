import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { GlobalErrorHandler, GlobalErrorService } from './error/global-error.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideServiceWorker('custom-sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately'
    }),
    GlobalErrorService,
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
