package repository;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import models.Cancion;
import models.Respuesta;

/**
 * Implementación de PlayListRepository usando una base de datos SQLite 3. Ideal
 * para enseñar JDBC y persistencia relacional.
 *
 * @author jairdiaz
 */
public class PlayListSQL implements PlayListRepository {

    // Ruta donde se creará el archivo de la base de datos SQLite localmente
    private final String URL_CONEXION = "jdbc:sqlite:playlist.db";

    public PlayListSQL() {
        // Al instanciar el repositorio, nos aseguramos de que la tabla exista
        crearTablaSiNoExiste();
    }

    /**
     * Método auxiliar para inicializar la estructura de la base de datos si no
     * existe.
     */
    private void crearTablaSiNoExiste() {
        String sql = "CREATE TABLE IF NOT EXISTS canciones ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "titulo TEXT NOT NULL, "
                + "url TEXT NOT NULL, "
                + "reproduciendo INTEGER NOT NULL)";

        try (Connection conn = DriverManager.getConnection(URL_CONEXION); Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        } catch (SQLException e) {
            System.err.println("Error al crear la tabla en SQLite: " + e.getMessage());
        }
    }

    @Override
    public List<Cancion> obtenerCanciones() {
        List<Cancion> lista = new ArrayList<>();
        String sql = "SELECT id, titulo, url, reproduciendo FROM canciones";

        try (Connection conn = DriverManager.getConnection(URL_CONEXION); Statement stmt = conn.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                int id = rs.getInt("id");
                String titulo = rs.getString("titulo");
                String url = rs.getString("url");
                boolean reproduciendo = rs.getInt("reproduciendo") == 1;

                // Creamos la canción usando el constructor que acepta el ID de la base de datos
                Cancion c = new Cancion(id, titulo, url, reproduciendo);
                lista.add(c);
            }
        } catch (SQLException e) {
            System.err.println("Error al consultar canciones en SQLite: " + e.getMessage());
        }
        return lista;
    }

    @Override
    public Respuesta<Cancion> agregarCancion(String titulo, String url) {
        String sql = "INSERT INTO canciones (titulo, url, reproduciendo) VALUES (?, ?, 0)";

        // Usamos Statement.RETURN_GENERATED_KEYS para recuperar el ID autoincrementable que asigna SQLite
        try (Connection conn = DriverManager.getConnection(URL_CONEXION); PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {

            pstmt.setString(1, titulo);
            pstmt.setString(2, url);
            pstmt.executeUpdate();

            // Recuperamos el ID generado por la BD
            ResultSet generatedKeys = pstmt.getGeneratedKeys();
            int idGenerado = 1;
            if (generatedKeys.next()) {
                idGenerado = generatedKeys.getInt(1);
            }

            Cancion nuevaCancion = new Cancion(idGenerado, titulo, url, false);
            return new Respuesta<>(true, "Canción guardada exitosamente en SQLite", nuevaCancion);

        } catch (SQLException e) {
            return new Respuesta<>(false, "Error al insertar en SQLite: " + e.getMessage());
        }
    }

    @Override
    public Respuesta<Void> eliminarCancion(String titulo) {
        String sql = "DELETE FROM canciones WHERE titulo = ?";

        // Forma limpia estándar con try-with-resources:
        try (Connection conn = DriverManager.getConnection(URL_CONEXION); PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, titulo);
            int filasAfectadas = pstmt.executeUpdate();

            if (filasAfectadas > 0) {
                return new Respuesta<>(true, "Canción eliminada de SQLite exitosamente");
            }
            return new Respuesta<>(false, "No se encontró la canción con ese título en la base de datos");

        } catch (SQLException e) {
            return new Respuesta<>(false, "Error al eliminar en SQLite: " + e.getMessage());
        }
    }
}
