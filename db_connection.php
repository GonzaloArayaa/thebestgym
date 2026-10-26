<?php

date_default_timezone_set('America/Argentina/Buenos_Aires');

/**
 * Lee una variable de entorno; si no existe o está vacía devuelve $default.
 * La conexión se configura con DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASS
 * (ver .env.example). Los valores por defecto son los de un XAMPP local.
 */
function envOr($key, $default) {
    $value = getenv($key);
    return ($value === false || $value === '') ? $default : $value;
}

define('DB_HOST', envOr('DB_HOST', 'localhost'));
define('DB_USER', envOr('DB_USER', 'root'));
define('DB_PASS', envOr('DB_PASS', ''));
define('DB_NAME', envOr('DB_NAME', 'thebestgym'));
define('DB_PORT', (int) envOr('DB_PORT', 3307));

// Orígenes externos autorizados a consumir la API (separados por coma).
// Por defecto ninguno: el frontend se sirve desde el mismo origen que la API.
define('ALLOWED_ORIGINS', envOr('ALLOWED_ORIGINS', ''));

const ROLES_STAFF = ['Administrador', 'Recepcionista'];

function getDB() {
    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        return $pdo;
    } catch (PDOException $e) {
        // El detalle va al log del servidor, nunca al cliente.
        error_log('Fallo de conexión a MySQL: ' . $e->getMessage());
        jsonResponse(['success' => false, 'message' => 'No se pudo conectar con la base de datos'], 500);
    }
}

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/** Texto plano seguro para guardar: sin etiquetas y con entidades escapadas. */
function sanitize($data) {
    return htmlspecialchars(strip_tags(trim((string) $data)));
}

/** Como sanitize(), pero devuelve null si el valor está vacío o ausente (columnas NULL / DATE). */
function sanitizeOrNull($data) {
    if ($data === null) {
        return null;
    }
    $value = sanitize($data);
    return $value === '' ? null : $value;
}

/** Valida una fecha Y-m-d real. */
function esFechaValida($fecha) {
    $d = DateTime::createFromFormat('Y-m-d', (string) $fecha);
    return $d && $d->format('Y-m-d') === $fecha;
}

function handleDbError($e) {
    error_log('DB Error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Error interno del servidor'], 500);
}

/** Lee el body JSON; devuelve [] si no es JSON válido. */
function readJsonInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

// ---------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------
if (session_status() == PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']),
    ]);
    session_start();
}

/**
 * Cabeceras comunes de las APIs y manejo de CORS/preflight.
 * Solo se permiten orígenes listados en ALLOWED_ORIGINS.
 */
function initApi() {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $permitidos = array_filter(array_map('trim', explode(',', ALLOWED_ORIGINS)));
        if (in_array($origin, $permitidos, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type');
            header('Vary: Origin');
        }
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/**
 * Devuelve el usuario autenticado (datos frescos de la base: rol, estado,
 * socio e instructor vinculados) o responde 401 / 403.
 * $roles: lista de roles permitidos; vacía = cualquier usuario autenticado.
 */
function requireAuth($db, array $roles = []) {
    static $actual = null;

    if ($actual === null) {
        $userId = (int) ($_SESSION['user_id'] ?? 0);
        if ($userId <= 0) {
            jsonResponse(['success' => false, 'message' => 'Sesión no iniciada'], 401);
        }

        $stmt = $db->prepare("
            SELECT u.id, u.username, u.nombre, u.rol, u.socio_id, u.activo, i.id AS instructor_id
            FROM usuarios u
            LEFT JOIN instructores i ON i.usuario_id = u.id AND i.activo = 1
            WHERE u.id = ?
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || !$user['activo']) {
            $_SESSION = [];
            session_destroy();
            jsonResponse(['success' => false, 'message' => 'Sesión no válida'], 401);
        }
        $actual = $user;
    }

    if ($roles && !in_array($actual['rol'], $roles, true)) {
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    return $actual;
}

/** Usuario con rol de recepción o administración. */
function esStaff(array $user) {
    return in_array($user['rol'], ROLES_STAFF, true);
}
