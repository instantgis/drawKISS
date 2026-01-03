import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss'
})
export class HelpComponent {
  private supabase = inject(SupabaseService);

  isLoggedIn = () => this.supabase.session() !== null;
}

