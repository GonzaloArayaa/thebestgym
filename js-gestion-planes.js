// GESTIÓN DE PLANES
let planEnEdicion = null;

// Info de sesión sobre pausas: NO se guarda en la base de datos.
// Solo se usa para el límite de 60 días/año y para calcular los días
// no utilizados si el socio reactiva su plan antes de tiempo.
// Lo único que persiste realmente en MySQL es socio.estado y socio.vencimiento.
const historialPausasSesion = {};
const pausaActivaSesion = {};
function abrirModalNuevoPlan() {
    if (currentUser.rol !== "Administrador") {
        mostrarErrorPermisos();
        return;
    }
    planEnEdicion = null;
    document.getElementById("tituloModalPlan").textContent = "Crear Nuevo Plan";
    document.getElementById("formPlan").reset();
    document.getElementById("planActivo").checked = true;
    document.getElementById("errorPlan").style.display = "none";
    document.getElementById("modalPlan").style.display = "flex";
    // Event listener
    document.getElementById("formPlan").onsubmit = (e) => {
        e.preventDefault();
        guardarPlan();
    };
}
function editarPlan(planId) {
    if (currentUser.rol !== "Administrador") {
        mostrarErrorPermisos();
        return;
    }
    const plan = database.planes.find((p) => p.id === planId);
    if (!plan) {
        alert("❌ Plan no encontrado");
        return;
    }
    planEnEdicion = plan;
    document.getElementById("tituloModalPlan").textContent = "Editar Plan";
    document.getElementById("planNombre").value = plan.nombre;
    document.getElementById("planDuracion").value = plan.duracion;
    document.getElementById("planCosto").value = plan.costo;
    document.getElementById("planDescripcion").value = plan.descripcion;
    document.getElementById("planBeneficios").value = plan.beneficios || "";
    document.getElementById("planActivo").checked = plan.activo !== false;
    document.getElementById("errorPlan").style.display = "none";
    document.getElementById("modalPlan").style.display = "flex";

    // Event listener
    document.getElementById("formPlan").onsubmit = (e) => {
        e.preventDefault();
        guardarPlan();
    };
}

async function guardarPlan() {
    const nombre = document.getElementById("planNombre").value.trim();
    const duracion = parseInt(document.getElementById("planDuracion").value);
    const costo = parseFloat(document.getElementById("planCosto").value);
    const descripcion = document.getElementById("planDescripcion").value.trim();
    const beneficios = document.getElementById("planBeneficios").value.trim();
    const activo = document.getElementById("planActivo").checked;

    const errorDiv = document.getElementById("errorPlan");

    // Validar nombre único
    const nombreExiste = database.planes.some(
        (p) =>
            p.nombre.toLowerCase() === nombre.toLowerCase() &&
            (!planEnEdicion || p.id !== planEnEdicion.id),
    );

    if (nombreExiste) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Nombre duplicado</strong>
                <p>Ya existe un plan con el nombre "${nombre}". Por favor, elige otro nombre.</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        return;
    }

    if (duracion < 1) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Duración inválida</strong>
                <p>La duración debe ser al menos 1 día.</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        return;
    }

    if (costo < 0) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Costo inválido</strong>
                <p>El costo no puede ser negativo.</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        return;
    }

    try {
        if (planEnEdicion) {
            // ✅ EDITAR plan existente en MySQL
            const planData = {
                id: planEnEdicion.id,
                nombre: nombre,
                duracion: duracion,
                costo: costo,
                descripcion: descripcion
            };

            const result = await actualizarPlanEnAPI(planData);
            
            if (!result) {
                alert('❌ Error al actualizar el plan');
                return;
            }

            alert("✅ Plan actualizado correctamente");
        } else {
            // ✅ CREAR nuevo plan en MySQL
            const planData = {
                nombre: nombre,
                duracion: duracion,
                costo: costo,
                descripcion: descripcion
            };

            const result = await crearPlanEnAPI(planData);
            
            if (!result) {
                alert('❌ Error al crear el plan');
                return;
            }

            alert("✅ Plan creado correctamente");
        }

        cerrarModalPlan();
        // NO necesitas updatePlanesGrid() porque las APIs ya lo hacen automáticamente
        
    } catch (error) {
        console.error('Error al guardar plan:', error);
        alert('❌ Error al guardar el plan. Revisa la consola para más detalles.');
    }
}

async function eliminarPlan(planId) {
    if (currentUser.rol !== "Administrador") {
        mostrarErrorPermisos();
        return;
    }

    const plan = database.planes.find((p) => p.id === planId);
    if (!plan) {
        alert("❌ Plan no encontrado");
        return;
    }

    // Verificar si hay socios con este plan
    const sociosConPlan = database.socios.filter((s) => s.plan === plan.nombre);

    if (sociosConPlan.length > 0) {
        if (
            !confirm(
                `⚠️ Hay ${sociosConPlan.length} socio(s) con este plan.\n\n¿Estás seguro de eliminarlo? Los socios mantendrán el nombre del plan, pero no podrás asignarlo a nuevos socios.`,
            )
        ) {
            return;
        }
    } else {
        if (!confirm(`¿Estás seguro de eliminar el plan "${plan.nombre}"?`)) {
            return;
        }
    }

    // Eliminar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await eliminarPlanEnAPI(planId);

    if (!exito) {
        alert("No se pudo eliminar el plan en la base de datos. Intentá de nuevo.");
        return;
    }

    const index = database.planes.findIndex((p) => p.id === planId);
    if (index > -1) {
        database.planes.splice(index, 1);
    }
    alert("✅ Plan eliminado correctamente");
    updatePlanesGrid();
}

function cerrarModalPlan() {
    document.getElementById("modalPlan").style.display = "none";
    document.getElementById("formPlan").reset();
    planEnEdicion = null;
}
// RF25: CANCELAR PLAN
function abrirModalCancelarPlan() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) {
        alert("⚠️ Error: No se encontró información del socio");
        return;
    }
    if (socio.estado === "Cancelado") {
        alert("❌ Tu plan ya está cancelado");
        return;
    }
    if (socio.estado === "Pausado") {
        alert("⚠️ Debes reactivar tu plan antes de cancelarlo");
        return;
    }
    const modal = document.getElementById("modalCancelarPlan");
    if (!modal) {
        alert("⚠️ Error: No se pudo abrir el modal");
        return;
    }
    modal.style.display = "flex";
    const errorDiv = document.getElementById("errorCancelarPlan");
    if (errorDiv) errorDiv.style.display = "none";
    const form = document.getElementById("formCancelarPlan");
    if (form) form.reset();
    const motivoOtro = document.getElementById("motivoOtroGroup");
    if (motivoOtro) motivoOtro.style.display = "none";
    // Verificar pagos pendientes
    const infoPagos = document.getElementById("infoPagosPendientes");
    if (infoPagos) {
        if (socio.estado === "Moroso") {
            infoPagos.style.display = "flex";
        } else {
            infoPagos.style.display = "none";
        }
    }
    // Event listener para cambio de motivo
    const selectMotivo = document.getElementById("motivoCancelacion");
    if (selectMotivo) {
        selectMotivo.onchange = function () {
            const motivoOtroGroup = document.getElementById("motivoOtroGroup");
            if (motivoOtroGroup) {
                if (this.value === "otro") {
                    motivoOtroGroup.style.display = "block";
                } else {
                    motivoOtroGroup.style.display = "none";
                }
            }
        };
    }

    // Event listener para el formulario
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            confirmarCancelacionPlan();
        };
    }
}

function cerrarModalCancelarPlan() {
    const modal = document.getElementById("modalCancelarPlan");
    if (modal) {
        modal.style.display = "none";
    }
}

async function confirmarCancelacionPlan() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);

    if (!socio) return;

    const motivoSelect = document.getElementById("motivoCancelacion");
    const motivoTexto = document.getElementById("motivoOtroTexto");
    const confirmarCheck = document.getElementById("confirmarCancelacion");

    if (!motivoSelect || !confirmarCheck) {
        alert("⚠️ Error en el formulario");
        return;
    }

    const motivo = motivoSelect.value;
    const motivoDetalle =
        motivo === "otro" && motivoTexto ? motivoTexto.value : motivo;
    const confirmado = confirmarCheck.checked;

    if (!confirmado) {
        alert(
            "⚠️ Debes confirmar que entiendes las consecuencias de cancelar tu plan",
        );
        return;
    }

    if (motivo === "otro" && (!motivoDetalle || !motivoDetalle.trim())) {
        alert("⚠️ Debes especificar el motivo de cancelación");
        return;
    }

    // Persistir el nuevo estado en MySQL
    const exito = await actualizarSocioEnAPI({
        id: socio.id,
        nombre: socio.nombre,
        email: socio.email,
        telefono: socio.telefono,
        plan: socio.plan,
        estado: "Cancelado",
        vencimiento: socio.vencimiento,
    });

    if (!exito) {
        alert(
            "No se pudo cancelar el plan en el servidor. Intentá de nuevo.",
        );
        return;
    }

    // Cancelar turnos activos del socio, persistiendo cada cancelación
    // en MySQL (antes esto solo tocaba el array en memoria y se perdía
    // al recargar la página).
    const turnosActivos = database.turnos.filter(
        (t) => t.socioId === socio.id && t.estado === "Confirmado",
    );
    for (const turno of turnosActivos) {
        await cancelarTurnoEnAPI(turno.id);
    }

    alert(
        "✅ Plan cancelado correctamente\n\nLamentamos que te vayas. Esperamos verte pronto de vuelta.",
    );

    cerrarModalCancelarPlan();
    updateMiPlan();

    // Actualizar dashboard si estamos en él
    if (activeModule === "dashboard") {
        updateDashboard();
    }
}
// RF26: PAUSAR / CONGELAR PLAN
function abrirModalPausarPlan() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);

    if (!socio) {
        alert("⚠️ Error: No se encontró información del socio");
        return;
    }

    if (socio.estado === "Cancelado") {
        alert("❌ No puedes pausar un plan cancelado");
        return;
    }

    if (socio.estado === "Pausado") {
        alert("⚠️ Tu plan ya está pausado");
        return;
    }

    if (socio.estado === "Moroso") {
        alert("⚠️ No puedes pausar tu plan si tienes pagos pendientes");
        return;
    }

    // Verificar días pausados en el año
    const diasPausadosEsteAno = calcularDiasPausadosEnAno(socio.id);
    if (diasPausadosEsteAno >= 60) {
        alert("❌ Has alcanzado el límite máximo de 60 días de pausa por año");
        return;
    }

    const modal = document.getElementById("modalPausarPlan");
    if (!modal) {
        alert("⚠️ Error: No se pudo abrir el modal");
        return;
    }

    modal.style.display = "flex";

    const errorDiv = document.getElementById("errorPausarPlan");
    if (errorDiv) errorDiv.style.display = "none";

    const form = document.getElementById("formPausarPlan");
    if (form) form.reset();

    const preview = document.getElementById("previsualizacionPausa");
    if (preview) preview.style.display = "none";

    // Establecer fecha mínima (mañana)
    const fechaInput = document.getElementById("fechaInicioPausaPlan");
    if (fechaInput) {
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        fechaInput.min = manana.toISOString().split("T")[0];
        fechaInput.onchange = actualizarPrevisualizacionPausa;
    }

    const duracionSelect = document.getElementById("duracionPausa");
    if (duracionSelect) {
        duracionSelect.onchange = actualizarPrevisualizacionPausa;
    }

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            confirmarPausaPlan();
        };
    }
}

function cerrarModalPausarPlan() {
    const modal = document.getElementById("modalPausarPlan");
    if (modal) {
        modal.style.display = "none";
    }
}

function calcularDiasPausadosEnAno(socioId) {
    const historial = historialPausasSesion[socioId];
    if (!historial) return 0;

    const anoActual = new Date().getFullYear();
    let totalDias = 0;

    historial.forEach((h) => {
        const fechaPausa = new Date(h.fecha);
        if (fechaPausa.getFullYear() === anoActual) {
            totalDias += h.dias || 0;
        }
    });

    return totalDias;
}

function actualizarPrevisualizacionPausa() {
    const fechaInput = document.getElementById("fechaInicioPausaPlan");
    const duracionSelect = document.getElementById("duracionPausa");

    if (!fechaInput || !duracionSelect) return;

    const fechaInicio = fechaInput.value;
    const duracion = parseInt(duracionSelect.value);

    if (!fechaInicio || !duracion) {
        const preview = document.getElementById("previsualizacionPausa");
        if (preview) preview.style.display = "none";
        return;
    }

    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    const diasYaUsados = calcularDiasPausadosEnAno(socio);

    if (diasYaUsados + duracion > 60) {
        const errorDiv = document.getElementById("errorPausarPlan");
        if (errorDiv) {
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Duración excedida</strong>
                    <p>Has usado ${diasYaUsados} días de pausa este año. Solo puedes pausar ${60 - diasYaUsados} días más.</p>
                </div>
            `;
            errorDiv.style.display = "flex";
        }
        const preview = document.getElementById("previsualizacionPausa");
        if (preview) preview.style.display = "none";
        return;
    }

    const errorDiv = document.getElementById("errorPausarPlan");
    if (errorDiv) errorDiv.style.display = "none";

    const inicio = new Date(fechaInicio + "T00:00:00");
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + duracion);

    const vencimientoActual = new Date(socio.vencimiento + "T00:00:00");
    const nuevoVencimiento = new Date(vencimientoActual);
    nuevoVencimiento.setDate(nuevoVencimiento.getDate() + duracion);

    const prevInicio = document.getElementById("prevInicioPausa");
    const prevFin = document.getElementById("prevFinPausa");
    const prevVencimiento = document.getElementById("prevNuevoVencimiento");

    if (prevInicio) prevInicio.textContent = formatDate(fechaInicio);
    if (prevFin)
        prevFin.textContent = formatDate(fin.toISOString().split("T")[0]);
    if (prevVencimiento)
        prevVencimiento.textContent = formatDate(
            nuevoVencimiento.toISOString().split("T")[0],
        );

    const preview = document.getElementById("previsualizacionPausa");
    if (preview) preview.style.display = "block";
}

async function confirmarPausaPlan() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);

    if (!socio) return;

    const fechaInput = document.getElementById("fechaInicioPausaPlan");
    const duracionSelect = document.getElementById("duracionPausa");

    if (!fechaInput || !duracionSelect) return;

    const fechaInicio = fechaInput.value;
    const duracion = parseInt(duracionSelect.value);

    const inicio = new Date(fechaInicio + "T00:00:00");
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + duracion);
    const finStr = fin.toISOString().split("T")[0];

    const vencimientoActual = new Date(socio.vencimiento + "T00:00:00");
    const nuevoVencimiento = new Date(vencimientoActual);
    nuevoVencimiento.setDate(nuevoVencimiento.getDate() + duracion);
    const nuevoVencimientoStr = nuevoVencimiento.toISOString().split("T")[0];

    // Persistir el nuevo estado y vencimiento en MySQL
    const exito = await actualizarSocioEnAPI({
        id: socio.id,
        nombre: socio.nombre,
        email: socio.email,
        telefono: socio.telefono,
        plan: socio.plan,
        estado: "Pausado",
        vencimiento: nuevoVencimientoStr,
    });

    if (!exito) {
        alert("No se pudo pausar el plan en el servidor. Intentá de nuevo.");
        return;
    }

    // Registro de sesión: solo para el límite de 60 días/año y la
    // reactivación anticipada. No persiste en la base de datos.
    historialPausasSesion[socio.id] = historialPausasSesion[socio.id] || [];
    historialPausasSesion[socio.id].push({
        fecha: new Date().toISOString(),
        dias: duracion,
    });
    pausaActivaSesion[socio.id] = { fechaFinPausa: finStr };

    alert(
        `✅ Plan pausado correctamente\n\nTu plan estará pausado desde el ${formatDate(fechaInicio)} hasta el ${formatDate(finStr)}\n\nNuevo vencimiento: ${formatDate(nuevoVencimientoStr)}`,
    );

    cerrarModalPausarPlan();
    updateMiPlan();
}

async function reactivarPlan() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);

    if (!socio || socio.estado !== "Pausado") {
        alert("⚠️ Tu plan no está pausado");
        return;
    }

    if (
        !confirm(
            "¿Estás seguro de reactivar tu plan antes de tiempo?\n\nPodrás volver a acceder al gimnasio inmediatamente.",
        )
    ) {
        return;
    }

    // Calcular días no utilizados de la pausa (solo si tenemos el registro
    // de esta sesión; si se recargó la página no se puede calcular y se
    // reactiva sin ajustar el vencimiento).
    const infoPausa = pausaActivaSesion[socio.id];
    let diasNoUtilizados = 0;
    let nuevoVencimientoStr = socio.vencimiento;

    if (infoPausa && infoPausa.fechaFinPausa) {
        const hoy = new Date();
        const fechaFinPausa = new Date(infoPausa.fechaFinPausa + "T00:00:00");
        diasNoUtilizados = Math.max(
            0,
            Math.ceil((fechaFinPausa - hoy) / (1000 * 60 * 60 * 24)),
        );

        if (diasNoUtilizados > 0) {
            const vencimientoActual = new Date(
                socio.vencimiento + "T00:00:00",
            );
            vencimientoActual.setDate(
                vencimientoActual.getDate() - diasNoUtilizados,
            );
            nuevoVencimientoStr = vencimientoActual.toISOString().split("T")[0];
        }
    }

    // Persistir el nuevo estado y vencimiento en MySQL
    const exito = await actualizarSocioEnAPI({
        id: socio.id,
        nombre: socio.nombre,
        email: socio.email,
        telefono: socio.telefono,
        plan: socio.plan,
        estado: "Activo",
        vencimiento: nuevoVencimientoStr,
    });

    if (!exito) {
        alert(
            "No se pudo reactivar el plan en el servidor. Intentá de nuevo.",
        );
        return;
    }

    delete pausaActivaSesion[socio.id];

    alert(
        `✅ Plan reactivado correctamente\n\n${diasNoUtilizados > 0 ? `Se han restado ${diasNoUtilizados} días no utilizados de tu vencimiento.` : ""}\n\nNuevo vencimiento: ${formatDate(nuevoVencimientoStr)}`,
    );

    updateMiPlan();
}
// RF27: VER ESTADO DEL PLAN
function verEstadoPlan(socioId) {
    const modalExistente = document.getElementById("modalEstadoPlan");
    if (modalExistente) modalExistente.remove();
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        alert("❌ Socio no encontrado");
        return;
    }

    const plan = database.planes.find((p) => p.nombre === socio.plan);
    const fechaVencimiento = new Date(socio.vencimiento + "T00:00:00");
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diasRestantes = Math.ceil(
        (fechaVencimiento - hoy) / (1000 * 60 * 60 * 24),
    );

    let estadoPlan = "";
    let estadoClass = "";
    let estadoIcono = "";

    if (socio.estado === "Moroso" || diasRestantes < 0) {
        estadoPlan = "Vencido";
        estadoClass = "estado-vencido";
        estadoIcono = "fa-times-circle";
    } else if (diasRestantes === 0) {
        estadoPlan = "Vence Hoy";
        estadoClass = "estado-vence-hoy";
        estadoIcono = "fa-exclamation-triangle";
    } else if (diasRestantes <= 3) {
        estadoPlan = "Por Vencer";
        estadoClass = "estado-por-vencer";
        estadoIcono = "fa-clock";
    } else {
        estadoPlan = "Activo";
        estadoClass = "estado-activo-plan";
        estadoIcono = "fa-check-circle";
    }

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalEstadoPlan";
    modal.style.display = "flex";

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalEstadoPlan()"></div>
        <div class="modal-content modal-estado-plan">
            <button class="modal-close" onclick="cerrarModalEstadoPlan()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-estado-plan ${estadoClass}">
                <i class="fas ${estadoIcono}"></i>
                <div>
                    <h3>Estado del Plan</h3>
                    <p>${socio.nombre}</p>
                </div>
            </div>

            <div class="modal-body-estado-plan">
                <div class="estado-plan-card">
                    <div class="estado-badge ${estadoClass}">
                        <i class="fas ${estadoIcono}"></i>
                        <span>${estadoPlan}</span>
                    </div>
                </div>

                <div class="info-plan-grid">
                    <div class="info-plan-item">
                        <i class="fas fa-id-card"></i>
                        <div>
                            <label>Plan Actual</label>
                            <strong>${socio.plan}</strong>
                        </div>
                    </div>

                    <div class="info-plan-item">
                        <i class="fas fa-calendar-alt"></i>
                        <div>
                            <label>Fecha de Alta</label>
                            <strong>${formatDate(socio.fechaAlta)}</strong>
                        </div>
                    </div>

                    <div class="info-plan-item">
                        <i class="fas fa-calendar-check"></i>
                        <div>
                            <label>Fecha de Vencimiento</label>
                            <strong>${formatDate(socio.vencimiento)}</strong>
                        </div>
                    </div>

                    <div class="info-plan-item">
                        <i class="fas fa-clock"></i>
                        <div>
                            <label>Días Restantes</label>
                            <strong>${diasRestantes >= 0 ? diasRestantes + " días" : "Vencido hace " + Math.abs(diasRestantes) + " días"}</strong>
                        </div>
                    </div>

                    ${
                        plan
                            ? `
                        <div class="info-plan-item">
                            <i class="fas fa-dollar-sign"></i>
                            <div>
                                <label>Costo del Plan</label>
                                <strong>${formatCurrency(plan.costo)}</strong>
                            </div>
                        </div>

                        <div class="info-plan-item">
                            <i class="fas fa-hourglass-half"></i>
                            <div>
                                <label>Duración</label>
                                <strong>${plan.duracion} días</strong>
                            </div>
                        </div>
                    `
                            : ""
                    }
                </div>

                ${
                    plan && plan.beneficios
                        ? `
                    <div class="beneficios-plan-estado">
                        <h4><i class="fas fa-star"></i> Beneficios de tu Plan</h4>
                        <ul>
                            ${plan.beneficios
                                .split("\n")
                                .filter((b) => b.trim())
                                .map((b) => `<li>${b.trim()}</li>`)
                                .join("")}
                        </ul>
                    </div>
                `
                        : ""
                }

                ${
                    estadoPlan === "Vencido" || estadoPlan === "Por Vencer"
                        ? `
                    <div class="alerta-renovacion">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div>
                            <strong>${estadoPlan === "Vencido" ? "¡Tu plan ha vencido!" : "¡Tu plan está por vencer!"}</strong>
                            <p>${
                                estadoPlan === "Vencido"
                                    ? "Renueva tu membresía para seguir disfrutando del gimnasio."
                                    : "Renueva pronto para evitar la suspensión del servicio."
                            }</p>
                        </div>
                    </div>
                `
                        : ""
                }

                <div class="acciones-estado-plan">
                    ${
                        (estadoPlan === "Vencido" ||
                            estadoPlan === "Por Vencer") &&
                        (currentUser.rol === "Administrador" ||
                            currentUser.rol === "Recepcionista")
                            ? `
                        <button class="btn-renovar-plan" onclick="abrirRenovarPlanSocio(${socio.id}); cerrarModalEstadoPlan();">
                            <i class="fas fa-sync-alt"></i> Renovar Plan
                        </button>
                    `
                            : ""
                    }
                    <button class="btn-secondary" onclick="cerrarModalEstadoPlan()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
function cerrarModalEstadoPlan() {
    const modal = document.getElementById("modalEstadoPlan");
    if (modal) modal.remove();
}
// VERIFICACIÓN AUTOMÁTICA PERIÓDICA
setInterval(
    () => {
        if (currentUser) {
            verificarVencimientos();
            if (activeModule === "dashboard") {
                updateDashboard();
            }
        }
    },
    5 * 60 * 1000,
); 
// EXTENDER updateMiPlan para mostrar/ocultar botones según el estado real del plan
(function () {
    const originalUpdateMiPlan = window.updateMiPlan;
    window.updateMiPlan = function () {
        // Llamar a la función original
        if (originalUpdateMiPlan) {
            originalUpdateMiPlan();
        }
        if (currentUser.rol !== "Socio") return;
        const socio = database.socios.find((s) => s.id === currentUser.socioId);
        if (!socio) return;
        // Mostrar/ocultar botones según estado (Pausado/Cancelado = ya no puede
        // volver a pausar/cancelar hasta reactivar)
        const btnPausar = document.querySelector(".btn-pause");
        const btnCancelar = document.querySelector(".btn-cancel");
        if (socio.estado === "Pausado" || socio.estado === "Cancelado") {
            if (btnPausar) btnPausar.style.display = "none";
            if (btnCancelar) btnCancelar.style.display = "none";
        } else {
            if (btnPausar) btnPausar.style.display = "flex";
            if (btnCancelar) btnCancelar.style.display = "flex";
        }
    };
})();


// EXTENDER updateSociosTable para mostrar estado
(function () {
    const originalUpdateSociosTable = window.updateSociosTable;

    window.updateSociosTable = function () {
        const searchTerm = document
            .getElementById("searchSocios")
            .value.toLowerCase();
        const tbody = document.getElementById("tablaSocios");

        const filteredSocios = database.socios.filter(
            (socio) =>
                socio.nombre.toLowerCase().includes(searchTerm) ||
                socio.dni.includes(searchTerm),
        );
        tbody.innerHTML = filteredSocios
            .map((socio) => {
                // El estado ya viene directo de la base de datos (Activo/Moroso/Pausado/Cancelado)
                const estadoMostrar = socio.estado;
                return `
            <tr>
                <td>
                    <div>
                        <div style="font-weight: 500; color: var(--text-dark);">${socio.nombre}</div>
                        <div style="font-size: 13px; color: var(--text-light);">${socio.email}</div>
                    </div>
                </td>
                <td>${socio.dni}</td>
                <td>${socio.plan}</td>
                <td>${formatDate(socio.vencimiento)}</td>
                <td>
                    <span class="badge ${
                        estadoMostrar === "Activo"
                            ? "badge-active"
                            : estadoMostrar === "Pausado"
                            ? "badge"
                            : "badge-moroso"
                    }" style="${estadoMostrar === "Pausado" ? "background: #fef3c7; color: #92400e;" : ""}">
                        ${estadoMostrar}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-table btn-ver-estado" onclick="verEstadoPlan(${socio.id})" title="Ver estado del plan">
                            <i class="fas fa-chart-line"></i> Estado
                        </button>
                        ${
                            typeof tienePermiso === "function" &&
                            tienePermiso("socios", "editar")
                                ? `
                            <button class="btn-table btn-edit" onclick="editarSocio(${socio.id})">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                        `
                                : ""
                        }
                        ${
                            typeof tienePermiso === "function" &&
                            tienePermiso("socios", "eliminar")
                                ? `
                            <button class="btn-table btn-delete" onclick="eliminarSocio(${socio.id})">
                                <i class="fas fa-trash"></i> Eliminar
                            </button>
                        `
                                : ""
                        }
                    </div>
                </td>
            </tr>
        `;
            })
            .join("");
    };
})();
console.log("✅ Funciones RF25, RF26 y RF27 cargadas correctamente");