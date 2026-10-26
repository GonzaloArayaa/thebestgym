<?php
/**
 * API para gestión de asistencias
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
 * Recepción y administración ven todas; un socio solo las suyas.
 */
function handleGet($db) {
    $actual = requireAuth($db);
    $staff = esStaff($actual);
    $socioPropio = $actual['rol'] === 'Socio' ? (int) $actual['socio_id'] : 0;

    if (!$staff && !$socioPropio) {
        if (isset($_GET['action']) && $_GET['action'] === 'all') {
            jsonResponse(['success' => true, 'data' => []]);
        }
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    // Obtener todas las asistencias con datos del socio
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->prepare("
            SELECT a.*, s.nombre, s.dni, s.plan, s.estado
            FROM asistencias a
            INNER JOIN socios s ON a.socio_id = s.id
            " . ($staff ? '' : 'WHERE a.socio_id = ?') . "
            ORDER BY a.fecha DESC, a.hora DESC
            LIMIT 100
        ");
        $stmt->execute($staff ? [] : [$socioPropio]);

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // El resto de las consultas globales son solo para recepción y administración
    else if (isset($_GET['action']) && !$staff) {
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    // Obtener asistencias de hoy
    else if (isset($_GET['action']) && $_GET['action'] === 'hoy') {
        $stmt = $db->prepare("
            SELECT a.*, s.nombre, s.dni
            FROM asistencias a
            INNER JOIN socios s ON a.socio_id = s.id
            WHERE a.fecha = ?
            ORDER BY a.hora DESC
        ");
        $stmt->execute([date('Y-m-d')]);

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Obtener asistencias de un socio
    else if (isset($_GET['socio_id'])) {
        $socio_id = intval($_GET['socio_id']);
        if (!$staff && $socio_id !== $socioPropio) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("
            SELECT * FROM asistencias
            WHERE socio_id = ?
            ORDER BY fecha DESC, hora DESC
            LIMIT 50
        ");
        $stmt->execute([$socio_id]);

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Obtener asistencias del mes de un socio
    else if (isset($_GET['socio_id_mes'])) {
        $socio_id = intval($_GET['socio_id_mes']);
        if (!$staff && $socio_id !== $socioPropio) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM asistencias
            WHERE socio_id = ? AND DATE_FORMAT(fecha, '%Y-%m') = ?
        ");
        $stmt->execute([$socio_id, date('Y-m')]);

        jsonResponse(['success' => true, 'data' => ['total' => $stmt->fetch()['total']]]);
    }

    // Estadísticas de asistencias
    else if (isset($_GET['action']) && $_GET['action'] === 'stats') {
        $stmt = $db->prepare("SELECT COUNT(*) as total FROM asistencias WHERE fecha = ?");
        $stmt->execute([date('Y-m-d')]);
        $hoy_total = $stmt->fetch()['total'];

        $stmt = $db->prepare("
            SELECT COUNT(*) as total
            FROM asistencias
            WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
        ");
        $stmt->execute([date('Y-m')]);
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
 * POST - Registrar asistencia (recepción y administración)
 */
function handlePost($db) {
    requireAuth($db, ROLES_STAFF);
    $input = readJsonInput();

    $dni = sanitize($input['dni'] ?? '');

    if ($dni === '') {
        jsonResponse(['success' => false, 'message' => 'DNI no proporcionado'], 400);
    }

    // Buscar socio por DNI
    $stmt = $db->prepare("SELECT id, nombre, estado, vencimiento FROM socios WHERE dni = ?");
    $stmt->execute([$dni]);
    $socio = $stmt->fetch();

    if (!$socio) {
        jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
    }

    // El estado Moroso solo se calcula en el navegador, así que el servidor
    // también verifica la fecha de vencimiento.
    $fecha = date('Y-m-d');
    $vencido = $socio['vencimiento'] < $fecha;

    if ($socio['estado'] === 'Inactivo') {
        jsonResponse([
            'success' => false,
            'message' => 'El socio está inactivo. No puede ingresar.',
            'data' => ['estado' => $socio['estado']]
        ], 403);
    }

    if ($socio['estado'] !== 'Activo' || $vencido) {
        jsonResponse([
            'success' => false,
            'message' => 'El socio tiene la cuota vencida. No puede ingresar.',
            'data' => ['estado' => $vencido ? 'Moroso' : $socio['estado']]
        ], 403);
    }

    $hora = date('H:i:s');

    // Verificar si ya registró asistencia hoy
    $stmt = $db->prepare("SELECT id FROM asistencias WHERE socio_id = ? AND fecha = ?");
    $stmt->execute([$socio['id'], $fecha]);

    if ($stmt->fetch()) {
        jsonResponse([
            'success' => false,
            'message' => 'El socio ya registró asistencia hoy',
            'data' => ['nombre' => $socio['nombre']]
        ], 409);
    }

    $stmt = $db->prepare("INSERT INTO asistencias (socio_id, fecha, hora) VALUES (?, ?, ?)");
    $stmt->execute([$socio['id'], $fecha, $hora]);

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
}

/**
 * DELETE - Eliminar asistencia (solo administrador, para correcciones)
 */
function handleDelete($db) {
    requireAuth($db, ['Administrador']);
    $id = intval($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    $stmt = $db->prepare("DELETE FROM asistencias WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() > 0) {
        jsonResponse(['success' => true, 'message' => 'Asistencia eliminada exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Asistencia no encontrada'], 404);
    }
}
