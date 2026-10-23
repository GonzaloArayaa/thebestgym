<?php
require_once 'db_connection.php';

try {
    $db = getDB();
    echo "✅ Conexión exitosa a MySQL<br>";
    echo "Puerto: " . DB_PORT . "<br>";
    echo "Base de datos: " . DB_NAME . "<br>";
    
    // Probar consulta
    $stmt = $db->query("SELECT COUNT(*) as total FROM socios");
    $result = $stmt->fetch();
    echo "Total de socios en DB: " . $result['total'];
    
} catch(Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
?>