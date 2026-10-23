-- ============================================
-- DATOS SINTÉTICOS DE DEMOSTRACIÓN: THE BEST GYM
-- No contienen información de personas reales.
-- ============================================

USE thebestgym;

-- ============================================
-- INSERTAR PLANES
-- ============================================
INSERT INTO planes (id, nombre, duracion, costo, descripcion) VALUES
(1, 'Mensual', 30, 15000.00, 'Acceso completo por 1 mes'),
(2, 'Trimestral', 90, 40000.00, 'Acceso completo por 3 meses'),
(3, 'Anual', 365, 150000.00, 'Acceso completo por 1 año');

-- ============================================
-- INSERTAR SOCIOS
-- ============================================
INSERT INTO socios (id, nombre, dni, email, telefono, plan, estado, vencimiento, fecha_alta, fecha_nacimiento, genero, emergencia_nombre, emergencia_relacion, emergencia_telefono, grupo_sanguineo, alergias, lesiones) VALUES
(1, 'Socio Demo 1', '00000001', 'socio1@example.com', '000-0000001', 'Mensual', 'Activo', '2025-10-20', '2025-01-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 'Socio Demo 2', '00000002', 'socio2@example.com', '000-0000002', 'Trimestral', 'Moroso', '2025-10-05', '2025-02-10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 'Socio Demo 3', '00000003', 'socio3@example.com', '000-0000003', 'Anual', 'Activo', '2025-12-15', '2024-12-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(4, 'Socio Demo 4', '00000004', 'socio4@example.com', '000-0000004', 'Mensual', 'Activo', '2025-11-01', '2025-03-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- ============================================
-- INSERTAR USUARIOS
-- ============================================
-- Las cuentas demo usan hashes bcrypt; cambia sus contraseñas antes de usar el sistema.
INSERT INTO usuarios (id, username, password, nombre, rol, socio_id, instructor_id) VALUES
(1, 'admin_demo', '$2y$10$PjBgeqeBUY/bW8Vvmyzgsu5LJqbDwu1EKEdfCpF8i7GRD2mETWbp6', 'Administrador Demo', 'Administrador', NULL, NULL),
(2, 'recep_demo', '$2y$10$PjBgeqeBUY/bW8Vvmyzgsu5LJqbDwu1EKEdfCpF8i7GRD2mETWbp6', 'Recepcionista Demo', 'Recepcionista', NULL, NULL),
(3, 'socio_demo', '$2y$10$PjBgeqeBUY/bW8Vvmyzgsu5LJqbDwu1EKEdfCpF8i7GRD2mETWbp6', 'Socio Demo 1', 'Socio', 1, NULL),
(4, 'instructor_demo_1', '$2y$10$PjBgeqeBUY/bW8Vvmyzgsu5LJqbDwu1EKEdfCpF8i7GRD2mETWbp6', 'Instructor Demo 1', 'Instructor', NULL, NULL),
(5, 'instructor_demo_2', '$2y$10$PjBgeqeBUY/bW8Vvmyzgsu5LJqbDwu1EKEdfCpF8i7GRD2mETWbp6', 'Instructor Demo 2', 'Instructor', NULL, NULL),
(6, 'instructor_demo_3', '$2y$10$PjBgeqeBUY/bW8Vvmyzgsu5LJqbDwu1EKEdfCpF8i7GRD2mETWbp6', 'Instructor Demo 3', 'Instructor', NULL, NULL);

-- ============================================
-- INSERTAR INSTRUCTORES
-- ============================================
INSERT INTO instructores (id, usuario_id, nombre, especialidad, email, telefono, activo) VALUES
(1, 4, 'Instructor Demo 1', 'Musculación', 'instructor1@example.com', '000-0000011', TRUE),
(2, 5, 'Instructor Demo 2', 'Funcional', 'instructor2@example.com', '000-0000012', TRUE),
(3, 6, 'Instructor Demo 3', 'CrossFit', 'instructor3@example.com', '000-0000013', TRUE);

-- ============================================
-- INSERTAR CLASES_GYM (clases del gimnasio para instructores)
-- ============================================
INSERT INTO clases_gym (id, nombre, tipo, horario, duracion, cupo_maximo, instructor_id, activa) VALUES
(1, 'Spinning Mañana', 'Cardio', 'Lunes y Miércoles 09:00', '45 min', 20, NULL, TRUE),
(2, 'Funcional Tarde', 'Funcional', 'Martes y Jueves 18:00', '60 min', 15, 2, TRUE),
(3, 'CrossFit Noche', 'CrossFit', 'Lunes, Miércoles y Viernes 20:00', '60 min', 12, 3, TRUE),
(4, 'Yoga Mañana', 'Relajación', 'Martes y Jueves 10:00', '50 min', 25, NULL, TRUE),
(5, 'Musculación Personalizada', 'Musculación', 'Lunes a Viernes 14:00', '90 min', 10, 1, TRUE);

-- ============================================
-- INSERTAR ASISTENCIAS
-- ============================================
INSERT INTO asistencias (id, socio_id, fecha, hora) VALUES
(1, 1, '2025-10-14', '08:30:00'),
(2, 3, '2025-10-14', '09:15:00'),
(3, 1, '2025-10-13', '18:45:00'),
(4, 4, '2025-10-14', '07:00:00'),
(5, 3, '2025-10-13', '19:30:00'),
(6, 1, '2025-10-12', '08:15:00'),
(7, 1, '2025-10-11', '18:00:00'),
(8, 1, '2025-10-10', '08:30:00');

-- ============================================
-- INSERTAR PAGOS
-- ============================================
INSERT INTO pagos (id, socio_id, monto, fecha, metodo_pago, concepto) VALUES
(1, 1, 15000.00, '2025-09-20', 'Efectivo', 'Cuota Mensual'),
(2, 3, 150000.00, '2024-12-15', 'Transferencia', 'Plan Anual'),
(3, 4, 15000.00, '2025-10-01', 'Tarjeta', 'Cuota Mensual');

-- ============================================
-- INSERTAR TURNOS (clase_id referencia clases_gym)
-- ============================================
INSERT INTO turnos (id, socio_id, clase_id, fecha, estado) VALUES
(1, 1, 1, '2025-10-21', 'Confirmado'),
(2, 1, 4, '2025-10-23', 'Confirmado');

-- ============================================
-- INSERTAR CONFIGURACIÓN INICIAL (opcional)
-- ============================================
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('nombre_gimnasio', 'The Best Gym', 'Nombre del gimnasio'),
('email_contacto', 'contacto@example.com', 'Email de contacto'),
('telefono_contacto', '000-0000000', 'Teléfono de contacto'),
('direccion', 'Dirección de demostración', 'Dirección del gimnasio'),
('horario_apertura', '06:00', 'Hora de apertura'),
('horario_cierre', '23:00', 'Hora de cierre');
