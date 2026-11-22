import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';

import { audioSrcSeguro } from '../../core/audio-src';
import { PlaylistStore } from '../../core/playlist-store';

@Component({
  selector: 'app-player-bar',
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.scss',
})
export class PlayerBar {
  protected readonly store = inject(PlaylistStore);
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');

  /** Escaped exactly once, only here (API.md §6). */
  protected readonly src = computed(() => {
    const cancion = this.store.actual();
    return cancion === null ? '' : audioSrcSeguro(cancion.url);
  });

  private readonly soporteFlac = document.createElement('audio').canPlayType('audio/flac');

  protected readonly progresoPct = computed(() => {
    const duracion = this.store.duracion();
    if (duracion <= 0) return '0%';
    const porcentaje = Math.min(100, Math.max(0, (this.store.progreso() / duracion) * 100));
    return `${porcentaje.toFixed(2)}%`;
  });

  protected readonly volumenPct = computed(() => Math.round(this.store.volumen() * 100));

  protected readonly nombreArchivo = computed(() => {
    const cancion = this.store.actual();
    if (cancion === null) return '';
    const partes = cancion.url.split(/[\\/]/);
    return partes[partes.length - 1] ?? cancion.url;
  });

  protected readonly avisoFlac = computed(() => {
    const cancion = this.store.actual();
    if (cancion === null || this.soporteFlac !== '') return '';
    const esFlac = /\.flac(\?|#|$)/i.test(cancion.url);
    return esFlac ? 'Este navegador no declara soporte para FLAC; igual intentaremos reproducirlo.' : '';
  });

  constructor() {
    // The store owns the intent; this effect owns the element: it sets `src`
    // and starts playback in the same pass, so no aborted load can leave the
    // track selected but silent.
    effect(() => {
      const elemento = this.audio()?.nativeElement;
      if (elemento === undefined) return;

      elemento.volume = this.store.volumen();

      const src = this.src();
      if (src === '') {
        if (elemento.hasAttribute('src')) {
          elemento.pause();
          elemento.removeAttribute('src');
          elemento.load();
        }
        return;
      }

      if (elemento.getAttribute('src') !== src) {
        elemento.src = src;
        elemento.load();
      }

      if (this.store.reproduciendo()) {
        if (elemento.paused) this.intentarReproducir(elemento);
      } else if (!elemento.paused) {
        elemento.pause();
      }
    });
  }

  protected alTiempo(evento: Event): void {
    this.store.progreso.set((evento.target as HTMLAudioElement).currentTime);
  }

  protected alCargarMetadatos(evento: Event): void {
    const duracion = (evento.target as HTMLAudioElement).duration;
    this.store.duracion.set(Number.isFinite(duracion) ? duracion : 0);
  }

  protected alTerminar(): void {
    this.store.siguiente();
  }

  protected alFallar(): void {
    const elemento = this.audio()?.nativeElement;
    if (elemento === undefined || this.store.actual() === null || this.src() === '') return;

    // MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED === 4
    this.store.registrarErrorAudio(
      elemento.error?.code === 4
        ? 'El navegador no puede decodificar este archivo (¿FLAC sin soporte?).'
        : 'No se pudo cargar el audio. Verificá el archivo en public/audio y el escapado de la ruta.',
    );
  }

  protected alBuscar(evento: Event): void {
    const elemento = this.audio()?.nativeElement;
    if (elemento === undefined) return;

    const valor = Number((evento.target as HTMLInputElement).value);
    if (!Number.isFinite(valor)) return;

    elemento.currentTime = valor;
    this.store.progreso.set(valor);
  }

  protected alCambiarVolumen(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    if (!Number.isFinite(valor)) return;
    this.store.fijarVolumen(valor / 100);
  }

  protected formatearTiempo(segundos: number): string {
    if (!Number.isFinite(segundos) || segundos < 0) return '0:00';
    const total = Math.floor(segundos);
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return `${minutos}:${resto.toString().padStart(2, '0')}`;
  }

  private intentarReproducir(elemento: HTMLAudioElement): void {
    const intento = elemento.play();
    if (intento === undefined) return;

    intento.catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.store.reproduciendo.set(false);
        this.store.avisar('info', 'El navegador bloqueó la reproducción automática. Apretá play para continuar.');
        return;
      }
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.store.registrarErrorAudio();
    });
  }
}
