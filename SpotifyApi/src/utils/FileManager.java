package utils;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;

public class FileManager {

    public static void guardar(String dir, Object arr) {
        try (FileOutputStream x = new FileOutputStream(dir); ObjectOutputStream archivo = new ObjectOutputStream(x)) {
            archivo.writeObject(arr);
        } catch (Exception ex) {
            System.err.println("Error al guardar: " + ex.getMessage());
            ex.printStackTrace();
        }
    }

    public static Object carga(String dir) {
        File f = new File(dir);
        if (!f.exists()) {
            return null; // Evita lanzar excepción en el primer arranque
        }
        try (FileInputStream x = new FileInputStream(f); ObjectInputStream archivo = new ObjectInputStream(x)) {
            return archivo.readObject();
        } catch (Exception ex) {
            System.err.println("Error al cargar: " + ex.getMessage());
            ex.printStackTrace();
            return null;
        }
    }
}
