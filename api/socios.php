<?php
/**
 * API para gestión de socios
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
 * GET - Obtener socios
 */
function handleGet($db) {
    // Obtener todos los socios
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->query("
            SELECT id, nombre, dni, email, telefono, plan, estado, 
                   vencimiento, fecha_alta, fecha_nacimiento, genero,
                   emergencia_nombre, emergencia_relacion, emergencia_telefono,
                   grupo_sanguineo, alergias, lesiones
            FROM socios 
            ORDER BY nombre
        ");
        $socios = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $socios]);
    }
    
    // Buscar socio por DNI
    else if (isset($_GET['dni'])) {
        $dni = sanitize($_GET['dni']);
        $stmt = $db->prepare("
            SELECT * FROM socios WHERE dni = ?
        ");
        $stmt->execute([$dni]);
        $socio = $stmt->fetch();
        
        if ($socio) {
            jsonResponse(['success' => true, 'data' => $socio]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
        }
    }
    
    // Obtener socio por ID
    else if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $stmt = $db->prepare("SELECT * FROM socios WHERE id = ?");
        $stmt->execute([$id]);
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
            SELECT * FROM socios 
            WHERE estado = 'Moroso' 
            ORDER BY vencimiento
        ");
        $morosos = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $morosos]);
    }
    
    // Obtener socios activos
    else if (isset($_GET['action']) && $_GET['action'] === 'activos') {
        $stmt = $db->query("
            SELECT * FROM socios 
            WHERE estado = 'Activo' 
            ORDER BY nombre
        ");
        $activos = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $activos]);
    }
    
    // Estadísticas
    else if (isset($_GET['action']) && $_GET['action'] === 'stats') {
        $stats = [];
        
        // Total activos
        $stmt = $db->query("SELECT COUNT(*) as total FROM socios WHERE estado = 'Activo'");
        $stats['activos'] = $stmt->fetch()['total'];
        
        // Total morosos
        $stmt = $db->query("SELECT COUNT(*) as total FROM socios WHERE estado = 'Moroso'");
        $stats['morosos'] = $stmt->fetch()['total'];
        
        // Total socios
        $stmt = $db->query("SELECT COUNT(*) as total FROM socios");
        $stats['total'] = $stmt->fetch()['total'];
        
        jsonResponse(['success' => true, 'data' => $stats]);
    }
    
    else {
        jsonResponse(['success' => false, 'message' => 'Acción no especificada'], 400);
    }
}

/**
 * POST - Crear nuevo socio
 */
function handlePost($db) {
    // Usamos file_get_contents('php://input') si JS usa JSON, pero
    // como usamos URLSearchParams en JS, el backend debe leer $_POST o decodificarlo.
    // Asumo que el JS usa JSON, por eso leemos el input stream:
    $input = json_decode(file_get_contents('php://input'), true);

    // Si la decodificación JSON falla (porque JS envió URLSearchParams), intentamos leer $_POST
    if (!$input) {
        $input = $_POST;
    }
    
    // 1. Obtener datos del formulario (los que realmente vienen)
    $nombre = sanitize($input['nombre'] ?? '');
    $dni = sanitize($input['dni'] ?? '');
    $email = sanitize($input['email'] ?? '');
    $telefono = sanitize($input['telefono'] ?? '');
    $plan = sanitize($input['plan'] ?? '');
    // Los siguientes vienen del JS, pero si fallan, se insertarán como NULL en la DB
    $fecha_nacimiento = sanitize($input['fechaNacimiento'] ?? NULL);
    $genero = sanitize($input['genero'] ?? NULL);
    
    $fecha_alta = date('Y-m-d'); 
    
    // 2. Valores por defecto (NULL) para campos no incluidos en el formulario de alta básica
    // Estos deben coincidir con el resto de las 16 columnas.
    $vacio = NULL; 
    $estado_activo = 'Activo'; 

    if (empty($nombre) || empty($dni) || empty($email) || empty($plan)) {
        jsonResponse(['success' => false, 'message' => 'Error: Nombre, DNI, Email y Plan son obligatorios.'], 400);
    }
    
    // Verificación de DNI (omito para simplificar la corrección del INSERT)

    // Obtener duración y costo del plan
    $stmt = $db->prepare("SELECT duracion, costo FROM planes WHERE nombre = ?");
    $stmt->execute([$plan]);
    $planData = $stmt->fetch();
    
    if (!$planData) {
        jsonResponse(['success' => false, 'message' => 'Plan no encontrado en la base de datos.'], 404);
    }
    
    // Calcular fecha de vencimiento
    $vencimiento = date('Y-m-d', strtotime("+{$planData['duracion']} days")); // Usar duración del plan

    // 3. SENTENCIA SQL FINAL CON LAS 16 COLUMNAS
    // ------------------------------------------
    $sql = "
        INSERT INTO socios (
            nombre, dni, email, telefono, plan, estado, vencimiento, fecha_alta, 
            fecha_nacimiento, genero, 
            emergencia_nombre, emergencia_relacion, emergencia_telefono,
            grupo_sanguineo, alergias, lesiones
        ) 
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, 
            ?, ?, 
            ?, ?, ?, 
            ?, ?, ?
        )
    "; // Total de 16 signos de pregunta (?)
    
    // 4. Parámetros vinculados (DEBE HABER 16 VALORES EN EL ORDEN EXACTO)
    $parametros = [
        // 1. Datos básicos (4)
        $nombre, $dni, $email, $telefono,
        
        // 2. Datos del Plan/Estado (3)
        $plan, $estado_activo, $vencimiento, 
        
        // 3. Datos de Fecha y NULL por defecto (9)
        $fecha_alta, 
        $fecha_nacimiento, $genero, 
        $vacio, $vacio, $vacio, // Contacto de emergencia: nombre, relación, teléfono
        $vacio, $vacio, $vacio  // Médica: grupo_sanguineo, alergias, lesiones
    ];
    
    // Verificar si el array de parámetros tiene el tamaño correcto (Debe ser 16)
    if (count($parametros) !== 16) {
        jsonResponse(['success' => false, 'message' => 'Error Interno: Faltan ' . (16 - count($parametros)) . ' parámetros para la inserción.'], 500);
    }

    $stmt = $db->prepare($sql);

    // 5. Ejecutar y devolver respuesta
    if ($stmt->execute($parametros)) {
        
        // --- También debe insertar el registro en la tabla 'pagos' ---
        // (Este paso estaba en tu JS, pero si el formulario falla, hay que hacerlo acá)
        $socio_id = $db->lastInsertId();
        $costo = $planData['costo'];
        $concepto_pago = "Plan {$plan} - Alta";

        $stmt_pago = $db->prepare("
            INSERT INTO pagos (socio_id, monto, fecha, metodo_pago, concepto) 
            VALUES (?, ?, ?, 'Efectivo', ?)
        ");
        $stmt_pago->execute([$socio_id, $costo, $fecha_alta, $concepto_pago]);
        // -----------------------------------------------------------
        
        jsonResponse([
            'success' => true,
            'message' => "Socio '$nombre' y pago inicial creados exitosamente en MySQL.",
            'data' => ['id' => $socio_id]
        ], 201);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error de ejecución SQL inesperado.'], 500);
    }
}

/**
 * PUT - Actualizar socio
 */
function handlePut($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = intval($input['id'] ?? 0);
    $nombre = sanitize($input['nombre'] ?? '');
    $email = sanitize($input['email'] ?? '');
    $telefono = sanitize($input['telefono'] ?? '');
    $plan = sanitize($input['plan'] ?? '');
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    // Obtener estado y vencimiento actuales para no pisarlos si no se envían
    $stmtActual = $db->prepare("SELECT estado, vencimiento FROM socios WHERE id = ?");
    $stmtActual->execute([$id]);
    $actual = $stmtActual->fetch();
    if (!$actual) {
        jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
    }
    
    $estado = isset($input['estado']) ? sanitize($input['estado']) : $actual['estado'];
    $vencimiento = isset($input['vencimiento']) ? sanitize($input['vencimiento']) : $actual['vencimiento'];
    
    // Actualizar perfil completo si se proporcionan datos adicionales
    if (isset($input['fecha_nacimiento']) || isset($input['genero'])) {
        $fecha_nacimiento = $input['fecha_nacimiento'] ?? null;
        $genero = $input['genero'] ?? null;
        $emergencia_nombre = sanitize($input['emergencia_nombre'] ?? '');
        $emergencia_relacion = sanitize($input['emergencia_relacion'] ?? '');
        $emergencia_telefono = sanitize($input['emergencia_telefono'] ?? '');
        $grupo_sanguineo = sanitize($input['grupo_sanguineo'] ?? '');
        $alergias = sanitize($input['alergias'] ?? '');
        $lesiones = sanitize($input['lesiones'] ?? '');
        
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
            $emergencia_nombre, $emergencia_relacion, $emergencia_telefono,
            $grupo_sanguineo, $alergias, $lesiones,
            $id
        ]);
    } else {
        // Actualización básica (incluye estado y vencimiento)
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
 * DELETE - Eliminar socio
 */
function handleDelete($db) {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    // Eliminar el socio (esto eliminará automáticamente sus asistencias y pagos por CASCADE)
    $stmt = $db->prepare("DELETE FROM socios WHERE id = ?");
    
    if ($stmt->execute([$id])) {
        jsonResponse(['success' => true, 'message' => 'Socio eliminado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al eliminar socio'], 500);
    }
}
?>