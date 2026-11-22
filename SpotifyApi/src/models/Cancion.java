package models;

import java.io.Serializable;

/**
 * @author jairdiaz
 */
public class Cancion implements Serializable {

    private static final long serialVersionUID = 1L;

    public static int contador = 1;
    private int id;
    private String titulo;
    private String url;
    private boolean reproduciendo;

    // Constructor cuando es una nueva canción (sin ID todavía)
    public Cancion(String titulo, String url) {
        this.id = contador++;
        this.titulo = titulo;
        this.url = url;
        this.reproduciendo = false;
    }

    public Cancion(int id, String titulo, String url, boolean reproduciendo) {
        this.id = id;
        this.titulo = titulo;
        this.url = url;
        this.reproduciendo = reproduciendo;
    }

    // Getters (Solo lectura, no hay Setters para proteger la inmutabilidad)
    public int getId() {
        return this.id;
    }

    public String getTitulo() {
        return this.titulo;
    }

    public String getUrl() {
        return this.url;
    }

    public boolean isReproduciendo() {
        return this.reproduciendo;
    }

    // Comportamientos de la canción
    public String reproducir() {
        this.reproduciendo = true;
        return this.url; // Retorna la URL para que el front la reproduzca
    }

    public void parar() {
        this.reproduciendo = false;
    }
}
