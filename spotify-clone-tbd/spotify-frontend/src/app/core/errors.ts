import { HttpErrorResponse } from '@angular/common/http';

import { API_BASE } from './config';

/**
 * Turns a transport failure into a message the UI can show verbatim.
 * Business errors (`ok: false`) already carry the server `mensaje` (API.md §8.4).
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return `No se pudo conectar con la API en ${API_BASE}. Verificá que el backend esté corriendo.`;
    }

    const cuerpo: unknown = error.error;
    if (cuerpo !== null && typeof cuerpo === 'object' && 'mensaje' in cuerpo) {
      const mensaje = (cuerpo as { mensaje?: unknown }).mensaje;
      if (typeof mensaje === 'string' && mensaje.trim() !== '') return mensaje;
    }

    return `La API respondió con un error ${error.status}.`;
  }

  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return 'Ocurrió un error inesperado.';
}
