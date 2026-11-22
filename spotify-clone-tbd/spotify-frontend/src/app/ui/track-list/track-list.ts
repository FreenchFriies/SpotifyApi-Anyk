import { Component, inject, signal } from '@angular/core';

import { extensionAudio } from '../../core/audio-src';
import { Cancion } from '../../core/models';
import { PlaylistStore } from '../../core/playlist-store';

@Component({
  selector: 'app-track-list',
  templateUrl: './track-list.html',
  styleUrl: './track-list.scss',
})
export class TrackList {
  protected readonly store = inject(PlaylistStore);
  protected readonly confirmando = signal<string | null>(null);
  protected readonly esqueletos = [1, 2, 3, 4];

  protected dosDigitos(valor: number): string {
    return valor.toString().padStart(2, '0');
  }

  protected extension(cancion: Cancion): string {
    return extensionAudio(cancion.url);
  }

  protected esActivo(cancion: Cancion): boolean {
    return this.store.actualId() === cancion.id;
  }

  protected pedirConfirmacion(cancion: Cancion): void {
    this.confirmando.set(cancion.titulo);
  }

  protected cancelar(): void {
    this.confirmando.set(null);
  }

  protected eliminar(cancion: Cancion): void {
    this.confirmando.set(null);
    this.store.eliminar(cancion);
  }
}
