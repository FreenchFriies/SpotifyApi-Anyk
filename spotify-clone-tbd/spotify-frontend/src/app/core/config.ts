/** Backend Java (see API.md §1). No auth, no body: everything travels in the query string. */
export const API_BASE = 'http://localhost:8080';

/** Logical endpoint. The backend registers `/canciones` as a prefix context. */
export const CANCIONES_URL = `${API_BASE}/canciones`;

/** Static manifest generated from `public/audio/` (API.md §7). */
export const CATALOGO_URL = 'audio/audio-files.json';

/** localStorage key for the remembered volume level. */
export const VOLUMEN_KEY = 'neonwave.volumen';
