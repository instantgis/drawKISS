import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { SupabaseService } from './supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  supabase = inject(SupabaseService);
  private router = inject(Router);
  private swUpdate = inject(SwUpdate);

  updateAvailable = signal(false);

  constructor() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(event => {
        if (event.type === 'VERSION_READY') {
          this.updateAvailable.set(true);
        }
      });
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
