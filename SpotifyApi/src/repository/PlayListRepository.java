package repository;

import models.Cancion;
import models.Respuesta;
import java.util.List;

/**
 * Interfaz que define las operaciones de persistencia para la Playlist. Permite
 * aplicar polimorfismo para cambiar de tecnología de almacenamiento fácilmente.
 */
public interface PlayListRepository {

    List<Cancion> obtenerCanciones();

    Respuesta<Cancion> agregarCancion(String titulo, String url);

    Respuesta<Void> eliminarCancion(String titulo);
}
