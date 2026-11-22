/** Shapes returned by the Java API (API.md §2, §3 and §8.1). */

export interface Cancion {
  id: number;
  titulo: string;
  url: string;
  /** Always `false` server-side: never use it as playback state (API.md §2). */
  reproduciendo: boolean;
}

/**
 * Wrapper of POST and DELETE responses.
 * `data` is optional on purpose: some branches do not include it (API.md §3.2, §3.3).
 */
export interface Respuesta<T> {
  ok: boolean;
  mensaje: string;
  data?: T | null;
}

/** One entry of `public/audio/audio-files.json` (API.md §7.5). */
export interface AudioFile {
  name: string;
  /** Logical path, unescaped. Escaped exactly once when building the audio `src`. */
  path: string;
}

export interface Catalogo {
  source: string;
  count: number;
  files: AudioFile[];
}

export type EstadoCarga = 'inicial' | 'cargando' | 'listo' | 'error';

export type TipoAviso = 'ok' | 'error' | 'info';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}
