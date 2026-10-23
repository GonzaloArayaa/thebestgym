// SISTEMA COMPLETO DE PERMISOS
// Permisos base por rol 
const permisosPorRol = {
    Administrador: {
        socios: { ver: true, crear: true, editar: true, eliminar: true },
        usuarios: {
            ver: true,
            crear: true,
            editar: true,
            eliminar: true,
            resetPassword: true,
        },
        pagos: {
            ver: true,
            crear: true,
            editar: true,
            eliminar: true,
            anular: true,
        },
        asistencias: { ver: true, registrar: true },
        planes: { ver: true, crear: true, editar: true, eliminar: true },
        clases: {
            ver: true,
            crear: true,
            editar: true,
            eliminar: true,
            asignarInstructor: true,
        },
        reportes: { ver: true, exportar: true },
        configuracion: { ver: true, modificar: true },
    },
    Recepcionista: {
        socios: { ver: true, crear: true, editar: true, eliminar: false },
        usuarios: {
            ver: false,
            crear: false,
            editar: false,
            eliminar: false,
            resetPassword: false,
        },
        pagos: {
            ver: true,
            crear: true,
            editar: false,
            eliminar: false,
            anular: false,
        },
        asistencias: { ver: true, registrar: true },
        planes: { ver: true, crear: false, editar: false, eliminar: false },
        clases: {
            ver: true,
            crear: false,
            editar: false,
            eliminar: false,
            asignarInstructor: false,
        },
        reportes: { ver: true, exportar: false },
        configuracion: { ver: false, modificar: false },
    },
    Instructor: {
        socios: { ver: false, crear: false, editar: false, eliminar: false },
        usuarios: {
            ver: false,
            crear: false,
            editar: false,
            eliminar: false,
            resetPassword: false,
        },
        pagos: {
            ver: false,
            crear: false,
            editar: false,
            eliminar: false,
            anular: false,
        },
        asistencias: { ver: false, registrar: false },
        planes: { ver: false, crear: false, editar: false, eliminar: false },
        clases: {
            ver: true,
            crear: false,
            editar: false,
            eliminar: false,
            asignarInstructor: false,
        },
        reportes: { ver: false, exportar: false },
        configuracion: { ver: false, modificar: false },
    },
    Socio: {
        socios: { ver: false, crear: false, editar: false, eliminar: false },
        usuarios: {
            ver: false,
            crear: false,
            editar: false,
            eliminar: false,
            resetPassword: false,
        },
        pagos: {
            ver: false,
            crear: false,
            editar: false,
            eliminar: false,
            anular: false,
        },
        asistencias: { ver: false, registrar: false },
        planes: { ver: true, crear: false, editar: false, eliminar: false },
        clases: {
            ver: true,
            crear: false,
            editar: false,
            eliminar: false,
            asignarInstructor: false,
        },
        reportes: { ver: false, exportar: false },
        configuracion: { ver: false, modificar: false },
    },
};
// FUNCIONES PRINCIPALES DE PERMISOS
function obtenerPermisosUsuario(usuarioId) {
    const usuario = database.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return null;

    // Clonar permisos base del rol
    const permisosBase = JSON.parse(
        JSON.stringify(permisosPorRol[usuario.rol] || {}),
    );

    // Aplicar permisos personalizados si existen
    const personalizados = database.permisosPersonalizados.filter(
        (p) => p.usuarioId === usuarioId,
    );

    personalizados.forEach((perm) => {
        if (permisosBase[perm.modulo]) {
            permisosBase[perm.modulo][perm.accion] = perm.permitido;
        }
    });

    return permisosBase;
}

/**
 * Verifica si el usuario actual tiene un permiso específico
 */
function tienePermiso(modulo, accion) {
    if (!currentUser || !currentUser.rol) {
        return false;
    }

    const permisos = obtenerPermisosUsuario(currentUser.id);

    if (!permisos || !permisos[modulo]) {
        return false;
    }

    return permisos[modulo][accion] === true;
}

/**
 * Guarda permisos personalizados para un usuario
 */
function guardarPermisosPersonalizados(usuarioId, modulo, accion, permitido) {
    // Buscar si ya existe el permiso personalizado
    const index = database.permisosPersonalizados.findIndex(
        (p) =>
            p.usuarioId === usuarioId &&
            p.modulo === modulo &&
            p.accion === accion,
    );

    const permiso = {
        id:
            index >= 0
                ? database.permisosPersonalizados[index].id
                : database.permisosPersonalizados.length + 1,
        usuarioId: usuarioId,
        modulo: modulo,
        accion: accion,
        permitido: permitido,
        fechaModificacion: new Date().toISOString(),
        modificadoPor: currentUser.id,
    };

    if (index >= 0) {
        database.permisosPersonalizados[index] = permiso;
    } else {
        database.permisosPersonalizados.push(permiso);
    }

    // Guardar en historial
    database.historialPermisos.push({
        id: database.historialPermisos.length + 1,
        usuarioId: usuarioId,
        modulo: modulo,
        accion: accion,
        valorAnterior:
            index >= 0
                ? database.permisosPersonalizados[index].permitido
                : null,
        valorNuevo: permitido,
        fecha: new Date().toISOString(),
        modificadoPor: currentUser.id,
    });
}

/**
 * Restablece permisos de un usuario a los valores por defecto de su rol
 */
function restablecerPermisosPorDefecto(usuarioId) {
    if (
        !confirm(
            "¿Está seguro de restablecer todos los permisos personalizados?\n\nSe aplicarán los permisos por defecto del rol del usuario.",
        )
    ) {
        return;
    }

    // Eliminar todos los permisos personalizados del usuario
    database.permisosPersonalizados = database.permisosPersonalizados.filter(
        (p) => p.usuarioId !== usuarioId,
    );

    // Registrar en historial
    database.historialPermisos.push({
        id: database.historialPermisos.length + 1,
        usuarioId: usuarioId,
        modulo: "todos",
        accion: "restablecer",
        valorAnterior: "personalizado",
        valorNuevo: "por defecto",
        fecha: new Date().toISOString(),
        modificadoPor: currentUser.id,
    });

    alert("Permisos restablecidos correctamente");
}

/**
 * Copia permisos de un usuario a otro
 */
function copiarPermisos(usuarioOrigenId, usuarioDestinoId) {
    const permisosOrigen = database.permisosPersonalizados.filter(
        (p) => p.usuarioId === usuarioOrigenId,
    );

    if (permisosOrigen.length === 0) {
        alert("El usuario origen no tiene permisos personalizados");
        return;
    }

    if (
        !confirm(
            `¿Copiar ${permisosOrigen.length} permisos personalizados al usuario seleccionado?`,
        )
    ) {
        return;
    }

    // Eliminar permisos existentes del destino
    database.permisosPersonalizados = database.permisosPersonalizados.filter(
        (p) => p.usuarioId !== usuarioDestinoId,
    );

    // Copiar permisos
    permisosOrigen.forEach((perm) => {
        guardarPermisosPersonalizados(
            usuarioDestinoId,
            perm.modulo,
            perm.accion,
            perm.permitido,
        );
    });

    alert("Permisos copiados correctamente");
}

/**
 * Muestra un mensaje de error cuando no hay permisos
 */
function mostrarErrorPermisos() {
    alert(
        "⛔ Acceso Denegado\n\nNo tienes permisos para realizar esta acción.\nContacta al administrador si necesitas acceso.",
    );
}
// INTERFAZ DE GESTIÓN DE PERMISOS
/*** Abre el modal completo de gestión de permisos*/
function gestionarPermisosUsuario(usuarioId) {
    const usuario = database.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return;

    const permisos = obtenerPermisosUsuario(usuarioId);
    const tienePersonalizados = database.permisosPersonalizados.some(
        (p) => p.usuarioId === usuarioId,
    );

    // Crear modal de gestión
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalGestionPermisos";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalPermisos()"></div>
        <div class="modal-content modal-permisos-full">
            <button class="modal-close" onclick="cerrarModalPermisos()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-permisos-full">
                <i class="fas fa-user-shield"></i>
                <div>
                    <h3>Gestión de Permisos</h3>
                    <p>${usuario.nombre} - ${usuario.rol}</p>
                </div>
            </div>

            <div class="modal-body-permisos-full">
                <div class="permisos-toolbar">
                    <button class="btn-permisos-action btn-restablecer" onclick="restablecerPermisosPorDefecto(${usuarioId}); cerrarModalPermisos(); updateUsuariosTable();">
                        <i class="fas fa-undo"></i> Restablecer por Defecto
                    </button>
                    <button class="btn-permisos-action btn-copiar" onclick="abrirModalCopiarPermisos(${usuarioId})">
                        <i class="fas fa-copy"></i> Copiar de otro Usuario
                    </button>
                    <button class="btn-permisos-action btn-historial" onclick="verHistorialPermisos(${usuarioId})">
                        <i class="fas fa-history"></i> Ver Historial
                    </button>
                </div>

                ${
                    tienePersonalizados
                        ? `
                    <div class="permisos-alerta">
                        <i class="fas fa-info-circle"></i>
                        <span>Este usuario tiene permisos personalizados activos</span>
                    </div>
                `
                        : ""
                }

                <div class="permisos-info-full">
                    <i class="fas fa-lightbulb"></i>
                    <span>Activa o desactiva permisos específicos. Los cambios se guardan automáticamente.</span>
                </div>

                <div class="permisos-grid-full">
                    ${Object.entries(permisos)
                        .map(
                            ([modulo, acciones]) => `
                        <div class="permiso-modulo-full">
                            <div class="permiso-modulo-header">
                                <i class="fas fa-folder"></i>
                                <h4>${capitalizarModulo(modulo)}</h4>
                            </div>
                            <div class="permiso-acciones-full">
                                ${Object.entries(acciones)
                                    .map(([accion, permitido]) => {
                                        const esPersonalizado =
                                            database.permisosPersonalizados.some(
                                                (p) =>
                                                    p.usuarioId === usuarioId &&
                                                    p.modulo === modulo &&
                                                    p.accion === accion,
                                            );
                                        return `
                                        <label class="permiso-checkbox ${esPersonalizado ? "personalizado" : ""}">
                                            <input 
                                                type="checkbox" 
                                                ${permitido ? "checked" : ""}
                                                onchange="togglePermiso(${usuarioId}, '${modulo}', '${accion}', this.checked)"
                                            />
                                            <span class="checkbox-custom"></span>
                                            <span class="permiso-label">
                                                ${capitalizarAccion(accion)}
                                                ${esPersonalizado ? '<i class="fas fa-star"></i>' : ""}
                                            </span>
                                        </label>
                                    `;
                                    })
                                    .join("")}
                            </div>
                        </div>
                    `,
                        )
                        .join("")}
                </div>
            </div>

            <div class="modal-footer-permisos-full">
                <button class="btn-secondary" onclick="cerrarModalPermisos()">
                    Cerrar
                </button>
                <button class="btn-primary" onclick="cerrarModalPermisos(); updateUsuariosTable();">
                    <i class="fas fa-check"></i> Aplicar Cambios
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function togglePermiso(usuarioId, modulo, accion, permitido) {
    guardarPermisosPersonalizados(usuarioId, modulo, accion, permitido);

    // Mostrar notificación temporal (Feedback visual)
    mostrarNotificacionPermiso(
        permitido ? "Permiso activado" : "Permiso desactivado",
    );
}

// ... El resto del código continúa sin cambios.
/**
 * Muestra notificación temporal
 */
function mostrarNotificacionPermiso(mensaje) {
    const notif = document.createElement("div");
    notif.className = "notificacion-permiso";
    notif.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${mensaje}</span>
    `;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.classList.add("show");
    }, 10);

    setTimeout(() => {
        notif.classList.remove("show");
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

/**
 * Abre modal para copiar permisos
 */
function abrirModalCopiarPermisos(usuarioDestinoId) {
    const usuariosConPermisos = database.usuarios.filter((u) => {
        return (
            u.id !== usuarioDestinoId &&
            database.permisosPersonalizados.some((p) => p.usuarioId === u.id)
        );
    });

    if (usuariosConPermisos.length === 0) {
        alert("No hay otros usuarios con permisos personalizados para copiar");
        return;
    }

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content modal-copiar-permisos">
            <button class="modal-close" onclick="this.closest('.modal').remove()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-copiar">
                <i class="fas fa-copy"></i>
                <h3>Copiar Permisos</h3>
            </div>

            <div class="modal-body-copiar">
                <p>Selecciona el usuario desde el cual copiar los permisos personalizados:</p>

                <div class="usuarios-lista-copiar">
                    ${usuariosConPermisos
                        .map((u) => {
                            const cantPermisos =
                                database.permisosPersonalizados.filter(
                                    (p) => p.usuarioId === u.id,
                                ).length;
                            return `
                            <div class="usuario-item-copiar" onclick="copiarPermisos(${u.id}, ${usuarioDestinoId}); this.closest('.modal').remove(); document.getElementById('modalGestionPermisos').remove(); updateUsuariosTable();">
                                <div class="usuario-avatar-copiar">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="usuario-info-copiar">
                                    <strong>${u.nombre}</strong>
                                    <span>${u.rol}</span>
                                    <span class="permisos-count">${cantPermisos} permisos personalizados</span>
                                </div>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        `;
                        })
                        .join("")}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Ver historial de cambios de permisos
 */
function verHistorialPermisos(usuarioId) {
    const usuario = database.usuarios.find((u) => u.id === usuarioId);
    const historial = database.historialPermisos
        .filter((h) => h.usuarioId === usuarioId)
        .reverse();

    if (historial.length === 0) {
        alert("No hay historial de cambios de permisos para este usuario");
        return;
    }

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content modal-historial">
            <button class="modal-close" onclick="this.closest('.modal').remove()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-historial">
                <i class="fas fa-history"></i>
                <div>
                    <h3>Historial de Permisos</h3>
                    <p>${usuario.nombre}</p>
                </div>
            </div>

            <div class="modal-body-historial">
                <div class="historial-lista">
                    ${historial
                        .map((h) => {
                            const modificador = database.usuarios.find(
                                (u) => u.id === h.modificadoPor,
                            );
                            const fecha = new Date(h.fecha);
                            return `
                            <div class="historial-item">
                                <div class="historial-icono">
                                    <i class="fas fa-${h.accion === "restablecer" ? "undo" : "edit"}"></i>
                                </div>
                                <div class="historial-info">
                                    <div class="historial-accion">
                                        ${
                                            h.accion === "restablecer"
                                                ? "<strong>Permisos restablecidos</strong> a valores por defecto"
                                                : `<strong>${capitalizarModulo(h.modulo)}</strong> - ${capitalizarAccion(h.accion)}`
                                        }
                                    </div>
                                    ${
                                        h.accion !== "restablecer"
                                            ? `
                                        <div class="historial-cambio">
                                            <span class="cambio ${h.valorAnterior ? "permitido" : "denegado"}">
                                                ${h.valorAnterior === null ? "Por defecto" : h.valorAnterior ? "Permitido" : "Denegado"}
                                            </span>
                                            <i class="fas fa-arrow-right"></i>
                                            <span class="cambio ${h.valorNuevo ? "permitido" : "denegado"}">
                                                ${h.valorNuevo ? "Permitido" : "Denegado"}
                                            </span>
                                        </div>
                                    `
                                            : ""
                                    }
                                    <div class="historial-meta">
                                        <span><i class="fas fa-user"></i> ${modificador ? modificador.nombre : "Sistema"}</span>
                                        <span><i class="fas fa-clock"></i> ${fecha.toLocaleString("es-AR")}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        })
                        .join("")}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Cierra el modal de gestión de permisos
 */
function cerrarModalPermisos() {
    const modal = document.getElementById("modalGestionPermisos");
    if (modal) {
        modal.remove();
    }
}
// FUNCIONES AUXILIARES
function capitalizarModulo(modulo) {
    const nombres = {
        socios: "Socios",
        usuarios: "Usuarios",
        pagos: "Pagos",
        asistencias: "Asistencias",
        planes: "Planes",
        clases: "Clases",
        reportes: "Reportes",
        configuracion: "Configuración",
        todos: "Todos los módulos",
    };
    return nombres[modulo] || modulo;
}

function capitalizarAccion(accion) {
    const nombres = {
        ver: "Ver",
        crear: "Crear",
        editar: "Editar",
        eliminar: "Eliminar",
        registrar: "Registrar",
        anular: "Anular",
        resetPassword: "Resetear Contraseña",
        asignarInstructor: "Asignar Instructor",
        exportar: "Exportar",
        modificar: "Modificar",
        restablecer: "Restablecer",
    };
    return nombres[accion] || accion;
}
// MODIFICAR FUNCIONES EXISTENTES CON VALIDACIONES
console.log("✅ Sistema COMPLETO de Permisos cargado correctamente");
