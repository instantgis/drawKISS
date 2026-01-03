import { Routes, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

const authGuard = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (supabase.currentUser()) {
    return true;
  }
  // Preserve the originally requested URL so we can return after login
  return router.createUrlTree(['/login'], {
    queryParams: { redirectTo: state.url }
  });
};

// Redirect to gallery if logged in, otherwise to about
const homeRedirect = () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (supabase.currentUser()) {
    return router.parseUrl('/gallery');
  }
  return router.parseUrl('/about');
};

export const routes: Routes = [
  {
    path: '',
    canActivate: [homeRedirect],
    children: []
  },
	  {
	    path: 'debug/share',
	    loadComponent: () => import('./share/share-debug.component').then(m => m.ShareDebugComponent),
	    canActivate: [authGuard]
	  },
  {
    path: 'share',
    loadComponent: () => import('./share/share.component').then(m => m.ShareComponent),
    canActivate: [authGuard]
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
    path: 'progress/:imageId',
    loadComponent: () => import('./progress/progress-timeline.component').then(m => m.ProgressTimelineComponent),
    canActivate: [authGuard]
  },
  {
    path: 'progress/:imageId/capture',
    loadComponent: () => import('./progress/progress-capture.component').then(m => m.ProgressCaptureComponent),
    canActivate: [authGuard]
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'help',
    loadComponent: () => import('./help/help.component').then(m => m.HelpComponent)
  }
];
