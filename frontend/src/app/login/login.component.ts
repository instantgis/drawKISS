import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-container">
      <h1>drawKISS</h1>
      <form (ngSubmit)="submit()">
        <input
          type="email"
          [(ngModel)]="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          type="password"
          [(ngModel)]="password"
          name="password"
          placeholder="Password"
          required
        />
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button type="submit" [disabled]="loading()">
          {{ isSignUp() ? 'Sign Up' : 'Sign In' }}
        </button>
        <p class="toggle" (click)="toggleMode()">
          {{ isSignUp() ? 'Already have an account? Sign In' : 'Need an account? Sign Up' }}
        </p>
      </form>
    </div>
  `,
  styles: [`
    .login-container {
      max-width: 320px;
      margin: 60px auto;
      padding: 24px;
      text-align: center;
    }
    h1 {
      margin-bottom: 24px;
      font-size: 2rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    input {
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 1rem;
    }
    button {
      padding: 12px;
      background: #333;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
    }
    .error {
      color: #c00;
      font-size: 0.9rem;
    }
    .toggle {
      color: #666;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .toggle:hover {
      text-decoration: underline;
    }
  `]
})
export class LoginComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  email = '';
  password = '';
  isSignUp = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  toggleMode() {
    this.isSignUp.update(v => !v);
    this.error.set(null);
  }

  async submit() {
    this.loading.set(true);
    this.error.set(null);

    try {
      if (this.isSignUp()) {
        await this.supabase.signUp(this.email, this.password);
        // Auto-confirm is enabled, so sign in immediately after signup
        await this.supabase.signIn(this.email, this.password);
        this.router.navigate(['/gallery']);
      } else {
        await this.supabase.signIn(this.email, this.password);
        this.router.navigate(['/gallery']);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Auth failed');
    } finally {
      this.loading.set(false);
    }
  }
}

