import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  supabase = inject(SupabaseService);
  private router = inject(Router);
  private swUpdate = inject(SwUpdate);

  updateAvailable = signal(false);

  ngOnInit() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(event => {
        console.log('[SW] Version event:', event.type);
        if (event.type === 'VERSION_READY') {
          this.updateAvailable.set(true);
        }
      });

      // Also check for updates on init
      this.swUpdate.checkForUpdate().then(hasUpdate => {
        console.log('[SW] Check for update:', hasUpdate);
      });
    } else {
      console.log('[SW] Service worker not enabled');
    }
  }

  reloadApp() {
    document.location.reload();
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
