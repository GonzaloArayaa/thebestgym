<?php
/**
 * API para gestión de planes
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
 * GET - Obtener planes
 */
function handleGet($db) {
    // Obtener todos los planes activos
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->query("
            SELECT * FROM planes 
            WHERE activo = 1 
            ORDER BY duracion
        ");
        $planes = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $planes]);
    }
    
    // Obtener plan por ID
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $stmt = $db->prepare("SELECT * FROM planes WHERE id = ?");
        $stmt->execute([$id]);
        $plan = $stmt->fetch();
        
        if ($plan) {
            jsonResponse(['success' => true, 'data' => $plan]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Plan no encontrado'], 404);
        }
    }
    
    // Obtener plan por nombre
    else if (isset($_GET['nombre'])) {
        $nombre = sanitize($_GET['nombre']);
        $stmt = $db->prepare("SELECT * FROM planes WHERE nombre = ? AND activo = 1");
        $stmt->execute([$nombre]);
        $plan = $stmt->fetch();
        
        if ($plan) {
            jsonResponse(['success' => true, 'data' => $plan]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Plan no encontrado'], 404);
        }
    }
    
    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Crear nuevo plan
 */
function handlePost($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $nombre = sanitize($input['nombre'] ?? '');
    $duracion = intval($input['duracion'] ?? 0);
    $costo = floatval($input['costo'] ?? 0);
    $descripcion = sanitize($input['descripcion'] ?? '');
    
    if (empty($nombre) || $duracion <= 0 || $costo <= 0) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }
    
    // Verificar si ya existe un plan con ese nombre
    $stmt = $db->prepare("SELECT id FROM planes WHERE nombre = ?");
    $stmt->execute([$nombre]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Ya existe un plan con ese nombre'], 409);
    }
    
    $stmt = $db->prepare("
        INSERT INTO planes (nombre, duracion, costo, descripcion) 
        VALUES (?, ?, ?, ?)
    ");
    
    if ($stmt->execute([$nombre, $duracion, $costo, $descripcion])) {
        jsonResponse([
            'success' => true,
            'message' => 'Plan creado exitosamente',
            'data' => ['id' => $db->lastInsertId()]
        ], 201);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al crear plan'], 500);
    }
}

/**
 * PUT - Actualizar plan
 */
function handlePut($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = intval($input['id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $duracion = intval($input['duracion'] ?? 0);
    $costo = floatval($input['costo'] ?? 0);
    $descripcion = sanitize($input['descripcion'] ?? '');
    
    if ($id <= 0 || empty($nombre) || $duracion <= 0 || $costo <= 0) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }
    
    $stmt = $db->prepare("
        UPDATE planes 
        SET nombre = ?, duracion = ?, costo = ?, descripcion = ? 
        WHERE id = ?
    ");
    
    if ($stmt->execute([$nombre, $duracion, $costo, $descripcion, $id])) {
        jsonResponse(['success' => true, 'message' => 'Plan actualizado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al actualizar plan'], 500);
    }
}

/**
 * DELETE - Desactivar plan (soft delete)
 */
function handleDelete($db) {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    // Soft delete: marcar como inactivo
    $stmt = $db->prepare("UPDATE planes SET activo = 0 WHERE id = ?");
    
    if ($stmt->execute([$id])) {
        jsonResponse(['success' => true, 'message' => 'Plan desactivado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al desactivar plan'], 500);
    }
}
?>