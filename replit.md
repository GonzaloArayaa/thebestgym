# The Best Gym - Sistema de Gestión

Aplicación web de gestión de gimnasio: frontend en JavaScript vanilla (`index.html`, `js-*.js`, `styles.css`) y API en PHP (`api/*.php`) sobre MySQL.

## Requisitos
- PHP 8.1+ con PDO MySQL (por ejemplo XAMPP) y MySQL/MariaDB
- Composer (para PHPMailer)

## Instalación
1. Importar `sql/database_structure.sql` y luego `sql/database_data.sql` (datos de demostración).
2. `composer install` en la raíz (la carpeta `vendor/` no se versiona).
3. Definir las variables de entorno de `.env.example` (`DB_*`, `SMTP_*`). Conviene crear un usuario MySQL propio en lugar de `root`.
4. Servir la carpeta con Apache (el `.htaccess` bloquea `sql/`, `vendor/` y los archivos de configuración) o, solo para pruebas, con `php -S localhost:8000`.
5. Opcional, para tener datos de demostración al día: `sql/actualizar_datos.sql` (más socios, instructores, clases, pagos y asistencias, precios nuevos). Si tu base todavía tiene la tabla `clases`, ejecuta antes **una sola vez** `sql/migracion_unificar_turnos.sql`. Ambos son para MySQL y se ejecutan en cada PC, porque Git comparte los archivos pero no la base de datos:
   ```
   mysql -h127.0.0.1 -P3307 -uroot --default-character-set=utf8mb4 < sql/actualizar_datos.sql
   ```
   Crea las cuentas `demo_admin`, `demo_recep` y `demo_socio` (contraseña `Demo2026`). Si lo ejecutas varias veces no duplica datos.
6. Cambiar las contraseñas de las cuentas demo antes de usar el sistema con datos reales.

`server.py` solo sirve archivos estáticos y no ejecuta PHP, así que no sirve para correr la API.

## Seguridad
- Todas las APIs exigen sesión y validan el rol en el servidor (Administrador, Recepcionista, Instructor, Socio).
- El login es `POST api/usuarios.php` con `{action: "login", username, password}`; tiene límite de intentos fallidos.
- CORS cerrado por defecto; se habilita con `ALLOWED_ORIGINS`.
