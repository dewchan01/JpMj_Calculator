import { ErrorHandler, Injectable, inject } from '@angular/core';
import { DiagnosticLog } from './diagnostic-log';

@Injectable()
export class DiagnosticErrorHandler implements ErrorHandler {
  private readonly logs = inject(DiagnosticLog);
  handleError(error: unknown): void {
    this.logs.runtimeError(error);
  }
}
