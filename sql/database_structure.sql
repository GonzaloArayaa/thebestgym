-- ============================================
-- BASE DE DATOS: THE BEST GYM
-- ============================================

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS thebestgym CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE thebestgym;

-- ============================================
-- TABLA: usuarios
-- ============================================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol ENUM('Administrador', 'Recepcionista', 'Socio', 'Instructor') NOT NULL,
    socio_id INT NULL,
    instructor_id INT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: socios
-- ============================================
CREATE TABLE socios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    plan VARCHAR(50) NOT NULL,
    estado ENUM('Activo', 'Moroso', 'Inactivo') DEFAULT 'Activo',
    vencimiento DATE NOT NULL,
    fecha_alta DATE NOT NULL,
    fecha_nacimiento DATE NULL,
    genero ENUM('Masculino', 'Femenino', 'Otro') NULL,
    
    -- Contacto de emergencia
    emergencia_nombre VARCHAR(100) NULL,
    emergencia_relacion VARCHAR(50) NULL,
    emergencia_telefono VARCHAR(20) NULL,
    
    -- Información médica
    grupo_sanguineo VARCHAR(5) NULL,
    alergias TEXT NULL,
    lesiones TEXT NULL,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_dni (dni),
    INDEX idx_estado (estado),
    INDEX idx_vencimiento (vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: planes
-- ============================================
CREATE TABLE planes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    duracion INT NOT NULL COMMENT 'Duración en días',
    costo DECIMAL(10, 2) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: instructores
-- ============================================
CREATE TABLE instructores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    especialidad VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: clases_gym
-- ============================================
CREATE TABLE clases_gym (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    horario VARCHAR(100) NOT NULL,
    duracion VARCHAR(20) NOT NULL,
    cupo_maximo INT NOT NULL,
    instructor_id INT NULL,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES instructores(id) ON DELETE SET NULL,
    INDEX idx_instructor (instructor_id),
    INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: asistencias
-- ============================================
CREATE TABLE asistencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    socio_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE,
    INDEX idx_socio (socio_id),
    INDEX idx_fecha (fecha),
    INDEX idx_socio_fecha (socio_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: pagos
-- ============================================
CREATE TABLE pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    socio_id INT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    fecha DATE NOT NULL,
    metodo_pago ENUM('Efectivo', 'Transferencia', 'Tarjeta') NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    observaciones TEXT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE,
    INDEX idx_socio (socio_id),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: turnos
-- ============================================
-- clase_id referencia directamente a clases_gym: es la ÚNICA tabla de
-- clases del sistema. Los cupos ocupados NO se guardan como contador
-- (eso es lo que se desincronizaba); se calculan siempre con
-- COUNT(*) de turnos Confirmados para esa clase, en el momento de la consulta.
CREATE TABLE turnos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    socio_id INT NOT NULL,
    clase_id INT NOT NULL,
    fecha DATE NOT NULL,
    estado ENUM('Confirmado', 'Cancelado', 'Completado') DEFAULT 'Confirmado',
    fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cancelacion TIMESTAMP NULL,
    FOREIGN KEY (socio_id) REFERENCES socios(id) ON DELETE CASCADE,
    FOREIGN KEY (clase_id) REFERENCES clases_gym(id) ON DELETE CASCADE,
    INDEX idx_socio (socio_id),
    INDEX idx_clase (clase_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: configuracion (opcional, para futuras configuraciones)
-- ============================================
CREATE TABLE configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;