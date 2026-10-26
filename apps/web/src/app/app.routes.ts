import { type Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'others/rules',
    loadComponent: () => import('./features/about/about').then((module) => module.About),
  },
  {
    path: 'others',
    loadComponent: () => import('./features/others/others').then((module) => module.Others),
  },
  {
    path: 'others/:section',
    loadComponent: () => import('./features/others/others').then((module) => module.Others),
  },
  {
    path: 'records/player/:name',
    loadComponent: () =>
      import('./features/records/player-profile/player-profile').then(
        (module) => module.PlayerProfile,
      ),
  },
  {
    path: 'records/:id',
    loadComponent: () =>
      import('./features/records/record-result/record-result').then(
        (module) => module.RecordResult,
      ),
  },
  {
    path: 'records',
    loadComponent: () => import('./features/records/records').then((module) => module.Records),
  },
  {
    path: '',
    loadComponent: () => import('./features/matches/home/home').then((module) => module.Home),
  },
  {
    path: 'score',
    loadComponent: () => import('./features/scoring/scorer/scorer').then((module) => module.Scorer),
  },
  {
    path: 'score/:id',
    loadComponent: () =>
      import('./features/scoring/game-table/game-table').then((module) => module.GameTable),
  },
  {
    path: 'about',
    redirectTo: 'others/rules',
    pathMatch: 'full',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((module) => module.Settings),
  },
  { path: '**', redirectTo: '' },
];
