<?php
/**
 * API para gestión de planes
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

initApi();

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
    requireAuth($db);

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
    requireAuth($db, ['Administrador']);
    $input = readJsonInput();
    
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
    requireAuth($db, ['Administrador']);
    $input = readJsonInput();
    
    $id = intval($input['id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $duracion = intval($input['duracion'] ?? 0);
    $costo = floatval($input['costo'] ?? 0);
    $descripcion = sanitize($input['descripcion'] ?? '');
    
    if ($id <= 0 || empty($nombre) || $duracion <= 0 || $costo <= 0) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }
    
    $stmt = $db->prepare("SELECT nombre FROM planes WHERE id = ?");
    $stmt->execute([$id]);
    $planActual = $stmt->fetch();
    if (!$planActual) {
        jsonResponse(['success' => false, 'message' => 'Plan no encontrado'], 404);
    }

    $stmt = $db->prepare("SELECT id FROM planes WHERE nombre = ? AND id <> ?");
    $stmt->execute([$nombre, $id]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Ya existe un plan con ese nombre'], 409);
    }

    // Los socios guardan el plan por nombre: si se renombra hay que arrastrarlos
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("
            UPDATE planes 
            SET nombre = ?, duracion = ?, costo = ?, descripcion = ? 
            WHERE id = ?
        ");
        $stmt->execute([$nombre, $duracion, $costo, $descripcion, $id]);

        if ($planActual['nombre'] !== $nombre) {
            $stmt = $db->prepare("UPDATE socios SET plan = ? WHERE plan = ?");
            $stmt->execute([$nombre, $planActual['nombre']]);
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    jsonResponse(['success' => true, 'message' => 'Plan actualizado exitosamente']);
}

/**
 * DELETE - Desactivar plan (soft delete)
 */
function handleDelete($db) {
    requireAuth($db, ['Administrador']);
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
