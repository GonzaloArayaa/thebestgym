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
5. Cambiar las contraseñas de las cuentas demo (`admin_demo`, etc.) antes de usar el sistema.

`server.py` solo sirve archivos estáticos y no ejecuta PHP, así que no sirve para correr la API.

## Seguridad
- Todas las APIs exigen sesión y validan el rol en el servidor (Administrador, Recepcionista, Instructor, Socio).
- El login es `POST api/usuarios.php` con `{action: "login", username, password}`; tiene límite de intentos fallidos.
- CORS cerrado por defecto; se habilita con `ALLOWED_ORIGINS`.
