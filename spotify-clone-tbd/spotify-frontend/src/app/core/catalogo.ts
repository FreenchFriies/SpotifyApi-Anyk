import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { CATALOGO_URL } from './config';
import { AudioFile, Catalogo } from './models';

/**
 * The browser cannot list a static folder, so `public/audio/audio-files.json`
 * is the only source of the catalog (API.md §7).
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  leer(): Observable<Catalogo> {
    return this.http.get<unknown>(CATALOGO_URL).pipe(map((crudo) => this.normalizar(crudo)));
  }

  private normalizar(crudo: unknown): Catalogo {
    if (crudo === null || typeof crudo !== 'object') {
      throw new Error('El manifiesto del catálogo no es un objeto JSON válido.');
    }

    const registro = crudo as Record<string, unknown>;
    const archivos = Array.isArray(registro['files']) ? registro['files'] : [];

    const files: AudioFile[] = archivos.flatMap((archivo) => {
      if (archivo === null || typeof archivo !== 'object') return [];
      const entrada = archivo as Record<string, unknown>;
      const name = entrada['name'];
      const path = entrada['path'];
      if (typeof name !== 'string' || typeof path !== 'string') return [];
      return [{ name, path }];
    });

    return {
      source: typeof registro['source'] === 'string' ? registro['source'] : 'desconocido',
      count: files.length,
      files,
    };
  }
}
