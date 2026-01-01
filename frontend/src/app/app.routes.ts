import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'capture',
    pathMatch: 'full'
  },
  {
    path: 'capture',
    loadComponent: () => import('./capture/capture.component').then(m => m.CaptureComponent)
  },
  {
    path: 'easel',
    loadComponent: () => import('./easel/easel.component').then(m => m.EaselComponent)
  }
];
