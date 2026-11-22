# API.md — Contrato completo de la API Java y guía para construir el frontend

Documento de referencia para cualquier agente o desarrollador que necesite **consumir esta API** o **construir un frontend desde cero** contra ella.

Todo lo que aparece aquí fue **capturado contra el servidor real en ejecución**. Nada es inferido ni copiado de un ejemplo inventado.

> Documentos relacionados:
> - `docs/API-CONTRACT.md` — auditoría técnica, historial de defectos encontrados y su estado.
> - `SPEC.md` — especificación del ejercicio.
> - `spotify-frontend/` — implementación de referencia en Angular 22.

---

## Ruta rápida

Si vienes a construir un frontend, esto es lo mínimo que necesitas saber:

1. **Backend en `http://localhost:8080`**, sin autenticación, sin body JSON: **todos los datos viajan en la query string**.
2. **Tres endpoints**: `GET /canciones`, `POST /canciones?titulo=&url=`, `DELETE /canciones?titulo=`.
3. **Ojo**: `GET` devuelve un **arreglo directo**; `POST` un **objeto envoltorio**; `DELETE` un envoltorio **sin `data`**. No son la misma forma.
4. **El audio se guarda como ruta lógica sin escapar** y se escapa **una sola vez** al reproducir.
5. **Obligatorio**: copia los audios a **`public/audio/`** y **genera `public/audio/audio-files.json`** desde los archivos reales. Sin el manifiesto el catálogo queda vacío. Ver [§7](#7-archivos-de-audio).
6. Verifica con la [checklist final](#checklist-para-validar-tu-frontend).

---

## 1. Arranque del backend

Clase principal: `api.ServidorApi`. Proyecto **Apache Ant**, no Maven ni Gradle.

```powershell
# Desde SpotifyApi/
& "C:\Program Files\NetBeans-25\netbeans\extide\ant\bin\ant.bat" run

# Equivalente sin Ant
java -cp "build\classes;lib\sqlite-jdbc-3.54.1.0.jar" api.ServidorApi

# Puerto alterno opcional (sin argumento usa 8080)
java -cp "build\classes;lib\sqlite-jdbc-3.54.1.0.jar" api.ServidorApi 8099
```

| Propiedad | Valor |
| --- | --- |
| Host | `localhost` (escucha en todas las interfaces) |
| Puerto por defecto | **8080** |
| Base path | **`/canciones`** |
| Autenticación | **ninguna** |
| `Content-Type` de todas las respuestas | `application/json; charset=UTF-8` |
| Persistencia | SQLite, archivo `playlist.db` |

> ⚠️ **La ruta de la BD es relativa al directorio de trabajo.** `jdbc:sqlite:playlist.db` significa: si arrancas el servidor desde otra carpeta, se usa **otra base** (posiblemente vacía). Arranca siempre desde la carpeta del proyecto.

> ⚠️ **Reinicia el proceso tras cambiar código Java.** Recompilar no recarga una JVM en marcha.

> 🎓 El modo de persistencia se elige en el código: `String modo = "sqlite";`. Con cualquier otro valor usa `PlayListArchivoDat` (`playlist.dat`). No hay configuración externa.

---

## 2. Modelo de datos

Tabla SQLite:

```sql
CREATE TABLE IF NOT EXISTS canciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo        TEXT NOT NULL,
  url           TEXT NOT NULL,
  reproduciendo INTEGER NOT NULL
);
```

JSON de una canción:

```json
{
  "id": 1,
  "titulo": "Por tu amor",
  "url": "/audio/Alacranes20-20Tu20(Duranguense).flac",
  "reproduciendo": false
}
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | `number` | Autoincremental, lo asigna SQLite. Úsalo como clave de lista. |
| `titulo` | `string` | Texto libre. **Sin validación de duplicados.** |
| `url` | `string` | Ruta lógica **sin escapar** o URL externa. Ver [§6](#6-codificación-de-rutas-y-parámetros). |
| `reproduciendo` | `boolean` | **Siempre `false`.** El `INSERT` escribe `0` fijo. No lo uses como estado; gestiona la reproducción en el cliente. |

---

## 3. Endpoints

Todos los parámetros viajan en la **query string**. El servidor **no lee el cuerpo** de la petición: enviar un JSON en el body no hace nada.

### 3.1 `GET /canciones`

Devuelve **un arreglo JSON directo**, sin envoltorio.

**Respuesta 200:**

```json
[{"id":1,"titulo":"Por tu amor","url":"/audio/Alacranes20-20Tu20(Duranguense).flac","reproduciendo":false}]
```

Lista vacía → `200` con cuerpo `[]`.

| Caso | Status | Cuerpo |
| --- | --- | --- |
| Hay canciones | 200 | `Cancion[]` |
| No hay canciones | 200 | `[]` |

---

### 3.2 `POST /canciones?titulo=<texto>&url=<texto>`

| Parámetro | Obligatorio | Descripción |
| --- | --- | --- |
| `titulo` | **sí** | Nombre de la canción |
| `url` | **sí** | Ruta lógica (`/audio/x.flac`) o URL externa (`https://...`) |

**Respuesta 201 (éxito):**

```json
{"ok":true,"mensaje":"Canción guardada exitosamente en SQLite","data":{"id":4,"titulo":"Nueva","url":"/audio/J20-20AM.flac","reproduciendo":false}}
```

**Respuesta 400 (faltan parámetros):**

```json
{"ok":false, "mensaje":"Faltan parámetros obligatorios (titulo y url)"}
```

**Respuesta 400 (error de SQLite):**

```json
{"ok":false,"mensaje":"Error al insertar en SQLite: ...","data":null}
```

| Caso | Status | ¿Trae `data`? |
| --- | --- | --- |
| Guardada | **201** | Sí, la canción creada con su `id` |
| Falta `titulo` o `url` | **400** | **No** (la propiedad no existe) |
| Error de base de datos | **400** | Sí, `null` |

> ⚠️ Las dos ramas de `400` **no tienen la misma forma**. Trata `data` como opcional en tu modelo.

> ⚠️ **No hay deduplicación ni restricción `UNIQUE`.** Dos `POST` con el mismo `titulo` crean dos filas con `id` distinto.

---

### 3.3 `DELETE /canciones?titulo=<texto>`

Elimina **por título**, no por `id`.

| Parámetro | Obligatorio | Descripción |
| --- | --- | --- |
| `titulo` | **sí** | Título exacto a eliminar |

**Respuesta 200:**

```json
{"ok":true, "mensaje":"Canción eliminada de SQLite exitosamente"}
```

**Respuesta 404:**

```json
{"ok":false, "mensaje":"No se encontró la canción con ese título en la base de datos"}
```

**Respuesta 400:**

```json
{"ok":false, "mensaje":"Falta el parámetro 'titulo' para eliminar"}
```

| Caso | Status | ¿Trae `data`? |
| --- | --- | --- |
| Eliminada | **200** | **No** |
| No existe | **404** | **No** |
| Falta `titulo` | **400** | **No** |

> ⚠️ **`DELETE` nunca devuelve `data`.** No esperes ese campo.

> ⚠️ El SQL es `DELETE FROM canciones WHERE titulo = ?`: **borra todas las filas con ese título**. Si hay duplicados, un solo `DELETE` se lleva todos.

> ⚠️ La comparación en SQLite es **sensible a mayúsculas**. `"Rock"` y `"rock"` son títulos distintos para `DELETE`.

---

### 3.4 `OPTIONS /canciones` — preflight CORS

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Sin cuerpo. Se responde **antes** de evaluar el método, así que nunca cae en el `405`.

---

### 3.5 Cualquier otro método → `405`

```json
{"ok":false, "mensaje":"Método HTTP no soportado"}
```

Aplica a `PUT`, `PATCH`, `HEAD`, `TRACE`, etc. **También lleva cabeceras CORS.**

---

### 3.6 Rutas fuera de `/canciones` → `404` JSON

```json
{"ok":false, "mensaje":"Ruta no encontrada"}
```

Con cabeceras CORS incluidas. Ya no devuelve el HTML por defecto del JDK.

> 🎓 `/canciones` se registró con `createContext`, que opera **por prefijo**: `/canciones/algo` entra al mismo handler y se comporta igual que `/canciones`. No existe endpoint de detalle por `id`.

---

## 4. Catálogo de errores

| Status | `mensaje` exacto | Cuándo |
| --- | --- | --- |
| 400 | `Faltan parámetros obligatorios (titulo y url)` | `POST` sin `titulo` o sin `url` |
| 400 | `Error al insertar en SQLite: <detalle>` | Fallo del driver al insertar |
| 400 | `Falta el parámetro 'titulo' para eliminar` | `DELETE` sin `titulo` |
| 404 | `No se encontró la canción con ese título en la base de datos` | `DELETE` de un título inexistente |
| 404 | `Ruta no encontrada` | Cualquier ruta fuera de `/canciones` |
| 405 | `Método HTTP no soportado` | Método distinto de `GET`/`POST`/`DELETE`/`OPTIONS` |

Forma común de los errores que **no** vienen del repositorio:

```json
{"ok":false, "mensaje":"..."}
```

> No confíes en el espaciado (unas ramas ponen un espacio tras la coma y otras no, y las de éxito no ponen ninguno). **Parsea siempre con un parser JSON real**, nunca con expresiones regulares.

---

## 5. CORS

Origen permitido: `*`. No hay cookies ni sesiones, así que `Access-Control-Allow-Origin: *` es válido.

Cabeceras presentes en **todas** las respuestas — éxito, error y rutas no encontradas:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Verificado en `200`, `201`, `204`, `400`, `404` y `405`.

**Implicación práctica:** el frontend puede correr en cualquier puerto (`4200`, `5173`, `3000`…) sin proxy. Si ves `No 'Access-Control-Allow-Origin' header is present`, el servidor en marcha **no tiene estos cambios**: reinícialo.

---

## 6. Codificación de rutas y parámetros

Esta es la parte donde más frontends se rompen. Léela completa.

### 6.1 Regla de oro de `url`

> **Guarda la ruta tal como es en disco, sin escapar. Escapa exactamente una vez, y solo al construir el `src` del audio.**

```text
guardado en la BD : /audio/AlejandraC320-20Por%20Favor.flac
src para el audio : /audio/AlejandraC320-20Por%2520Favor.flac
```

Los archivos de `resources/` contienen la secuencia **literal** `%20` en el nombre (no son espacios). **Nunca** decodifiques `%20` a un espacio: el archivo no existe con ese nombre.

### 6.2 Cómo lo codifica Angular (`HttpParams`)

Medido en Angular 22 sobre `request.urlWithParams`:

| Carácter | En la query |
| --- | --- |
| espacio | `%20` |
| `+` | `%2B` |
| `%` | `%25` |
| `&` | `%26` |
| `=` | `%3D` |
| `?` | `%3F` |
| `/` | `/` (literal) |

Ejemplo real:

```text
titulo=C%2B%2B%20%26%20Rock&url=%2Faudio%2FAlejandraC320-20Por%2520Favor.flac
```

### 6.3 Cómo decodifica el servidor

1. Lee la query **cruda** (`URI.getRawQuery()`), sin decodificar.
2. Divide por `&`.
3. Divide **solo en el primer `=`**, así un valor puede contener `=`.
4. Protege el `+` antes de decodificar (por si un cliente lo envía literal).
5. Decodifica **una sola vez** con `URLDecoder` y UTF-8. Si la secuencia `%` está mal formada, devuelve el valor tal cual en vez de romper.

### 6.4 Función de referencia (TypeScript)

```ts
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
```

Propiedades que **debe** cumplir cualquier implementación:

| Entrada | Salida |
| --- | --- |
| `/audio/J20-20AM.flac` | `/audio/J20-20AM.flac` |
| `/audio/Mi Tema.flac` | `/audio/Mi%20Tema.flac` |
| `/audio/Alacranes20-20Tu20(Duranguense).flac` | igual (paréntesis no se escapan) |
| `/audio/AlejandraC320-20Por%20Favor.flac` | `/audio/AlejandraC320-20Por%2520Favor.flac` |
| `https://ejemplo.com/a%20b.mp3?x=1` | igual (no se re-codifica) |
| `/audio/../../x.flac` | error (segmento `..`) |

---

## 7. Archivos de audio

> ### ⚠️ Requisito obligatorio del frontend
>
> **1.** Los archivos de audio (`.flac`, `.mp3`, `.ogg`…) deben copiarse a **`public/audio/`** dentro del proyecto del frontend.
> **2.** Debes **generar el manifiesto `public/audio/audio-files.json`** a partir de los archivos reales de esa carpeta.
>
> Sin esos dos pasos el reproductor **no funciona**: el navegador no puede enumerar una carpeta estática, así que el `public/audio/audio-files.json` es la **única** fuente del catálogo. Si falta o está desactualizado, el selector de archivos aparece vacío y no hay forma de agregar canciones del catálogo.

### 7.1 Paso 1 — copiar los audios a `public/audio/`

```text
resources/                      ← originales, NO se modifican ni se borran
spotify-frontend/public/audio/  ← destino: copias servidas por el dev server
```

```powershell
# Desde la raíz del proyecto del frontend
New-Item -ItemType Directory -Force -Path "public\audio" | Out-Null
Copy-Item "..\resources\*.flac" "public\audio\" -Force
```

> Usa **copia**, nunca `move` ni symlinks: los originales de `resources/` no se tocan.
>
> Los nombres se conservan **exactamente**, incluidos `%` literales y paréntesis. No los renombres ni los normalices.

### 7.2 Paso 2 — generar `public/audio/audio-files.json`

Se genera **enumerando los archivos reales**, nunca a mano:

```powershell
$dst = "public\audio"

$entries = Get-ChildItem $dst -File -Include *.flac,*.mp3,*.ogg,*.wav -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object { [pscustomobject]@{ name = $_.Name; path = "/audio/" + $_.Name } }

$manifest = [pscustomobject]@{ source = "resources"; count = @($entries).Count; files = @($entries) }

[System.IO.File]::WriteAllText(
  (Join-Path $dst "audio-files.json"),
  ($manifest | ConvertTo-Json -Depth 5),
  [System.Text.UTF8Encoding]::new($false)   # UTF-8 SIN BOM
)
```

> **Sin BOM.** El navegador hace `GET` del manifiesto y `JSON.parse`; un BOM inicial puede romper el parseo en algunos entornos. Usa `UTF8Encoding($false)`, no `Out-File` con la codificación por defecto.

**Script alternativo en Node:**

```js
import { readdirSync, writeFileSync } from 'node:fs';

const dir = 'public/audio';
const files = readdirSync(dir)
  .filter((f) => /\.(flac|mp3|ogg|wav)$/i.test(f))
  .sort()
  .map((name) => ({ name, path: `/audio/${name}` }));

writeFileSync(
  `${dir}/audio-files.json`,
  JSON.stringify({ source: 'resources', count: files.length, files }, null, 2),
  'utf8',
);
```

### 7.3 Verificación

```powershell
Get-ChildItem public\audio | Select-Object Name, Length
Get-Content public\audio\audio-files.json -Raw
```

Comprueba que:

- [ ] `public/audio/` contiene los audios **y** `audio-files.json`.
- [ ] `count` coincide con el número real de archivos de audio.
- [ ] Cada `path` empieza por `/audio/` y conserva el nombre **exacto** del archivo.
- [ ] `GET http://localhost:4200/audio/audio-files.json` devuelve `application/json` (no el `index.html` de la SPA).

> Si `GET /audio/audio-files.json` devuelve `text/html`, la ruta está mal o el archivo no existe (la SPA está haciendo fallback). Con Vite usa `public/`; con Angular usa `public/` o `src/assets/` según la configuración de `angular.json`.

### 7.4 Qué pasa si falta el manifiesto

| Situación | Síntoma visible |
| --- | --- |
| No existe `audio-files.json` | El desplegable del catálogo queda vacío |
| El manifiesto está desactualizado | Faltan canciones nuevas, o aparecen archivos borrados |
| `path` no coincide con el nombre real | El audio da `404` y suena el fallback / no carga |
| El manifiesto tiene BOM | `JSON.parse` falla y el catálogo queda vacío |

Un frontend robusto debe mostrar un mensaje explícito cuando el catálogo venga vacío, en lugar de un desplegable en blanco.

### 7.5 Formato del manifiesto

```json
{
  "source": "resources",
  "count": 7,
  "files": [
    { "name": "Alacranes20-20Tu20(Duranguense).flac", "path": "/audio/Alacranes20-20Tu20(Duranguense).flac" },
    { "name": "AlejandraC320-20Por%20Favor.flac", "path": "/audio/AlejandraC320-20Por%20Favor.flac" }
  ]
}
```

| Campo | Tipo | Significado |
| --- | --- | --- |
| `source` | `string` | Origen de los archivos (informativo) |
| `count` | `number` | Número de archivos |
| `files[].name` | `string` | Nombre del archivo con extensión, **exacto** |
| `files[].path` | `string` | Ruta **lógica sin escapar**, la misma que se envía a la API |

`path` se guarda **sin escapar** y se escapa una sola vez al construir el `src` del audio (ver [§6](#6-codificación-de-rutas-y-parámetros)).

### 7.6 Archivos disponibles

```text
Alacranes20-20Tu20(Duranguense).flac
AlejandraC320-20Por%20Favor.flac
Enjambre20Visita.flac
Gorillaz2620La20-20Good%20Inc.flac
J20-20AM.flac
Michael20-20Jean.flac
Sir20-20Close.flac
```

Caracteres: ASCII imprimible, **sin espacios y sin acentos**; contienen `%` literal y paréntesis.

### 7.7 Compatibilidad

**FLAC no está garantizado en todos los navegadores.** Consulta `audio.canPlayType('audio/flac')`, avisa al usuario si devuelve cadena vacía, e intenta reproducir igualmente. Si `play()` falla, muestra el motivo real (`NotAllowedError` = autoplay bloqueado).

No conviertas ni modifiques los originales.

---

## 8. Cliente de referencia (TypeScript)

### 8.1 Modelos

```ts
export interface Cancion {
  id: number;
  titulo: string;
  url: string;
  reproduciendo: boolean;
}

/** `data` es opcional a propósito: hay respuestas que no lo incluyen. */
export interface Respuesta<T> {
  ok: boolean;
  mensaje: string;
  data?: T | null;
}
```

> El mismo tipo cubre `POST` (con `data`) y `DELETE` (sin `data`). No crees un tipo que exija `data` siempre.

### 8.2 Servicio HTTP

```ts
const BASE = 'http://localhost:8080/canciones';

export const playlistApi = {
  listar: (): Promise<Cancion[]> => fetch(BASE).then((r) => r.json()),

  agregar: (titulo: string, url: string): Promise<Respuesta<Cancion>> => {
    const q = new URLSearchParams({ titulo, url });
    return fetch(`${BASE}?${q}`, { method: 'POST' }).then((r) => r.json());
  },

  eliminar: (titulo: string): Promise<Respuesta<null>> => {
    const q = new URLSearchParams({ titulo });
    return fetch(`${BASE}?${q}`, { method: 'DELETE' }).then((r) => r.json());
  },
};
```

> ⚠️ `URLSearchParams` codifica el espacio como `+`, no como `%20`. El backend lo tolera (protege el `+`), pero si quieres paridad exacta con Angular usa `encodeURIComponent` por valor, o usa `HttpParams` si trabajas en Angular.

### 8.3 Reglas de UI que la API impone

| Regla | Motivo |
| --- | --- |
| Lista con `track cancion.id` | `titulo` **no** es único |
| Borrar **por título**, nunca por `id` | El endpoint no acepta `id` |
| Confirmar antes de borrar | Un `DELETE` puede llevarse varias filas homónimas |
| Tras `POST`/`DELETE`, **volver a hacer `GET`** | No hay push ni websockets; la fuente de verdad es el servidor |
| No usar `reproduciendo` | Siempre llega `false` |
| Tratar `data` como opcional | Hay respuestas sin ese campo |
| Estado de reproducción en el cliente | La API no lo gestiona |

### 8.4 Estados que el frontend debe cubrir

| Estado | Cómo detectarlo | Qué mostrar |
| --- | --- | --- |
| Cargando | petición en vuelo | spinner |
| Error de red | `fetch` rechaza / `status 0` | mensaje + botón reintentar |
| Lista vacía | `GET` → `[]` | texto guía, no un error |
| Error de negocio | `ok: false` | `mensaje` del servidor, tal cual |
| Éxito | `ok: true` | `mensaje` del servidor |

> 🎓 Usa el `mensaje` que devuelve el servidor: ya viene en español y describe el caso real.

---

## 9. Trampas conocidas

Cada una está reproducida y documentada; no son teóricas.

| # | Trampa | Consecuencia |
| --- | --- | --- |
| 1 | `GET` devuelve arreglo, `POST` envoltorio, `DELETE` envoltorio sin `data` | Un modelo único mal tipado rompe en runtime |
| 2 | Decodificar `%20` a espacio | El archivo no se encuentra (cae al `index.html` de la SPA) |
| 3 | Escapar dos veces (`%2520` → `%252520`) | 404 del audio |
| 4 | Usar `id` para `DELETE` | El endpoint lo ignora: necesitas `titulo` |
| 5 | Asumir que `titulo` es único | Duplicados silenciosos; el borrado se lleva todos |
| 6 | Confiar en `reproduciendo` | Siempre `false` |
| 7 | Arrancar el backend desde otra carpeta | Se usa otra `playlist.db` |
| 8 | Cambiar Java sin reiniciar el proceso | Sigues hablando con el código viejo |
| 9 | Parsear JSON con regex por el espaciado irregular | Fallos esporádicos |
| 10 | Enviar los datos en el body | El servidor no lee el body: los ignora |

---

## 10. Lo que esta API **no** tiene

Para que no pierdas tiempo buscándolo:

- ❌ `GET /canciones/{id}` (detalle individual)
- ❌ `PUT` / `PATCH` (actualizar)
- ❌ body JSON (todo va en query string)
- ❌ autenticación, sesiones o tokens
- ❌ paginación, búsqueda o filtros
- ❌ validación de duplicados
- ❌ notificaciones en tiempo real
- ❌ subida de archivos de audio
- ❌ endpoint para listar los audios (por eso existe el manifiesto)

---

## Checklist para validar tu frontend

Cada punto se puede comprobar con la API real:

- [ ] `GET /canciones` devuelve `[]` o un arreglo, y lo renderizas sin envoltorio.
- [ ] Agregar una canción devuelve `201` y luego se ve en la lista tras recargar.
- [ ] El título con `&`, `+`, `%` o comillas se guarda **exacto** (compruébalo con `GET`).
- [ ] La ruta con `%20` literal se guarda como `%20` y suena/sirve como `%2520`.
- [ ] Eliminar usa `titulo`, no `id`.
- [ ] Un `DELETE` inexistente muestra el `mensaje` del `404`, no un error genérico.
- [ ] La lista vacía no se muestra como error.
- [ ] Con el backend apagado aparece un estado de error con reintento, no una pantalla en blanco.
- [ ] No dependes de `reproduciendo` para nada.
- [ ] Funciona desde un origen distinto al `8080` sin proxy (CORS).

---

## Apéndice: verificación rápida con `curl`

```powershell
# Listar
curl.exe -s http://localhost:8080/canciones

# Preflight (debe ser 204 y sin cuerpo)
curl.exe -s -i -X OPTIONS http://localhost:8080/canciones `
  -H "Origin: http://localhost:4200" `
  -H "Access-Control-Request-Method: POST"

# Crear
curl.exe -s -X POST "http://localhost:8080/canciones?titulo=Prueba&url=/audio/J20-20AM.flac"

# Eliminar por título
curl.exe -s -X DELETE "http://localhost:8080/canciones?titulo=Prueba"
```

> En PowerShell, `%XX` dentro de argumentos puede decodificarse antes de llegar al comando. Para pruebas de codificación byte a byte usa un cliente HTTP programático (Node, Python), no `curl.exe` desde PowerShell.
