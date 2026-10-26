<?php
/**
 * API para gestión de usuarios y sesión
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

initApi();

const ROLES_VALIDOS = ['Administrador', 'Recepcionista', 'Socio', 'Instructor'];
const PASSWORD_MIN = 6;
const LOGIN_MAX_INTENTOS = 5;
const LOGIN_VENTANA_SEG = 900;

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

try {
    switch($method) {
        case 'GET':
            handleGet($db);
            break;
        case 'POST':
            handlePost($db);
            break;
        case 'PUT':
            handlePut($db);
            break;
        case 'DELETE':
            handleDelete($db);
            break;
        default:
            jsonResponse(['success' => false, 'message' => 'Método no permitido'], 405);
    }
} catch(Exception $e) {
    handleDbError($e);
}

/** Archivo donde se cuentan los intentos fallidos de login por IP + usuario. */
function loginThrottleFile($username) {
    $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . strtolower($username));
    return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tbg_login_' . $key;
}

function loginBloqueado($username) {
    $file = loginThrottleFile($username);
    if (!is_file($file)) {
        return false;
    }
    $intentos = array_filter(
        array_map('intval', file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []),
        fn($t) => $t > time() - LOGIN_VENTANA_SEG
    );
    return count($intentos) >= LOGIN_MAX_INTENTOS;
}

function registrarLoginFallido($username) {
    file_put_contents(loginThrottleFile($username), time() . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function limpiarLoginFallidos($username) {
    @unlink(loginThrottleFile($username));
}

/** POST action=login: valida credenciales e inicia la sesión. */
function handleLogin($db, $input) {
    $username = sanitize($input['username'] ?? '');
    // La contraseña no se sanitiza: se compara tal cual con el hash.
    $password = is_string($input['password'] ?? null) ? $input['password'] : '';

    if ($username === '' || $password === '') {
        jsonResponse(['success' => false, 'message' => 'Credenciales incompletas'], 400);
    }

    if (loginBloqueado($username)) {
        jsonResponse(['success' => false, 'message' => 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.'], 429);
    }

    $stmt = $db->prepare("
        SELECT id, username, password, nombre, rol, socio_id
        FROM usuarios
        WHERE username = ? AND activo = 1
    ");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        registrarLoginFallido($username);
        jsonResponse(['success' => false, 'message' => 'Credenciales incorrectas'], 401);
    }

    limpiarLoginFallidos($username);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];

    jsonResponse([
        'success' => true,
        'message' => 'Login exitoso',
        'data' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'nombre' => $user['nombre'],
            'rol' => $user['rol'],
            'socioId' => $user['socio_id']
        ]
    ]);
}

/**
 * GET - Obtener usuarios
 */
function handleGet($db) {
    $actual = requireAuth($db);

    // Sesión actual (permite restaurar el login tras recargar la página)
    if (isset($_GET['action']) && $_GET['action'] === 'me') {
        jsonResponse(['success' => true, 'data' => [
            'id' => $actual['id'],
            'username' => $actual['username'],
            'nombre' => $actual['nombre'],
            'rol' => $actual['rol'],
            'socioId' => $actual['socio_id']
        ]]);
    }

    // Obtener todos los usuarios: el administrador ve todos, el resto solo su propio usuario
    else if (isset($_GET['action']) && $_GET['action'] === 'all') {
        if ($actual['rol'] === 'Administrador') {
            $stmt = $db->query("SELECT id, username, nombre, rol, activo FROM usuarios ORDER BY id");
        } else {
            $stmt = $db->prepare("SELECT id, username, nombre, rol, activo FROM usuarios WHERE id = ?");
            $stmt->execute([$actual['id']]);
        }

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Obtener usuario por ID (administrador, o el propio usuario)
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        if ($actual['rol'] !== 'Administrador' && $id !== (int) $actual['id']) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("SELECT id, username, nombre, rol, socio_id, activo FROM usuarios WHERE id = ?");
        $stmt->execute([$id]);
        $usuario = $stmt->fetch();

        if ($usuario) {
            jsonResponse(['success' => true, 'data' => $usuario]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Usuario no encontrado'], 404);
        }
    }

    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Login, logout o crear nuevo usuario
 */
function handlePost($db) {
    $input = readJsonInput();
    $accion = $input['action'] ?? '';

    if ($accion === 'login') {
        handleLogin($db, $input);
    }

    if ($accion === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        jsonResponse(['success' => true, 'message' => 'Sesión cerrada']);
    }

    // Crear usuario: el administrador crea cualquier rol; la recepción solo cuentas de socio
    $actual = requireAuth($db, ROLES_STAFF);

    $username = sanitize($input['username'] ?? '');
    $password = is_string($input['password'] ?? null) ? $input['password'] : '';
    $nombre = sanitize($input['nombre'] ?? '');
    $rol = sanitize($input['rol'] ?? '');
    $socio_id = isset($input['socio_id']) && $input['socio_id'] !== '' ? intval($input['socio_id']) : null;

    if ($username === '' || $password === '' || $nombre === '' || $rol === '') {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }

    if (!in_array($rol, ROLES_VALIDOS, true)) {
        jsonResponse(['success' => false, 'message' => 'Rol no válido'], 400);
    }

    if ($actual['rol'] !== 'Administrador' && $rol !== 'Socio') {
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para crear usuarios con ese rol'], 403);
    }

    if (strlen($password) < PASSWORD_MIN) {
        jsonResponse(['success' => false, 'message' => 'La contraseña debe tener al menos ' . PASSWORD_MIN . ' caracteres'], 400);
    }

    // Verificar si el username ya existe
    $stmt = $db->prepare("SELECT id FROM usuarios WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'El nombre de usuario ya existe'], 409);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare("
        INSERT INTO usuarios (username, password, nombre, rol, socio_id)
        VALUES (?, ?, ?, ?, ?)
    ");

    if ($stmt->execute([$username, $passwordHash, $nombre, $rol, $socio_id])) {
        jsonResponse([
            'success' => true,
            'message' => 'Usuario creado exitosamente',
            'data' => ['id' => $db->lastInsertId()]
        ], 201);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al crear usuario'], 500);
    }
}

/**
 * PUT - Actualizar usuario (administrador, o el propio usuario)
 */
function handlePut($db) {
    $actual = requireAuth($db);
    $input = readJsonInput();

    $id = intval($input['id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $password = is_string($input['password'] ?? null) ? $input['password'] : '';

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    if ($actual['rol'] !== 'Administrador' && $id !== (int) $actual['id']) {
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    if ($password !== '' && strlen($password) < PASSWORD_MIN) {
        jsonResponse(['success' => false, 'message' => 'La contraseña debe tener al menos ' . PASSWORD_MIN . ' caracteres'], 400);
    }

    // Si no se envía nombre se conserva el actual
    $campos = [];
    $params = [];
    if ($nombre !== '') {
        $campos[] = 'nombre = ?';
        $params[] = $nombre;
    }
    if ($password !== '') {
        $campos[] = 'password = ?';
        $params[] = password_hash($password, PASSWORD_DEFAULT);
    }

    if (!$campos) {
        jsonResponse(['success' => false, 'message' => 'No hay datos para actualizar'], 400);
    }

    $params[] = $id;
    $stmt = $db->prepare('UPDATE usuarios SET ' . implode(', ', $campos) . ' WHERE id = ?');

    if ($stmt->execute($params)) {
        jsonResponse(['success' => true, 'message' => 'Usuario actualizado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al actualizar usuario'], 500);
    }
}

/**
 * DELETE - Eliminar usuario (solo administrador, eliminación definitiva)
 */
function handleDelete($db) {
    $actual = requireAuth($db, ['Administrador']);
    $id = intval($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    if ($id === (int) $actual['id']) {
        jsonResponse(['success' => false, 'message' => 'No puedes eliminar tu propio usuario'], 400);
    }

    // No dejar el sistema sin administradores activos
    $stmt = $db->prepare("SELECT rol FROM usuarios WHERE id = ?");
    $stmt->execute([$id]);
    $objetivo = $stmt->fetch();

    if (!$objetivo) {
        jsonResponse(['success' => false, 'message' => 'Usuario no encontrado'], 404);
    }

    if ($objetivo['rol'] === 'Administrador') {
        $total = $db->query("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'Administrador' AND activo = 1")->fetch()['n'];
        if ($total <= 1) {
            jsonResponse(['success' => false, 'message' => 'No se puede eliminar al último administrador'], 400);
        }
    }

    $stmt = $db->prepare("DELETE FROM usuarios WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['success' => true, 'message' => 'Usuario eliminado exitosamente']);
}
