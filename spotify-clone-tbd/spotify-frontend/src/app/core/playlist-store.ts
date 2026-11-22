import { Injectable, computed, inject, signal } from '@angular/core';

import { CatalogoService } from './catalogo';
import { VOLUMEN_KEY } from './config';
import { mensajeDeError } from './errors';
import { AudioFile, Aviso, Cancion, EstadoCarga, TipoAviso } from './models';
import { PlaylistApi } from './playlist-api';

/**
 * Single source of truth for the library, the catalog and the client-side
 * playback state (the API always reports `reproduciendo: false`).
 */
@Injectable({ providedIn: 'root' })
export class PlaylistStore {
  private readonly api = inject(PlaylistApi);
  private readonly catalogoSvc = inject(CatalogoService);

  private avisoId = 0;
  private avisoTimer: ReturnType<typeof setTimeout> | undefined;

  readonly canciones = signal<Cancion[]>([]);
  readonly estado = signal<EstadoCarga>('inicial');
  readonly errorLista = signal('');
  readonly refrescando = signal(false);

  readonly enviando = signal(false);
  readonly eliminando = signal<string | null>(null);
  readonly aviso = signal<Aviso | null>(null);

  readonly catalogo = signal<AudioFile[]>([]);
  readonly catalogoEstado = signal<EstadoCarga>('inicial');
  readonly catalogoError = signal('');

  readonly actualId = signal<number | null>(null);
  readonly reproduciendo = signal(false);
  readonly progreso = signal(0);
  readonly duracion = signal(0);
  readonly errorAudio = signal('');
  readonly volumen = signal(this.leerVolumen());

  readonly total = computed(() => this.canciones().length);
  readonly cargando = computed(() => this.estado() === 'cargando');
  readonly apiViva = computed(() => this.estado() === 'listo');
  readonly actual = computed(() => {
    const id = this.actualId();
    return id === null ? null : (this.canciones().find((cancion) => cancion.id === id) ?? null);
  });
  readonly indiceActual = computed(() => {
    const id = this.actualId();
    return id === null ? -1 : this.canciones().findIndex((cancion) => cancion.id === id);
  });

  cargar(): void {
    if (this.estado() === 'cargando') return;

    const primeraCarga = this.estado() !== 'listo';
    this.errorLista.set('');
    if (primeraCarga) this.estado.set('cargando');
    else this.refrescando.set(true);

    this.api.listar().subscribe({
      next: (canciones) => {
        this.canciones.set(canciones);
        this.estado.set('listo');
        this.refrescando.set(false);
        this.sincronizarReproduccion();
      },
      error: (error: unknown) => {
        this.refrescando.set(false);
        if (this.canciones().length === 0) {
          this.estado.set('error');
          this.errorLista.set(mensajeDeError(error));
        } else {
          this.avisar('error', mensajeDeError(error));
        }
      },
    });
  }

  cargarCatalogo(): void {
    this.catalogoEstado.set('cargando');
    this.catalogoError.set('');

    this.catalogoSvc.leer().subscribe({
      next: (catalogo) => {
        this.catalogo.set(catalogo.files);
        if (catalogo.files.length === 0) {
          this.catalogoEstado.set('error');
          this.catalogoError.set(
            'El manifiesto existe pero no lista ningún audio. Regenerá public/audio/audio-files.json.',
          );
          return;
        }
        this.catalogoEstado.set('listo');
      },
      error: () => {
        this.catalogoEstado.set('error');
        this.catalogoError.set(
          'No se pudo leer /audio/audio-files.json. Copiá los audios a public/audio y regenerá el manifiesto.',
        );
      },
    });
  }

  agregar(titulo: string, url: string): void {
    if (this.enviando()) return;

    this.enviando.set(true);
    this.api.agregar(titulo.trim(), url.trim()).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.avisar(respuesta.ok ? 'ok' : 'error', respuesta.mensaje);
        if (respuesta.ok) this.cargar();
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.avisar('error', mensajeDeError(error));
      },
    });
  }

  eliminar(cancion: Cancion): void {
    if (this.eliminando() !== null) return;

    this.eliminando.set(cancion.titulo);
    this.api.eliminar(cancion.titulo).subscribe({
      next: (respuesta) => {
        this.eliminando.set(null);
        this.avisar(respuesta.ok ? 'ok' : 'error', respuesta.mensaje);
        if (!respuesta.ok) return;
        if (this.actual()?.titulo === cancion.titulo) this.reiniciarReproductor();
        this.cargar();
      },
      error: (error: unknown) => {
        this.eliminando.set(null);
        this.avisar('error', mensajeDeError(error));
      },
    });
  }

  contarTitulo(titulo: string): number {
    return this.canciones().filter((cancion) => cancion.titulo === titulo).length;
  }

  seleccionar(cancion: Cancion): void {
    if (this.actualId() === cancion.id) {
      this.reproduciendo.update((valor) => !valor);
      return;
    }

    this.actualId.set(cancion.id);
    this.progreso.set(0);
    this.duracion.set(0);
    this.errorAudio.set('');
    this.reproduciendo.set(true);
  }

  siguiente(): void {
    const lista = this.canciones();
    if (lista.length === 0) return;

    const indice = this.indiceActual();
    const destino = lista[(indice + 1) % lista.length];
    this.cambiarPista(destino);
  }

  anterior(): void {
    const lista = this.canciones();
    if (lista.length === 0) return;

    const indice = this.indiceActual();
    const destino = lista[(indice - 1 + lista.length) % lista.length];
    this.cambiarPista(destino);
  }

  alternar(): void {
    if (this.actual() === null) {
      const primera = this.canciones()[0];
      if (primera) this.seleccionar(primera);
      return;
    }
    this.reproduciendo.update((valor) => !valor);
  }

  fijarVolumen(valor: number): void {
    const volumen = Math.min(1, Math.max(0, valor));
    this.volumen.set(volumen);
    try {
      localStorage.setItem(VOLUMEN_KEY, String(volumen));
    } catch {
      // Storage can be blocked; the level still works for this session.
    }
  }

  registrarErrorAudio(detalle?: string): void {
    this.errorAudio.set(
      detalle ?? 'No se pudo reproducir el audio. Verificá que el archivo exista en public/audio.',
    );
  }

  limpiarAviso(): void {
    if (this.avisoTimer !== undefined) clearTimeout(this.avisoTimer);
    this.avisoTimer = undefined;
    this.aviso.set(null);
  }

  avisar(tipo: TipoAviso, texto: string): void {
    if (texto.trim() === '') return;

    this.limpiarAviso();
    this.aviso.set({ id: ++this.avisoId, tipo, texto });
    this.avisoTimer = setTimeout(() => this.aviso.set(null), tipo === 'error' ? 9000 : 5500);
  }

  private cambiarPista(destino: Cancion): void {
    this.actualId.set(destino.id);
    this.progreso.set(0);
    this.duracion.set(0);
    this.errorAudio.set('');
    this.reproduciendo.set(true);
  }

  private sincronizarReproduccion(): void {
    const id = this.actualId();
    if (id === null) return;
    if (this.canciones().some((cancion) => cancion.id === id)) return;
    this.reiniciarReproductor();
  }

  private reiniciarReproductor(): void {
    this.actualId.set(null);
    this.reproduciendo.set(false);
    this.progreso.set(0);
    this.duracion.set(0);
    this.errorAudio.set('');
  }

  private leerVolumen(): number {
    try {
      const crudo = localStorage.getItem(VOLUMEN_KEY);
      if (crudo === null) return 0.8;
      const valor = Number(crudo);
      return Number.isFinite(valor) && valor >= 0 && valor <= 1 ? valor : 0.8;
    } catch {
      return 0.8;
    }
  }
}
