import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  private supabase = inject(SupabaseService);

  isLoggedIn = () => this.supabase.session() !== null;
}

