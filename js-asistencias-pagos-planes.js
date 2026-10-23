// MÓDULO ASISTENCIAS
function initAsistenciasModule() {
    document
        .getElementById("btnRegistrarAsistencia")
        .addEventListener("click", registrarAsistencia);
    updateAsistenciasTable();
}
async function registrarAsistencia() {
    const dniInput = document.getElementById("dniAsistencia");
    const dni = dniInput ? dniInput.value.trim() : "";

    if (!dni) {
        alert("⚠️ Por favor ingresá el DNI del socio");
        return;
    }

    try {
        const result = await registrarAsistenciaEnAPI(dni);

        if (!result) {
            // El error ya lo muestra la API
            return;
        }

        alert(`✅ Asistencia registrada para ${result.socio}`);
        dniInput.value = "";
        dniInput.focus();
        updateDashboard();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión al registrar asistencia.');
    }
}
function updateAsistenciasTable() {
    const tbody = document.getElementById("tablaAsistencias");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Ordenar por fecha descendente (más recientes primero)
    const asistenciasOrdenadas = [...database.asistencias].sort((a, b) => {
        const fechaA = new Date(a.fecha + ' ' + (a.hora || '00:00:00'));
        const fechaB = new Date(b.fecha + ' ' + (b.hora || '00:00:00'));
        return fechaB - fechaA;
    });

    asistenciasOrdenadas.forEach(asistencia => {
        // Soportar ambos formatos: socioId (memoria) y socio_id (MySQL)
        const socioId = asistencia.socio_id || asistencia.socioId;
        const socio = database.socios.find(s => s.id === socioId);
        
        // Si viene de MySQL, ya tiene el nombre
        const socioNombre = asistencia.nombre || (socio ? socio.nombre : "Socio desconocido");
        const fecha = asistencia.fecha || "Sin fecha";
        const hora = asistencia.hora || "Sin hora";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${socioNombre}</td>
            <td>${fecha}</td>
            <td>${hora}</td>
        `;
        tbody.appendChild(row);
    });

    // Si no hay asistencias, mostrar mensaje
    if (asistenciasOrdenadas.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td colspan="3" style="text-align: center; color: #999;">
                No hay asistencias registradas
            </td>
        `;
        tbody.appendChild(row);
    }
}
// MÓDULO PAGOS
let tipoPagoActual = "plan";

function actualizarSelectSociosPago() {
    const select = document.getElementById("socioSeleccionado");
    if (!select) return;
    const seleccionActual = select.value;
    select.innerHTML =
        '<option value="">Seleccionar Socio</option>' +
        database.socios
            .map((s) => `<option value="${s.id}">${s.nombre}</option>`)
            .join("");
    // Mantener la selección previa si el socio sigue existiendo
    if (seleccionActual) {
        select.value = seleccionActual;
    }
}

function cambiarTipoPago(tipo) {
    tipoPagoActual = tipo;

    const btnPlan = document.getElementById("btnTipoPagoPlan");
    const btnLibre = document.getElementById("btnTipoPagoLibre");
    const montoInput = document.getElementById("montoPago");
    const hint = document.getElementById("hintMontoPago");

    if (btnPlan) btnPlan.classList.toggle("active", tipo === "plan");
    if (btnLibre) btnLibre.classList.toggle("active", tipo === "libre");

    if (tipo === "plan") {
        montoInput.readOnly = true;
        if (hint) hint.style.display = "flex";
        actualizarMontoSegunPlan();
    } else {
        montoInput.readOnly = false;
        montoInput.value = "";
        if (hint) hint.style.display = "none";
        montoInput.focus();
    }
}

function actualizarMontoSegunPlan() {
    if (tipoPagoActual !== "plan") return;

    const montoInput = document.getElementById("montoPago");
    const socioId = parseInt(
        document.getElementById("socioSeleccionado").value,
    );
    const socio = database.socios.find((s) => s.id === socioId);

    if (!socio) {
        montoInput.value = "";
        return;
    }

    const plan = database.planes.find((p) => p.nombre === socio.plan);
    montoInput.value = plan ? plan.costo : "";
}

function initPagosModule() {
    actualizarSelectSociosPago();
    document
        .getElementById("socioSeleccionado")
        .addEventListener("change", actualizarMontoSegunPlan);
    document
        .getElementById("btnRegistrarPago")
        .addEventListener("click", registrarPago);
    cambiarTipoPago("plan");
    updatePagosTable();
}
async function registrarPago() {
    if (!tienePermiso("pagos", "crear")) {
        mostrarErrorPermisos();
        return;
    }
    
    const socioId = parseInt(
        document.getElementById("socioSeleccionado").value,
    );
    const monto = parseFloat(document.getElementById("montoPago").value);
    const metodoPago = document.getElementById("metodoPago").value;

    if (!socioId || !monto) {
        alert("Por favor complete todos los campos");
        return;
    }

    const socio = database.socios.find((s) => s.id === socioId);
    const concepto =
        tipoPagoActual === "plan" && socio
            ? `Cuota ${socio.plan}`
            : "Pago Manual";

    try {
        // ✅ Registrar pago en MySQL
        const pagoData = {
            socio_id: socioId,
            monto: monto,
            metodo_pago: metodoPago,
            concepto: concepto
        };

        const result = await registrarPagoEnAPI(pagoData);
        
        if (!result) {
            alert('Error al registrar el pago');
            return;
        }

        // Limpiar campos
        document.getElementById("socioSeleccionado").value = "";
        cambiarTipoPago("plan");

        alert("✅ Pago registrado correctamente");
        
        updateDashboard();
        
    } catch (error) {
        console.error('Error al registrar pago:', error);
        alert('Error al registrar el pago. Revisa la consola para más detalles.');
    }
}

function updatePagosTable() {
    const tbody = document.getElementById("tablaPagos");
    const pagos = database.pagos.slice().reverse();

    tbody.innerHTML = pagos
        .map((pago) => {
            const socio = database.socios.find((s) => s.id === pago.socioId);
            
            // Protección si no encuentra el socio
            const nombreSocio = socio ? socio.nombre : ((pago.socio_nombre || pago.socioNombre) || 'Desconocido');
            
            // Soportar ambos formatos de nombres de campos
            const metodoPago = pago.metodo_pago || pago.metodoPago || 'N/A';
            
            return `
            <tr>
                <td>${nombreSocio}</td>
                <td style="font-weight: 600; color: var(--success-color);">${formatCurrency(pago.monto)}</td>
                <td>${formatDate(pago.fecha)}</td>
                <td>${metodoPago}</td>
                <td>${pago.concepto}</td>
                <td>
                    <button class="btn-ticket" onclick="generarTicket(${pago.id})">
                        <i class="fas fa-receipt"></i> Ticket
                    </button>
                </td>
            </tr>
        `;
        })
        .join("");
}
// MÓDULO PLANES
function initPlanesModule() {
    // Ocultar botón si no es admin
    const btnNuevoPlan = document.getElementById("btnNuevoPlan");
    if (btnNuevoPlan) {
        if (currentUser.rol !== "Administrador") {
            btnNuevoPlan.style.display = "none";
        } else {
            btnNuevoPlan.style.display = "flex";
        }
    }
    updatePlanesGrid();
}
function updatePlanesGrid() {
    const grid = document.getElementById("planesGrid");
    if (database.planes.length === 0) {
        grid.innerHTML =
            '<p class="text-center" style="color: var(--text-light); padding: 40px;">No hay planes registrados</p>';
        return;
    }

    grid.innerHTML = database.planes
        .map((plan) => {
            const activo = plan.activo !== false;
            return `
            <div class="plan-card ${!activo ? "plan-inactivo" : ""}">
                ${!activo ? '<div class="plan-badge-inactivo">Inactivo</div>' : ""}
                <div class="plan-header">
                    <h3>${plan.nombre}</h3>
                    ${
                        currentUser.rol === "Administrador"
                            ? `
                        <div class="plan-actions">
                            <button class="btn-plan-action" onclick="editarPlan(${plan.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-plan-action btn-delete" onclick="eliminarPlan(${plan.id})" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `
                            : ""
                    }
                </div>
                <p class="plan-description">${plan.descripcion}</p>
                ${
                    plan.beneficios
                        ? `
                    <div class="plan-beneficios">
                        <strong><i class="fas fa-check-circle"></i> Beneficios:</strong>
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
                <div class="plan-price">
                    <div class="price">${formatCurrency(plan.costo)}</div>
                    <div class="duration">${plan.duracion} días</div>
                </div>
                ${
                    currentUser.rol === "Socio"
                        ? `
                    <button class="btn-primary" onclick="seleccionarPlan(${plan.id})" ${!activo ? "disabled" : ""}>
                        ${!activo ? "No Disponible" : "Seleccionar Plan"}
                    </button>
                `
                        : ""
                }
            </div>
        `;
        })
        .join("");
}
function seleccionarPlan(id) {
    const plan = database.planes.find((p) => p.id === id);
    alert(`Has seleccionado el plan: ${plan.nombre}`);
}
// MÓDULO MI PLAN
function initMiPlanModule() {
    updateMiPlan();
}
function updateMiPlan() {
    if (currentUser.rol !== "Socio") return;

    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) {
        document.querySelector(".my-plan-container").innerHTML =
            '<p class="text-center">No se encontró información del socio</p>';
        return;
    }
    const plan = database.planes.find((p) => p.nombre === socio.plan);
    document.getElementById("miPlanNombre").textContent = socio.plan;
    document.getElementById("miPlanEstado").textContent = socio.estado;
    document.getElementById("miPlanFechaInicio").textContent = formatDate(
        socio.fechaAlta,
    );
    document.getElementById("miPlanVencimiento").textContent = formatDate(
        socio.vencimiento,
    );
    document.getElementById("miPlanCosto").textContent = plan
        ? formatCurrency(plan.costo)
        : "-";

    const today = new Date();
    const vencimiento = new Date(socio.vencimiento + "T00:00:00");
    const diasRestantes = Math.ceil(
        (vencimiento - today) / (1000 * 60 * 60 * 24),
    );
    document.getElementById("miPlanDiasRestantes").textContent =
        diasRestantes > 0 ? `${diasRestantes} días` : "Vencido";

    const fechaInicio = new Date(socio.fechaAlta + "T00:00:00");
    const duracionTotal = plan ? plan.duracion : 30;
    const diasTranscurridos = Math.ceil(
        (today - fechaInicio) / (1000 * 60 * 60 * 24),
    );
    const progreso = Math.min(
        100,
        Math.round((diasTranscurridos / duracionTotal) * 100),
    );

    document.getElementById("planProgressPercent").textContent = progreso + "%";
    document.getElementById("planProgressBar").style.width = progreso + "%";

    const asistenciasMes = database.asistencias.filter((a) => {
        const fechaAsistencia = new Date(a.fecha + "T00:00:00");
        return (
            a.socioId === socio.id &&
            fechaAsistencia.getMonth() === today.getMonth() &&
            fechaAsistencia.getFullYear() === today.getFullYear()
        );
    }).length;

    document.getElementById("misAsistenciasMes").textContent = asistenciasMes;

    generateAsistenciasChart(socio.id);

    document.getElementById("proximoPagoMonto").textContent = plan
        ? formatCurrency(plan.costo)
        : "$0";
    document.getElementById("proximoPagoFecha").textContent = formatDate(
        socio.vencimiento,
    );

    const pagosSocio = database.pagos.filter((p) => p.socioId === socio.id);
    const totalPagado = pagosSocio.reduce((sum, p) => sum + p.monto, 0);

    document.getElementById("ultimosPagosCount").textContent =
        pagosSocio.length;
    document.getElementById("totalPagado").textContent =
        formatCurrency(totalPagado);

    const estadoBadge = document.getElementById("estadoCuenta");
    if (socio.estado === "Activo") {
        estadoBadge.textContent = "Al día";
        estadoBadge.className = "status-badge";
    } else {
        estadoBadge.textContent = "Moroso";
        estadoBadge.className = "status-badge moroso";
    }

    updateMiHistorialAsistencias(socio.id);
}

function generateAsistenciasChart(socioId) {
    const chartContainer = document.getElementById("chartAsistencias");
    const today = new Date();
    const chart = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const count = database.asistencias.filter(
            (a) => a.socioId === socioId && a.fecha === dateStr,
        ).length;

        chart.push({
            date: dateStr,
            count: count,
        });
    }

    const maxCount = Math.max(...chart.map((c) => c.count), 1);

    chartContainer.innerHTML = chart
        .map((item) => {
            const height = (item.count / maxCount) * 100;
            return `<div class="chart-bar-item" style="height: ${height}%" title="${item.date}: ${item.count} asistencias"></div>`;
        })
        .join("");
}

function updateMiHistorialAsistencias(socioId) {
    const tbody = document.getElementById("miHistorialAsistencias");
    const asistencias = database.asistencias
        .filter((a) => a.socioId === socioId)
        .slice(-10)
        .reverse();

    if (asistencias.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="3" class="text-center">No hay asistencias registradas</td></tr>';
        return;
    }

    tbody.innerHTML = asistencias
        .map(
            (asistencia) => `
        <tr>
            <td>${formatDate(asistencia.fecha)}</td>
            <td>${asistencia.hora}</td>
            <td><span class="badge badge-active">Completado</span></td>
        </tr>
    `,
        )
        .join("");
}

async function renovarPlan() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) return;

    const plan = database.planes.find((p) => p.nombre === socio.plan);
    if (!plan) {
        alert("⚠️ No se encontró información de tu plan actual");
        return;
    }

    const confirmar = confirm(
        `¿Confirmás la renovación de tu plan ${plan.nombre} por ${formatCurrency(plan.costo)} (efectivo)?`,
    );
    if (!confirmar) return;

    try {
        const pagoData = {
            socio_id: socio.id,
            monto: plan.costo,
            metodo_pago: "Efectivo",
            concepto: `Renovación - Plan ${plan.nombre}`,
        };

        const result = await registrarPagoEnAPI(pagoData);

        if (!result) {
            alert(
                "No se pudo registrar el pago de renovación. Intentá de nuevo.",
            );
            return;
        }

        alert("✅ Plan renovado exitosamente");
        updateMiPlan();
    } catch (error) {
        console.error("Error al renovar plan:", error);
        alert("Error al renovar el plan. Revisá la consola para más detalles.");
    }
}

function verHistorialPagos() {
    if (currentUser.rol === "Socio") {
        const socio = database.socios.find((s) => s.id === currentUser.socioId);
        const pagos = database.pagos.filter((p) => p.socioId === socio.id);

        let mensaje = "HISTORIAL DE PAGOS\n\n";
        pagos.forEach((pago) => {
            mensaje += `Fecha: ${formatDate(pago.fecha)}\n`;
            mensaje += `Monto: ${formatCurrency(pago.monto)}\n`;
            mensaje += `Método: ${pago.metodo_pago || pago.metodoPago}\n`;
            mensaje += `Concepto: ${pago.concepto}\n\n`;
        });

        alert(mensaje);
    }
}