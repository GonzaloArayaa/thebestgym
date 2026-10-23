<?php
/**Configuración de Email para The Best Gym*/

// Configuración del servidor SMTP
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_PORT', (int) (getenv('SMTP_PORT') ?: 587));
define('SMTP_USERNAME', getenv('SMTP_USERNAME') ?: '');
define('SMTP_PASSWORD', getenv('SMTP_PASSWORD') ?: '');
define('SMTP_ENCRYPTION', getenv('SMTP_ENCRYPTION') ?: 'tls');

// Configuración del remitente
define('EMAIL_FROM', getenv('EMAIL_FROM') ?: SMTP_USERNAME);
define('EMAIL_FROM_NAME', 'The Best Gym');

// Configuración general
define('EMAIL_CHARSET', 'UTF-8');
define('EMAIL_DEBUG', 0); 

// Validar que las credenciales no estén vacías
function validarConfiguracionEmail() {
    if (SMTP_USERNAME === '' || SMTP_PASSWORD === '') {
        return [
            'success' => false,
            'message' => '⚠️ Email no configurado. Define SMTP_USERNAME y SMTP_PASSWORD en el entorno.'
        ];
    }
    return ['success' => true];
}
?>
