// MÓDULO DE REPORTES
function initReportesModule() {
    document
        .getElementById("filtroPeriodoPagos")
        .addEventListener("change", function () {
            const valor = this.value;
            const rangoFechas = document.getElementById("rangoFechasPagos");
            const rangoFechas2 = document.getElementById("rangoFechasPagos2");
            if (valor === "personalizado") {
                rangoFechas.style.display = "block";
                rangoFechas2.style.display = "block";
            } else {
                rangoFechas.style.display = "none";
                rangoFechas2.style.display = "none";
            }
        });
    document
        .getElementById("filtroPeriodoAsistencias")
        .addEventListener("change", function () {
            const valor = this.value;
            const rangoFechas = document.getElementById(
                "rangoFechasAsistencias",
            );
            const rangoFechas2 = document.getElementById(
                "rangoFechasAsistencias2",
            );
            if (valor === "personalizado") {
                rangoFechas.style.display = "block";
                rangoFechas2.style.display = "block";
            } else {
                rangoFechas.style.display = "none";
                rangoFechas2.style.display = "none";
            }
        });
    aplicarFiltrosPagos();
}
function cambiarTipoReporte(tipo) {
    document
        .querySelectorAll(".tab-btn")
        .forEach((btn) => btn.classList.remove("active"));
    event.target.closest(".tab-btn").classList.add("active");
    // Mostrar/ocultar secciones
    if (tipo === "pagos") {
        document.getElementById("reportePagos").style.display = "block";
        document.getElementById("reporteAsistencias").style.display = "none";
        aplicarFiltrosPagos();
    } else {
        document.getElementById("reportePagos").style.display = "none";
        document.getElementById("reporteAsistencias").style.display = "block";
        aplicarFiltrosAsistencias();
    }
}
// REPORTES DE PAGOS
function aplicarFiltrosPagos() {
    const periodo = document.getElementById("filtroPeriodoPagos").value;
    const plan = document.getElementById("filtroPlanPagos").value;
    const metodo = document.getElementById("filtroMetodoPagos").value;
    let fechaDesde, fechaHasta;
    const hoy = new Date();
    switch (periodo) {
        case "mes-actual":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fechaHasta = hoy;
            break;
        case "mes-anterior":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            break;
        case "trimestre":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
            fechaHasta = hoy;
            break;
        case "año":
            fechaDesde = new Date(hoy.getFullYear(), 0, 1);
            fechaHasta = hoy;
            break;
        case "personalizado":
            fechaDesde = new Date(
                document.getElementById("fechaDesdePagos").value + "T00:00:00",
            );
            fechaHasta = new Date(
                document.getElementById("fechaHastaPagos").value + "T23:59:59",
            );
            break;
    }
    // Filtrar pagos
    let pagosFiltrados = database.pagos.filter((pago) => {
        const fechaPago = new Date(pago.fecha + "T00:00:00");
        const socio = database.socios.find((s) => s.id === pago.socioId);
        const cumpleFecha = fechaPago >= fechaDesde && fechaPago <= fechaHasta;
        const cumplePlan = plan === "todos" || (socio && socio.plan === plan);
        const cumpleMetodo = metodo === "todos" || (pago.metodo_pago || pago.metodoPago) === metodo;
        return cumpleFecha && cumplePlan && cumpleMetodo;
    });
    // Actualizar estadísticas
    const totalIngresos = pagosFiltrados.reduce((sum, p) => sum + p.monto, 0);
    const cantidadPagos = pagosFiltrados.length;
    const promedio = cantidadPagos > 0 ? totalIngresos / cantidadPagos : 0;
    document.getElementById("totalIngresosPagos").textContent =
        formatCurrency(totalIngresos);
    document.getElementById("cantidadPagos").textContent = cantidadPagos;
    document.getElementById("promedioPagos").textContent =
        formatCurrency(promedio);
    // Actualizar tabla
    const tbody = document.getElementById("tablaReportePagos");
    tbody.innerHTML =
        pagosFiltrados.length > 0
            ? pagosFiltrados
                .map((pago) => {
                    const socio = database.socios.find(
                        (s) => s.id === pago.socioId,
                    );
                    return `
                <tr>
                    <td>${formatDate(pago.fecha)}</td>
                    <td>${socio ? socio.nombre : "-"}</td>
                    <td>${pago.concepto}</td>
                    <td>${socio ? socio.plan : "-"}</td>
                    <td>${pago.metodo_pago || pago.metodoPago}</td>
                    <td style="font-weight: 600; color: var(--success-color);">${formatCurrency(pago.monto)}</td>
                </tr>
            `;})
                .join("")
            : '<tr><td colspan="6" class="text-center" style="color: var(--text-light); padding: 20px;">No hay pagos en este período</td></tr>';
}
function exportarPagosExcel() {
    alert(
        "📊 Exportando a Excel...\n\nEsta funcionalidad requiere una librería adicional.\nPor ahora se descargará como CSV.",
    );
    exportarPagosCSV();
}

function exportarPagosCSV() {
    const periodo = document.getElementById("filtroPeriodoPagos").value;
    const pagos = obtenerPagosFiltrados();

    let csv = "Fecha,Socio,DNI,Concepto,Plan,Método de Pago,Monto\n";

    pagos.forEach((pago) => {
        const socio = database.socios.find((s) => s.id === pago.socioId);
        csv += `${pago.fecha},${socio?.nombre || "-"},${socio?.dni || "-"},${pago.concepto},${socio?.plan || "-"},${pago.metodo_pago || pago.metodoPago},${pago.monto}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_pagos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportarPagosPDF() {
    alert(
        "📄 Funcionalidad de exportación a PDF\n\nEsta característica requiere una librería adicional (jsPDF).\nActualmente puedes usar la opción de imprimir del navegador.",
    );
    window.print();
}

function obtenerPagosFiltrados() {
    const periodo = document.getElementById("filtroPeriodoPagos").value;
    const plan = document.getElementById("filtroPlanPagos").value;
    const metodo = document.getElementById("filtroMetodoPagos").value;

    let fechaDesde, fechaHasta;
    const hoy = new Date();

    switch (periodo) {
        case "mes-actual":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fechaHasta = hoy;
            break;
        case "mes-anterior":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            break;
        case "trimestre":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
            fechaHasta = hoy;
            break;
        case "año":
            fechaDesde = new Date(hoy.getFullYear(), 0, 1);
            fechaHasta = hoy;
            break;
        case "personalizado":
            fechaDesde = new Date(
                document.getElementById("fechaDesdePagos").value + "T00:00:00",
            );
            fechaHasta = new Date(
                document.getElementById("fechaHastaPagos").value + "T23:59:59",
            );
            break;
    }

    return database.pagos.filter((pago) => {
        const fechaPago = new Date(pago.fecha + "T00:00:00");
        const socio = database.socios.find((s) => s.id === pago.socioId);

        const cumpleFecha = fechaPago >= fechaDesde && fechaPago <= fechaHasta;
        const cumplePlan = plan === "todos" || (socio && socio.plan === plan);
        const cumpleMetodo = metodo === "todos" || (pago.metodo_pago || pago.metodoPago) === metodo;

        return cumpleFecha && cumplePlan && cumpleMetodo;
    });
}
// REPORTES DE ASISTENCIAS
function aplicarFiltrosAsistencias() {
    const periodo = document.getElementById("filtroPeriodoAsistencias").value;
    let fechaDesde, fechaHasta;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    switch (periodo) {
        case "hoy":
            fechaDesde = hoy;
            fechaHasta = hoy;
            break;
        case "semana":
            fechaDesde = new Date(hoy);
            fechaDesde.setDate(hoy.getDate() - hoy.getDay());
            fechaHasta = hoy;
            break;
        case "mes-actual":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fechaHasta = hoy;
            break;
        case "mes-anterior":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            break;
        case "personalizado":
            fechaDesde = new Date(
                document.getElementById("fechaDesdeAsistencias").value +
                    "T00:00:00",
            );
            fechaHasta = new Date(
                document.getElementById("fechaHastaAsistencias").value +
                    "T23:59:59",
            );
            break;
    }

    // Filtrar asistencias
    let asistenciasFiltradas = database.asistencias.filter((asist) => {
        const fechaAsist = new Date(asist.fecha + "T00:00:00");
        return fechaAsist >= fechaDesde && fechaAsist <= fechaHasta;
    });

    // Calcular estadísticas
    const totalAsistencias = asistenciasFiltradas.length;
    const dias =
        Math.ceil((fechaHasta - fechaDesde) / (1000 * 60 * 60 * 24)) + 1;
    const promedioDiario = Math.round(totalAsistencias / dias);

    // Encontrar día con más asistencias
    const asistenciasPorDia = {};
    asistenciasFiltradas.forEach((a) => {
        asistenciasPorDia[a.fecha] = (asistenciasPorDia[a.fecha] || 0) + 1;
    });

    let diaMasAsistencias = "-";
    let maxAsistencias = 0;
    Object.entries(asistenciasPorDia).forEach(([fecha, cant]) => {
        if (cant > maxAsistencias) {
            maxAsistencias = cant;
            diaMasAsistencias = `${formatDate(fecha)} (${cant})`;
        }
    });

    // Actualizar estadísticas
    document.getElementById("totalAsistencias").textContent = totalAsistencias;
    document.getElementById("promedioDiarioAsistencias").textContent =
        promedioDiario;
    document.getElementById("diaMasAsistencias").textContent =
        diaMasAsistencias;

    // Actualizar tabla
    const tbody = document.getElementById("tablaReporteAsistencias");
    tbody.innerHTML =
        asistenciasFiltradas.length > 0
            ? asistenciasFiltradas
                  .map((asist) => {
                      const socio = database.socios.find(
                          (s) => s.id === asist.socioId,
                      );
                      return `
                <tr>
                    <td>${formatDate(asist.fecha)}</td>
                    <td>${asist.hora}</td>
                    <td>${socio ? socio.nombre : "-"}</td>
                    <td>${socio ? socio.plan : "-"}</td>
                </tr>
            `;
                  })
                  .join("")
            : '<tr><td colspan="4" class="text-center" style="color: var(--text-light); padding: 20px;">No hay asistencias en este período</td></tr>';

    // Generar gráfico
    generarGraficoAsistencias(asistenciasPorDia);
}

function generarGraficoAsistencias(asistenciasPorDia) {
    const container = document.getElementById("graficoAsistencias");

    const fechas = Object.keys(asistenciasPorDia).sort();
    const maxValue = Math.max(...Object.values(asistenciasPorDia));

    if (fechas.length === 0) {
        container.innerHTML =
            '<p class="text-center" style="color: var(--text-light); padding: 40px;">No hay datos para mostrar</p>';
        return;
    }

    container.innerHTML = `
        <div class="grafico-barras">
            ${fechas
                .map((fecha) => {
                    const cantidad = asistenciasPorDia[fecha];
                    const altura = (cantidad / maxValue) * 100;
                    return `
                    <div class="barra-container">
                        <div class="barra-valor">${cantidad}</div>
                        <div class="barra" style="height: ${altura}%" title="${formatDate(fecha)}: ${cantidad} asistencias"></div>
                        <div class="barra-label">${new Date(fecha + "T00:00:00").getDate()}/${new Date(fecha + "T00:00:00").getMonth() + 1}</div>
                    </div>
                `;
                })
                .join("")}
        </div>
    `;
}

function exportarAsistenciasExcel() {
    alert(
        "📊 Exportando a Excel...\n\nEsta funcionalidad requiere una librería adicional.\nPor ahora se descargará como CSV.",
    );
    exportarAsistenciasCSV();
}

function exportarAsistenciasCSV() {
    const asistencias = obtenerAsistenciasFiltradas();

    let csv = "Fecha,Hora,Socio,DNI,Plan\n";

    asistencias.forEach((asist) => {
        const socio = database.socios.find((s) => s.id === asist.socioId);
        csv += `${asist.fecha},${asist.hora},${socio?.nombre || "-"},${socio?.dni || "-"},${socio?.plan || "-"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_asistencias_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportarAsistenciasPDF() {
    alert(
        "📄 Funcionalidad de exportación a PDF\n\nEsta característica requiere una librería adicional (jsPDF).\nActualmente puedes usar la opción de imprimir del navegador.",
    );
    window.print();
}

function obtenerAsistenciasFiltradas() {
    const periodo = document.getElementById("filtroPeriodoAsistencias").value;

    let fechaDesde, fechaHasta;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    switch (periodo) {
        case "hoy":
            fechaDesde = hoy;
            fechaHasta = hoy;
            break;
        case "semana":
            fechaDesde = new Date(hoy);
            fechaDesde.setDate(hoy.getDate() - hoy.getDay());
            fechaHasta = hoy;
            break;
        case "mes-actual":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            fechaHasta = hoy;
            break;
        case "mes-anterior":
            fechaDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            fechaHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            break;
        case "personalizado":
            fechaDesde = new Date(
                document.getElementById("fechaDesdeAsistencias").value +
                    "T00:00:00",
            );
            fechaHasta = new Date(
                document.getElementById("fechaHastaAsistencias").value +
                    "T23:59:59",
            );
            break;
    }

    return database.asistencias.filter((asist) => {
        const fechaAsist = new Date(asist.fecha + "T00:00:00");
        return fechaAsist >= fechaDesde && fechaAsist <= fechaHasta;
    });
}
// SISTEMA DE NOTIFICACIONES
/*** Envía una notificación a un socio*/
function enviarNotificacion(socioId, tipo, asunto, mensaje, canal = "email") {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        console.error("Socio no encontrado");
        return false;
    }
    // Simular envío 
    const exito = Math.random() > 0.1; 
    const notificacion = {
        id: database.notificaciones.length + 1,
        socioId: socioId,
        tipo: tipo, 
        canal: canal, 
        asunto: asunto,
        mensaje: mensaje,
        fecha: new Date().toISOString(),
        envioPor: currentUser.id,
        estado: exito ? "enviado" : "fallido",
        intentos: 1,
    };
    database.notificaciones.push(notificacion);
    // Registrar en log
    const log = {
        id: database.logNotificaciones.length + 1,
        notificacionId: notificacion.id,
        fecha: new Date().toISOString(),
        estado: exito ? "exitoso" : "error",
        mensaje: exito
            ? `Notificación enviada a ${socio.nombre} (${canal})`
            : `Error al enviar notificación a ${socio.nombre}`,
        detalles: {
            socio: socio.nombre,
            email: socio.email,
            telefono: socio.telefono,
            canal: canal,
        },
    };
    database.logNotificaciones.push(log);
    return exito;
}
/*** Notificar sobre reserva de turno*/
function notificarReservaTurno(socioId, claseId) {
    const socio = database.socios.find((s) => s.id === socioId);
    const clase = database.clasesGym.find((c) => c.id === claseId);
    if (!socio || !clase) return false;
    const asunto = "Confirmación de Turno - The Best Gym";
    const mensaje =
        `Hola ${socio.nombre},\n\nTu turno ha sido confirmado:\n\n` +
        `Clase: ${clase.nombre}\n` +
        `Horario: ${clase.horario}\n` +
        `Instructor: ${clase.instructor_nombre || "Sin asignar"}\n\n` +
        `Te esperamos!\n\nThe Best Gym`;
    return enviarNotificacion(socioId, "turno", asunto, mensaje, "email");
}
/*** Notificar cancelación de turno*/
function notificarCancelacionTurno(socioId, claseId) {
    const socio = database.socios.find((s) => s.id === socioId);
    const clase = database.clasesGym.find((c) => c.id === claseId);
    if (!socio || !clase) return false;
    const asunto = "Turno Cancelado - The Best Gym";
    const mensaje =
        `Hola ${socio.nombre},\n\nTu turno ha sido cancelado:\n\n` +
        `Clase: ${clase.nombre}\n` +
        `Horario: ${clase.horario}\n\n` +
        `Puedes reservar otro turno cuando desees.\n\nThe Best Gym`;
    return enviarNotificacion(socioId, "turno", asunto, mensaje, "email");
}
/*** Notificar cambio de clase*/
function notificarCambioClase(claseId, cambios) {
    const clase = database.clasesGym.find((c) => c.id === claseId);
    if (!clase) return;
    // Encontrar todos los turnos de esta clase
    const turnosClase = database.turnos.filter(
        (t) => t.claseId === claseId && t.estado === "Confirmado",
    );
    turnosClase.forEach((turno) => {
        const socio = database.socios.find((s) => s.id === turno.socioId);
        if (!socio) return;
        const asunto = "Cambio en tu Clase - The Best Gym";
        const mensaje =
            `Hola ${socio.nombre},\n\nHay cambios en tu clase:\n\n` +
            `Clase: ${clase.nombre}\n` +
            `Cambios: ${cambios}\n\n` +
            `Disculpa las molestias.\n\nThe Best Gym`;

        enviarNotificacion(socio.id, "clase", asunto, mensaje, "email");
    });
}

/**
 * Notificar vencimiento próximo
 */
function notificarVencimientoProximo(socioId) {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return false;

    const fechaVenc = new Date(socio.vencimiento + "T00:00:00");
    const diasRestantes = Math.ceil(
        (fechaVenc - new Date()) / (1000 * 60 * 60 * 24),
    );

    const asunto = "Tu Plan está por Vencer - The Best Gym";
    const mensaje =
        `Hola ${socio.nombre},\n\nTu plan ${socio.plan} vence en ${diasRestantes} días.\n\n` +
        `Fecha de vencimiento: ${formatDate(socio.vencimiento)}\n\n` +
        `Renueva tu membresía para seguir disfrutando del gimnasio.\n\nThe Best Gym`;

    return enviarNotificacion(
        socio.id,
        "vencimiento",
        asunto,
        mensaje,
        "ambos",
    );
}

/**
 * Notificar pago registrado
 */
function notificarPagoRegistrado(pagoId) {
    const pago = database.pagos.find((p) => p.id === pagoId);
    if (!pago) return false;

    const socio = database.socios.find((s) => s.id === pago.socioId);
    if (!socio) return false;

    const asunto = "Pago Registrado - The Best Gym";
    const mensaje =
        `Hola ${socio.nombre},\n\nHemos registrado tu pago:\n\n` +
        `Monto: ${formatCurrency(pago.monto)}\n` +
        `Concepto: ${pago.concepto}\n` +
        `Método: ${pago.metodo_pago || pago.metodoPago}\n` +
        `Fecha: ${formatDate(pago.fecha)}\n\n` +
        `Gracias por tu pago!\n\nThe Best Gym`;

    return enviarNotificacion(socio.id, "pago", asunto, mensaje, "email");
}

/**
 * Panel de gestión de notificaciones
 */
function abrirPanelNotificaciones() {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalNotificaciones";
    modal.style.display = "flex";

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalNotificaciones()"></div>
        <div class="modal-content modal-notificaciones">
            <button class="modal-close" onclick="cerrarModalNotificaciones()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-notificaciones">
                <i class="fas fa-bell"></i>
                <h3>Gestión de Notificaciones</h3>
            </div>

            <div class="modal-body-notificaciones">
                <div class="notif-tabs">
                    <button class="notif-tab active" onclick="cambiarTabNotif('enviar')">
                        <i class="fas fa-paper-plane"></i> Enviar Notificación
                    </button>
                    <button class="notif-tab" onclick="cambiarTabNotif('historial')">
                        <i class="fas fa-history"></i> Historial
                    </button>
                    <button class="notif-tab" onclick="cambiarTabNotif('log')">
                        <i class="fas fa-list"></i> Log de Errores
                    </button>
                </div>

                <!-- Tab: Enviar Notificación -->
                <div id="tabEnviarNotif" class="notif-tab-content">
                    <form id="formEnviarNotif">
                        <div class="form-group">
                            <label>Destinatarios *</label>
                            <select id="notifDestinatario" class="form-control" required onchange="actualizarDestinatarios()">
                                <option value="">Seleccionar...</option>
                                <option value="todos">Todos los socios activos</option>
                                <option value="morosos">Socios morosos</option>
                                <option value="proximos-vencer">Próximos a vencer (7 días)</option>
                                <option value="individual">Socio individual</option>
                            </select>
                        </div>

                        <div class="form-group" id="selectSocioIndividual" style="display: none;">
                            <label>Seleccionar Socio *</label>
                            <select id="notifSocioId" class="form-control">
                                <option value="">Seleccionar...</option>
                                ${database.socios.map((s) => `<option value="${s.id}">${s.nombre} - ${s.dni}</option>`).join("")}
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Canal de Envío *</label>
                            <select id="notifCanal" class="form-control" required>
                                <option value="email">Email</option>
                                <option value="sms">SMS</option>
                                <option value="ambos">Ambos (Email + SMS)</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Tipo de Notificación *</label>
                            <select id="notifTipo" class="form-control" required>
                                <option value="general">General</option>
                                <option value="vencimiento">Vencimiento</option>
                                <option value="clase">Cambio de Clase</option>
                                <option value="turno">Turno</option>
                                <option value="promocion">Promoción</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Asunto *</label>
                            <input type="text" id="notifAsunto" class="form-control" required 
                                   placeholder="Ej: Cambio de horario - Spinning" />
                        </div>

                        <div class="form-group">
                            <label>Mensaje *</label>
                            <textarea id="notifMensaje" class="form-control" rows="6" required 
                                      placeholder="Escribe el mensaje que recibirán los socios..."></textarea>
                            <small class="form-hint">
                                <i class="fas fa-info-circle"></i>
                                El mensaje se personalizará con el nombre de cada socio
                            </small>
                        </div>

                        <div id="previstaDestinatarios" class="prevista-dest">
                            <!-- Se llena dinámicamente -->
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="cerrarModalNotificaciones()">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-paper-plane"></i> Enviar Notificación
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Tab: Historial -->
                <div id="tabHistorialNotif" class="notif-tab-content" style="display: none;">
                    <div class="historial-stats">
                        <div class="stat-notif">
                            <i class="fas fa-check-circle"></i>
                            <div>
                                <strong>${database.notificaciones.filter((n) => n.estado === "enviado").length}</strong>
                                <span>Enviadas</span>
                            </div>
                        </div>
                        <div class="stat-notif">
                            <i class="fas fa-times-circle"></i>
                            <div>
                                <strong>${database.notificaciones.filter((n) => n.estado === "fallido").length}</strong>
                                <span>Fallidas</span>
                            </div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Socio</th>
                                    <th>Tipo</th>
                                    <th>Canal</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${
                                    database.notificaciones
                                        .slice()
                                        .reverse()
                                        .map((n) => {
                                            const socio = database.socios.find(
                                                (s) => s.id === n.socioId,
                                            );
                                            return `
                                        <tr>
                                            <td>${new Date(n.fecha).toLocaleString("es-AR")}</td>
                                            <td>${socio ? socio.nombre : "-"}</td>
                                            <td><span class="badge-tipo-notif">${n.tipo}</span></td>
                                            <td>${n.canal}</td>
                                            <td>
                                                <span class="badge ${n.estado === "enviado" ? "badge-active" : "badge-moroso"}">
                                                    ${n.estado}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                        })
                                        .join("") ||
                                    '<tr><td colspan="5" class="text-center">No hay notificaciones</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Tab: Log -->
                <div id="tabLogNotif" class="notif-tab-content" style="display: none;">
                    <div class="log-container">
                        ${
                            database.logNotificaciones
                                .slice()
                                .reverse()
                                .map(
                                    (log) => `
                            <div class="log-item ${log.estado}">
                                <div class="log-icon">
                                    <i class="fas fa-${log.estado === "exitoso" ? "check-circle" : "exclamation-triangle"}"></i>
                                </div>
                                <div class="log-info">
                                    <div class="log-mensaje">${log.mensaje}</div>
                                    <div class="log-fecha">${new Date(log.fecha).toLocaleString("es-AR")}</div>
                                    ${
                                        log.detalles
                                            ? `
                                        <div class="log-detalles">
                                            Email: ${log.detalles.email || "-"} | 
                                            Tel: ${log.detalles.telefono || "-"} | 
                                            Canal: ${log.detalles.canal}
                                        </div>
                                    `
                                            : ""
                                    }
                                </div>
                            </div>
                        `,
                                )
                                .join("") ||
                            '<p class="text-center" style="padding: 40px; color: var(--text-light);">No hay registros</p>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listener para el formulario
    document
        .getElementById("formEnviarNotif")
        .addEventListener("submit", (e) => {
            e.preventDefault();
            enviarNotificacionMasiva();
        });
}

function cerrarModalNotificaciones() {
    const modal = document.getElementById("modalNotificaciones");
    if (modal) modal.remove();
}

function cambiarTabNotif(tab) {
    // Cambiar tabs activos
    document
        .querySelectorAll(".notif-tab")
        .forEach((btn) => btn.classList.remove("active"));
    event.target.closest(".notif-tab").classList.add("active");

    // Mostrar contenido
    document
        .querySelectorAll(".notif-tab-content")
        .forEach((content) => (content.style.display = "none"));

    if (tab === "enviar") {
        document.getElementById("tabEnviarNotif").style.display = "block";
    } else if (tab === "historial") {
        document.getElementById("tabHistorialNotif").style.display = "block";
    } else if (tab === "log") {
        document.getElementById("tabLogNotif").style.display = "block";
    }
}

function actualizarDestinatarios() {
    const tipo = document.getElementById("notifDestinatario").value;
    const selectIndividual = document.getElementById("selectSocioIndividual");
    const prevista = document.getElementById("previstaDestinatarios");

    if (tipo === "individual") {
        selectIndividual.style.display = "block";
        prevista.innerHTML = "";
    } else {
        selectIndividual.style.display = "none";

        let socios = [];
        switch (tipo) {
            case "todos":
                socios = database.socios.filter((s) => s.estado === "Activo");
                break;
            case "morosos":
                socios = database.socios.filter((s) => s.estado === "Moroso");
                break;
            case "proximos-vencer":
                socios = obtenerSociosProximosVencer(7);
                break;
        }

        if (socios.length > 0) {
            prevista.innerHTML = `
                <div class="prevista-info">
                    <i class="fas fa-users"></i>
                    <span>Se enviará a <strong>${socios.length}</strong> ${socios.length === 1 ? "socio" : "socios"}</span>
                </div>
            `;
        }
    }
}

function enviarNotificacionMasiva() {
    const destinatario = document.getElementById("notifDestinatario").value;
    const canal = document.getElementById("notifCanal").value;
    const tipo = document.getElementById("notifTipo").value;
    const asunto = document.getElementById("notifAsunto").value;
    const mensaje = document.getElementById("notifMensaje").value;

    let sociosDestino = [];

    if (destinatario === "individual") {
        const socioId = parseInt(document.getElementById("notifSocioId").value);
        if (!socioId) {
            alert("⚠️ Debes seleccionar un socio");
            return;
        }
        sociosDestino = [database.socios.find((s) => s.id === socioId)];
    } else {
        switch (destinatario) {
            case "todos":
                sociosDestino = database.socios.filter(
                    (s) => s.estado === "Activo",
                );
                break;
            case "morosos":
                sociosDestino = database.socios.filter(
                    (s) => s.estado === "Moroso",
                );
                break;
            case "proximos-vencer":
                sociosDestino = obtenerSociosProximosVencer(7);
                break;
        }
    }

    if (sociosDestino.length === 0) {
        alert("⚠️ No hay destinatarios para enviar");
        return;
    }

    if (
        !confirm(
            `¿Enviar notificación a ${sociosDestino.length} ${sociosDestino.length === 1 ? "socio" : "socios"}?`,
        )
    ) {
        return;
    }

    let exitosos = 0;
    let fallidos = 0;

    sociosDestino.forEach((socio) => {
        const exito = enviarNotificacion(
            socio.id,
            tipo,
            asunto,
            mensaje,
            canal,
        );
        if (exito) exitosos++;
        else fallidos++;
    });

    alert(
        `✅ Notificaciones enviadas\n\nExitosas: ${exitosos}\nFallidas: ${fallidos}`,
    );
    cerrarModalNotificaciones();
}

// Integrar notificaciones en funciones existentes.
// reservarClase/cancelarTurno son async y devuelven true/false según
// si la operación realmente se confirmó en MySQL: hay que esperar y
// chequear el resultado antes de notificar, o se termina avisando
// "turno reservado" incluso cuando falló (ej: sin cupos).
const reservarClaseOriginal = reservarClase;
window.reservarClase = async function (claseId) {
    const exito = await reservarClaseOriginal(claseId);

    if (exito) {
        if (currentUser.rol === "Recepcionista") {
            const socioId = parseInt(
                document.getElementById("socioSeleccionadoTurno").value,
            );
            if (socioId) {
                notificarReservaTurno(socioId, claseId);
            }
        } else {
            notificarReservaTurno(currentUser.socioId, claseId);
        }
    }

    return exito;
};

const cancelarTurnoOriginal = cancelarTurno;
window.cancelarTurno = async function (turnoId) {
    // Guardamos los datos del turno ANTES de cancelarlo: una vez
    // cancelado, cargarTurnosDesdeAPI() solo trae turnos Confirmados
    // y este turno ya no va a estar en database.turnos.
    const turno = database.turnos.find((t) => t.id === turnoId);

    const exito = await cancelarTurnoOriginal(turnoId);

    if (exito && turno) {
        notificarCancelacionTurno(turno.socioId, turno.claseId);
    }

    return exito;
};
