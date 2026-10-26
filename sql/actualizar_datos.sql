-- ============================================================
-- THE BEST GYM - Actualización de datos de demostración
-- ------------------------------------------------------------
-- Se puede ejecutar varias veces sin duplicar datos. Las fechas
-- se calculan respecto del día en que se ejecuta.
--
--   mysql -h127.0.0.1 -P3307 -uroot --default-character-set=utf8mb4 < sql/actualizar_datos.sql
--
-- ORDEN: si tu base todavía tiene la tabla `clases` (esquema viejo), ejecuta
-- ANTES sql/migracion_unificar_turnos.sql (una sola vez) y haz un respaldo:
--   mysqldump -h127.0.0.1 -P3307 -uroot thebestgym > respaldo.sql
--
-- Qué hace:
--   1. Actualiza los precios de los planes.
--   2. Agrega instructores, clases con horarios y socios nuevos.
--   3. Crea cuentas de demostración (contraseña: Demo2026):
--      demo_admin, demo_recep, demo_socio y un usuario por instructor nuevo.
--   4. Pone al día vencimientos, pagos, asistencias y turnos.
--
-- IMPORTANTE: es solo para demostración. Cambia las contraseñas
-- antes de usar el sistema con datos reales.
-- ============================================================

SET NAMES utf8mb4;
USE thebestgym;

-- ------------------------------------------------------------
-- 1. PLANES
-- ------------------------------------------------------------
INSERT INTO planes (nombre, duracion, costo, descripcion)
SELECT 'Semanal', 7, 10000.00, 'Acceso por 1 semana'
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Semanal');

UPDATE planes SET costo = 10000.00, duracion = 7 WHERE nombre = 'Semanal';
UPDATE planes SET costo = 35000.00  WHERE nombre = 'Mensual';
UPDATE planes SET costo = 75000.00  WHERE nombre = 'Trimestral';
UPDATE planes SET costo = 380000.00 WHERE nombre = 'Anual';

-- ------------------------------------------------------------
-- 2. INSTRUCTORES (usuario + ficha)
-- ------------------------------------------------------------
CREATE TEMPORARY TABLE tmp_instr (
    username VARCHAR(50), nombre VARCHAR(100), especialidad VARCHAR(100),
    email VARCHAR(100), telefono VARCHAR(20)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
INSERT INTO tmp_instr VALUES
('vquiroga', 'Valeria Quiroga',  'Pilates',   'vquiroga@example.com', '261-555-0201'),
('srojas',   'Sebastián Rojas',  'Boxeo',     'srojas@example.com',   '261-555-0202'),
('cherrera', 'Camila Herrera',   'Zumba',     'cherrera@example.com', '261-555-0203'),
('nparedes', 'Nicolás Paredes',  'Spinning',  'nparedes@example.com', '261-555-0204'),
('jibanez',  'Julieta Ibáñez',   'Yoga',      'jibanez@example.com',  '261-555-0205');

INSERT IGNORE INTO usuarios (username, password, nombre, rol)
SELECT username, '$2y$10$pYYlq12HXZXNJ9ohBREU8OTPet6DaybZw7sWWX0fdkvTMT1he/Nda', nombre, 'Instructor' FROM tmp_instr;

INSERT INTO instructores (usuario_id, nombre, especialidad, email, telefono)
SELECT u.id, t.nombre, t.especialidad, t.email, t.telefono
FROM tmp_instr t
JOIN usuarios u ON u.username = t.username
WHERE NOT EXISTS (SELECT 1 FROM instructores i WHERE i.usuario_id = u.id);

-- ------------------------------------------------------------
-- 3. CLASES Y HORARIOS
-- ------------------------------------------------------------
CREATE TEMPORARY TABLE tmp_clases (
    nombre VARCHAR(100), tipo VARCHAR(50), horario VARCHAR(100),
    duracion VARCHAR(20), cupo INT, instructor VARCHAR(100)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
INSERT INTO tmp_clases VALUES
('Pilates Mañana',         'Relajación',  'Lunes, Miércoles y Viernes 08:00', '50 min',  15, 'Valeria Quiroga'),
('Boxeo Funcional',        'Funcional',   'Martes y Jueves 19:00',            '60 min',  14, 'Sebastián Rojas'),
('Zumba Noche',            'Cardio',      'Lunes y Miércoles 20:30',          '55 min',  30, 'Camila Herrera'),
('Spinning Tarde',         'Cardio',      'Martes y Jueves 17:00',            '45 min',  20, 'Nicolás Paredes'),
('Yoga Sábado',            'Relajación',  'Sábados 10:00',                    '60 min',  25, 'Julieta Ibáñez'),
('HIIT Express',           'Funcional',   'Lunes a Viernes 07:00',            '30 min',  16, 'Laura Trainer'),
('CrossFit Mañana',        'CrossFit',    'Martes, Jueves y Sábados 09:00',   '60 min',  12, 'Miguel Strong'),
('Musculación Guiada',     'Musculación', 'Lunes a Viernes 18:00',            '75 min',  18, 'Carlos Fitness'),
('Stretching y Movilidad', 'Relajación',  'Viernes 19:00',                    '40 min',  20, 'Valeria Quiroga'),
('Spinning Sábado',        'Cardio',      'Sábados 11:30',                    '45 min',  20, 'Nicolás Paredes');

INSERT INTO clases_gym (nombre, tipo, horario, duracion, cupo_maximo, instructor_id)
SELECT t.nombre, t.tipo, t.horario, t.duracion, t.cupo,
       (SELECT i.id FROM instructores i WHERE i.nombre = t.instructor LIMIT 1)
FROM tmp_clases t
WHERE NOT EXISTS (SELECT 1 FROM clases_gym c WHERE c.nombre = t.nombre);

-- ------------------------------------------------------------
-- 4. SOCIOS NUEVOS (dni único: si ya existen se omiten)
--    vencimiento / alta relativos a hoy
-- ------------------------------------------------------------
INSERT IGNORE INTO socios
    (nombre, dni, email, telefono, plan, estado, vencimiento, fecha_alta,
     fecha_nacimiento, genero, emergencia_nombre, emergencia_relacion,
     emergencia_telefono, grupo_sanguineo, alergias, lesiones)
VALUES
('Sofía Benítez',     '41000001', 'sofia.benitez@example.com',     '261-555-0101', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 18 DAY),  DATE_SUB(CURDATE(), INTERVAL 200 DAY), '1998-03-14', 'Femenino',  'Marta Benítez',    'Madre',   '261-555-0301', 'A+',  NULL,         NULL),
('Mateo Fernández',   '41000002', 'mateo.fernandez@example.com',   '261-555-0102', 'Trimestral', 'Activo', DATE_ADD(CURDATE(), INTERVAL 62 DAY),  DATE_SUB(CURDATE(), INTERVAL 150 DAY), '1995-07-02', 'Masculino', 'Jorge Fernández',  'Padre',   '261-555-0302', '0+',  NULL,         'Rodilla derecha'),
('Valentina Ruiz',    '41000003', 'valentina.ruiz@example.com',    '261-555-0103', 'Anual',      'Activo', DATE_ADD(CURDATE(), INTERVAL 240 DAY), DATE_SUB(CURDATE(), INTERVAL 125 DAY), '2000-11-23', 'Femenino',  'Laura Ruiz',       'Hermana', '261-555-0303', 'B+',  'Polen',      NULL),
('Santiago Molina',   '41000004', 'santiago.molina@example.com',   '261-555-0104', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 5 DAY),   DATE_SUB(CURDATE(), INTERVAL 95 DAY),  '1992-01-30', 'Masculino', 'Ana Molina',       'Esposa',  '261-555-0304', 'A-',  NULL,         NULL),
('Camila Acosta',     '41000005', 'camila.acosta@example.com',     '261-555-0105', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 2 DAY),   DATE_SUB(CURDATE(), INTERVAL 60 DAY),  '1999-05-18', 'Femenino',  'Rosa Acosta',      'Madre',   '261-555-0305', 'O-',  NULL,         NULL),
('Lucas Romero',      '41000006', 'lucas.romero@example.com',      '261-555-0106', 'Trimestral', 'Activo', DATE_ADD(CURDATE(), INTERVAL 45 DAY),  DATE_SUB(CURDATE(), INTERVAL 45 DAY),  '1990-09-09', 'Masculino', 'Elena Romero',     'Madre',   '261-555-0306', 'AB+', NULL,         NULL),
('Julieta Castro',    '41000007', 'julieta.castro@example.com',    '261-555-0107', 'Semanal',    'Activo', DATE_ADD(CURDATE(), INTERVAL 3 DAY),   DATE_SUB(CURDATE(), INTERVAL 25 DAY),  '2001-12-04', 'Femenino',  'Pablo Castro',     'Padre',   '261-555-0307', 'A+',  NULL,         NULL),
('Tomás Herrera',     '41000008', 'tomas.herrera@example.com',     '261-555-0108', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 27 DAY),  DATE_SUB(CURDATE(), INTERVAL 330 DAY), '1988-04-21', 'Masculino', 'Silvia Herrera',   'Esposa',  '261-555-0308', '0+',  'Penicilina', NULL),
('Martina Sosa',      '41000009', 'martina.sosa@example.com',      '261-555-0109', 'Anual',      'Activo', DATE_ADD(CURDATE(), INTERVAL 310 DAY), DATE_SUB(CURDATE(), INTERVAL 55 DAY),  '1996-08-16', 'Femenino',  'Diego Sosa',       'Hermano', '261-555-0309', 'B-',  NULL,         NULL),
('Joaquín Medina',    '41000010', 'joaquin.medina@example.com',    '261-555-0110', 'Trimestral', 'Activo', DATE_ADD(CURDATE(), INTERVAL 80 DAY),  DATE_SUB(CURDATE(), INTERVAL 10 DAY),  '1993-02-11', 'Masculino', 'Carmen Medina',    'Madre',   '261-555-0310', 'A+',  NULL,         'Hombro izquierdo'),
('Agustina Ríos',     '41000011', 'agustina.rios@example.com',     '261-555-0111', 'Mensual',    'Activo', DATE_SUB(CURDATE(), INTERVAL 4 DAY),   DATE_SUB(CURDATE(), INTERVAL 140 DAY), '1997-06-27', 'Femenino',  'Luis Ríos',        'Padre',   '261-555-0311', 'O+',  NULL,         NULL),
('Franco Gutiérrez',  '41000012', 'franco.gutierrez@example.com',  '261-555-0112', 'Mensual',    'Activo', DATE_SUB(CURDATE(), INTERVAL 12 DAY),  DATE_SUB(CURDATE(), INTERVAL 220 DAY), '1991-10-05', 'Masculino', 'Noelia Gutiérrez', 'Esposa',  '261-555-0312', 'A+',  NULL,         NULL),
('Lucía Peralta',     '41000013', 'lucia.peralta@example.com',     '261-555-0113', 'Semanal',    'Activo', DATE_SUB(CURDATE(), INTERVAL 9 DAY),   DATE_SUB(CURDATE(), INTERVAL 40 DAY),  '2002-03-29', 'Femenino',  'Gabriela Peralta', 'Madre',   '261-555-0313', 'B+',  NULL,         NULL),
('Nahuel Vega',       '41000014', 'nahuel.vega@example.com',       '261-555-0114', 'Trimestral', 'Activo', DATE_SUB(CURDATE(), INTERVAL 21 DAY),  DATE_SUB(CURDATE(), INTERVAL 180 DAY), '1994-12-13', 'Masculino', 'Mirta Vega',       'Madre',   '261-555-0314', '0-',  NULL,         NULL),
('Abril Domínguez',   '41000015', 'abril.dominguez@example.com',   '261-555-0115', 'Mensual',    'Activo', DATE_SUB(CURDATE(), INTERVAL 33 DAY),  DATE_SUB(CURDATE(), INTERVAL 260 DAY), '1999-09-01', 'Femenino',  'Raúl Domínguez',   'Padre',   '261-555-0315', 'A+',  NULL,         NULL),
('Bruno Silva',       '41000016', 'bruno.silva@example.com',       '261-555-0116', 'Anual',      'Activo', DATE_ADD(CURDATE(), INTERVAL 150 DAY), DATE_SUB(CURDATE(), INTERVAL 215 DAY), '1987-05-07', 'Masculino', 'Paula Silva',      'Esposa',  '261-555-0316', 'O+',  NULL,         'Lumbar'),
('Renata Paz',        '41000017', 'renata.paz@example.com',        '261-555-0117', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 11 DAY),  DATE_SUB(CURDATE(), INTERVAL 19 DAY),  '2003-01-19', 'Otro',      'Inés Paz',         'Madre',   '261-555-0317', 'A+',  NULL,         NULL),
('Emiliano Torres',   '41000018', 'emiliano.torres@example.com',   '261-555-0118', 'Trimestral', 'Activo', DATE_ADD(CURDATE(), INTERVAL 33 DAY),  DATE_SUB(CURDATE(), INTERVAL 57 DAY),  '1989-07-25', 'Masculino', 'Cecilia Torres',   'Esposa',  '261-555-0318', 'AB-', NULL,         NULL),
('Victoria Navarro',  '41000019', 'victoria.navarro@example.com',  '261-555-0119', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 8 DAY),   DATE_SUB(CURDATE(), INTERVAL 80 DAY),  '1998-11-11', 'Femenino',  'Hugo Navarro',     'Padre',   '261-555-0319', 'B+',  NULL,         NULL),
('Ignacio Campos',    '41000020', 'ignacio.campos@example.com',    '261-555-0120', 'Mensual',    'Activo', DATE_ADD(CURDATE(), INTERVAL 22 DAY),  DATE_SUB(CURDATE(), INTERVAL 105 DAY), '1994-04-03', 'Masculino', 'Teresa Campos',    'Madre',   '261-555-0320', '0+',  NULL,         NULL);

-- ------------------------------------------------------------
-- 5. CUENTAS DE DEMOSTRACIÓN (contraseña: Demo2026)
-- ------------------------------------------------------------
INSERT IGNORE INTO usuarios (username, password, nombre, rol)
VALUES ('demo_admin', '$2y$10$pYYlq12HXZXNJ9ohBREU8OTPet6DaybZw7sWWX0fdkvTMT1he/Nda', 'Administrador Demo', 'Administrador'),
       ('demo_recep', '$2y$10$pYYlq12HXZXNJ9ohBREU8OTPet6DaybZw7sWWX0fdkvTMT1he/Nda', 'Recepcionista Demo',  'Recepcionista');

INSERT IGNORE INTO usuarios (username, password, nombre, rol, socio_id)
SELECT 'demo_socio', '$2y$10$pYYlq12HXZXNJ9ohBREU8OTPet6DaybZw7sWWX0fdkvTMT1he/Nda', s.nombre, 'Socio', s.id FROM socios s WHERE s.dni = '41000001';

-- ------------------------------------------------------------
-- 6. VENCIMIENTOS AL DÍA
--    Los socios que llevan más de 30 días vencidos se renuevan con
--    fechas repartidas (algunos vigentes, otros vencidos hace poco).
-- ------------------------------------------------------------
UPDATE socios
SET vencimiento = DATE_ADD(CURDATE(), INTERVAL ((id * 11) MOD 50 - 12) DAY)
WHERE vencimiento < DATE_SUB(CURDATE(), INTERVAL 30 DAY);

UPDATE socios SET estado = IF(vencimiento < CURDATE(), 'Moroso', 'Activo')
WHERE estado IN ('Activo', 'Moroso');

-- ------------------------------------------------------------
-- 7. PAGOS: último pago de cada socio (fecha = inicio del período vigente)
-- ------------------------------------------------------------
INSERT INTO pagos (socio_id, monto, fecha, metodo_pago, concepto)
SELECT s.id, p.costo,
       GREATEST(s.fecha_alta, DATE_SUB(s.vencimiento, INTERVAL p.duracion DAY)),
       ELT(1 + s.id MOD 3, 'Efectivo', 'Transferencia', 'Tarjeta'),
       CONCAT('Cuota ', p.nombre)
FROM socios s
JOIN planes p ON p.nombre = s.plan
WHERE GREATEST(s.fecha_alta, DATE_SUB(s.vencimiento, INTERVAL p.duracion DAY)) <= CURDATE()
  AND NOT EXISTS (
      SELECT 1 FROM pagos x
      WHERE x.socio_id = s.id
        AND x.fecha = GREATEST(s.fecha_alta, DATE_SUB(s.vencimiento, INTERVAL p.duracion DAY))
  );

-- ------------------------------------------------------------
-- 8. ASISTENCIAS de los últimos 14 días (solo socios con cuota vigente ese día)
-- ------------------------------------------------------------
INSERT INTO asistencias (socio_id, fecha, hora)
SELECT s.id, DATE_SUB(CURDATE(), INTERVAL n.n DAY),
       MAKETIME(7 + (s.id + n.n) MOD 14, (s.id * 7 + n.n * 11) MOD 60, 0)
FROM socios s
JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
      UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
      UNION ALL SELECT 13) n
WHERE (s.id + n.n) MOD 3 = 0
  AND s.vencimiento >= DATE_SUB(CURDATE(), INTERVAL n.n DAY)
  AND s.fecha_alta <= DATE_SUB(CURDATE(), INTERVAL n.n DAY)
  AND NOT EXISTS (
      SELECT 1 FROM asistencias a
      WHERE a.socio_id = s.id AND a.fecha = DATE_SUB(CURDATE(), INTERVAL n.n DAY)
  );

-- ------------------------------------------------------------
-- 9. TURNOS: los pasados quedan completados y se agregan reservas próximas
-- ------------------------------------------------------------
UPDATE turnos SET estado = 'Completado' WHERE estado = 'Confirmado' AND fecha < CURDATE();

INSERT INTO turnos (socio_id, clase_id, fecha, estado)
SELECT s.id, c.id, DATE_ADD(CURDATE(), INTERVAL 1 + (s.id MOD 6) DAY), 'Confirmado'
FROM socios s
JOIN clases_gym c ON c.id = (SELECT MIN(id) FROM clases_gym WHERE activa = 1) + (s.id MOD 8)
WHERE s.estado = 'Activo' AND s.id MOD 2 = 0
  AND NOT EXISTS (
      SELECT 1 FROM turnos t
      WHERE t.socio_id = s.id AND t.clase_id = c.id AND t.estado = 'Confirmado'
  );
