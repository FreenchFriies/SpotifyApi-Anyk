import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { CANCIONES_URL } from './config';
import { mensajeDeError } from './errors';
import { Cancion, Respuesta } from './models';

/**
 * Thin client over the Java API (API.md §8.2).
 *
 * Everything travels in the query string: `HttpParams` encodes with
 * `encodeURIComponent`, so spaces become `%20` and `%` becomes `%25` exactly
 * once, which is what the backend expects.
 */
@Injectable({ providedIn: 'root' })
export class PlaylistApi {
  private readonly http = inject(HttpClient);

  /** `GET /canciones` returns a bare array, no wrapper (API.md §3.1). */
  listar(): Observable<Cancion[]> {
    return this.http.get<Cancion[]>(CANCIONES_URL);
  }

  /** `POST /canciones?titulo=&url=` returns a wrapper with `data` when saved (API.md §3.2). */
  agregar(titulo: string, url: string): Observable<Respuesta<Cancion>> {
    const params = new HttpParams().set('titulo', titulo).set('url', url);
    return this.http
      .post<Respuesta<Cancion>>(CANCIONES_URL, null, { params })
      .pipe(catchError((error: unknown) => of(this.aRespuesta<Cancion>(error))));
  }

  /**
   * `DELETE /canciones?titulo=` deletes by **title**, never by id, and the
   * wrapper never carries `data` (API.md §3.3).
   */
  eliminar(titulo: string): Observable<Respuesta<null>> {
    const params = new HttpParams().set('titulo', titulo);
    return this.http
      .delete<Respuesta<null>>(CANCIONES_URL, { params })
      .pipe(catchError((error: unknown) => of(this.aRespuesta<null>(error))));
  }

  /** Server error branches share `{ ok: false, mensaje }`; keep that shape instead of throwing. */
  private aRespuesta<T>(error: unknown): Respuesta<T> {
    return { ok: false, mensaje: mensajeDeError(error) };
  }
}
