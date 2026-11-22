package api;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import models.Cancion;
import models.Respuesta;
import repository.PlayListRepository;
import repository.PlayListSQL;
import repository.PlayListArchivoDat;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Servidor HTTP nativo para exponer la API de la Playlist. Permite cambiar
 * usando la arquitectura por capas.
 *
 * @author jairdiaz
 */
public class ServidorApi {

    public static void main(String[] args) throws IOException {
        int puerto = 8080;

        // Puerto opcional por argumento (por ejemplo: `ant run -Dargs=8099` o
        // `java ... api.ServidorApi 8099`). Sin argumentos se mantiene el 8080,
        // que es el que espera el frontend Angular.
        if (args.length > 0) {
            try {
                puerto = Integer.parseInt(args[0].trim());
            } catch (NumberFormatException e) {
                System.err.println("Puerto inválido: " + args[0] + ". Se usa 8080.");
            }
        }

        // AQUÍ ES DONDE LOS ALUMNOS PUEDEN USTEDER CAMBIAR EL MODO:
        // Opciones: "sqlite"  o  "file" o "oracle"
        String modo = "sqlite";

        PlayListRepository repo;
        if (modo.equalsIgnoreCase("sqlite")) {
            repo = new PlayListSQL();
            System.out.println("--> Usando modo: Base de Datos SQLite");
        } else {
            repo = new PlayListArchivoDat();
            System.out.println("--> Usando modo: Archivo Binario (.dat)");
        }

        // Creamos el servidor HTTP escuchando en el puerto indicado
        HttpServer servidor = HttpServer.create(new InetSocketAddress(puerto), 0);

        // Mapeamos la ruta "/canciones"
        servidor.createContext("/canciones", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String metodo = exchange.getRequestMethod();
                String respuestaJson = "";
                int codigoStatus = 200;

                // Cabeceras CORS antes de cualquier rama, para que también viajen en los errores.
                aplicarCors(exchange);

                // El navegador manda OPTIONS como preflight: 204 sin cuerpo y se corta aquí.
                if ("OPTIONS".equalsIgnoreCase(metodo)) {
                    responderSinCuerpo(exchange);
                    return;
                }

                // Indicamos que respondemos en formato JSON con codificación UTF-8
                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");

                // Manejo según el Verbo HTTP
                if ("GET".equalsIgnoreCase(metodo)) {
                    // Obtener todas las canciones
                    List<Cancion> canciones = repo.obtenerCanciones();
                    respuestaJson = convertirListaAJson(canciones);

                } else if ("POST".equalsIgnoreCase(metodo)) {
                    // Agregar una canción mediante Parámetros URL (ej: /canciones?titulo=Rock&url=http...)
                    // getRawQuery() devuelve la query SIN decodificar; getQuery() ya la decodifica
                    // y decodificarla otra vez corrompe los valores.
                    String query = exchange.getRequestURI().getRawQuery();
                    String titulo = obtenerParametro(query, "titulo");
                    String url = obtenerParametro(query, "url");

                    if (titulo != null && url != null) {
                        Respuesta<Cancion> res = repo.agregarCancion(titulo, url);
                        respuestaJson = convertirRespuestaAJson(res);
                        codigoStatus = res.isOk() ? 201 : 400;
                    } else {
                        respuestaJson = "{\"ok\":false, \"mensaje\":\"Faltan parámetros obligatorios (titulo y url)\"}";
                        codigoStatus = 400;
                    }

                } else if ("DELETE".equalsIgnoreCase(metodo)) {
                    // Eliminar una canción por título (ej: /canciones?titulo=Rock)
                    String query = exchange.getRequestURI().getRawQuery();
                    String titulo = obtenerParametro(query, "titulo");

                    if (titulo != null) {
                        Respuesta<Void> res = repo.eliminarCancion(titulo);
                        respuestaJson = "{\"ok\":" + res.isOk() + ", \"mensaje\":\"" + escaparJson(res.getMensaje()) + "\"}";
                        codigoStatus = res.isOk() ? 200 : 404;
                    } else {
                        respuestaJson = "{\"ok\":false, \"mensaje\":\"Falta el parámetro 'titulo' para eliminar\"}";
                        codigoStatus = 400;
                    }

                } else {
                    codigoStatus = 405; // Método no permitido
                    respuestaJson = "{\"ok\":false, \"mensaje\":\"Método HTTP no soportado\"}";
                }

                // Enviar la respuesta HTTP al cliente (Postman, navegador, etc.)
                byte[] bytes = respuestaJson.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(codigoStatus, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });

        // Cualquier ruta fuera de /canciones responde 404 JSON, también con cabeceras CORS.
        servidor.createContext("/", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                aplicarCors(exchange);

                if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                    responderSinCuerpo(exchange);
                    return;
                }

                exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
                byte[] bytes = "{\"ok\":false, \"mensaje\":\"Ruta no encontrada\"}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(404, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });

        servidor.setExecutor(null); // Usar el ejecutor por defecto de Java
        servidor.start();
        System.out.println("API REST iniciada con éxito en: http://localhost:" + puerto + "/canciones");
    }

    /**
     * Centraliza las cabeceras CORS de desarrollo. El frontend corre en
     * http://localhost:4200 y la API en http://localhost:8080.
     */
    private static void aplicarCors(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    /**
     * Responde a un preflight con 204 No Content. En HttpExchange una respuesta
     * sin cuerpo se declara con longitud -1.
     */
    private static void responderSinCuerpo(HttpExchange exchange) throws IOException {
        exchange.sendResponseHeaders(204, -1);
        exchange.close();
    }

    // MÉTODOS AUXILIARES DE CONVERSIÓN A JSON (Sin librerías externas)

    /**
     * Escapa un texto para incrustarlo en un JSON construido a mano. Sin esto,
     * un título con comillas o barras invertidas produce JSON inválido y rompe
     * la respuesta completa de GET.
     */
    private static String escaparJson(String texto) {
        if (texto == null) {
            return "";
        }

        StringBuilder sb = new StringBuilder(texto.length() + 16);
        for (int i = 0; i < texto.length(); i++) {
            char c = texto.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    private static String convertirListaAJson(List<Cancion> lista) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < lista.size(); i++) {
            Cancion c = lista.get(i);
            sb.append("{")
                    .append("\"id\":").append(c.getId()).append(",")
                    .append("\"titulo\":\"").append(escaparJson(c.getTitulo())).append("\",")
                    .append("\"url\":\"").append(escaparJson(c.getUrl())).append("\",")
                    .append("\"reproduciendo\":").append(c.isReproduciendo())
                    .append("}");
            if (i < lista.size() - 1) {
                sb.append(",");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    private static String convertirRespuestaAJson(Respuesta<Cancion> res) {
        Cancion c = res.getData();
        String cJson = (c != null)
                ? "{\"id\":" + c.getId() + ",\"titulo\":\"" + escaparJson(c.getTitulo()) + "\",\"url\":\"" + escaparJson(c.getUrl()) + "\",\"reproduciendo\":" + c.isReproduciendo() + "}"
                : "null";

        return "{"
                + "\"ok\":" + res.isOk() + ","
                + "\"mensaje\":\"" + escaparJson(res.getMensaje()) + "\","
                + "\"data\":" + cJson
                + "}";
    }

    private static String obtenerParametro(String query, String param) {
        if (query == null) {
            return null;
        }
        for (String par : query.split("&")) {
            // Se divide solo en el primer '=': el valor puede contener '=' (por ejemplo una URL externa).
            int separador = par.indexOf('=');
            if (separador <= 0) {
                continue;
            }

            String clave = par.substring(0, separador);
            if (!clave.equalsIgnoreCase(param)) {
                continue;
            }

            String valor = par.substring(separador + 1);

            // Algunos clientes envían '+' literal en vez de %2B; se protege antes de
            // decodificar para no convertirlo en un espacio.
            try {
                return java.net.URLDecoder.decode(valor.replace("+", "%2B"), StandardCharsets.UTF_8);
            } catch (IllegalArgumentException e) {
                // Secuencia '%' mal formada: se devuelve el valor tal cual en lugar de romper.
                return valor;
            }
        }
        return null;
    }
}
