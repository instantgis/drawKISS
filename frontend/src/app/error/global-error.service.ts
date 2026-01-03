import { Injectable, signal, ErrorHandler } from '@angular/core';

export interface AppError {
  message: string;
  stack?: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorService {
  /** Current unhandled error, null if none */
  currentError = signal<AppError | null>(null);

  /** Set an error to display */
  setError(error: unknown) {
    const appError: AppError = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date()
    };
    console.error('[GlobalError]', appError);
    this.currentError.set(appError);
  }

  /** Clear the current error */
  clearError() {
    this.currentError.set(null);
  }
}

/**
 * Custom ErrorHandler that catches all unhandled errors
 * and routes them to GlobalErrorService
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private errorService: GlobalErrorService) {}

  handleError(error: unknown): void {
    // Avoid infinite loops - don't re-handle if already handling
    if (this.errorService.currentError()) {
      console.error('[GlobalErrorHandler] Already handling an error, logging only:', error);
      return;
    }
    this.errorService.setError(error);
  }
}

