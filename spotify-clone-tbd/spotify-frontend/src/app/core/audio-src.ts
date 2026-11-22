/**
 * Path encoding rules for the API (API.md §6).
 *
 * Golden rule: the database stores the logical path **unescaped**.
 * Escape it exactly once, and only when building the audio `src`.
 */

const ESQUEMA_EXTERNO = /^(https?:)?\/\//i;
const ESQUEMA_BINARIO = /^(data|blob):/i;

export function esUrlExterna(valor: string): boolean {
  const limpio = valor.trim();
  return ESQUEMA_EXTERNO.test(limpio) || ESQUEMA_BINARIO.test(limpio);
}

export function buildAudioSrc(valor: string): string {
  const limpio = valor.trim();
  if (limpio === '') throw new Error('La ruta del audio está vacía.');
  if (esUrlExterna(limpio)) return limpio;

  const segmentos = limpio.split('/');
  if (segmentos.includes('..')) throw new Error('La ruta no puede salir del directorio de audio.');

  return segmentos.map(encodeURIComponent).join('/');
}

/** Non-throwing variant for templates: returns `''` when the path cannot be used. */
export function audioSrcSeguro(valor: string): string {
  try {
    return buildAudioSrc(valor);
  } catch {
    return '';
  }
}

/** `%20` inside a stored path is literal text, not a space. Never decode it. */
export function extensionAudio(valor: string): string {
  const limpio = valor.trim().split(/[?#]/)[0];
  const punto = limpio.lastIndexOf('.');
  const extension = punto >= 0 ? limpio.slice(punto + 1).toUpperCase() : '';
  return /^(FLAC|MP3|OGG|WAV)$/.test(extension) ? extension : '';
}
