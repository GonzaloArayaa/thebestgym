<?php
/**
 * API para gestión de pagos
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
 * GET - Obtener pagos
 */
function handleGet($db) {
    // Obtener todos los pagos
    if (isset($_GET['action']) && $_GET['action'] === 'all') {
        $stmt = $db->query("
            SELECT p.*, s.nombre as socio_nombre, s.dni
            FROM pagos p
            INNER JOIN socios s ON p.socio_id = s.id
            ORDER BY p.fecha DESC, p.id DESC
        ");
        $pagos = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $pagos]);
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
        
        if ($pago) {
            jsonResponse(['success' => true, 'data' => $pago]);
        } else {
            jsonResponse(['success' => false, 'message' => 'Pago no encontrado'], 404);
        }
    }
    
    // Obtener pagos de un socio
    else if (isset($_GET['socio_id'])) {
        $socio_id = intval($_GET['socio_id']);
        $stmt = $db->prepare("
            SELECT * FROM pagos 
            WHERE socio_id = ? 
            ORDER BY fecha DESC
        ");
        $stmt->execute([$socio_id]);
        $pagos = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'data' => $pagos]);
    }
    
    // Ingresos del mes
    else if (isset($_GET['action']) && $_GET['action'] === 'ingresos_mes') {
        $mes_actual = date('Y-m');
        $stmt = $db->prepare("
            SELECT SUM(monto) as total
            FROM pagos 
            WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
        ");
        $stmt->execute([$mes_actual]);
        $resultado = $stmt->fetch();
        
        jsonResponse([
            'success' => true,
            'data' => ['total' => $resultado['total'] ?? 0]
        ]);
    }
    
    // Total pagado por un socio
    else if (isset($_GET['action']) && $_GET['action'] === 'total_socio') {
        $socio_id = intval($_GET['socio_id'] ?? 0);
        
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
 * POST - Registrar pago
 */
function handlePost($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $socio_id = intval($input['socio_id'] ?? 0);
    $monto = floatval($input['monto'] ?? 0);
    $metodo_pago = sanitize($input['metodo_pago'] ?? '');
    $concepto = sanitize($input['concepto'] ?? 'Cuota Mensual');
    $fecha = date('Y-m-d');
    
    if ($socio_id <= 0 || $monto <= 0 || empty($metodo_pago)) {
        jsonResponse(['success' => false, 'message' => 'Datos incompletos'], 400);
    }
    
    // Verificar que el socio existe
    $stmt = $db->prepare("SELECT id, plan FROM socios WHERE id = ?");
    $stmt->execute([$socio_id]);
    $socio = $stmt->fetch();
    
    if (!$socio) {
        jsonResponse(['success' => false, 'message' => 'Socio no encontrado'], 404);
    }
    
    // Iniciar transacción
    $db->beginTransaction();
    
    try {
        // Insertar pago
        $stmt = $db->prepare("
            INSERT INTO pagos (socio_id, monto, fecha, metodo_pago, concepto) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$socio_id, $monto, $fecha, $metodo_pago, $concepto]);
        $pago_id = $db->lastInsertId();
        
        // Actualizar estado del socio y vencimiento
        $stmt = $db->prepare("SELECT duracion FROM planes WHERE nombre = ?");
        $stmt->execute([$socio['plan']]);
        $plan = $stmt->fetch();
        
        if ($plan) {
            $nueva_fecha_venc = date('Y-m-d', strtotime("+{$plan['duracion']} days"));
            
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
                'vencimiento' => $nueva_fecha_venc ?? null
            ]
        ], 201);
        
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
}

/**
 * DELETE - Eliminar pago
 */
function handleDelete($db) {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID inválido'], 400);
    }
    
    $stmt = $db->prepare("DELETE FROM pagos WHERE id = ?");
    
    if ($stmt->execute([$id])) {
        jsonResponse(['success' => true, 'message' => 'Pago eliminado exitosamente']);
    } else {
        jsonResponse(['success' => false, 'message' => 'Error al eliminar pago'], 500);
    }
}
?>