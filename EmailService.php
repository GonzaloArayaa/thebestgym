<?php
/**
 * Servicio de envío de correos electrónicos
 * Utiliza PHPMailer para enviar emails con credenciales y notificaciones
 */

require_once __DIR__ . '/email_config.php';

// Importar PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/vendor/autoload.php';


class EmailService {
    
    public static function enviarCredencialesUsuario($destinatario, $nombreUsuario, $username, $password, $rol) {
        $validacion = validarConfiguracionEmail();
        if (!$validacion['success']) {
            return $validacion;
        }

        $mail = self::configurarMailer();
        
        try {
            $mail->addAddress($destinatario, $nombreUsuario);
            $mail->Subject = 'Bienvenido a The Best Gym - Tus Credenciales de Acceso';
            $mail->isHTML(true);
            $mail->Body = self::plantillaCredencialesUsuario($nombreUsuario, $username, $password, $rol);
            $mail->AltBody = self::plantillaCredencialesTextoPlano($nombreUsuario, $username, $password, $rol);
            $mail->send();
            
            return [
                'success' => true,
                'message' => 'Credenciales enviadas exitosamente a ' . $destinatario
            ];
            
        } catch (\Throwable $e) {
            error_log("Error al enviar email: " . $mail->ErrorInfo);
            return [
                'success' => false,
                'message' => 'No se pudo enviar el email: ' . $mail->ErrorInfo
            ];
        }
    }
    
    /**
     * Envía credenciales de nuevo socio
     */
    public static function enviarCredencialesSocio($destinatario, $nombreSocio, $dni, $username, $password, $planNombre, $vencimiento, $costo) {
        // Validar configuración
        $validacion = validarConfiguracionEmail();
        if (!$validacion['success']) {
            return $validacion;
        }

        $mail = self::configurarMailer();
        
        try {
            $mail->addAddress($destinatario, $nombreSocio);
            $mail->Subject = '¡Bienvenido a The Best Gym! - Tu Membresía Está Activa';
            
            $mail->isHTML(true);
            $mail->Body = self::plantillaCredencialesSocio($nombreSocio, $dni, $username, $password, $planNombre, $vencimiento, $costo);
            $mail->AltBody = self::plantillaCredencialesSocioTextoPlano($nombreSocio, $dni, $username, $password, $planNombre, $vencimiento, $costo);
            
            $mail->send();
            
            return [
                'success' => true,
                'message' => 'Credenciales enviadas exitosamente a ' . $destinatario
            ];
            
        } catch (\Throwable $e) {
            error_log("Error al enviar email: " . $mail->ErrorInfo);
            return [
                'success' => false,
                'message' => 'No se pudo enviar el email: ' . $mail->ErrorInfo
            ];
        }
    }
    
    /**
     * Configura el objeto PHPMailer con los parámetros SMTP
     */
    private static function configurarMailer() {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = SMTP_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = SMTP_USERNAME;
        $mail->Password = SMTP_PASSWORD;
        $mail->SMTPSecure = SMTP_ENCRYPTION;
        $mail->Port = SMTP_PORT;
        $mail->CharSet = EMAIL_CHARSET;
        
        // Configuración del remitente
        $mail->setFrom(EMAIL_FROM, EMAIL_FROM_NAME);
        
        // Debug (solo en desarrollo) - va al log de PHP, no al output,
        // para no romper la respuesta JSON
        $mail->SMTPDebug = EMAIL_DEBUG;
        $mail->Debugoutput = 'error_log';
        
        return $mail;
    }
    
    /**
     * Plantilla HTML para credenciales de usuario
     */
    private static function plantillaCredencialesUsuario($nombre, $username, $password, $rol) {
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { margin: 0; font-size: 28px; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .credential-item { margin: 15px 0; padding: 10px; background: #f1f3f5; border-radius: 5px; }
                .credential-label { font-weight: bold; color: #667eea; display: block; margin-bottom: 5px; }
                .credential-value { font-size: 18px; color: #333; font-family: 'Courier New', monospace; background: white; padding: 8px; border-radius: 4px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🏋️ The Best Gym</h1>
                    <p style='margin: 10px 0 0 0; font-size: 16px;'>Sistema de Gestión</p>
                </div>
                
                <div class='content'>
                    <h2>¡Hola {$nombre}! 👋</h2>
                    
                    <p>Tu cuenta de <strong>{$rol}</strong> ha sido creada exitosamente en nuestro sistema.</p>
                    
                    <div class='credentials'>
                        <h3 style='margin-top: 0; color: #667eea;'>🔐 Tus Credenciales de Acceso</h3>
                        
                        <div class='credential-item'>
                            <span class='credential-label'>Usuario:</span>
                            <code class='credential-value'>{$username}</code>
                        </div>
                        
                        <div class='credential-item'>
                            <span class='credential-label'>Contraseña:</span>
                            <code class='credential-value'>{$password}</code>
                        </div>
                    </div>
                    
                    <div class='warning'>
                        <strong>⚠️ Importante:</strong>
                        <ul style='margin: 10px 0 0 0; padding-left: 20px;'>
                            <li>Guarda estas credenciales en un lugar seguro</li>
                            <li>No compartas tu contraseña con nadie</li>
                            <li>Puedes cambiar tu contraseña después del primer ingreso</li>
                        </ul>
                    </div>
                    
                    <p style='text-align: center;'>
                        <a href='http://localhost/thebestgym' class='button'>🚀 Ingresar al Sistema</a>
                    </p>
                    
                    <p>Si tienes alguna duda o problema para ingresar, no dudes en contactarnos.</p>
                </div>
                
                <div class='footer'>
                    <p><strong>The Best Gym</strong></p>
                    <p>Este es un correo automático, por favor no responder.</p>
                    <p style='font-size: 12px; color: #adb5bd;'>Fecha de envío: " . date('d/m/Y H:i') . "</p>
                </div>
            </div>
        </body>
        </html>
        ";
    }
    
    /**
     * Plantilla HTML para credenciales de socio
     */
    private static function plantillaCredencialesSocio($nombre, $dni, $username, $password, $plan, $vencimiento, $costo) {
        $vencimientoFormateado = date('d/m/Y', strtotime($vencimiento));
        $costoFormateado = '$' . number_format($costo, 0, ',', '.');
        
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { margin: 0; font-size: 28px; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .welcome-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; text-align: center; margin: 20px 0; }
                .plan-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #11998e; }
                .plan-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
                .plan-item:last-child { border-bottom: none; }
                .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .credential-item { margin: 15px 0; padding: 10px; background: #f1f3f5; border-radius: 5px; }
                .credential-label { font-weight: bold; color: #667eea; display: block; margin-bottom: 5px; }
                .credential-value { font-size: 18px; color: #333; font-family: 'Courier New', monospace; background: white; padding: 8px; border-radius: 4px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
                .button { display: inline-block; background: #11998e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>🏋️ The Best Gym</h1>
                    <p style='margin: 10px 0 0 0; font-size: 18px;'>¡Bienvenido a la familia!</p>
                </div>
                
                <div class='content'>
                    <div class='welcome-box'>
                        <h2 style='margin: 0 0 10px 0;'>🎉 ¡Hola {$nombre}!</h2>
                        <p style='margin: 0; font-size: 18px;'>Tu membresía está activa</p>
                    </div>
                    
                    <div class='plan-info'>
                        <h3 style='margin-top: 0; color: #11998e;'>📋 Detalles de tu Membresía</h3>
                        
                        <div class='plan-item'>
                            <span><strong>DNI:</strong></span>
                            <span>{$dni}</span>
                        </div>
                        
                        <div class='plan-item'>
                            <span><strong>Plan:</strong></span>
                            <span style='color: #11998e; font-weight: bold;'>{$plan}</span>
                        </div>
                        
                        <div class='plan-item'>
                            <span><strong>Vencimiento:</strong></span>
                            <span>{$vencimientoFormateado}</span>
                        </div>
                        
                        <div class='plan-item'>
                            <span><strong>Inversión:</strong></span>
                            <span style='font-size: 20px; font-weight: bold; color: #11998e;'>{$costoFormateado}</span>
                        </div>
                    </div>
                    
                    <div class='credentials'>
                        <h3 style='margin-top: 0; color: #667eea;'>🔐 Acceso al Portal de Socios</h3>
                        
                        <p>Ingresa con estas credenciales para ver tu plan, reservar turnos y más:</p>
                        
                        <div class='credential-item'>
                            <span class='credential-label'>Usuario:</span>
                            <code class='credential-value'>{$username}</code>
                        </div>
                        
                        <div class='credential-item'>
                            <span class='credential-label'>Contraseña:</span>
                            <code class='credential-value'>{$password}</code>
                        </div>
                    </div>
                    
                    <div class='warning'>
                        <strong>⚠️ Recordatorios Importantes:</strong>
                        <ul style='margin: 10px 0 0 0; padding-left: 20px;'>
                            <li>Trae tu DNI en cada visita al gimnasio</li>
                            <li>Renueva tu membresía antes del vencimiento</li>
                            <li>Puedes cambiar tu contraseña desde tu perfil</li>
                            <li>Guarda estas credenciales en un lugar seguro</li>
                        </ul>
                    </div>
                    
                    <p style='text-align: center;'>
                        <a href='http://localhost/thebestgym' class='button'>🚀 Ingresar al Portal</a>
                    </p>
                    
                    <p style='text-align: center; margin-top: 30px; font-size: 18px;'>
                        <strong>¡Nos vemos en el gimnasio! 💪</strong>
                    </p>
                </div>
                
                <div class='footer'>
                    <p><strong>The Best Gym</strong></p>
                    <p>¿Necesitas ayuda? Contáctanos en el gimnasio o por nuestros canales oficiales.</p>
                    <p style='font-size: 12px; color: #adb5bd;'>Fecha de envío: " . date('d/m/Y H:i') . "</p>
                </div>
            </div>
        </body>
        </html>
        ";
    }
    
    /**
     * Plantilla texto plano para usuarios
     */
    private static function plantillaCredencialesTextoPlano($nombre, $username, $password, $rol) {
        return "
THE BEST GYM - CREDENCIALES DE ACCESO
=====================================

¡Hola {$nombre}!

Tu cuenta de {$rol} ha sido creada exitosamente.

CREDENCIALES:
-------------
Usuario: {$username}
Contraseña: {$password}

IMPORTANTE:
- Guarda estas credenciales en un lugar seguro
- No compartas tu contraseña con nadie
- Puedes cambiar tu contraseña después del primer ingreso

Accede al sistema en: http://localhost/thebestgym

Fecha: " . date('d/m/Y H:i') . "

The Best Gym - Sistema de Gestión
        ";
    }
    
    /**
     * Plantilla texto plano para socios
     */
    private static function plantillaCredencialesSocioTextoPlano($nombre, $dni, $username, $password, $plan, $vencimiento, $costo) {
        $vencimientoFormateado = date('d/m/Y', strtotime($vencimiento));
        $costoFormateado = '$' . number_format($costo, 0, ',', '.');
        
        return "
THE BEST GYM - ¡BIENVENIDO!
===========================

¡Hola {$nombre}! Tu membresía está activa.

DETALLES DE TU MEMBRESÍA:
-------------------------
DNI: {$dni}
Plan: {$plan}
Vencimiento: {$vencimientoFormateado}
Inversión: {$costoFormateado}

CREDENCIALES DE ACCESO:
-----------------------
Usuario: {$username}
Contraseña: {$password}

IMPORTANTE:
- Trae tu DNI en cada visita
- Renueva antes del vencimiento
- Accede al portal: http://localhost/thebestgym

¡Nos vemos en el gimnasio! 💪

Fecha: " . date('d/m/Y H:i') . "

The Best Gym
        ";
    }
}
?>