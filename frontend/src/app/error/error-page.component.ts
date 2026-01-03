import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { GlobalErrorService } from './global-error.service';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './error-page.component.html',
  styleUrl: './error-page.component.scss'
})
export class ErrorPageComponent {
  errorService = inject(GlobalErrorService);

  reload() {
    this.errorService.clearError();
    window.location.reload();
  }

  dismiss() {
    this.errorService.clearError();
  }
}

