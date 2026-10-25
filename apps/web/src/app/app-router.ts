import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appRouter = provideRouter(
  routes,
  withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
);
