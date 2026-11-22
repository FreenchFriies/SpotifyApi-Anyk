package repository;

import java.util.ArrayList;
import java.util.List;
import models.Cancion;
import models.Respuesta;
import utils.FileManager;

/**
 *
 * @author jairdiaz
 */
public class PlayListArchivoDat implements PlayListRepository {

    private final String RUTA_ARCHIVO = "playlist.dat";

    @Override
    public List<Cancion> obtenerCanciones() {
        // Carga el objeto completo del archivo binario de un solo golpe
        Object obj = FileManager.carga(RUTA_ARCHIVO);
        if (obj == null) {
            return new ArrayList<>(); // Si el archivo no existe, retorna una lista vacía
        }
        return (List<Cancion>) obj; // Retorna la lista completa serializada
    }

    @Override
    public Respuesta<Cancion> agregarCancion(String titulo, String url) {
        // 1. Obtenemos toda la estructura actual en memoria
        List<Cancion> canciones = obtenerCanciones();

        // 2. Creamos y agregamos el elemento a la lista en memoria
        Cancion nuevaCancion = new Cancion(titulo, url);
        canciones.add(nuevaCancion);

        // 3. Guardamos TODO el objeto (la lista completa) de nuevo en el archivo .dat
        FileManager.guardar(RUTA_ARCHIVO, canciones);

        return new Respuesta<>(true, "Playlist  actualizada y guardada en el archivo .dat", nuevaCancion);
    }

    @Override
    public Respuesta<Void> eliminarCancion(String titulo) {
        // 1. Obtenemos toda la estructura actual
        List<Cancion> canciones = obtenerCanciones();

        // 2. Modificamos la estructura en memoria
        boolean removido = canciones.removeIf(c -> c.getTitulo().equalsIgnoreCase(titulo));

        if (removido) {
            // 3. Volvemos a persistir la estructura completa modificada
            FileManager.guardar(RUTA_ARCHIVO, canciones);
            return new Respuesta<>(true, "Canción eliminada y archivo .dat actualizado");
        }

        return new Respuesta<>(false, "No se encontró la canción en el archivo");
    }
}
