import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

// GitHub Pages has no SPA fallback. Hash routes survive direct links and reloads.
export const appRouter = provideRouter(
  routes,
  withHashLocation(),
  withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
);
