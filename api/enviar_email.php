<?php
/*POST: Envía email con credenciales de usuario o socio*/

// Evita que un warning/notice de PHP se cuele en el body y rompa el JSON
ob_start();
ini_set('display_errors', '0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../EmailService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    ob_clean();
    echo json_encode([
        'success' => false,
        'message' => 'Método no permitido. Solo POST.'
    ]);
    exit;
}

try {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (!$data) {
        throw new Exception('Datos JSON inválidos');
    }
    
    $tipo = $data['tipo'] ?? '';
    $destinatario = $data['destinatario'] ?? '';
    $nombre = $data['nombre'] ?? '';
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($destinatario) || empty($nombre) || empty($username) || empty($password)) {
        throw new Exception('Faltan campos obligatorios (destinatario, nombre, username, password)');
    }
    
    if (!filter_var($destinatario, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('El email destinatario no es válido');
    }
    
    // Determinar tipo de email a enviar
    if ($tipo === 'usuario') {
        $rol = $data['rol'] ?? 'Usuario';
        $resultado = EmailService::enviarCredencialesUsuario(
            $destinatario,
            $nombre,
            $username,
            $password,
            $rol
        );
        
    } elseif ($tipo === 'socio') {
        // Enviar credenciales de socio (incluye info del plan)
        $dni = $data['dni'] ?? '';
        $planNombre = $data['planNombre'] ?? 'Sin Plan';
        $vencimiento = $data['vencimiento'] ?? date('Y-m-d');
        $costo = floatval($data['costo'] ?? 0);
        
        if (empty($dni)) {
            throw new Exception('Falta el DNI del socio');
        }
        
        $resultado = EmailService::enviarCredencialesSocio(
            $destinatario,
            $nombre,
            $dni,
            $username,
            $password,
            $planNombre,
            $vencimiento,
            $costo
        );
        
    } else {
        throw new Exception('Tipo de email no válido. Use "usuario" o "socio".');
    }
    
    // Retornar resultado
    ob_clean();
    echo json_encode($resultado);
    
} catch (\Throwable $e) {
    error_log("Error en enviar_email.php: " . $e->getMessage());
    
    http_response_code(500);
    ob_clean();
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>