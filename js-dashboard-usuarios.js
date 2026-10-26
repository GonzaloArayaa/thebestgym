// MÓDULO DASHBOARD
function initDashboard() {
    updateDashboard();
}
function verificarVencimientos() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    database.socios.forEach((socio) => {
        const fechaVencimiento = new Date(socio.vencimiento + "T00:00:00");

        // Si la fecha de vencimiento ya pasó -> Moroso
        if (fechaVencimiento < hoy) {
            socio.estado = "Moroso";
        }
        // Si la fecha es hoy o futura y estaba moroso -> Activo (si renovó)
        else if (fechaVencimiento >= hoy && socio.estado === "Moroso") {
            // No cambiar automáticamente, solo si hay pago reciente
            const pagoReciente = database.pagos.find(
                (p) =>
                    p.socioId === socio.id &&
                    new Date(p.fecha + "T00:00:00") >=
                        new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000),
            );
            if (pagoReciente) {
                socio.estado = "Activo";
            }
        }
    });
}

function obtenerSociosProximosVencer(dias = 7) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() + dias);

    return database.socios.filter((socio) => {
        const fechaVencimiento = new Date(socio.vencimiento + "T00:00:00");
        return (
            fechaVencimiento >= hoy &&
            fechaVencimiento <= fechaLimite &&
            socio.estado === "Activo"
        );
    });
}
function updateDashboard() {
    // Marcar como morosos a los socios vencidos ANTES de contar
    verificarVencimientos();

    // Calcular estadísticas
    const sociosActivos = database.socios.filter(
        (s) => s.estado === "Activo",
    ).length;
    const sociosMorosos = database.socios.filter(
        (s) => s.estado === "Moroso",
    ).length;
    const asistenciasHoy = database.asistencias.filter(
        (a) => a.fecha === getTodayString(),
    ).length;
    const ingresosDelMes = database.pagos
        .filter((p) => p.fecha.startsWith(getTodayString().slice(0, 7)))
        .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
    // Actualizar valores
    document.getElementById("sociosActivos").textContent = sociosActivos;
    document.getElementById("sociosMorosos").textContent = sociosMorosos;
    document.getElementById("asistenciasHoy").textContent = asistenciasHoy;
    document.getElementById("ingresosDelMes").textContent =
        formatCurrency(ingresosDelMes);
    // Actualizar alertas de vencimiento
    updateAlertasVencimiento();
    // Actualizar últimas asistencias
    updateUltimasAsistencias();
}

function updateAlertasVencimiento() {
    const container = document.getElementById("alertasVencimiento");

    // Verificar vencimientos automáticamente
    verificarVencimientos();

    const morosos = database.socios.filter((s) => s.estado === "Moroso");
    const proximosVencer = obtenerSociosProximosVencer(7); // 7 días

    const todasAlertas = [];

    // Agregar morosos (prioridad alta)
    morosos.forEach((socio) => {
        const diasVencido = Math.floor(
            (new Date() - new Date(socio.vencimiento + "T00:00:00")) /
                (1000 * 60 * 60 * 24),
        );
        todasAlertas.push({
            socio: socio,
            tipo: "moroso",
            mensaje: `Vencido hace ${diasVencido} día${diasVencido !== 1 ? "s" : ""}`,
            prioridad: 1,
        });
    });

    // Agregar próximos a vencer (prioridad media)
    proximosVencer.forEach((socio) => {
        const diasRestantes = Math.ceil(
            (new Date(socio.vencimiento + "T00:00:00") - new Date()) /
                (1000 * 60 * 60 * 24),
        );
        todasAlertas.push({
            socio: socio,
            tipo: "proximo",
            mensaje: `Vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`,
            prioridad: 2,
        });
    });

    if (todasAlertas.length === 0) {
        container.innerHTML = `
            <div class="sin-alertas">
                <i class="fas fa-check-circle"></i>
                <p>No hay alertas de vencimiento</p>
            </div>
        `;
        return;
    }

    // Ordenar por prioridad
    todasAlertas.sort((a, b) => a.prioridad - b.prioridad);

    container.innerHTML = todasAlertas
        .map(
            (alerta) => `
            <div class="alert-item ${alerta.tipo === "moroso" ? "alert-moroso" : "alert-proximo"}">
                <div class="alert-item-info">
                    <p class="alert-nombre">${alerta.socio.nombre}</p>
                    <p class="alert-detalle">${alerta.mensaje}</p>
                    <p class="alert-fecha">Vencimiento: ${formatDate(alerta.socio.vencimiento)}</p>
                </div>
                <div class="alert-icon">
                    <i class="fas ${alerta.tipo === "moroso" ? "fa-exclamation-circle" : "fa-clock"}"></i>
                </div>
            </div>
        `,
        )
        .join("");
}

function updateUltimasAsistencias() {
    const container = document.getElementById("ultimasAsistencias");
    const ultimasAsistencias = database.asistencias.slice(-5).reverse();

    if (ultimasAsistencias.length === 0) {
        container.innerHTML =
            '<p class="text-center" style="color: var(--text-light);">No hay asistencias registradas</p>';
        return;
    }

    container.innerHTML = ultimasAsistencias
        .map((asistencia) => {
            // Soportar ambos formatos: socioId (memoria) y socio_id (MySQL)
            const socioId = asistencia.socio_id || asistencia.socioId;
            const socio = database.socios.find((s) => s.id === socioId);
            
            // Si no encuentra el socio, usar el nombre que viene en la asistencia
            const nombreSocio = socio ? socio.nombre : (asistencia.nombre || 'Socio desconocido');
            
            return `
            <div class="attendance-item">
                <div class="attendance-item-info">
                    <p>${nombreSocio}</p>
                    <p>${formatDate(asistencia.fecha)} - ${asistencia.hora}</p>
                </div>
                <i class="fas fa-check-circle"></i>
            </div>
        `;
        })
        .join("");
}
// MÓDULO GESTIÓN DE USUARIOS
function initUsuariosModule() {
    // Event listeners
    document
        .getElementById("btnNuevoUsuario")
        .addEventListener("click", abrirModalNuevoUsuario);
    document
        .getElementById("formNuevoUsuario")
        .addEventListener("submit", guardarNuevoUsuario);
    document
        .getElementById("searchUsuarios")
        .addEventListener("input", updateUsuariosTable);
    const btnNuevoUsuario = document.getElementById("btnNuevoUsuario");
    if (btnNuevoUsuario) {
        if (!tienePermiso("usuarios", "crear")) {
            btnNuevoUsuario.style.display = "none";
        } else {
            btnNuevoUsuario.style.display = "flex";
        }
    }
    updateUsuariosTable();
}

function updateUsuariosTable() {
    const searchTerm = document
        .getElementById("searchUsuarios")
        .value.toLowerCase();
    const tbody = document.getElementById("tablaUsuarios");

    // Filtrar usuarios (excluir el usuario actual del listado)
    const filteredUsuarios = database.usuarios.filter(
        (usuario) =>
            (usuario.nombre.toLowerCase().includes(searchTerm) ||
                usuario.username.toLowerCase().includes(searchTerm) ||
                usuario.rol.toLowerCase().includes(searchTerm)) &&
            usuario.id !== currentUser.id, // No mostrar el usuario actual
    );

    if (filteredUsuarios.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="5" class="text-center" style="color: var(--text-light); padding: 20px;">No se encontraron usuarios</td></tr>';
        return;
    }

    tbody.innerHTML = filteredUsuarios
        .map(
            (usuario) => `
        <tr>
            <td>
                <div class="usuario-info">
                    <div class="usuario-avatar-small">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500; color: var(--text-dark);">${usuario.nombre}</div>
                        <div style="font-size: 13px; color: var(--text-light);">@${usuario.username}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge-rol badge-rol-${usuario.rol.toLowerCase().replace(/\s/g, "")}">
                    ${usuario.rol}
                </span>
            </td>
            <td>
                <span class="estado-badge ${usuario.activo !== false ? "estado-activo" : "estado-inactivo"}">
                    <i class="fas fa-circle"></i>
                    ${usuario.activo !== false ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td>${usuario.fechaCreacion ? formatDate(usuario.fechaCreacion) : "-"}</td>
            <td>
    <div class="action-buttons">
        <button class="btn-table btn-view-permisos" onclick="gestionarPermisosUsuario(${usuario.id})" title="Gestionar permisos">
            <i class="fas fa-user-shield"></i>
        </button>
        <button class="btn-table ${usuario.activo !== false ? "btn-toggle" : "btn-activate"}" 
                onclick="toggleEstadoUsuario(${usuario.id})" 
                title="${usuario.activo !== false ? "Desactivar" : "Activar"} usuario">
            <i class="fas fa-${usuario.activo !== false ? "ban" : "check-circle"}"></i>
        </button>
        ${
            currentUser.rol === "Administrador" &&
            usuario.rol !== "Administrador"
                ? `
            <button class="btn-table btn-delete" onclick="eliminarUsuario(${usuario.id})" title="Eliminar usuario">
                <i class="fas fa-trash"></i>
            </button>
        `
                : ""
        }
    </div>
</td>
        </tr>
    `,
        )
        .join("");
}

function abrirModalNuevoUsuario() {
    document.getElementById("modalNuevoUsuario").style.display = "flex";
    document.getElementById("formNuevoUsuario").reset();
    document.getElementById("errorUsuario").style.display = "none";
    document.getElementById("usuarioGenerado").style.display = "none";
    document.getElementById("formNuevoUsuario").style.display = "block";
    document.getElementById("grupoDniSocio").style.display = "none";
}

function cerrarModalUsuario() {
    document.getElementById("modalNuevoUsuario").style.display = "none";
    document.getElementById("formNuevoUsuario").reset();
    document.getElementById("grupoDniSocio").style.display = "none";
}

function toggleCampoDniSocio() {
    const rol = document.getElementById("nuevoRol").value;
    const grupoDni = document.getElementById("grupoDniSocio");
    const inputDni = document.getElementById("nuevoDni");

    if (rol === "Socio") {
        grupoDni.style.display = "block";
        inputDni.setAttribute("required", "required");
    } else {
        grupoDni.style.display = "none";
        inputDni.removeAttribute("required");
        inputDni.value = "";
    }
}

function generarUsername(nombre, apellido) {
    // Generar username: primera letra del nombre + apellido (sin espacios, minúsculas)
    const primeraLetra = nombre.charAt(0).toLowerCase();
    const apellidoLimpio = apellido.toLowerCase().replace(/\s/g, "");
    let username = primeraLetra + apellidoLimpio;

    // Verificar si ya existe, si existe agregar número
    let contador = 1;
    let usernameOriginal = username;
    while (database.usuarios.some((u) => u.username === username)) {
        username = usernameOriginal + contador;
        contador++;
    }

    return username;
}

function generarPassword() {
    // Generar contraseña aleatoria de 8 caracteres
    const caracteres =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
        password += caracteres.charAt(
            Math.floor(Math.random() * caracteres.length),
        );
    }
    return password;
}

async function guardarNuevoUsuario(e) {
    e.preventDefault();

    const nombre = document.getElementById("nuevoNombre").value.trim();
    const apellido = document.getElementById("nuevoApellido").value.trim();
    const email = document.getElementById("nuevoEmail").value.trim();
    const rol = document.getElementById("nuevoRol").value;
    const dni = document.getElementById("nuevoDni").value.trim();

    const errorDiv = document.getElementById("errorUsuario");

    // Validar DNI obligatorio cuando el rol es Socio
    if (rol === "Socio" && !dni) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>DNI requerido</strong>
                <p>Para crear un usuario Socio es obligatorio ingresar el DNI.</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        document.getElementById("nuevoDni").focus();
        return;
    }

    // Validar que el email no esté en uso
    if (
        database.usuarios.some(
            (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
        )
    ) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Email ya registrado</strong>
                <p>El correo electrónico ya está en uso. Por favor, ingrese un correo alternativo.</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        document.getElementById("nuevoEmail").focus();
        return;
    }

    // Generar credenciales
    const username = generarUsername(nombre, apellido);
    const password = generarPassword();
    const nombreCompleto = `${nombre} ${apellido}`;

    try {
        
        let socioId = null;
        if (rol === "Socio") {
            const socioData = {
                nombre: nombreCompleto,
                dni: dni,
                email: email,
                telefono: "",
                plan: "Mensual"
            };
            
            const resultSocio = await crearSocioEnAPI(socioData);
            if (!resultSocio) {
                alert('Error al crear el registro del socio');
                return;
            }
            socioId = resultSocio.id;
        }

        const usuarioData = {
            username: username,
            password: password,
            nombre: nombreCompleto,
            rol: rol,
            socio_id: socioId
        };
        
        const resultUsuario = await crearUsuarioEnAPI(usuarioData);
        if (!resultUsuario) {
            alert('Error al crear el usuario');
            return;
        }

        if (rol === "Instructor") {
            const instructorData = {
                usuario_id: resultUsuario.id,
                nombre: nombreCompleto,
                especialidad: "General",
                email: email,
                telefono: ""
            };
            
            await crearInstructorEnAPI(instructorData);
        }

        let emailResponse = null;
        try {
            emailResponse = await enviarCredencialesPorEmail(
                email,
                nombreCompleto,
                username,
                password,
                rol
            );
        } catch (error) {
            console.log('⚠️ Email no configurado o error al enviar:', error);
            emailResponse = {
                success: false,
                message: 'Sistema de email no configurado. Las credenciales se muestran en pantalla.'
            };
        }

        // Mostrar credenciales generadas (con info del email)
        mostrarCredencialesGeneradas(username, password, emailResponse);

        // La tabla ya se actualiza automáticamente en las funciones API
        
    } catch (error) {
        console.error('Error al crear usuario:', error);
        alert('Error al crear el usuario. Revisa la consola para más detalles.');
    }

    // Ocultar formulario y mostrar credenciales
    document.getElementById("formNuevoUsuario").style.display = "none";
}

function mostrarCredencialesGeneradas(username, password) {
    const div = document.getElementById("usuarioGenerado");
    div.innerHTML = `
        <div class="credenciales-header">
            <i class="fas fa-check-circle"></i>
            <h3>¡Usuario creado exitosamente!</h3>
        </div>
        <p class="credenciales-info">Guarde estas credenciales de forma segura. La contraseña no se mostrará nuevamente.</p>
        <div class="credenciales-box">
            <div class="credencial-item">
                <label>Usuario:</label>
                <div class="credencial-value">
                    <code id="usernameGenerado">${username}</code>
                    <button class="btn-copy" onclick="copiarTexto('usernameGenerado')" title="Copiar usuario">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="credencial-item">
                <label>Contraseña:</label>
                <div class="credencial-value">
                    <code id="passwordGenerado">${password}</code>
                    <button class="btn-copy" onclick="copiarTexto('passwordGenerado')" title="Copiar contraseña">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="credenciales-actions">
            <button class="btn-primary" onclick="descargarCredenciales('${username}', '${password}')">
                <i class="fas fa-download"></i> Descargar Credenciales
            </button>
            <button class="btn-secondary" onclick="finalizarCreacionUsuario()">
                <i class="fas fa-check"></i> Finalizar
            </button>
        </div>
    `;
    div.style.display = "block";
}

function copiarTexto(elementId) {
    const texto = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(texto).then(() => {
        // Feedback visual
        const btn = event.target.closest(".btn-copy");
        const iconOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.background = "var(--success-color)";

        setTimeout(() => {
            btn.innerHTML = iconOriginal;
            btn.style.background = "";
        }, 2000);
    });
}

function descargarCredenciales(username, password) {
    const contenido = `
THE BEST GYM - CREDENCIALES DE ACCESO
=====================================

Usuario: ${username}
Contraseña: ${password}

Fecha de creación: ${new Date().toLocaleString("es-AR")}

IMPORTANTE: Guarde estas credenciales de forma segura.
Por razones de seguridad, la contraseña no se mostrará nuevamente.

Puede cambiar su contraseña después del primer ingreso desde su perfil.
    `;

    const blob = new Blob([contenido], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credenciales_${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function finalizarCreacionUsuario() {
    cerrarModalUsuario();
    document.getElementById("formNuevoUsuario").style.display = "block";
    document.getElementById("usuarioGenerado").style.display = "none";
}

function toggleEstadoUsuario(id) {
    const usuario = database.usuarios.find((u) => u.id === id);
    if (!usuario) return;

    const nuevoEstado = usuario.activo !== false ? false : true;
    const accion = nuevoEstado ? "activar" : "desactivar";

    if (!confirm(`¿Está seguro de ${accion} el usuario ${usuario.nombre}?`)) {
        return;
    }

    usuario.activo = nuevoEstado;

    // Si es instructor, actualizar también su estado
    const instructor = database.instructores.find((i) => i.usuarioId === id);
    if (instructor) {
        instructor.activo = nuevoEstado;
    }

    updateUsuariosTable();
    alert(`Usuario ${nuevoEstado ? "activado" : "desactivado"} correctamente`);
}

async function eliminarUsuario(id) {
    if (!tienePermiso("usuarios", "eliminar")) {
        mostrarErrorPermisos();
        return;
    }

    const usuario = database.usuarios.find((u) => u.id === id);
    if (!usuario) return;

    if (usuario.rol === "Administrador") {
        alert("No se puede eliminar un usuario Administrador");
        return;
    }

    if (
        !confirm(
            `¿Estás seguro de eliminar el usuario ${usuario.nombre}?\n\nEsta acción no se puede deshacer.`,
        )
    ) {
        return;
    }

    // Eliminar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await eliminarUsuarioEnAPI(id);

    if (!exito) {
        alert("No se pudo eliminar el usuario en la base de datos. Intentá de nuevo.");
        return;
    }

    const index = database.usuarios.findIndex((u) => u.id === id);
    if (index > -1) {
        database.usuarios.splice(index, 1);
    }

    const instructorIndex = database.instructores.findIndex(
        (i) => i.usuarioId === id,
    );
    if (instructorIndex > -1) {
        database.instructores.splice(instructorIndex, 1);
    }

    updateUsuariosTable();
    alert("Usuario eliminado correctamente");
}

function getDefaultVencimiento() {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 30);
    return fecha.toISOString().split("T")[0];
}