package models;

/**
 * @author jairdiaz
 * @param <T> Tipo de dato genérico que viaja dentro de la respuesta.
 */
public class Respuesta<T> {

    private boolean ok;
    private String mensaje;
    private T data;

    // Constructor completo (Estado, Mensaje y Datos)
    public Respuesta(boolean ok, String mensaje, T data) {
        this.ok = ok;
        this.mensaje = mensaje;
        this.data = data;
    }

    // Constructor sin datos (Ideal para cuando solo mandas un mensaje de éxito/error)
    public Respuesta(boolean ok, String mensaje) {
        this.ok = ok;
        this.mensaje = mensaje;
        this.data = null;
    }

    // Constructor básico (Solo el estatus booleano)
    public Respuesta(boolean ok) {
        this.ok = ok;
        this.mensaje = "";
        this.data = null;
    }

    // Getters con uso de this
    public boolean isOk() {
        return this.ok;
    }

    public String getMensaje() {
        return this.mensaje;
    }

    public T getData() {
        return this.data;
    }
}