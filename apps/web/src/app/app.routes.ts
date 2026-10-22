import { type Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/matches/home').then((module) => module.Home),
  },
  {
    path: 'score',
    loadComponent: () => import('./features/scoring/scorer').then((module) => module.Scorer),
  },
  {
    path: 'score/:id',
    loadComponent: () => import('./features/scoring/scorer').then((module) => module.Scorer),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about').then((module) => module.About),
  },
  { path: '**', redirectTo: '' },
];
