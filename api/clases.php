<?php
/* API para gestión de clases del gimnasio y turnos (reservas).
 * A partir de la unificación, `clases_gym` es la ÚNICA tabla de clases.
 * `turnos.clase_id` apunta directo a `clases_gym.id`.
 * Los cupos ocupados NUNCA se guardan como contador: se calculan con
 * COUNT(*) de turnos Confirmados en el momento de la consulta, para
 * que nunca puedan desincronizarse de la realidad.
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

/** Query base reutilizada: todas las clases del gym con cupos calculados en vivo */
function queryClasesGym($db, $whereExtra = '', $params = []) {
    $sql = "
        SELECT
            cg.id,
            cg.nombre,
            cg.tipo,
            cg.horario,
            cg.duracion,
            cg.cupo_maximo AS cupoMaximo,
            cg.instructor_id AS instructorId,
            cg.activa,
            i.nombre AS instructor_nombre,
            COALESCE(t.ocupados, 0) AS cuposOcupados
        FROM clases_gym cg
        LEFT JOIN instructores i ON cg.instructor_id = i.id
        LEFT JOIN (
            SELECT clase_id, COUNT(*) AS ocupados
            FROM turnos
            WHERE estado = 'Confirmado'
            GROUP BY clase_id
        ) t ON t.clase_id = cg.id
        WHERE cg.activa = 1 $whereExtra
        ORDER BY cg.id
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/**GET - Obtener clases y turnos*/
function handleGet($db) {
    $actual = requireAuth($db);

    // Catálogo completo de clases del gym, con cupos calculados en vivo.
    // Sirve tanto para el módulo de Turnos (Recepcionista/Socio) como
    // para el módulo de Clases e Instructores (Admin/Recepcionista) y
    // el panel del Instructor: es la MISMA fuente para los tres roles.
    if (isset($_GET['action']) && ($_GET['action'] === 'all' || $_GET['action'] === 'gym')) {
        $clases = queryClasesGym($db);
        jsonResponse(['success' => true, 'data' => $clases]);
    }

    // Obtener clases de un instructor
    else if (isset($_GET['instructor_id'])) {
        $instructor_id = intval($_GET['instructor_id']);
        $clases = queryClasesGym($db, 'AND cg.instructor_id = ?', [$instructor_id]);
        jsonResponse(['success' => true, 'data' => $clases]);
    }

    // Turnos de un socio puntual
    else if (isset($_GET['action']) && $_GET['action'] === 'mis_turnos') {
        $socio_id = intval($_GET['socio_id'] ?? 0);
        if ($actual['rol'] === 'Socio') {
            $socio_id = (int) $actual['socio_id'];
        } else if (!esStaff($actual)) {
            jsonResponse(['success' => true, 'data' => []]);
        }

        $stmt = $db->prepare("
            SELECT
                t.id,
                t.socio_id as socioId,
                t.clase_id as claseId,
                t.fecha,
                t.estado,
                cg.nombre,
                cg.tipo,
                cg.horario,
                cg.duracion,
                i.nombre as instructor_nombre
            FROM turnos t
            INNER JOIN clases_gym cg ON t.clase_id = cg.id
            LEFT JOIN instructores i ON cg.instructor_id = i.id
            WHERE t.socio_id = ? AND t.estado = 'Confirmado'
            ORDER BY t.fecha DESC
        ");
        $stmt->execute([$socio_id]);
        $turnos = $stmt->fetchAll();

        jsonResponse(['success' => true, 'data' => $turnos]);
    }

    // Todos los turnos confirmados (para que Admin/Recepcionista/Instructor
    // vean el mismo estado real al iniciar sesión, sin depender de que
    // otra pestaña/compu los tenga en memoria)
    else if (isset($_GET['action']) && $_GET['action'] === 'all_turnos') {
        // Recepción/administración ven todos; el socio solo los suyos;
        // el instructor solo los de sus clases.
        $filtro = '';
        $params = [];
        if ($actual['rol'] === 'Socio') {
            $filtro = 'AND t.socio_id = ?';
            $params = [(int) $actual['socio_id']];
        } else if ($actual['rol'] === 'Instructor') {
            $filtro = 'AND cg.instructor_id = ?';
            $params = [(int) $actual['instructor_id']];
        }

        $stmt = $db->prepare("
            SELECT
                t.id,
                t.socio_id as socioId,
                t.clase_id as claseId,
                t.fecha,
                t.estado,
                cg.nombre,
                cg.tipo,
                cg.horario,
                cg.duracion,
                i.nombre as instructor_nombre,
                s.nombre as socio_nombre,
                s.dni as socio_dni
            FROM turnos t
            INNER JOIN clases_gym cg ON t.clase_id = cg.id
            LEFT JOIN instructores i ON cg.instructor_id = i.id
            INNER JOIN socios s ON t.socio_id = s.id
            WHERE t.estado = 'Confirmado' $filtro
            ORDER BY t.fecha DESC
        ");
        $stmt->execute($params);
        $turnos = $stmt->fetchAll();

        jsonResponse(['success' => true, 'data' => $turnos]);
    }

    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Crear clase o reservar turno
 */
function handlePost($db) {
    $actual = requireAuth($db);
    $input = readJsonInput();

    // Reservar turno
    if (isset($input['action']) && $input['action'] === 'reservar') {
        $socio_id = intval($input['socio_id'] ?? 0);
        $clase_id = intval($input['clase_id'] ?? 0);
        $fecha = sanitize($input['fecha'] ?? '');

        // Un socio solo reserva para sí mismo; el instructor no reserva
        if ($actual['rol'] === 'Socio') {
            $socio_id = (int) $actual['socio_id'];
        } else if (!esStaff($actual)) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        if ($socio_id <= 0 || $clase_id <= 0 || empty($fecha)) {
            jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
        }

        if (!esFechaValida($fecha) || $fecha < date('Y-m-d')) {
            jsonResponse(['success' => false, 'message' => 'La fecha del turno no es válida'], 400);
        }

        $stmt = $db->prepare("SELECT id FROM socios WHERE id = ?");
        $stmt->execute([$socio_id]);
        if (!$stmt->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
        }

        // Cupo y reserva se verifican y se insertan en una transacción,
        // bloqueando la clase para que dos reservas simultáneas no excedan el cupo.
        $db->beginTransaction();
        $stmt = $db->prepare("SELECT id FROM clases_gym WHERE id = ? FOR UPDATE");
        $stmt->execute([$clase_id]);

        // Verificar que la clase existe y contar cupos ocupados en vivo
        $stmt = $db->prepare("
            SELECT cg.cupo_maximo, cg.nombre,
                   (SELECT COUNT(*) FROM turnos WHERE clase_id = cg.id AND estado = 'Confirmado') AS ocupados
            FROM clases_gym cg
            WHERE cg.id = ? AND cg.activa = 1
        ");
        $stmt->execute([$clase_id]);
        $clase = $stmt->fetch();

        if (!$clase) {
            $db->rollBack();
            jsonResponse(['success' => false, 'message' => 'Clase no encontrada'], 404);
        }

        if ($clase['ocupados'] >= $clase['cupo_maximo']) {
            $db->rollBack();
            jsonResponse(['success' => false, 'message' => 'No hay cupos disponibles'], 409);
        }

        // Verificar que no tenga ya una reserva para esta clase
        $stmt = $db->prepare("
            SELECT id FROM turnos
            WHERE socio_id = ? AND clase_id = ? AND estado = 'Confirmado'
        ");
        $stmt->execute([$socio_id, $clase_id]);

        if ($stmt->fetch()) {
            $db->rollBack();
            jsonResponse(['success' => false, 'message' => 'Ya tienes una reserva para esta clase'], 409);
        }

        // Insert simple: no hay contador que actualizar, los cupos se
        // calculan siempre a partir de esta misma tabla.
        $stmt = $db->prepare("
            INSERT INTO turnos (socio_id, clase_id, fecha, estado)
            VALUES (?, ?, ?, 'Confirmado')
        ");
        $stmt->execute([$socio_id, $clase_id, $fecha]);
        $turno_id = $db->lastInsertId();
        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => "Turno reservado exitosamente para {$clase['nombre']}",
            'data' => ['id' => $turno_id]
        ], 201);
    }

    // Crear clase gym
    else if (isset($input['action']) && $input['action'] === 'crear_gym') {
        requireAuth($db, ['Administrador']);
        $nombre = sanitize($input['nombre'] ?? '');
        $tipo = sanitize($input['tipo'] ?? '');
        $horario = sanitize($input['horario'] ?? '');
        $duracion = sanitize($input['duracion'] ?? '');
        $cupo_maximo = intval($input['cupo_maximo'] ?? 0);

        if (empty($nombre) || empty($tipo) || $cupo_maximo <= 0) {
            jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
        }

        $stmt = $db->prepare("
            INSERT INTO clases_gym (nombre, tipo, horario, duracion, cupo_maximo)
            VALUES (?, ?, ?, ?, ?)
        ");

        if ($stmt->execute([$nombre, $tipo, $horario, $duracion, $cupo_maximo])) {
            jsonResponse([
                'success' => true,
                'message' => 'Clase creada exitosamente',
                'data' => ['id' => $db->lastInsertId()]
            ], 201);
        } else {
            jsonResponse(['success' => false, 'message' => 'Error al crear clase'], 500);
        }
    }

    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * PUT - Actualizar clase, asignar instructor o modificar turno
 */
function handlePut($db) {
    $actual = requireAuth($db);
    $input = readJsonInput();

    // ASIGNAR INSTRUCTOR A CLASE
    if (isset($input['action']) && $input['action'] === 'asignar_instructor') {
        requireAuth($db, ['Administrador']);
        $clase_id = intval($input['clase_id'] ?? 0);
        $instructor_id = isset($input['instructor_id']) && $input['instructor_id'] !== ''
            ? intval($input['instructor_id'])
            : null;

        if ($clase_id <= 0) {
            jsonResponse(['success' => false, 'message' => 'ID de clase inválido'], 400);
        }

        if ($instructor_id !== null) {
            $stmt = $db->prepare("SELECT id FROM instructores WHERE id = ? AND activo = 1");
            $stmt->execute([$instructor_id]);
            if (!$stmt->fetch()) {
                jsonResponse(['success' => false, 'message' => 'Instructor no encontrado'], 404);
            }
        }

        $stmt = $db->prepare("
            UPDATE clases_gym
            SET instructor_id = ?
            WHERE id = ?
        ");

        if ($stmt->execute([$instructor_id, $clase_id])) {
            $verify = $db->prepare("SELECT instructor_id FROM clases_gym WHERE id = ?");
            $verify->execute([$clase_id]);
            $result = $verify->fetch();

            jsonResponse([
                'success' => true,
                'message' => 'Instructor asignado exitosamente',
                'data' => ['instructor_id' => $result['instructor_id']]
            ]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Error al asignar instructor'], 500);
        }
    }

    // MODIFICAR TURNO (cambiar de clase)
    else if (isset($input['action']) && $input['action'] === 'modificar_turno') {
        $turno_id = intval($input['turno_id'] ?? 0);
        $nueva_clase_id = intval($input['nueva_clase_id'] ?? 0);
        $nueva_fecha = sanitize($input['nueva_fecha'] ?? '');

        if ($turno_id <= 0 || $nueva_clase_id <= 0 || empty($nueva_fecha)) {
            jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
        }

        if (!esFechaValida($nueva_fecha) || $nueva_fecha < date('Y-m-d')) {
            jsonResponse(['success' => false, 'message' => 'La fecha del turno no es válida'], 400);
        }

        $stmt = $db->prepare("SELECT socio_id, clase_id, estado FROM turnos WHERE id = ?");
        $stmt->execute([$turno_id]);
        $turno = $stmt->fetch();

        if (!$turno || $turno['estado'] !== 'Confirmado') {
            jsonResponse(['success' => false, 'message' => 'Turno no encontrado o ya cancelado'], 404);
        }

        // Un socio solo modifica sus propios turnos; el instructor no modifica turnos
        if (!esStaff($actual) && !($actual['rol'] === 'Socio' && (int) $turno['socio_id'] === (int) $actual['socio_id'])) {
            jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
        }

        // Cupos de la clase nueva calculados en vivo
        $stmt = $db->prepare("
            SELECT cg.cupo_maximo, cg.nombre, cg.horario,
                   (SELECT COUNT(*) FROM turnos WHERE clase_id = cg.id AND estado = 'Confirmado') AS ocupados
            FROM clases_gym cg WHERE cg.id = ? AND cg.activa = 1
        ");
        $stmt->execute([$nueva_clase_id]);
        $claseNueva = $stmt->fetch();

        if (!$claseNueva) {
            jsonResponse(['success' => false, 'message' => 'Clase no encontrada'], 404);
        }

        if ((int) $turno['clase_id'] !== $nueva_clase_id && $claseNueva['ocupados'] >= $claseNueva['cupo_maximo']) {
            jsonResponse(['success' => false, 'message' => 'La clase seleccionada no tiene cupos disponibles'], 409);
        }

        $stmt = $db->prepare("UPDATE turnos SET clase_id = ?, fecha = ? WHERE id = ?");
        $stmt->execute([$nueva_clase_id, $nueva_fecha, $turno_id]);

        jsonResponse([
            'success' => true,
            'message' => "Turno modificado exitosamente a {$claseNueva['nombre']}"
        ]);
    }

    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * DELETE - Cancelar turno
 */
function handleDelete($db) {
    $actual = requireAuth($db);
    $turno_id = intval($_GET['id'] ?? 0);

    if ($turno_id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }

    $stmt = $db->prepare("SELECT socio_id, clase_id, estado FROM turnos WHERE id = ?");
    $stmt->execute([$turno_id]);
    $turno = $stmt->fetch();

    if (!$turno) {
        jsonResponse(['success' => false, 'message' => 'Turno no encontrado'], 404);
    }

    // Un socio solo cancela sus propios turnos; el instructor no cancela turnos
    if (!esStaff($actual) && !($actual['rol'] === 'Socio' && (int) $turno['socio_id'] === (int) $actual['socio_id'])) {
        jsonResponse(['success' => false, 'message' => 'No tienes permiso para realizar esta acción'], 403);
    }

    if ($turno['estado'] !== 'Confirmado') {
        jsonResponse(['success' => false, 'message' => 'El turno ya fue cancelado'], 400);
    }

    // Solo actualizamos el estado. No hay contador de cupos que tocar:
    // al pasar a 'Cancelado' deja automáticamente de contar en el
    // COUNT(*) que calcula los cupos ocupados.
    $stmt = $db->prepare("
        UPDATE turnos
        SET estado = 'Cancelado', fecha_cancelacion = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$turno_id]);

    jsonResponse(['success' => true, 'message' => 'Turno cancelado exitosamente']);
}
