import { Component, inject } from '@angular/core';

import { PlaylistStore } from './core/playlist-store';
import { AddPanel } from './ui/add-panel/add-panel';
import { PlayerBar } from './ui/player-bar/player-bar';
import { TrackList } from './ui/track-list/track-list';

@Component({
  selector: 'app-root',
  imports: [TrackList, AddPanel, PlayerBar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(PlaylistStore);

  constructor() {
    this.store.cargar();
    this.store.cargarCatalogo();
  }

  protected dosDigitos(valor: number): string {
    return valor.toString().padStart(2, '0');
  }
}
