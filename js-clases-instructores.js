// MÓDULO CLASES E INSTRUCTORES
let claseSeleccionadaId = null;
function initClasesInstructoresModule() {
    updateClasesTable();
    updateInstructoresGrid();}
function updateClasesTable() {
    const tbody = document.getElementById("tablaClasesGym");
    tbody.innerHTML = database.clasesGym
        .map((clase) => {
            const instructor = clase.instructorId
                ? database.instructores.find((i) => i.id === clase.instructorId)
                : null;
            return `
            <tr>
                <td>
                    <div>
                        <div style="font-weight: 500; color: var(--text-dark);">${clase.nombre}</div>
                    </div>
                </td>
                <td>
                    <span class="badge-tipo badge-tipo-${clase.tipo.toLowerCase().replace(/\s/g, "")}">${clase.tipo}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-calendar-alt" style="color: var(--text-light); font-size: 12px;"></i>
                        ${clase.horario}
                    </div>
                </td>
                <td>${clase.duracion}</td>
                <td>
                    <span class="cupo-badge-instructor">
                        <i class="fas fa-users"></i> ${clase.cupoMaximo}
                    </span>
                </td>
                <td>
                    ${
                        instructor
                            ? `<div class="instructor-assigned">
                             <i class="fas fa-user-check"></i>
                             <span>${instructor.nombre}</span>
                           </div>`
                            : `<span class="no-instructor">Sin asignar</span>`
                    }
                </td>
                <td>
                    ${
                        tienePermiso("clases", "asignarInstructor")
                            ? `
                        <button class="btn-asignar-instructor" onclick="abrirModalAsignar(${clase.id})">
                            <i class="fas fa-user-plus"></i>
                            ${instructor ? "Reasignar" : "Asignar"}
                        </button>
                    `
                            : '<span style="color: var(--text-light); font-size: 13px;">-</span>'
                    }
                </td>
            </tr>
        `;
        })
        .join("");
}

function updateInstructoresGrid() {
    const grid = document.getElementById("instructoresGrid");

    grid.innerHTML = database.instructores
        .map((instructor) => {
            const clasesAsignadas = database.clasesGym.filter(
                (c) => c.instructorId === instructor.id,
            );

            return `
            <div class="instructor-card">
                <div class="instructor-avatar-custom">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div class="instructor-info-custom">
                    <h4>${instructor.nombre}</h4>
                    <p class="instructor-especialidad-custom">
                        <i class="fas fa-star"></i> ${instructor.especialidad}
                    </p>
                    <p class="instructor-contacto-custom">
                        <i class="fas fa-envelope"></i> ${instructor.email}
                    </p>
                    <p class="instructor-contacto-custom">
                        <i class="fas fa-phone"></i> ${instructor.telefono}
                    </p>
                </div>
                <div class="instructor-stats-custom">
                    <div class="stat-item-instructor">
                        <span class="stat-number-instructor">${clasesAsignadas.length}</span>
                        <span class="stat-label-instructor">Clases</span>
                    </div>
                    <div class="stat-status-instructor ${instructor.activo ? "status-active-instructor" : "status-inactive-instructor"}">
                        <i class="fas fa-circle"></i> ${instructor.activo ? "Activo" : "Inactivo"}
                    </div>
                </div>
            </div>
        `;
        })
        .join("");
}

function abrirModalAsignar(claseId) {
    if (!tienePermiso("clases", "asignarInstructor")) {
        mostrarErrorPermisos();
        return;
    }

    claseSeleccionadaId = claseId;
    const clase = database.clasesGym.find((c) => c.id === claseId);

    if (!clase) {
        alert("Clase no encontrada");
        return;
    }

    document.getElementById("claseSeleccionadaNombre").textContent =
        clase.nombre;
    document.getElementById("claseSeleccionadaHorario").textContent =
        clase.horario;
    document.getElementById("claseSeleccionadaTipo").textContent = clase.tipo;

    const select = document.getElementById("instructorSelect");
    select.innerHTML =
        '<option value="">-- Sin instructor asignado --</option>' +
        database.instructores
            .filter((i) => i.activo)
            .map(
                (i) => `
                <option value="${i.id}" ${clase.instructorId === i.id ? "selected" : ""}>
                    ${i.nombre} - ${i.especialidad}
                </option>
            `,
            )
            .join("");

    select.onchange = mostrarPreviewInstructor;

    if (clase.instructorId) {
        mostrarPreviewInstructor();
    }

    document.getElementById("asignarInstructorModal").style.display = "flex";
}

function mostrarPreviewInstructor() {
    const instructorId = parseInt(
        document.getElementById("instructorSelect").value,
    );
    const preview = document.getElementById("instructorPreview");

    if (!instructorId) {
        preview.style.display = "none";
        return;
    }

    const instructor = database.instructores.find((i) => i.id === instructorId);

    if (!instructor) {
        preview.style.display = "none";
        return;
    }

    const clasesAsignadas = database.clasesGym.filter(
        (c) => c.instructorId === instructorId,
    );

    preview.innerHTML = `
        <div class="preview-header-instructor">
            <i class="fas fa-info-circle"></i>
            <span>Vista previa del instructor</span>
        </div>
        <div class="preview-content-instructor">
            <div class="preview-avatar-instructor">
                <i class="fas fa-user-tie"></i>
            </div>
            <div class="preview-details-instructor">
                <h4>${instructor.nombre}</h4>
                <p><strong>Especialidad:</strong> ${instructor.especialidad}</p>
                <p><strong>Email:</strong> ${instructor.email}</p>
                <p><strong>Clases actuales:</strong> ${clasesAsignadas.length}</p>
                ${
                    clasesAsignadas.length > 0
                        ? `
                    <div class="clases-actuales">
                        ${clasesAsignadas.map((c) => `<span class="clase-tag">${c.nombre}</span>`).join("")}
                    </div>
                `
                        : ""
                }
            </div>
        </div>
    `;

    preview.style.display = "block";
}

async function confirmarAsignacion() {
    if (!claseSeleccionadaId) return;

    const instructorId = document.getElementById("instructorSelect").value;
    const instructorIdNum = instructorId ? parseInt(instructorId) : null;

    const clase = database.clasesGym.find((c) => c.id === claseSeleccionadaId);
    const instructorAnterior = clase.instructorId
        ? database.instructores.find((i) => i.id === clase.instructorId)
        : null;
    const instructorNuevo = instructorIdNum
        ? database.instructores.find((i) => i.id === instructorIdNum)
        : null;

    // ✅ GUARDAR EN MYSQL
    const resultado = await asignarInstructorEnAPI(claseSeleccionadaId, instructorIdNum);
    
    if (!resultado) {
        alert('❌ Error al asignar instructor');
        return;
    }

    // ✅ RECARGAR DATOS desde MySQL para actualizar la interfaz
    await cargarClasesGymDesdeAPI();
    await cargarInstructoresDesdeAPI();

    let mensaje = "";
    if (instructorAnterior && instructorNuevo) {
        mensaje = `Se reasignó la clase "${clase.nombre}"\nDe: ${instructorAnterior.nombre}\nA: ${instructorNuevo.nombre}`;
    } else if (instructorNuevo) {
        mensaje = `Se asignó "${instructorNuevo.nombre}" a la clase "${clase.nombre}"`;
    } else {
        mensaje = `Se quitó el instructor de la clase "${clase.nombre}"`;
    }

    alert(mensaje);
    
    // ✅ ACTUALIZAR TABLAS con los datos recargados
    updateClasesTable();
    updateInstructoresGrid();
    cerrarModalAsignar();
}
function cerrarModalAsignar() {
    const modal = document.getElementById("asignarInstructorModal");
    if (modal) {
        modal.style.display = "none";
    }
    const preview = document.getElementById("instructorPreview");
    if (preview) preview.style.display = "none";
    const select = document.getElementById("instructorSelect");
    if (select) select.value = "";}
// TICKETS
function generarTicket(pagoId) {
    const pago = database.pagos.find((p) => p.id === pagoId);
    const socio = database.socios.find((s) => s.id === pago.socioId);
    if (!pago || !socio) {
        alert("Error al generar el ticket");
        return;
    }
    const ticketContent = document.getElementById("ticketContent");

    ticketContent.innerHTML = `
        <div class="ticket-header">
            <div class="ticket-logo">
                <i class="fas fa-dumbbell"></i>
            </div>
            <h2>The Best Gym</h2>
            <p>Sistema de Gestión</p>
            <div class="ticket-divider"></div>
        </div>

        <div class="ticket-body">
            <div class="ticket-section">
                <h3>Comprobante de Pago</h3>
                <p class="ticket-number">N° ${String(pago.id).padStart(6, "0")}</p>
            </div>

            <div class="ticket-divider"></div>

            <div class="ticket-section">
                <div class="ticket-row">
                    <span class="ticket-label">Fecha:</span>
                    <span class="ticket-value">${formatDate(pago.fecha)}</span>
                </div>
                <div class="ticket-row">
                    <span class="ticket-label">Hora:</span>
                    <span class="ticket-value">${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
            </div>

            <div class="ticket-divider"></div>

            <div class="ticket-section">
                <h4>Datos del Socio</h4>
                <div class="ticket-row">
                    <span class="ticket-label">Nombre:</span>
                    <span class="ticket-value">${socio.nombre}</span>
                </div>
                <div class="ticket-row">
                    <span class="ticket-label">DNI:</span>
                    <span class="ticket-value">${socio.dni}</span>
                </div>
                <div class="ticket-row">
                    <span class="ticket-label">Plan:</span>
                    <span class="ticket-value">${socio.plan}</span>
                </div>
            </div>

            <div class="ticket-divider"></div>

            <div class="ticket-section">
                <h4>Detalle del Pago</h4>
                <div class="ticket-row">
                    <span class="ticket-label">Concepto:</span>
                    <span class="ticket-value">${pago.concepto}</span>
                </div>
                <div class="ticket-row">
                    <span class="ticket-label">Método:</span>
                    <span class="ticket-value">${pago.metodo_pago || pago.metodoPago}</span>
                </div>
            </div>

            <div class="ticket-divider"></div>

            <div class="ticket-total">
                <span>TOTAL ABONADO</span>
                <span class="ticket-amount">${formatCurrency(pago.monto)}</span>
            </div>

            <div class="ticket-footer">
                <p>¡Gracias por tu pago!</p>
                <p class="ticket-small">Este comprobante es válido como constancia de pago</p>
                <p class="ticket-small">Vencimiento: ${formatDate(socio.vencimiento)}</p>
            </div>
        </div>
    `;

    document.getElementById("ticketModal").style.display = "flex";
}

function cerrarTicket() {
    document.getElementById("ticketModal").style.display = "none";
}

function imprimirTicket() {
    window.print();
}

function descargarTicket() {
    alert(
        'Funcionalidad de descarga PDF próximamente.\nPor ahora usa "Imprimir" y selecciona "Guardar como PDF"',
    );
}
// FUNCIONES AUXILIARES
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = "flex";
}
// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
    initLogin();
});
