function generateMenu() {
    const nav = document.getElementById("sidebarNav");
    nav.innerHTML = "";
    const menuItems = [
        {
            id: "dashboard",
            label: "Dashboard",
            icon: "fa-chart-line",
            roles: ["Administrador", "Recepcionista"],
        },
        {
            id: "usuarios",
            label: "Usuarios",
            icon: "fa-users-cog",
            roles: ["Administrador"],
        },
        {
            id: "socios",
            label: "Socios",
            icon: "fa-users",
            roles: ["Administrador", "Recepcionista"],
        },
        {
            id: "asistencias",
            label: "Asistencias",
            icon: "fa-calendar-check",
            roles: ["Recepcionista"],
        },
        {
            id: "pagos",
            label: "Pagos",
            icon: "fa-dollar-sign",
            roles: ["Administrador", "Recepcionista"],
        },
        {
            id: "turnos",
            label: "Gestión de Turnos",
            icon: "fa-calendar-alt",
            roles: ["Recepcionista"],
        },
        {
            id: "clasesInstructores",
            label: "Clases",
            icon: "fa-chalkboard-teacher",
            roles: ["Administrador", "Recepcionista"],
        },
        {
            id: "planes",
            label: "Planes",
            icon: "fa-file-alt",
            roles: ["Administrador", "Recepcionista"],
        },
        {
            id: "reportes",
            label: "Reportes",
            icon: "fa-chart-bar",
            roles: ["Administrador"],
        },
        {
            id: "perfil",
            label: "Mi Perfil",
            icon: "fa-user-circle",
            roles: ["Socio"],
        },
        {
            id: "miPlan",
            label: "Mi Plan",
            icon: "fa-id-card",
            roles: ["Socio"],
        },
        {
            id: "misClases",
            label: "Mis Clases",
            icon: "fa-chalkboard-teacher",
            roles: ["Instructor"],
        },
        {
            id: "turnos",
            label: "Mis Turnos",
            icon: "fa-calendar-alt",
            roles: ["Socio"],
        },
    ];

    if (!currentUser) return;

    menuItems
        .filter((item) => item.roles.includes(currentUser.rol))
        .forEach((item) => {
            const button = document.createElement("button");
            button.className = "nav-item";
            button.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>`;
            button.addEventListener("click", (e) => showModule(item.id, e));
            nav.appendChild(button);
        });
}
// DATOS INICIALES
let currentUser = null;
let activeModule = "dashboard";
// FUNCIONES DE API PARA CONECTAR CON PHP
/***Cargar todos los socios desde MySQL*/
async function cargarSociosDesdeAPI() {
    try {
        console.log('🔄 Intentando cargar socios desde API...');
        const response = await fetch('api/socios.php?action=all');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('📦 Respuesta recibida:', result);
        if (result.success) {
            database.socios = result.data.map(socio => ({
                ...socio,
                fechaNacimiento: socio.fecha_nacimiento || socio.fechaNacimiento || null,
                contactoEmergencia: {
                    nombre: socio.emergencia_nombre || '',
                    relacion: socio.emergencia_relacion || '',
                    telefono: socio.emergencia_telefono || '',
                },
                informacionMedica: {
                    grupoSanguineo: socio.grupo_sanguineo || '',
                    alergias: socio.alergias || '',
                    lesiones: socio.lesiones || '',
                },
            }));
            console.log('✅ Socios cargados desde MySQL:', result.data.length);
            console.log('👥 Socios:', database.socios);
            return database.socios;
        } else {
            console.error('❌ Error al cargar socios:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar socios:', error);
        alert('Error al cargar socios. Verifica que XAMPP esté activo.');
        return [];
    }
}
/*** Crear nuevo socio en MySQL*/
async function crearSocioEnAPI(socioData) {
    try {
        console.log('🔄 Enviando nuevo socio a la API...', socioData);
        const response = await fetch('api/socios.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json',},
            body: JSON.stringify(socioData)
        });
        console.log('📡 Response status:', response.status);
        if (!response.ok) {throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('📦 Respuesta de crear socio:', result);
        if (result.success) {
            console.log('✅ Socio creado en MySQL:', result.data);
            await cargarSociosDesdeAPI();
            updateSociosTable();
            return result.data;
        } else {
            console.error('❌ Error al crear socio:', result.message);
            alert('Error al crear socio: ' + result.message);
            return null;
        }
    } catch (error) {
        console.error('❌ Error de conexión al crear socio:', error);
        alert('Error de conexión al crear socio. Verifica que XAMPP esté activo.');
        return null;
    }
}
/*** Actualizar socio en MySQL*/
async function actualizarSocioEnAPI(socioData) {
    try {
        console.log('🔄 Actualizando socio en MySQL...', socioData);
        const response = await fetch('api/socios.php', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json',},
            body: JSON.stringify(socioData)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('📦 Respuesta de actualizar socio:', result);
        if (result.success) {
            console.log('✅ Socio actualizado en MySQL');
            await cargarSociosDesdeAPI();
            if (typeof updateSociosTable === 'function') {
                updateSociosTable();
            }
            return true;
        } else {
            console.error('❌ Error al actualizar socio:', result.message);
            alert('Error al actualizar socio: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión al actualizar socio:', error);
        alert('Error de conexión al actualizar socio. Verifica que XAMPP esté activo.');
        return false;
    }
}
/*** Eliminar socio en MySQL*/
async function eliminarSocioEnAPI(socioId) {
    try {
        console.log('🔄 Eliminando socio ID:', socioId);
        const response = await fetch(`api/socios.php?id=${socioId}`, {
            method: 'DELETE'});
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('📦 Respuesta de eliminar:', result);
        if (result.success) {
            console.log('✅ Socio eliminado de MySQL');
            await cargarSociosDesdeAPI();
            updateSociosTable();
            return true;
        } else {
            console.error('❌ Error al eliminar socio:', result.message);
            alert('Error al eliminar socio: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión al eliminar socio:', error);
        alert('Error de conexión al eliminar socio.');
        return false;
    }
}
/*** Cargar planes desde MySQL*/
async function cargarPlanesDesdeAPI() {
    try {
        console.log('🔄 Intentando cargar planes desde API...');
        const response = await fetch('api/planes.php?action=all');
        if (!response.ok) {throw new Error(`HTTP error! status: ${response.status}`);}
        const result = await response.json();
        console.log('📦 Respuesta planes:', result);
        if (result.success) {
            database.planes = result.data;
            console.log('✅ Planes cargados desde MySQL:', result.data.length);
            return result.data;
        } else {
            console.error('❌ Error al cargar planes:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar planes:', error);
        return [];
    }
}
/*** Cargar usuarios desde MySQL*/
async function cargarUsuariosDesdeAPI() {
    try {
        console.log('🔄 Intentando cargar usuarios desde API...');
        const response = await fetch('api/usuarios.php?action=all');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);}
        const result = await response.json();
        console.log('📦 Respuesta usuarios:', result);
        if (result.success) {
            database.usuarios = result.data;
            console.log('✅ Usuarios cargados desde MySQL:', result.data.length);
            return result.data;
        } else {
            console.error('❌ Error al cargar usuarios:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar usuarios:', error);
        return [];
    }
}
// PAGOS
/*** Cargar todos los pagos desde MySQL*/
async function cargarPagosDesdeAPI() {
    try {
        console.log('🔄 Cargando pagos desde API...');
        const response = await fetch('api/pagos.php?action=all');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.success) {
            database.pagos = result.data.map(pago => ({
                ...pago,
                socioId: pago.socio_id || pago.socioId,
                socioNombre: (pago.socio_nombre || pago.socioNombre),
                metodoPago: pago.metodo_pago || pago.metodoPago,  
                monto: parseFloat(pago.monto) || 0 
            }));
            console.log('✅ Pagos cargados desde MySQL:', result.data.length);
            return result.data;
        } else {
            console.error('❌ Error al cargar pagos:', result.message);
            return [];}
    } catch (error) {
        console.error('❌ Error de conexión al cargar pagos:', error);
        return [];
    }
}
/*** Registrar nuevo pago en MySQL*/
async function registrarPagoEnAPI(pagoData) {
    try {
        console.log('🔄 Registrando pago...', pagoData);
        const response = await fetch('api/pagos.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(pagoData)});
        const result = await response.json();
        if (result.success) {
            console.log('✅ Pago registrado en MySQL:', result.data);
            await cargarPagosDesdeAPI();
            await cargarSociosDesdeAPI();
            if (typeof updatePagosTable === 'function') {
                updatePagosTable();}
            if (typeof updateSociosTable === 'function') {
                updateSociosTable();}
            return result.data;
        } else {
            console.error('❌ Error al registrar pago:', result.message);
            alert('Error al registrar pago: ' + result.message);
            return null;}
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión al registrar pago.');
        return null;}
}
/*** Eliminar pago de MySQL*/
async function eliminarPagoEnAPI(pagoId) {
    try {
        const response = await fetch(`api/pagos.php?id=${pagoId}`, {
            method: 'DELETE'});
        const result = await response.json();
        if (result.success) {
            console.log('✅ Pago eliminado de MySQL');
            await cargarPagosDesdeAPI();
            if (typeof updatePagosTable === 'function') {
                updatePagosTable();}
            return true;
        } else {
            console.error('❌ Error al eliminar pago:', result.message);
            alert('Error al eliminar pago: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}
// ASISTENCIAS
/*** Cargar asistencias desde MySQL*/
async function cargarAsistenciasDesdeAPI() {
    try {
        console.log('🔄 Cargando asistencias desde API...');
        const response = await fetch('api/asistencias.php?action=all');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);}
        const result = await response.json();
        if (result.success) {
            database.asistencias = result.data.map(asistencia => ({
                ...asistencia,
                socioId: asistencia.socio_id || asistencia.socioId }));
            console.log('✅ Asistencias cargadas desde MySQL:', result.data.length);
            return result.data;
        } else {
            console.error('❌ Error al cargar asistencias:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar asistencias:', error);
        return [];
    }
}
/*** Registrar asistencia en MySQL*/
async function registrarAsistenciaEnAPI(dni) {
    try {
        console.log('🔄 Registrando asistencia para DNI:', dni);
        const response = await fetch('api/asistencias.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dni: dni })
        });
        const result = await response.json();
        if (result.success) {
            console.log('✅ Asistencia registrada:', result.data);
            await cargarAsistenciasDesdeAPI();
            if (typeof updateAsistenciasTable === 'function') {
                updateAsistenciasTable();
            }
            return result.data;
        } else {
            console.error('❌ Error al registrar asistencia:', result.message);
            alert(result.message);
            return null;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión al registrar asistencia.');
        return null;
    }
}
/** * Eliminar asistencia de MySQL*/
async function eliminarAsistenciaEnAPI(asistenciaId) {
    try {
        const response = await fetch(`api/asistencias.php?id=${asistenciaId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            console.log('✅ Asistencia eliminada de MySQL');
            await cargarAsistenciasDesdeAPI();
            if (typeof updateAsistenciasTable === 'function') {
                updateAsistenciasTable();
            }
            return true;
        } else {
            console.error('❌ Error al eliminar asistencia:', result.message);
            alert('Error al eliminar asistencia: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}
// CLASES
/**
 * Cargar clases del gym desde MySQL. Es la ÚNICA fuente de clases del
 * sistema (Turnos, Clases e Instructores y panel de Instructor leen
 * todos de acá), con cupos ocupados calculados en vivo en el backend.
 */
async function cargarClasesGymDesdeAPI() {
    try {
        console.log('🔄 Cargando clases gym desde API...');
        const response = await fetch('api/clases.php?action=gym');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            database.clasesGym = result.data;
            console.log('✅ Clases gym cargadas desde MySQL:', result.data.length);
            return result.data;
        } else {
            console.error('❌ Error al cargar clases gym:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar clases gym:', error);
        return [];
    }
}

/**
 * Asignar instructor a clase en MySQL
 */
async function asignarInstructorEnAPI(claseId, instructorId) {
    try {
        console.log('🔄 Asignando instructor a clase...', {claseId, instructorId});
        
        const response = await fetch('api/clases.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'asignar_instructor',
                clase_id: claseId,
                instructor_id: instructorId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Instructor asignado correctamente');
            await cargarClasesGymDesdeAPI();
            if (typeof updateClasesTable === 'function') {
                updateClasesTable();
            }
            return true;
        } else {
            console.error('❌ Error al asignar instructor:', result.message);
            alert('Error al asignar instructor: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión al asignar instructor.');
        return false;
    }
}
// TURNOS
/**
 * Cargar TODOS los turnos confirmados desde MySQL. Esto es lo que
 * faltaba: sin esto, los turnos vivían solo en la memoria de cada
 * navegador y nunca se sincronizaban entre Admin/Instructor/Recepcionista.
 * Se llama al iniciar sesión (inicializarDatosDesdeAPI) igual que el
 * resto de las tablas.
 */
async function cargarTurnosDesdeAPI() {
    try {
        console.log('🔄 Cargando turnos desde API...');
        const response = await fetch('api/clases.php?action=all_turnos');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            database.turnos = result.data;
            console.log('✅ Turnos cargados desde MySQL:', result.data.length);
            return result.data;
        } else {
            console.error('❌ Error al cargar turnos:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar turnos:', error);
        return [];
    }
}

/*** Reservar turno en MySQL*/
async function reservarTurnoEnAPI(socioId, claseId, fecha) {
    try {
        console.log('🔄 Reservando turno...', { socioId, claseId, fecha });
        const response = await fetch('api/clases.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'reservar',
                socio_id: socioId,
                clase_id: claseId,
                fecha: fecha
            })
        });
        const result = await response.json();
        if (result.success) {
            console.log('✅ Turno reservado en MySQL:', result.data);
            await cargarTurnosDesdeAPI();
            return { ok: true, data: result.data };
        } else {
            console.error('❌ Error al reservar turno:', result.message);
            return { ok: false, message: result.message };
        }
    } catch (error) {
        console.error('❌ Error de conexión al reservar turno:', error);
        return { ok: false, message: 'Error de conexión al reservar turno.' };
    }
}

/*** Cancelar turno en MySQL*/
async function cancelarTurnoEnAPI(turnoId) {
    try {
        console.log('🔄 Cancelando turno ID:', turnoId);
        const response = await fetch(`api/clases.php?id=${turnoId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            console.log('✅ Turno cancelado en MySQL');
            await cargarTurnosDesdeAPI();
            return true;
        } else {
            console.error('❌ Error al cancelar turno:', result.message);
            alert('Error al cancelar turno: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión al cancelar turno:', error);
        alert('Error de conexión al cancelar turno.');
        return false;
    }
}

/*** Modificar turno (cambiar de clase) en MySQL*/
async function modificarTurnoEnAPI(turnoId, nuevaClaseId, nuevaFecha) {
    try {
        console.log('🔄 Modificando turno...', { turnoId, nuevaClaseId, nuevaFecha });
        const response = await fetch('api/clases.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'modificar_turno',
                turno_id: turnoId,
                nueva_clase_id: nuevaClaseId,
                nueva_fecha: nuevaFecha
            })
        });
        const result = await response.json();
        if (result.success) {
            console.log('✅ Turno modificado en MySQL');
            await cargarTurnosDesdeAPI();
            return { ok: true };
        } else {
            console.error('❌ Error al modificar turno:', result.message);
            return { ok: false, message: result.message };
        }
    } catch (error) {
        console.error('❌ Error de conexión al modificar turno:', error);
        return { ok: false, message: 'Error de conexión al modificar turno.' };
    }
}

// INSTRUCTORES
/*** Cargar instructores desde MySQL*/
async function cargarInstructoresDesdeAPI() {
    try {
        console.log('📄 Cargando instructores desde API...');
        const response = await fetch('api/instructores.php?action=all');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // ✅ Normalizar: convertir usuario_id a usuarioId
            database.instructores = result.data.map(instructor => ({
                ...instructor,
                usuarioId: instructor.usuario_id || instructor.usuarioId
            }));
            console.log('✅ Instructores cargados desde MySQL:', result.data.length);
            console.log('👥 Instructores normalizados:', database.instructores);
            return result.data;
        } else {
            console.error('❌ Error al cargar instructores:', result.message);
            return [];
        }
    } catch (error) {
        console.error('❌ Error de conexión al cargar instructores:', error);
        return [];
    }
}

/**
 * Crear instructor en MySQL
 */
async function crearInstructorEnAPI(instructorData) {
    try {
        console.log('🔄 Creando instructor...', instructorData);
        
        const response = await fetch('api/instructores.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(instructorData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Instructor creado en MySQL:', result.data);
            await cargarInstructoresDesdeAPI();
            if (typeof updateInstructoresGrid === 'function') {
                updateInstructoresGrid();
            }
            return result.data;
        } else {
            console.error('❌ Error al crear instructor:', result.message);
            alert('Error al crear instructor: ' + result.message);
            return null;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión al crear instructor.');
        return null;
    }
}
// PLANES
/**
 * Crear nuevo plan en MySQL
 */
async function crearPlanEnAPI(planData) {
    try {
        console.log('🔄 Creando plan...', planData);
        
        const response = await fetch('api/planes.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(planData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Plan creado en MySQL:', result.data);
            await cargarPlanesDesdeAPI();
            if (typeof updatePlanesGrid === 'function') {
                updatePlanesGrid();
            }
            return result.data;
        } else {
            console.error('❌ Error al crear plan:', result.message);
            alert('Error al crear plan: ' + result.message);
            return null;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión al crear plan.');
        return null;
    }
}

/**
 * Actualizar plan en MySQL
 */
async function actualizarPlanEnAPI(planData) {
    try {
        console.log('🔄 Actualizando plan...', planData);
        
        const response = await fetch('api/planes.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(planData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Plan actualizado en MySQL');
            await cargarPlanesDesdeAPI();
            if (typeof updatePlanesGrid === 'function') {
                updatePlanesGrid();
            }
            return true;
        } else {
            console.error('❌ Error al actualizar plan:', result.message);
            alert('Error al actualizar plan: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

/**
 * Eliminar plan de MySQL
 */
async function eliminarPlanEnAPI(planId) {
    try {
        const response = await fetch(`api/planes.php?id=${planId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Plan eliminado de MySQL');
            await cargarPlanesDesdeAPI();
            if (typeof updatePlanesGrid === 'function') {
                updatePlanesGrid();
            }
            return true;
        } else {
            console.error('❌ Error al eliminar plan:', result.message);
            alert('Error al eliminar plan: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}
// USUARIOS (funciones adicionales)
/**
 * Crear nuevo usuario en MySQL
 */
async function crearUsuarioEnAPI(usuarioData) {
    try {
        console.log('🔄 Enviando nuevo usuario a la API...', usuarioData);
        
        const response = await fetch('api/usuarios.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(usuarioData)
        });
        
        const result = await response.json();
        console.log('📦 Respuesta de crear usuario:', result);
        
        if (result.success) {
            console.log('✅ Usuario creado en MySQL:', result.data);
            await cargarUsuariosDesdeAPI();
            if (typeof updateUsuariosTable === 'function') {
                updateUsuariosTable();
            }
            return result.data;
        } else {
            console.error('❌ Error al crear usuario:', result.message);
            alert('Error al crear usuario: ' + result.message);
            return null;
        }
    } catch (error) {
        console.error('❌ Error de conexión al crear usuario:', error);
        alert('Error de conexión al crear usuario.');
        return null;
    }
}

/**
 * Actualizar usuario en MySQL
 */
async function actualizarUsuarioEnAPI(usuarioData) {
    try {
        console.log('🔄 Actualizando usuario...', usuarioData);
        
        const response = await fetch('api/usuarios.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(usuarioData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Usuario actualizado en MySQL');
            await cargarUsuariosDesdeAPI();
            if (typeof updateUsuariosTable === 'function') {
                updateUsuariosTable();
            }
            return true;
        } else {
            console.error('❌ Error al actualizar usuario:', result.message);
            alert('Error al actualizar usuario: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

/**
 * Eliminar usuario en MySQL
 */
async function eliminarUsuarioEnAPI(usuarioId) {
    try {
        const response = await fetch(`api/usuarios.php?id=${usuarioId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Usuario eliminado de MySQL');
            await cargarUsuariosDesdeAPI();
            if (typeof updateUsuariosTable === 'function') {
                updateUsuariosTable();
            }
            return true;
        } else {
            console.error('❌ Error al eliminar usuario:', result.message);
            alert('Error al eliminar usuario: ' + result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}
console.log('✅ Funciones adicionales de API cargadas correctamente');

// INICIALIZACIÓN COMPLETA
/**
 * Actualizar inicializarDatosDesdeAPI para cargar TODO
 */
async function inicializarDatosDesdeAPI() {
    console.log('🔄 Cargando TODOS los datos desde MySQL...');
    console.log('👤 Usuario actual:', currentUser);
    
    try {
        // Cargar todos los datos necesarios en paralelo
        await Promise.all([
            cargarSociosDesdeAPI(),
            cargarPlanesDesdeAPI(),
            cargarUsuariosDesdeAPI(),
            cargarPagosDesdeAPI(),
            cargarAsistenciasDesdeAPI(),
            cargarClasesGymDesdeAPI(),
            cargarInstructoresDesdeAPI(),
            cargarTurnosDesdeAPI()
        ]);
        
        console.log('✅ TODOS los datos cargados desde MySQL');
        console.log('📊 Estado completo de database:', {
            socios: database.socios.length,
            planes: database.planes.length,
            usuarios: database.usuarios.length,
            pagos: database.pagos.length,
            asistencias: database.asistencias.length,
            clasesGym: database.clasesGym ? database.clasesGym.length : 0,
            instructores: database.instructores ? database.instructores.length : 0,
            turnos: database.turnos ? database.turnos.length : 0
        });
        
        // Actualizar la interfaz según el módulo activo
        if (activeModule === 'socios') {
            updateSociosTable();
        } else if (activeModule === 'dashboard') {
            updateDashboard();
        } else if (activeModule === 'usuarios') {
            updateUsuariosTable();
        } else if (activeModule === 'pagos') {
            updatePagosTable();
        } else if (activeModule === 'asistencias') {
            updateAsistenciasTable();
        } else if (activeModule === 'planes') {
            updatePlanesGrid();
        } else if (activeModule === 'clasesInstructores') {
            if (typeof updateClasesTable === 'function') updateClasesTable();
            if (typeof updateInstructoresGrid === 'function') updateInstructoresGrid();
        } else if (activeModule === 'turnos') {
            if (typeof updateTurnosModule === 'function') updateTurnosModule();
        } else if (activeModule === 'misClases') {
            if (typeof updateMisClasesInstructor === 'function') updateMisClasesInstructor();
        }
        
    } catch (error) {
        console.error('❌ Error al inicializar datos:', error);
    }
}
console.log('✅ TODAS las funciones de API cargadas correctamente');