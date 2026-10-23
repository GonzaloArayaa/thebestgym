<?php
/**
 * API para gestión de instructores
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

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
 * GET - Obtener instructores
 */
function handleGet($db) {
    // Obtener todos los instructores
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->query("
            SELECT i.*, 
                   (SELECT COUNT(*) FROM clases_gym WHERE instructor_id = i.id AND activa = 1) as clases_asignadas
            FROM instructores i
            WHERE i.activo = 1
            ORDER BY i.nombre
        ");
        $instructores = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $instructores]);
    }
    
    // Obtener instructor por ID
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $stmt = $db->prepare("
            SELECT i.*, 
                   (SELECT COUNT(*) FROM clases_gym WHERE instructor_id = i.id AND activa = 1) as clases_asignadas
            FROM instructores i
            WHERE i.id = ?
        ");
        $stmt->execute([$id]);
        $instructor = $stmt->fetch();
        
        if ($instructor) {
            jsonResponse(['success' => true, 'data' => $instructor]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Instructor no encontrado'], 404);
        }
    }
    
    // Obtener instructor por usuario_id
    else if (isset($_GET['usuario_id'])) {
        $usuario_id = intval($_GET['usuario_id']);
        $stmt = $db->prepare("
            SELECT i.*, 
                   (SELECT COUNT(*) FROM clases_gym WHERE instructor_id = i.id AND activa = 1) as clases_asignadas
            FROM instructores i
            WHERE i.usuario_id = ?
        ");
        $stmt->execute([$usuario_id]);
        $instructor = $stmt->fetch();
        
        if ($instructor) {
            jsonResponse(['success' => true, 'data' => $instructor]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Instructor no encontrado'], 404);
        }
    }
    
    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Crear nuevo instructor
 */
function handlePost($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $usuario_id = intval($input['usuario_id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $especialidad = sanitize($input['especialidad'] ?? '');
    $email = sanitize($input['email'] ?? '');
    $telefono = sanitize($input['telefono'] ?? '');
    
    if ($usuario_id <= 0 || empty($nombre) || empty($email)) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }
    
    // Verificar que el usuario existe y es instructor
    $stmt = $db->prepare("SELECT id, rol FROM usuarios WHERE id = ?");
    $stmt->execute([$usuario_id]);
    $usuario = $stmt->fetch();
    
    if (!$usuario || $usuario['rol'] !== 'Instructor') {
        jsonResponse(['success' => false, 'message' => 'Usuario no válido como instructor'], 400);
    }
    
    $stmt = $db->prepare("
        INSERT INTO instructores (usuario_id, nombre, especialidad, email, telefono) 
        VALUES (?, ?, ?, ?, ?)
    ");
    
    if ($stmt->execute([$usuario_id, $nombre, $especialidad, $email, $telefono])) {
        jsonResponse([
            'success' => true,
            'message' => 'Instructor creado exitosamente',
            'data' => ['id' => $db->lastInsertId()]
        ], 201);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al crear instructor'], 500);
    }
}

/**
 * PUT - Actualizar instructor
 */
function handlePut($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = intval($input['id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $especialidad = sanitize($input['especialidad'] ?? '');
    $email = sanitize($input['email'] ?? '');
    $telefono = sanitize($input['telefono'] ?? '');
    
    if ($id <= 0 || empty($nombre) || empty($email)) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }
    
    $stmt = $db->prepare("
        UPDATE instructores 
        SET nombre = ?, especialidad = ?, email = ?, telefono = ? 
        WHERE id = ?
    ");
    
    if ($stmt->execute([$nombre, $especialidad, $email, $telefono, $id])) {
        jsonResponse(['success' => true, 'message' => 'Instructor actualizado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al actualizar instructor'], 500);
    }
}

/**
 * DELETE - Desactivar instructor (soft delete)
 */
function handleDelete($db) {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    // Soft delete: marcar como inactivo
    $stmt = $db->prepare("UPDATE instructores SET activo = 0 WHERE id = ?");
    
    if ($stmt->execute([$id])) {
        jsonResponse(['success' => true, 'message' => 'Instructor desactivado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al desactivar instructor'], 500);
    }
}
?>