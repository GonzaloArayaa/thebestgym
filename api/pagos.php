<?php
/**
 * API para gestión de pagos
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

initApi();

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta'];

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
 * GET - Obtener pagos
 * Recepción y administración ven todos; un socio solo los suyos.
 */
function handleGet($db) {
    $actual = requireAuth($db);
    $staff = esStaff($actual);
    $socioPropio = $actual['rol'] === 'Socio' ? (int) $actual['socio_id'] : 0;

    if (!$staff && !$socioPropio) {
        // Instructores y cuentas sin socio vinculado: sin acceso a pagos
        if (isset($_GET['action']) && $_GET['action'] === 'all') {
            jsonResponse(['success' => true, 'data' => []]);
        }
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    // Obtener todos los pagos
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $sql = "
            SELECT p.*, s.nombre as socio_nombre, s.dni
            FROM pagos p
            INNER JOIN socios s ON p.socio_id = s.id
            " . ($staff ? '' : 'WHERE p.socio_id = ?') . "
            ORDER BY p.fecha DESC, p.id DESC
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($staff ? [] : [$socioPropio]);

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Obtener pago por ID
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $stmt = $db->prepare("
            SELECT p.*, s.nombre as socio_nombre, s.dni, s.plan
            FROM pagos p
            INNER JOIN socios s ON p.socio_id = s.id
            WHERE p.id = ?
        ");
        $stmt->execute([$id]);
        $pago = $stmt->fetch();

        if ($pago && ($staff || (int) $pago['socio_id'] === $socioPropio)) {
            jsonResponse(['success' => true, 'data' => $pago]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Pago no encontrado'], 404);
        }
    }

    // Obtener pagos de un socio
    else if (isset($_GET['socio_id']) && (!isset($_GET['action']))) {
        $socio_id = intval($_GET['socio_id']);
        if (!$staff && $socio_id !== $socioPropio) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("
            SELECT * FROM pagos
            WHERE socio_id = ?
            ORDER BY fecha DESC
        ");
        $stmt->execute([$socio_id]);

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Ingresos del mes (solo recepción y administración)
    else if (isset($_GET['action']) && $_GET['action'] === 'ingresos_mes') {
        if (!$staff) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("
            SELECT SUM(monto) as total
            FROM pagos
            WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
        ");
        $stmt->execute([date('Y-m')]);
        $resultado = $stmt->fetch();

        jsonResponse([
            'success' => true,
            'data' => ['total' => $resultado['total'] ?? 0]
        ]);
    }

    // Total pagado por un socio
    else if (isset($_GET['action']) && $_GET['action'] === 'total_socio') {
        $socio_id = intval($_GET['socio_id'] ?? 0);
        if (!$staff && $socio_id !== $socioPropio) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("
            SELECT SUM(monto) as total, COUNT(*) as cantidad
            FROM pagos
            WHERE socio_id = ?
        ");
        $stmt->execute([$socio_id]);
        $resultado = $stmt->fetch();

        jsonResponse([
            'success' => true,
            'data' => [
                'total' => $resultado['total'] ?? 0,
                'cantidad' => $resultado['cantidad'] ?? 0
            ]
        ]);
    }

    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Registrar pago (recepción y administración)
 * La renovación suma la duración del plan a partir del vencimiento actual si
 * todavía no venció, o desde hoy si ya venció.
 */
function handlePost($db) {
    requireAuth($db, ROLES_STAFF);
    $input = readJsonInput();

    $socio_id = intval($input['socio_id'] ?? 0);
    $monto = floatval($input['monto'] ?? 0);
    $metodo_pago = sanitize($input['metodo_pago'] ?? '');
    $concepto = sanitize($input['concepto'] ?? '') ?: 'Cuota Mensual';
    $fecha = date('Y-m-d');

    if ($socio_id <= 0 || $monto <= 0 || $metodo_pago === '') {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }

    if (!in_array($metodo_pago, METODOS_PAGO, true)) {
        jsonResponse(['success' => false, 'message' => 'Método de pago no válido'], 400);
    }

    $db->beginTransaction();

    try {
        // Bloquear la fila del socio para evitar renovaciones simultáneas
        $stmt = $db->prepare("SELECT id, plan, vencimiento FROM socios WHERE id = ? FOR UPDATE");
        $stmt->execute([$socio_id]);
        $socio = $stmt->fetch();

        if (!$socio) {
            $db->rollBack();
            jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
        }

        $stmt = $db->prepare("
            INSERT INTO pagos (socio_id, monto, fecha, metodo_pago, concepto)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$socio_id, $monto, $fecha, $metodo_pago, $concepto]);
        $pago_id = $db->lastInsertId();

        $nueva_fecha_venc = null;
        $stmt = $db->prepare("SELECT duracion FROM planes WHERE nombre = ?");
        $stmt->execute([$socio['plan']]);
        $plan = $stmt->fetch();

        if ($plan) {
            $base = max($fecha, $socio['vencimiento']);
            $nueva_fecha_venc = date('Y-m-d', strtotime("$base +{$plan['duracion']} days"));

            $stmt = $db->prepare("
                UPDATE socios
                SET estado = 'Activo', vencimiento = ?
                WHERE id = ?
            ");
            $stmt->execute([$nueva_fecha_venc, $socio_id]);
        }

        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Pago registrado exitosamente',
            'data' => [
                'id' => $pago_id,
                'vencimiento' => $nueva_fecha_venc
            ]
        ], 201);

    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

/**
 * DELETE - Eliminar pago (solo administrador)
 */
function handleDelete($db) {
    requireAuth($db, ['Administrador']);
    $id = intval($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    $stmt = $db->prepare("DELETE FROM pagos WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() > 0) {
        jsonResponse(['success' => true, 'message' => 'Pago eliminado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Pago no encontrado'], 404);
    }
}
