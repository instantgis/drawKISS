import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'gallery',
    pathMatch: 'full'
  },
  {
    path: 'gallery',
    loadComponent: () => import('./gallery/gallery').then(m => m.Gallery)
  },
  {
    path: 'capture',
    loadComponent: () => import('./capture/capture.component').then(m => m.CaptureComponent)
  },
  {
    path: 'easel/:imageId',
    loadComponent: () => import('./easel/easel.component').then(m => m.EaselComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent)
  }
];
