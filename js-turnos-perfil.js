// MÓDULO TURNOS
// Ahora trabaja 100% sobre database.clasesGym (la misma tabla que usan
// Admin/Instructor). turno.claseId apunta directo a clasesGym.id, así
// que ya no hace falta ningún cruce por nombre. Toda operación que
// modifica turnos (reservar/cancelar/modificar) pega contra la API y
// después recarga desde MySQL, para que el estado nunca viva solo en
// la memoria de este navegador.

const DIAS_SEMANA_ORDEN = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
];

// Interpreta el campo horario de clases_gym (ej: "Lunes y Miércoles 09:00"
// o "Lunes a Viernes 14:00") y devuelve los días que abarca y la hora.
function parseHorarioClase(horario) {
    if (!horario) return { dias: [], hora: "00:00" };

    const rangoMatch = horario.match(
        /(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\s+a\s+(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)/,
    );

    let dias;
    if (rangoMatch) {
        const iStart = DIAS_SEMANA_ORDEN.indexOf(rangoMatch[1]);
        const iEnd = DIAS_SEMANA_ORDEN.indexOf(rangoMatch[2]);
        dias = DIAS_SEMANA_ORDEN.slice(iStart, iEnd + 1);
    } else {
        dias = DIAS_SEMANA_ORDEN.filter((d) => horario.includes(d));
    }

    const horaMatch = horario.match(/\d{1,2}:\d{2}/);
    return { dias, hora: horaMatch ? horaMatch[0] : "00:00" };
}

// Próxima fecha (la más cercana) en que ocurre una clase, dado su horario.
function getNextFechaClase(horario) {
    const { dias } = parseHorarioClase(horario);
    if (dias.length === 0) return getNextClassDate("Lunes");
    const fechas = dias.map((d) => getNextClassDate(d));
    return fechas.sort()[0];
}

function initTurnosModule() {
    document
        .getElementById("filterDia")
        .addEventListener("change", updateClasesDisponibles);
    document
        .getElementById("filterActividad")
        .addEventListener("change", updateClasesDisponibles);
    poblarFiltroActividades();
    if (currentUser.rol === "Recepcionista") {
        agregarSelectorSocioEnTurnos();
    }
    updateTurnosModule();
}

// El dropdown de actividades se arma dinámicamente a partir de las
// clases reales del gym, para no quedar desactualizado si se crean o
// borran clases desde el módulo de Clases e Instructores.
function poblarFiltroActividades() {
    const select = document.getElementById("filterActividad");
    const valorActual = select.value;
    const nombres = [...new Set(database.clasesGym.map((c) => c.nombre))].sort();

    select.innerHTML =
        '<option value="">Todas las actividades</option>' +
        nombres.map((n) => `<option value="${n}">${n}</option>`).join("");

    if (nombres.includes(valorActual)) {
        select.value = valorActual;
    }
}

function agregarSelectorSocioEnTurnos() {
    const turnosContainer = document.querySelector(
        "#turnosModule .turnos-container",
    );
    // Crear selector de socio al inicio
    const selectorHTML = `
        <div class="card selector-socio-turnos">
            <h3 class="card-title">
                <i class="fas fa-user-check"></i> Seleccionar Socio
            </h3>
            <div class="form-group">
                <label>Buscar Socio por DNI o Nombre *</label>
                <input 
                    type="text" 
                    id="buscarSocioTurno" 
                    class="form-control" 
                    placeholder="Ingrese DNI o nombre del socio..."
                />
            </div>
            <div class="form-group">
                <label>Socio Seleccionado</label>
                <select id="socioSeleccionadoTurno" class="form-control">
                    <option value="">-- Seleccione un socio de la lista --</option>
                </select>
            </div>
            <div id="infoSocioSeleccionado" style="display: none;" class="info-socio-turno">
                <!-- Info del socio -->
            </div>
        </div>
    `;

    turnosContainer.insertAdjacentHTML("afterbegin", selectorHTML);

    // Event listeners
    document
        .getElementById("buscarSocioTurno")
        .addEventListener("input", buscarSocioParaTurno);
    document
        .getElementById("socioSeleccionadoTurno")
        .addEventListener("change", mostrarInfoSocioTurno);
}

function buscarSocioParaTurno() {
    const busqueda = document
        .getElementById("buscarSocioTurno")
        .value.toLowerCase()
        .trim();
    const select = document.getElementById("socioSeleccionadoTurno");

    if (busqueda.length < 2) {
        select.innerHTML = '<option value="">-- Ninguno --</option>';
        document.getElementById("infoSocioSeleccionado").style.display = "none";
        return;
    }

    const sociosFiltrados = database.socios.filter(
        (s) =>
            s.nombre.toLowerCase().includes(busqueda) ||
            s.dni.includes(busqueda),
    );

    select.innerHTML =
        '<option value="">-- Seleccionar --</option>' +
        sociosFiltrados
            .map(
                (s) =>
                    `<option value="${s.id}">${s.nombre} - DNI: ${s.dni} (${s.estado})</option>`,
            )
            .join("");
}

function mostrarInfoSocioTurno() {
    const socioId = parseInt(
        document.getElementById("socioSeleccionadoTurno").value,
    );
    const infoDiv = document.getElementById("infoSocioSeleccionado");

    if (!socioId) {
        infoDiv.style.display = "none";
        return;
    }

    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return;

    const estadoClass =
        socio.estado === "Activo" ? "badge-active" : "badge-moroso";

    infoDiv.innerHTML = `
        <div class="socio-info-header">
            <i class="fas fa-user-circle"></i>
            <div>
                <strong>${socio.nombre}</strong>
                <span class="badge ${estadoClass}">${socio.estado}</span>
            </div>
        </div>
        <div class="socio-info-detalles">
            <div><i class="fas fa-id-card"></i> DNI: ${socio.dni}</div>
            <div><i class="fas fa-calendar-alt"></i> Plan: ${socio.plan}</div>
            <div><i class="fas fa-clock"></i> Vence: ${formatDate(socio.vencimiento)}</div>
        </div>
    `;
    infoDiv.style.display = "block";
}
function updateTurnosModule() {
    poblarFiltroActividades();
    updateClasesDisponibles();
    updateMisTurnos();
}

function updateClasesDisponibles() {
    const filterDia = document.getElementById("filterDia").value;
    const filterActividad = document.getElementById("filterActividad").value;
    const container = document.getElementById("clasesDisponibles");

    let clasesFiltered = database.clasesGym.filter((c) => c.activa);

    if (filterDia) {
        clasesFiltered = clasesFiltered.filter((c) =>
            parseHorarioClase(c.horario).dias.includes(filterDia),
        );
    }

    if (filterActividad) {
        clasesFiltered = clasesFiltered.filter(
            (c) => c.nombre === filterActividad,
        );
    }

    if (clasesFiltered.length === 0) {
        container.innerHTML =
            '<p class="text-center" style="color: var(--text-light); padding: 20px;">No hay clases disponibles con estos filtros</p>';
        return;
    }

    container.innerHTML = clasesFiltered
        .map((clase) => {
            const cupoMaximo = clase.cupoMaximo;
            const cuposOcupados = clase.cuposOcupados || 0;
            const cuposDisponibles = cupoMaximo - cuposOcupados;
            const porcentaje = (cuposOcupados / cupoMaximo) * 100;

            let cuposClass = "cupos-disponible";
            let cuposText = `${cuposDisponibles} cupos disponibles`;
            let btnDisabled = false;

            if (cuposDisponibles <= 0) {
                cuposClass = "cupos-lleno";
                cuposText = "Completo";
                btnDisabled = true;
            } else if (porcentaje >= 80) {
                cuposClass = "cupos-limitado";
                cuposText = `Solo ${cuposDisponibles} cupos`;
            }

            const socioIdParaChequear =
                currentUser.rol === "Recepcionista"
                    ? parseInt(document.getElementById("socioSeleccionadoTurno")?.value)
                    : currentUser.socioId;

            const yaReservado = database.turnos.some(
                (t) =>
                    t.socioId === socioIdParaChequear &&
                    t.claseId === clase.id &&
                    t.estado === "Confirmado",
            );

            return `
            <div class="clase-card">
                <div class="clase-info">
                    <h4>${clase.nombre}</h4>
                    <div class="clase-detalles">
                        <span><i class="fas fa-tag"></i> ${clase.tipo}</span>
                        <span><i class="fas fa-calendar"></i> ${clase.horario}</span>
                        <span><i class="fas fa-user"></i> ${clase.instructor_nombre || "Sin asignar"}</span>
                        <span><i class="fas fa-hourglass-half"></i> ${clase.duracion}</span>
                    </div>
                    <span class="cupos-badge ${cuposClass}">${cuposText}</span>
                </div>
                <button 
                    class="btn-reservar" 
                    onclick="reservarClase(${clase.id})"
                    ${btnDisabled || yaReservado ? "disabled" : ""}
                >
                    ${yaReservado ? "Ya Reservado" : "Reservar"}
                </button>
            </div>
        `;
        })
        .join("");
}

function updateMisTurnos() {
    const container = document.getElementById("misTurnosReservados");

    let turnosFiltrados;

    if (currentUser.rol === "Recepcionista") {
        const socioId = parseInt(
            document.getElementById("socioSeleccionadoTurno")?.value,
        );

        if (!socioId) {
            container.innerHTML = `
                <div class="sin-turnos">
                    <i class="fas fa-info-circle"></i>
                    <p>Selecciona un socio para ver sus turnos reservados</p>
                </div>
            `;
            return;
        }

        turnosFiltrados = database.turnos.filter(
            (t) => t.socioId === socioId && t.estado === "Confirmado",
        );
    } else {
        turnosFiltrados = database.turnos.filter(
            (t) =>
                t.socioId === currentUser.socioId && t.estado === "Confirmado",
        );
    }

    if (turnosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="sin-turnos">
                <i class="fas fa-calendar-times"></i>
                <p>No hay turnos reservados</p>
            </div>
        `;
        return;
    }

    container.innerHTML = turnosFiltrados
        .map((turno) => {
            const clase = database.clasesGym.find((c) => c.id === turno.claseId);
            const socio = database.socios.find((s) => s.id === turno.socioId);
            if (!clase || !socio) return "";

            return `
            <div class="turno-item">
                ${
                    currentUser.rol === "Recepcionista"
                        ? `
                    <div class="turno-socio-info">
                        <i class="fas fa-user"></i>
                        <strong>${socio.nombre}</strong>
                    </div>
                `
                        : ""
                }
                <h4>${clase.nombre}</h4>
                <p><i class="fas fa-calendar"></i> ${clase.horario} - ${formatDate(turno.fecha)}</p>
                <p><i class="fas fa-user"></i> ${clase.instructor_nombre || "Sin asignar"}</p>
                <div class="turno-actions">
                    <button class="btn-modificar-turno" onclick="modificarTurno(${turno.id})">
                        <i class="fas fa-edit"></i> Modificar
                    </button>
                    <button class="btn-cancelar" onclick="cancelarTurno(${turno.id})">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            </div>
        `;
        })
        .join("");
}

async function reservarClase(claseId) {
    const clase = database.clasesGym.find((c) => c.id === claseId);
    if (!clase) return false;

    let socioId;

    // Si es recepcionista, usar el socio seleccionado
    if (currentUser.rol === "Recepcionista") {
        socioId = parseInt(
            document.getElementById("socioSeleccionadoTurno").value,
        );

        if (!socioId) {
            alert("⚠️ Debes seleccionar un socio primero");
            return false;
        }

        const socio = database.socios.find((s) => s.id === socioId);

        if (socio.estado !== "Activo") {
            alert(
                "⚠️ El socio no tiene un plan activo.\n\nNo se puede reservar turno para socios con cuota vencida.",
            );
            return false;
        }
    } else {
        // Si es socio, usar su propio ID
        socioId = currentUser.socioId;
    }

    // Verificar si ya tiene turno reservado (chequeo optimista local;
    // el backend también lo valida antes de insertar)
    const yaReservado = database.turnos.some(
        (t) =>
            t.socioId === socioId &&
            t.claseId === claseId &&
            t.estado === "Confirmado",
    );

    if (yaReservado) {
        alert("⚠️ Ya tienes un turno reservado para esta clase");
        return false;
    }

    const fecha = getNextFechaClase(clase.horario);
    const resultado = await reservarTurnoEnAPI(socioId, claseId, fecha);

    if (!resultado.ok) {
        alert("❌ " + (resultado.message || "No se pudo reservar el turno"));
        return false;
    }

    const socio = database.socios.find((s) => s.id === socioId);

    alert(
        `✅ Turno reservado exitosamente!\n\nSocio: ${socio.nombre}\nClase: ${clase.nombre}\nHorario: ${clase.horario}`,
    );

    updateTurnosModule();
    return true;
}

async function cancelarTurno(turnoId) {
    if (!confirm("¿Estás seguro de cancelar este turno?")) return false;

    const exito = await cancelarTurnoEnAPI(turnoId);
    if (!exito) return false;

    alert("Turno cancelado exitosamente");
    updateTurnosModule();
    return true;
}

function modificarTurno(turnoId) {
    const turno = database.turnos.find((t) => t.id === turnoId);
    if (!turno) return;

    const claseActual = database.clasesGym.find((c) => c.id === turno.claseId);
    const socio = database.socios.find((s) => s.id === turno.socioId);
    if (!claseActual || !socio) return;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalModificarTurno";
    modal.style.display = "flex";

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalModificarTurno()"></div>
        <div class="modal-content modal-modificar-turno">
            <button class="modal-close" onclick="cerrarModalModificarTurno()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-socio">
                <i class="fas fa-edit"></i>
                <h3>Modificar Turno</h3>
            </div>

            <div class="modal-body-socio">
                <div class="turno-actual-info">
                    <h4><i class="fas fa-info-circle"></i> Turno Actual</h4>
                    <div class="info-box">
                        <div><strong>Socio:</strong> ${socio.nombre}</div>
                        <div><strong>Clase:</strong> ${claseActual.nombre}</div>
                        <div><strong>Horario:</strong> ${claseActual.horario}</div>
                    </div>
                </div>

                <form id="formModificarTurno">
                    <div class="form-group">
                        <label>Seleccionar Nueva Clase *</label>
                        <select id="nuevaClaseTurno" class="form-control" required>
                            <option value="">-- Seleccionar --</option>
                            ${database.clasesGym
                                .filter((c) => c.activa)
                                .map((c) => {
                                    const disponible =
                                        c.cupoMaximo - (c.cuposOcupados || 0) > 0;
                                    return `<option value="${c.id}" ${!disponible ? "disabled" : ""}>
                                    ${c.nombre} - ${c.horario} 
                                    ${!disponible ? "(Sin cupos)" : `(${c.cupoMaximo - (c.cuposOcupados || 0)} cupos)`}
                                </option>`;
                                })
                                .join("")}
                        </select>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="cerrarModalModificarTurno()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-check"></i> Confirmar Cambio
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("formModificarTurno")
        .addEventListener("submit", (e) => {
            e.preventDefault();
            confirmarModificacionTurno(turnoId);
        });
}

function cerrarModalModificarTurno() {
    const modal = document.getElementById("modalModificarTurno");
    if (modal) modal.remove();
}

async function confirmarModificacionTurno(turnoId) {
    const turno = database.turnos.find((t) => t.id === turnoId);
    const nuevaClaseId = parseInt(
        document.getElementById("nuevaClaseTurno").value,
    );

    if (!nuevaClaseId) {
        alert("⚠️ Debes seleccionar una nueva clase");
        return;
    }

    if (turno.claseId === nuevaClaseId) {
        alert("⚠️ Ya estás inscrito en esta clase. Selecciona una clase diferente.");
        return;
    }

    const claseNueva = database.clasesGym.find((c) => c.id === nuevaClaseId);
    if (!claseNueva) return;

    const nuevaFecha = getNextFechaClase(claseNueva.horario);
    const resultado = await modificarTurnoEnAPI(turnoId, nuevaClaseId, nuevaFecha);

    if (!resultado.ok) {
        alert("❌ " + (resultado.message || "No se pudo modificar el turno"));
        return;
    }

    alert(
        `✅ Turno modificado exitosamente\n\nNueva clase: ${claseNueva.nombre}\nHorario: ${claseNueva.horario}`,
    );

    cerrarModalModificarTurno();
    updateTurnosModule();
}

function getNextClassDate(dia) {
    const dias = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
    ];
    const today = new Date();
    const targetDay = dias.indexOf(dia);
    const currentDay = today.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
    }

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilTarget);

    return nextDate.toISOString().split("T")[0];
}
// MÓDULO PERFIL
function initPerfilModule() {
    document
        .getElementById("formDatosPersonales")
        .addEventListener("submit", guardarDatosPersonales);
    document
        .getElementById("formEmergencia")
        .addEventListener("submit", guardarContactoEmergencia);
    document
        .getElementById("formMedico")
        .addEventListener("submit", guardarInformacionMedica);
    document
        .getElementById("formCambiarPassword")
        .addEventListener("submit", cambiarPassword);

    updatePerfilModule();
}

function updatePerfilModule() {
    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) return;

    document.getElementById("perfilNombreCompleto").textContent = socio.nombre;
    document.getElementById("perfilEmail").textContent = socio.email;
    document.getElementById("perfilMiembroDesde").textContent = formatDate(
        socio.fechaAlta,
    );
    document.getElementById("perfilEstado").textContent = socio.estado;
    document.getElementById("perfilPlan").textContent = socio.plan;

    document.getElementById("editNombre").value = socio.nombre;
    document.getElementById("editDni").value = socio.dni;
    document.getElementById("editEmail").value = socio.email;
    document.getElementById("editTelefono").value = socio.telefono;
    document.getElementById("editFechaNacimiento").value =
        socio.fechaNacimiento || "";
    document.getElementById("editGenero").value = socio.genero || "";

    if (socio.contactoEmergencia) {
        document.getElementById("emergenciaNombre").value =
            socio.contactoEmergencia.nombre || "";
        document.getElementById("emergenciaRelacion").value =
            socio.contactoEmergencia.relacion || "";
        document.getElementById("emergenciaTelefono").value =
            socio.contactoEmergencia.telefono || "";
    }

    if (socio.informacionMedica) {
        document.getElementById("grupoSanguineo").value =
            socio.informacionMedica.grupoSanguineo || "";
        document.getElementById("alergias").value =
            socio.informacionMedica.alergias || "";
        document.getElementById("lesiones").value =
            socio.informacionMedica.lesiones || "";
    }
}

async function guardarDatosPersonales(e) {
    e.preventDefault();

    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) return;

    const socioData = {
        id: socio.id,
        nombre: document.getElementById("editNombre").value,
        email: document.getElementById("editEmail").value,
        telefono: document.getElementById("editTelefono").value,
        plan: socio.plan,
        fecha_nacimiento: document.getElementById("editFechaNacimiento").value,
        genero: document.getElementById("editGenero").value,
        emergencia_nombre: socio.contactoEmergencia?.nombre || "",
        emergencia_relacion: socio.contactoEmergencia?.relacion || "",
        emergencia_telefono: socio.contactoEmergencia?.telefono || "",
        grupo_sanguineo: socio.informacionMedica?.grupoSanguineo || "",
        alergias: socio.informacionMedica?.alergias || "",
        lesiones: socio.informacionMedica?.lesiones || "",
    };

    // Guardar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await actualizarSocioEnAPI(socioData);

    if (!exito) {
        alert("No se pudieron guardar los datos en la base de datos. Intentá de nuevo.");
        return;
    }

    currentUser.nombre = socioData.nombre;
    database.usuarios.find((u) => u.id === currentUser.id).nombre =
        socioData.nombre;

    alert("Datos personales actualizados correctamente");
    updatePerfilModule();
    document.getElementById("welcomeText").textContent =
        `Bienvenido, ${currentUser.nombre}`;
}

async function guardarContactoEmergencia(e) {
    e.preventDefault();

    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) return;

    const socioData = {
        id: socio.id,
        nombre: socio.nombre,
        email: socio.email,
        telefono: socio.telefono,
        plan: socio.plan,
        fecha_nacimiento: socio.fechaNacimiento || "",
        genero: socio.genero || "",
        emergencia_nombre: document.getElementById("emergenciaNombre").value,
        emergencia_relacion: document.getElementById("emergenciaRelacion").value,
        emergencia_telefono: document.getElementById("emergenciaTelefono").value,
        grupo_sanguineo: socio.informacionMedica?.grupoSanguineo || "",
        alergias: socio.informacionMedica?.alergias || "",
        lesiones: socio.informacionMedica?.lesiones || "",
    };

    // Guardar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await actualizarSocioEnAPI(socioData);

    if (!exito) {
        alert("No se pudo guardar el contacto de emergencia en la base de datos. Intentá de nuevo.");
        return;
    }

    alert("Contacto de emergencia guardado correctamente");
}

async function guardarInformacionMedica(e) {
    e.preventDefault();

    const socio = database.socios.find((s) => s.id === currentUser.socioId);
    if (!socio) return;

    const socioData = {
        id: socio.id,
        nombre: socio.nombre,
        email: socio.email,
        telefono: socio.telefono,
        plan: socio.plan,
        fecha_nacimiento: socio.fechaNacimiento || "",
        genero: socio.genero || "",
        emergencia_nombre: socio.contactoEmergencia?.nombre || "",
        emergencia_relacion: socio.contactoEmergencia?.relacion || "",
        emergencia_telefono: socio.contactoEmergencia?.telefono || "",
        grupo_sanguineo: document.getElementById("grupoSanguineo").value,
        alergias: document.getElementById("alergias").value,
        lesiones: document.getElementById("lesiones").value,
    };

    // Guardar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await actualizarSocioEnAPI(socioData);

    if (!exito) {
        alert("No se pudo guardar la información médica en la base de datos. Intentá de nuevo.");
        return;
    }

    alert("Información médica guardada correctamente");
}

async function cambiarPassword(e) {
    e.preventDefault();

    const actual = document.getElementById("passwordActual").value;
    const nueva = document.getElementById("passwordNueva").value;
    const confirmar = document.getElementById("passwordConfirmar").value;

    const usuario = database.usuarios.find((u) => u.id === currentUser.id);

    if (usuario.password !== actual) {
        alert("La contraseña actual es incorrecta");
        return;
    }

    if (nueva !== confirmar) {
        alert("Las contraseñas no coinciden");
        return;
    }

    if (nueva.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres");
        return;
    }

    // Guardar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await actualizarUsuarioEnAPI({
        id: usuario.id,
        nombre: usuario.nombre,
        password: nueva,
    });

    if (!exito) {
        alert("No se pudo cambiar la contraseña en la base de datos. Intentá de nuevo.");
        return;
    }

    alert("Contraseña cambiada correctamente");
    document.getElementById("passwordActual").value = "";
    document.getElementById("passwordNueva").value = "";
    document.getElementById("passwordConfirmar").value = "";
}

function cambiarFoto() {
    alert(
        "Funcionalidad de cambio de foto. Aquí se implementaría la carga de imagen.",
    );
}