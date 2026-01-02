import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';

const authGuard = () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (supabase.currentUser()) {
    return true;
  }
  return router.parseUrl('/login');
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'about',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'gallery',
    loadComponent: () => import('./gallery/gallery').then(m => m.Gallery),
    canActivate: [authGuard]
  },
  {
    path: 'capture',
    loadComponent: () => import('./capture/capture.component').then(m => m.CaptureComponent),
    canActivate: [authGuard]
  },
  {
    path: 'easel/:imageId',
    loadComponent: () => import('./easel/easel.component').then(m => m.EaselComponent),
    canActivate: [authGuard]
  },
  {
    path: 'edit/:imageId',
    loadComponent: () => import('./edit/edit.component').then(m => m.EditComponent),
    canActivate: [authGuard]
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent)
  }
];
