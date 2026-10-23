<?php
/**
 * API para gestión de usuarios
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

// Configurar CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

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

/**
 * GET - Obtener usuarios o login
 */
function handleGet($db) {
    // Login
    if (isset($_GET['action']) && $_GET['action'] === 'login') {
        $username = sanitize($_GET['username'] ?? '');
        $password = sanitize($_GET['password'] ?? '');
        
        if (empty($username) || empty($password)) {
            jsonResponse(['success' => false, 'message' => 'Credenciales incompletas'], 400);
        }
        
        $stmt = $db->prepare("
            SELECT u.*, s.id as socio_id_real
            FROM usuarios u
            LEFT JOIN socios s ON u.socio_id = s.id
            WHERE u.username = ? AND u.activo = 1
        ");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password'])) {
            // Guardar en sesión
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['rol'] = $user['rol'];
            
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
        } else {
            jsonResponse(['success' => false, 'message' => 'Credenciales incorrectas'], 401);
        }
    }
    
    // Obtener todos los usuarios
    else if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->query("SELECT id, username, nombre, rol, activo FROM usuarios ORDER BY id");
        $usuarios = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => $usuarios
        ]);
    }
    
    // Obtener usuario por ID
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
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
 * POST - Crear nuevo usuario
 */
function handlePost($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $username = sanitize($input['username'] ?? '');
    $password = sanitize($input['password'] ?? '');
    $nombre = sanitize($input['nombre'] ?? '');
    $rol = sanitize($input['rol'] ?? '');
    $socio_id = isset($input['socio_id']) ? intval($input['socio_id']) : null;
    
    if (empty($username) || empty($password) || empty($nombre) || empty($rol)) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
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
 * PUT - Actualizar usuario
 */
function handlePut($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = intval($input['id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $password = sanitize($input['password'] ?? '');
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    // Si se proporciona contraseña, actualizarla también
    if (!empty($password)) {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE usuarios SET nombre = ?, password = ? WHERE id = ?");
        $result = $stmt->execute([$nombre, $passwordHash, $id]);
    } else {
        $stmt = $db->prepare("UPDATE usuarios SET nombre = ? WHERE id = ?");
        $result = $stmt->execute([$nombre, $id]);
    }
    
    if ($result) {
        jsonResponse(['success' => true, 'message' => 'Usuario actualizado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al actualizar usuario'], 500);
    }
}

/**
 * DELETE - Eliminar usuario (eliminación definitiva)
 */
function handleDelete($db) {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    // Eliminación definitiva de la base de datos
    $stmt = $db->prepare("DELETE FROM usuarios WHERE id = ?");
    
    if ($stmt->execute([$id])) {
        if ($stmt->rowCount() > 0) {
            jsonResponse(['success' => true, 'message' => 'Usuario eliminado exitosamente']);
        } else {
            jsonResponse(['success' => false, 'message' => 'Usuario no encontrado'], 404);
        }
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al eliminar usuario'], 500);
    }
}
?>
