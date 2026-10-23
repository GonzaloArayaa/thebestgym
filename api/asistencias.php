<?php
/**
 * API para gestión de asistencias
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
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
 * GET - Obtener asistencias
 */
function handleGet($db) {
    // Obtener todas las asistencias con datos del socio
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->query("
            SELECT a.*, s.nombre, s.dni, s.plan, s.estado
            FROM asistencias a
            INNER JOIN socios s ON a.socio_id = s.id
            ORDER BY a.fecha DESC, a.hora DESC
            LIMIT 100
        ");
        $asistencias = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $asistencias]);
    }
    
    // Obtener asistencias de hoy
    else if (isset($_GET['action']) && $_GET['action'] === 'hoy') {
        $hoy = date('Y-m-d');
        $stmt = $db->prepare("
            SELECT a.*, s.nombre, s.dni
            FROM asistencias a
            INNER JOIN socios s ON a.socio_id = s.id
            WHERE a.fecha = ?
            ORDER BY a.hora DESC
        ");
        $stmt->execute([$hoy]);
        $asistencias = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $asistencias]);
    }
    
    // Obtener asistencias de un socio
    else if (isset($_GET['socio_id'])) {
        $socio_id = intval($_GET['socio_id']);
        $stmt = $db->prepare("
            SELECT * FROM asistencias 
            WHERE socio_id = ? 
            ORDER BY fecha DESC, hora DESC
            LIMIT 50
        ");
        $stmt->execute([$socio_id]);
        $asistencias = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $asistencias]);
    }
    
    // Obtener asistencias del mes de un socio
    else if (isset($_GET['socio_id_mes'])) {
        $socio_id = intval($_GET['socio_id_mes']);
        $mes_actual = date('Y-m');
        
        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM asistencias 
            WHERE socio_id = ? AND DATE_FORMAT(fecha, '%Y-%m') = ?
        ");
        $stmt->execute([$socio_id, $mes_actual]);
        $resultado = $stmt->fetch();
        
        jsonResponse(['success' => true, 'data' => ['total' => $resultado['total']]]);
    }
    
    // Estadísticas de asistencias
    else if (isset($_GET['action']) && $_GET['action'] === 'stats') {
        $hoy = date('Y-m-d');
        $mes_actual = date('Y-m');
        
        // Asistencias de hoy
        $stmt = $db->prepare("SELECT COUNT(*) as total FROM asistencias WHERE fecha = ?");
        $stmt->execute([$hoy]);
        $hoy_total = $stmt->fetch()['total'];
        
        // Asistencias del mes
        $stmt = $db->prepare("
            SELECT COUNT(*) as total 
            FROM asistencias 
            WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
        ");
        $stmt->execute([$mes_actual]);
        $mes_total = $stmt->fetch()['total'];
        
        jsonResponse([
            'success' => true,
            'data' => [
                'hoy' => $hoy_total,
                'mes' => $mes_total
            ]
        ]);
    }
    
    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Registrar asistencia
 */
function handlePost($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $dni = sanitize($input['dni'] ?? '');
    
    if (empty($dni)) {
        jsonResponse(['success' => false, 'message' => 'DNI no proporcionado'], 400);
    }
    
    // Buscar socio por DNI
    $stmt = $db->prepare("SELECT id, nombre, estado FROM socios WHERE dni = ?");
    $stmt->execute([$dni]);
    $socio = $stmt->fetch();
    
    if (!$socio) {
        jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
    }
    
    // Verificar si el socio está activo
    if ($socio['estado'] !== 'Activo') {
        jsonResponse([
            'success' => false,
            'message' => 'El socio tiene la cuota vencida. No puede ingresar.',
            'data' => ['estado' => $socio['estado']]
        ], 403);
    }
    
    // Registrar asistencia
    $fecha = date('Y-m-d');
    $hora = date('H:i:s');
    
    // Verificar si ya registró asistencia hoy
    $stmt = $db->prepare("
        SELECT id FROM asistencias 
        WHERE socio_id = ? AND fecha = ?
    ");
    $stmt->execute([$socio['id'], $fecha]);
    
    if ($stmt->fetch()) {
        jsonResponse([
            'success' => false,
            'message' => 'El socio ya registró asistencia hoy',
            'data' => ['nombre' => $socio['nombre']]
        ], 409);
    }
    
    // Insertar asistencia
    $stmt = $db->prepare("
        INSERT INTO asistencias (socio_id, fecha, hora) 
        VALUES (?, ?, ?)
    ");
    
    if ($stmt->execute([$socio['id'], $fecha, $hora])) {
        jsonResponse([
            'success' => true,
            'message' => "Asistencia registrada para {$socio['nombre']}",
            'data' => [
                'id' => $db->lastInsertId(),
                'socio' => $socio['nombre'],
                'fecha' => $fecha,
                'hora' => $hora
            ]
        ], 201);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al registrar asistencia'], 500);
    }
}

/**
 * DELETE - Eliminar asistencia (solo para correcciones)
 */
function handleDelete($db) {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    $stmt = $db->prepare("DELETE FROM asistencias WHERE id = ?");
    
    if ($stmt->execute([$id])) {
        jsonResponse(['success' => true, 'message' => 'Asistencia eliminada exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al eliminar asistencia'], 500);
    }
}
?>