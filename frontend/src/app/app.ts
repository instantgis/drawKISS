import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
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

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
