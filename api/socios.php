<?php
/**
 * API para gestión de socios
 * The Best Gym - Sistema de Gestión
 */

require_once '../db_connection.php';

initApi();

const COLUMNAS_SOCIO = "id, nombre, dni, email, telefono, plan, estado,
                   vencimiento, fecha_alta, fecha_nacimiento, genero,
                   emergencia_nombre, emergencia_relacion, emergencia_telefono,
                   grupo_sanguineo, alergias, lesiones";
const ESTADOS_SOCIO = ['Activo', 'Moroso', 'Inactivo'];
const GENEROS = ['Masculino', 'Femenino', 'Otro'];
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
 * GET - Obtener socios
 * Recepción y administración ven todo; un socio solo ve su propio registro;
 * el instructor no accede a datos de socios.
 */
function handleGet($db) {
    $actual = requireAuth($db);
    $staff = esStaff($actual);
    sincronizarEstadosSocios($db);

    // Obtener todos los socios
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        if ($staff) {
            $stmt = $db->query("SELECT " . COLUMNAS_SOCIO . " FROM socios ORDER BY nombre");
        } else if ($actual['rol'] === 'Socio' && $actual['socio_id']) {
            $stmt = $db->prepare("SELECT " . COLUMNAS_SOCIO . " FROM socios WHERE id = ?");
            $stmt->execute([$actual['socio_id']]);
        } else {
            jsonResponse(['success' => true, 'data' => []]);
        }

        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Obtener socio por ID (un socio solo puede pedir el suyo)
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        if (!$staff && !($actual['rol'] === 'Socio' && $id === (int) $actual['socio_id'])) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        $stmt = $db->prepare("SELECT " . COLUMNAS_SOCIO . " FROM socios WHERE id = ?");
        $stmt->execute([$id]);
        $socio = $stmt->fetch();

        if ($socio) {
            jsonResponse(['success' => true, 'data' => $socio]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
        }
    }

    // El resto de las consultas son solo para recepción y administración
    else if (!$staff) {
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    // Buscar socio por DNI
    else if (isset($_GET['dni'])) {
        $dni = sanitize($_GET['dni']);
        $stmt = $db->prepare("SELECT " . COLUMNAS_SOCIO . " FROM socios WHERE dni = ?");
        $stmt->execute([$dni]);
        $socio = $stmt->fetch();

        if ($socio) {
            jsonResponse(['success' => true, 'data' => $socio]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
        }
    }

    // Obtener socios morosos
    else if (isset($_GET['action']) && $_GET['action'] === 'morosos') {
        $stmt = $db->query("
            SELECT " . COLUMNAS_SOCIO . " FROM socios
            WHERE estado = 'Moroso'
            ORDER BY vencimiento
        ");
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Obtener socios activos
    else if (isset($_GET['action']) && $_GET['action'] === 'activos') {
        $stmt = $db->query("
            SELECT " . COLUMNAS_SOCIO . " FROM socios
            WHERE estado = 'Activo'
            ORDER BY nombre
        ");
        jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    // Estadísticas
    else if (isset($_GET['action']) && $_GET['action'] === 'stats') {
        $stats = [];
        $stats['activos'] = $db->query("SELECT COUNT(*) as total FROM socios WHERE estado = 'Activo'")->fetch()['total'];
        $stats['morosos'] = $db->query("SELECT COUNT(*) as total FROM socios WHERE estado = 'Moroso'")->fetch()['total'];
        $stats['total'] = $db->query("SELECT COUNT(*) as total FROM socios")->fetch()['total'];

        jsonResponse(['success' => true, 'data' => $stats]);
    }

    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Crear nuevo socio (recepción y administración)
 * El socio y su pago inicial se crean en una sola transacción.
 */
function handlePost($db) {
    requireAuth($db, ROLES_STAFF);

    // Se acepta JSON o formulario
    $input = readJsonInput() ?: $_POST;

    $nombre = sanitize($input['nombre'] ?? '');
    $dni = sanitize($input['dni'] ?? '');
    $email = trim((string) ($input['email'] ?? ''));
    $telefono = sanitize($input['telefono'] ?? '');
    $plan = sanitize($input['plan'] ?? '');
    $fecha_nacimiento = sanitizeOrNull($input['fechaNacimiento'] ?? null);
    $genero = sanitizeOrNull($input['genero'] ?? null);
    $metodo_pago = sanitize($input['metodo_pago'] ?? 'Efectivo');

    if ($nombre === '' || $dni === '' || $email === '' || $plan === '') {
        jsonResponse(['success' => false, 'message' => 'Nombre, DNI, Email y Plan son obligatorios.'], 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'message' => 'El email no es válido.'], 400);
    }
    $email = sanitize($email);

    if ($fecha_nacimiento !== null && !esFechaValida($fecha_nacimiento)) {
        jsonResponse(['success' => false, 'message' => 'La fecha de nacimiento no es válida.'], 400);
    }

    if ($genero !== null && !in_array($genero, GENEROS, true)) {
        jsonResponse(['success' => false, 'message' => 'Género no válido.'], 400);
    }

    if (!in_array($metodo_pago, METODOS_PAGO, true)) {
        jsonResponse(['success' => false, 'message' => 'Método de pago no válido.'], 400);
    }

    // DNI único
    $stmt = $db->prepare("SELECT id FROM socios WHERE dni = ?");
    $stmt->execute([$dni]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => 'Ya existe un socio con ese DNI.'], 409);
    }

    // Obtener duración y costo del plan
    $stmt = $db->prepare("SELECT duracion, costo FROM planes WHERE nombre = ? AND activo = 1");
    $stmt->execute([$plan]);
    $planData = $stmt->fetch();

    if (!$planData) {
        jsonResponse(['success' => false, 'message' => 'Plan no encontrado en la base de datos.'], 404);
    }

    $fecha_alta = date('Y-m-d');
    $vencimiento = date('Y-m-d', strtotime("+{$planData['duracion']} days"));

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("
            INSERT INTO socios (
                nombre, dni, email, telefono, plan, estado, vencimiento, fecha_alta,
                fecha_nacimiento, genero
            ) VALUES (?, ?, ?, ?, ?, 'Activo', ?, ?, ?, ?)
        ");
        $stmt->execute([
            $nombre, $dni, $email, $telefono, $plan, $vencimiento, $fecha_alta,
            $fecha_nacimiento, $genero
        ]);
        $socio_id = $db->lastInsertId();

        $stmt = $db->prepare("
            INSERT INTO pagos (socio_id, monto, fecha, metodo_pago, concepto)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$socio_id, $planData['costo'], $fecha_alta, $metodo_pago, "Plan {$plan} - Alta"]);

        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    jsonResponse([
        'success' => true,
        'message' => "Socio '$nombre' y pago inicial creados exitosamente.",
        'data' => ['id' => $socio_id]
    ], 201);
}

/**
 * PUT - Actualizar socio
 * Recepción y administración editan todo; un socio solo puede editar los
 * datos personales de su propio perfil (no plan, estado ni vencimiento).
 */
function handlePut($db) {
    $actual = requireAuth($db, ['Administrador', 'Recepcionista', 'Socio']);
    $staff = esStaff($actual);
    $input = readJsonInput();

    $id = intval($input['id'] ?? 0);
    if ($actual['rol'] === 'Socio') {
        if ($id !== (int) $actual['socio_id']) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }
    }

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    // Valores actuales: se conservan si no se envían
    $stmtActual = $db->prepare("SELECT * FROM socios WHERE id = ?");
    $stmtActual->execute([$id]);
    $actualSocio = $stmtActual->fetch();
    if (!$actualSocio) {
        jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
    }

    $nombre = sanitize($input['nombre'] ?? '') ?: $actualSocio['nombre'];
    $telefono = isset($input['telefono']) ? sanitize($input['telefono']) : $actualSocio['telefono'];

    $email = $actualSocio['email'];
    if (!empty($input['email'])) {
        if (!filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'message' => 'El email no es válido.'], 400);
        }
        $email = sanitize($input['email']);
    }

    // Plan, estado y vencimiento: solo recepción y administración
    $plan = $actualSocio['plan'];
    $estado = $actualSocio['estado'];
    $vencimiento = $actualSocio['vencimiento'];
    if ($staff) {
        if (!empty($input['plan'])) {
            $plan = sanitize($input['plan']);
            $stmt = $db->prepare("SELECT id FROM planes WHERE nombre = ?");
            $stmt->execute([$plan]);
            if (!$stmt->fetch()) {
                jsonResponse(['success' => false, 'message' => 'Plan no encontrado en la base de datos.'], 404);
            }
        }
        if (isset($input['estado'])) {
            $estado = sanitize($input['estado']);
            if (!in_array($estado, ESTADOS_SOCIO, true)) {
                jsonResponse(['success' => false, 'message' => 'Estado no válido.'], 400);
            }
        }
        if (isset($input['vencimiento'])) {
            $vencimiento = sanitize($input['vencimiento']);
            if (!esFechaValida($vencimiento)) {
                jsonResponse(['success' => false, 'message' => 'Fecha de vencimiento no válida.'], 400);
            }
        }
    }

    // Perfil completo (datos personales, emergencia y médicos)
    if (isset($input['fecha_nacimiento']) || isset($input['genero'])) {
        $fecha_nacimiento = sanitizeOrNull($input['fecha_nacimiento'] ?? null);
        $genero = sanitizeOrNull($input['genero'] ?? null);

        if ($fecha_nacimiento !== null && !esFechaValida($fecha_nacimiento)) {
            jsonResponse(['success' => false, 'message' => 'La fecha de nacimiento no es válida.'], 400);
        }
        if ($genero !== null && !in_array($genero, GENEROS, true)) {
            jsonResponse(['success' => false, 'message' => 'Género no válido.'], 400);
        }

        $stmt = $db->prepare("
            UPDATE socios SET
                nombre = ?, email = ?, telefono = ?, plan = ?,
                estado = ?, vencimiento = ?,
                fecha_nacimiento = ?, genero = ?,
                emergencia_nombre = ?, emergencia_relacion = ?, emergencia_telefono = ?,
                grupo_sanguineo = ?, alergias = ?, lesiones = ?
            WHERE id = ?
        ");

        $result = $stmt->execute([
            $nombre, $email, $telefono, $plan,
            $estado, $vencimiento,
            $fecha_nacimiento, $genero,
            sanitize($input['emergencia_nombre'] ?? ''),
            sanitize($input['emergencia_relacion'] ?? ''),
            sanitize($input['emergencia_telefono'] ?? ''),
            sanitize($input['grupo_sanguineo'] ?? ''),
            sanitize($input['alergias'] ?? ''),
            sanitize($input['lesiones'] ?? ''),
            $id
        ]);
    } else {
        $stmt = $db->prepare("
            UPDATE socios SET nombre = ?, email = ?, telefono = ?, plan = ?, estado = ?, vencimiento = ?
            WHERE id = ?
        ");
        $result = $stmt->execute([$nombre, $email, $telefono, $plan, $estado, $vencimiento, $id]);
    }

    if ($result) {
        jsonResponse(['success' => true, 'message' => 'Socio actualizado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al actualizar socio'], 500);
    }
}

/**
 * DELETE - Eliminar socio (solo administrador)
 * Sus asistencias, pagos y turnos se eliminan por CASCADE y sus cuentas de
 * usuario quedan desactivadas.
 */
function handleDelete($db) {
    requireAuth($db, ['Administrador']);
    $id = intval($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("DELETE FROM socios WHERE id = ?");
        $stmt->execute([$id]);
        $eliminado = $stmt->rowCount() > 0;

        if ($eliminado) {
            $stmt = $db->prepare("UPDATE usuarios SET activo = 0 WHERE socio_id = ?");
            $stmt->execute([$id]);
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }

    if ($eliminado) {
        jsonResponse(['success' => true, 'message' => 'Socio eliminado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
    }
}
