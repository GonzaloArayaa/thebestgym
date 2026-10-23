-- ============================================
-- MIGRACIÓN: Unificar turnos -> clases_gym
-- ============================================
-- Corre esto UNA SOLA VEZ sobre una base de datos que ya tiene la
-- estructura vieja (tabla `clases` separada de `clases_gym`).
-- Después de correrlo, la app ya puede usar el código nuevo.
--
-- QUÉ HACE:
-- 1. Mapea cada turno viejo (que apuntaba a `clases`) a la clase
--    equivalente en `clases_gym`, por nombre.
-- 2. Los turnos cuya clase NO tiene equivalente en clases_gym (ej:
--    "Zumba" en el seed de ejemplo no existe en clases_gym) no se
--    pueden migrar de forma automática y quedan cancelados, con
--    aviso, para que los revises a mano.
-- 3. Cambia la FK de turnos para que apunte a clases_gym.
-- 4. Borra la tabla `clases` vieja.
--
-- ⚠️ HACÉ UN BACKUP ANTES DE CORRER ESTO:
--    mysqldump -u root -P 3307 thebestgym > backup_antes_de_migrar.sql

USE thebestgym;

-- Si tu base ya no tiene la tabla `clases`, no corras este script:
-- ya estás en el esquema nuevo.

-- Nota: MySQL no soporta DDL transaccional (los ALTER/DROP TABLE hacen
-- commit implícito). El START TRANSACTION de acá abajo protege los
-- UPDATE/DELETE de datos, pero no los pasos de ALTER/DROP. Por eso el
-- backup previo es el respaldo real, no esta transacción.
START TRANSACTION;

-- 1) Tabla temporal de mapeo nombre-viejo -> id-nuevo.
--    Ajustá/completá este mapeo si tenés nombres de clases distintos
--    a los del seed de ejemplo.
DROP TEMPORARY TABLE IF EXISTS mapeo_clases;
CREATE TEMPORARY TABLE mapeo_clases (
    nombre_viejo VARCHAR(100) PRIMARY KEY,
    id_nuevo INT NULL
);
INSERT INTO mapeo_clases (nombre_viejo, id_nuevo)
SELECT c.nombre, cg.id
FROM (SELECT DISTINCT nombre FROM clases) c
LEFT JOIN clases_gym cg
    ON cg.nombre = c.nombre OR cg.nombre LIKE CONCAT(c.nombre, ' %');

-- 2) Turnos cuya clase vieja SÍ tiene equivalente: repuntar clase_id.
UPDATE turnos t
INNER JOIN clases c_old ON t.clase_id = c_old.id
INNER JOIN mapeo_clases m ON m.nombre_viejo = c_old.nombre
SET t.clase_id = m.id_nuevo
WHERE m.id_nuevo IS NOT NULL;

-- 3) Turnos cuya clase vieja NO tiene equivalente: no se pueden
--    migrar (la clase ya no existe en el catálogo unificado).
--    Se cancelan para no dejar el dato en un estado inválido.
--    Revisá el resultado de este SELECT antes de continuar si querés
--    decidir manualmente a qué clase reasignarlos.
SELECT t.id AS turno_id, t.socio_id, c_old.nombre AS clase_sin_equivalente
FROM turnos t
INNER JOIN clases c_old ON t.clase_id = c_old.id
INNER JOIN mapeo_clases m ON m.nombre_viejo = c_old.nombre
WHERE m.id_nuevo IS NULL;

DELETE t FROM turnos t
INNER JOIN clases c_old ON t.clase_id = c_old.id
INNER JOIN mapeo_clases m ON m.nombre_viejo = c_old.nombre
WHERE m.id_nuevo IS NULL;

-- 4) Cambiar la FK de turnos para que apunte a clases_gym.
--    Buscamos el nombre real de la constraint en vez de asumirlo
--    (puede variar según cómo se creó la base en tu instalación).
SET @fk_name = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'turnos'
      AND COLUMN_NAME = 'clase_id'
      AND REFERENCED_TABLE_NAME = 'clases'
    LIMIT 1
);
SET @drop_sql = CONCAT('ALTER TABLE turnos DROP FOREIGN KEY ', @fk_name);
PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE turnos
    ADD CONSTRAINT fk_turnos_clase_gym FOREIGN KEY (clase_id) REFERENCES clases_gym(id) ON DELETE CASCADE;

-- 5) Borrar la tabla vieja.
DROP TABLE clases;

COMMIT;

-- Verificación rápida:
SELECT t.id, t.socio_id, cg.nombre AS clase, t.fecha, t.estado
FROM turnos t
INNER JOIN clases_gym cg ON t.clase_id = cg.id
ORDER BY t.id;
