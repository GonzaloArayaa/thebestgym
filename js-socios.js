// MÓDULO SOCIOS
function initSociosModule() {
    const searchInput = document.getElementById("searchSocios");
    searchInput.addEventListener("input", updateSociosTable);
    const btnNuevoSocio = document.getElementById("btnNuevoSocio");
    if (btnNuevoSocio) {
        if (!tienePermiso("socios", "crear")) {
            btnNuevoSocio.style.display = "none";
        } else {
            btnNuevoSocio.style.display = "flex";
        }
    }

    // Event listeners para el modal de nuevo socio
    document
        .getElementById("formNuevoSocio")
        .addEventListener("submit", guardarNuevoSocio);
    document
        .getElementById("socioPlan")
        .addEventListener("change", actualizarVencimientoSocio);

    updateSociosTable();
}

function updateSociosTable() {
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
        .map(
            (socio) => `
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
                <span class="badge ${socio.estado === "Activo" ? "badge-active" : "badge-moroso"}">
                    ${socio.estado}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-table btn-estado" onclick="verEstadoPlan(${socio.id})" title="Ver estado del plan">
                        <i class="fas fa-info-circle"></i> Estado
                    </button>
                    ${
                        tienePermiso("socios", "editar")
                            ? `
                        <button class="btn-table btn-edit" onclick="editarSocio(${socio.id})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    `
                            : ""
                    }
                    ${
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
    `,
        )
        .join("");
}

async function eliminarSocio(id) {
    // Validar permisos primero
    if (!tienePermiso("socios", "eliminar")) {
        mostrarErrorPermisos();
        return;
    }

    const socio = database.socios.find((s) => s.id === id);

    if (!socio) {
        alert("Socio no encontrado");
        return;
    }

    if (
        !confirm(
            `¿Estás seguro de eliminar a ${socio.nombre}?\n\nEsta acción no se puede deshacer.`,
        )
    ) {
        return;
    }

    // Eliminar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await eliminarSocioEnAPI(id);

    if (!exito) {
        alert("No se pudo eliminar el socio en la base de datos. Intentá de nuevo.");
        return;
    }

    const index = database.socios.findIndex((s) => s.id === id);
    if (index > -1) {
        database.socios.splice(index, 1);
    }

    if (activeModule === "dashboard") {
        updateDashboard();
    }
    alert("Socio eliminado correctamente");
}

function editarSocio(id) {
    if (!tienePermiso("socios", "editar")) {
        mostrarErrorPermisos();
        return;
    }

    const socio = database.socios.find((s) => s.id === id);
    if (!socio) {
        alert("❌ Error: Socio no encontrado");
        return;
    }
    abrirActualizarDatosSocio(id);
}
// FUNCIONES PARA NUEVO SOCIO
function abrirModalNuevoSocio() {
    if (!tienePermiso("socios", "crear")) {
        mostrarErrorPermisos();
        return;
    }

    document.getElementById("modalNuevoSocio").style.display = "flex";
    document.getElementById("formNuevoSocio").reset();
    document.getElementById("errorSocio").style.display = "none";
    document.getElementById("socioRegistrado").style.display = "none";
    document.getElementById("formNuevoSocio").style.display = "block";
    document.getElementById("planPreview").style.display = "none";

    // Establecer fecha de alta (hoy)
    document.getElementById("socioFechaAlta").value = getTodayString();
}

function cerrarModalNuevoSocio() {
    document.getElementById("modalNuevoSocio").style.display = "none";
    document.getElementById("formNuevoSocio").reset();
}

function actualizarVencimientoSocio() {
    const planId = parseInt(document.getElementById("socioPlan").value);
    const fechaAlta = document.getElementById("socioFechaAlta").value;

    if (!planId || !fechaAlta) {
        document.getElementById("socioVencimiento").value = "";
        document.getElementById("planPreview").style.display = "none";
        return;
    }

    const plan = database.planes.find((p) => p.id === planId);
    if (!plan) return;

    // Calcular fecha de vencimiento
    const fechaInicio = new Date(fechaAlta + "T00:00:00");
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + plan.duracion);

    document.getElementById("socioVencimiento").value = fechaVencimiento
        .toISOString()
        .split("T")[0];

    // Mostrar preview del plan
    const preview = document.getElementById("planPreview");
    document.getElementById("planNombrePreview").textContent = plan.nombre;
    document.getElementById("planDetallesPreview").textContent =
        `${plan.descripcion} - ${plan.duracion} días`;
    document.getElementById("planPrecioPreview").textContent = formatCurrency(
        plan.costo,
    );
    preview.style.display = "flex";
}

async function guardarNuevoSocio(e) {
    e.preventDefault();

    const nombre = document.getElementById("socioNombre").value.trim();
    const dni = document.getElementById("socioDni").value.trim();
    const telefono = document.getElementById("socioTelefono").value.trim();
    const email = document.getElementById("socioEmail").value.trim();
    const planId = parseInt(document.getElementById("socioPlan").value);
    const fechaAlta = document.getElementById("socioFechaAlta").value;
    const vencimiento = document.getElementById("socioVencimiento").value;

    const errorDiv = document.getElementById("errorSocio");

    // Validaciones
    if (dni.length !== 8) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>DNI inválido</strong>
                <p>El DNI debe tener 8 dígitos.</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        document.getElementById("socioDni").focus();
        return;
    }

    // Verificar si el DNI ya existe
    const socioExistentePorDNI = database.socios.find((s) => s.dni === dni);
    if (socioExistentePorDNI) {
        mostrarSocioExistente(socioExistentePorDNI, "DNI");
        return;
    }

    // Verificar si el email ya existe
    const socioExistentePorEmail = database.socios.find(
        (s) => s.email.toLowerCase() === email.toLowerCase(),
    );
    if (socioExistentePorEmail) {
        mostrarSocioExistente(socioExistentePorEmail, "email");
        return;
    }

    const plan = database.planes.find((p) => p.id === planId);
    if (!plan) {
        alert("Error: Plan no encontrado");
        return;
    }

    try {
        // ✅ PASO 1: Crear socio en MySQL
        const socioData = {
            nombre: nombre,
            dni: dni,
            email: email,
            telefono: telefono,
            plan: plan.nombre,
            fechaNacimiento: null,
            genero: null
        };

        const resultSocio = await crearSocioEnAPI(socioData);
        
        if (!resultSocio) {
            alert('Error al crear el socio');
            return;
        }

        // ✅ PASO 2: Generar credenciales y crear usuario en MySQL
        const username = generarUsernameFromDNI(dni);
        const password = generarPassword();

        const usuarioData = {
            username: username,
            password: password,
            nombre: nombre,
            rol: "Socio",
            socio_id: resultSocio.id
        };

        const resultUsuario = await crearUsuarioEnAPI(usuarioData);
        
        if (!resultUsuario) {
            alert('Error al crear el usuario del socio');
            return;
        }

        // ✅ PASO 3: Registrar primer pago en MySQL
        const pagoData = {
            socio_id: resultSocio.id,
            monto: plan.costo,
            metodo_pago: "Efectivo",
            concepto: `Plan ${plan.nombre} - Alta`
        };

        await registrarPagoEnAPI(pagoData);

        // ✅ PASO 4: Enviar credenciales por email (NUEVO)
        let emailResponse = null;
        try {
            emailResponse = await enviarCredencialesSocioPorEmail(
                email,           // destinatario
                nombre,          // nombre completo
                dni,             // DNI
                username,        // usuario
                password,        // contraseña
                plan.nombre,     // nombre del plan
                vencimiento,     // fecha vencimiento
                plan.costo       // costo
            );
            
            if (emailResponse.success) {
                console.log('✅ Email enviado correctamente al socio');
            } else {
                console.log('⚠️ No se pudo enviar el email:', emailResponse.message);
            }
        } catch (error) {
            console.log('⚠️ Email no configurado o error al enviar:', error);
            emailResponse = {
                success: false,
                message: 'Sistema de email no configurado. Las credenciales se muestran en pantalla.'
            };
        }

        // ✅ Mostrar confirmación con credenciales (ahora incluye info del email)
        const nuevoSocio = {
            id: resultSocio.id,
            nombre: nombre,
            dni: dni,
            email: email,
            telefono: telefono,
            plan: plan.nombre,
            estado: "Activo",
            vencimiento: vencimiento,
            fechaAlta: fechaAlta,
        };

        mostrarConfirmacionSocioConEmail(nuevoSocio, username, password, plan, emailResponse);

        // Actualizar dashboard si está activo
        if (activeModule === "dashboard") {
            updateDashboard();
        }

        // Ocultar formulario
        document.getElementById("formNuevoSocio").style.display = "none";
        
    } catch (error) {
        console.error('Error al crear socio completo:', error);
        alert('Error al crear el socio. Revisa la consola para más detalles.');
    }
}

// Nueva función para mostrar confirmación con info del email
function mostrarConfirmacionSocioConEmail(socio, username, password, plan, emailResponse) {
    const div = document.getElementById("socioRegistrado");

    // Llenar datos de confirmación
    document.getElementById("confirmNombre").textContent = socio.nombre;
    document.getElementById("confirmDni").textContent = socio.dni;
    document.getElementById("confirmPlan").textContent = plan.nombre;
    document.getElementById("confirmVencimiento").textContent = formatDate(
        socio.vencimiento,
    );
    document.getElementById("confirmUsuario").textContent = username;
    document.getElementById("confirmPassword").textContent = password;

    // Agregar mensaje sobre el email
    const confirmEmailMsg = document.getElementById("confirmEmailMsg");
    if (confirmEmailMsg) {
        if (emailResponse && emailResponse.success) {
            confirmEmailMsg.innerHTML = `
                <div style="background: #d1f2eb; border-left: 4px solid #00b894; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <i class="fas fa-check-circle" style="color: #00b894;"></i>
                    <strong style="color: #00695c;">✅ Email enviado correctamente</strong>
                    <p style="margin: 5px 0 0 0; color: #004d40;">
                        Las credenciales fueron enviadas a: <strong>${socio.email}</strong>
                    </p>
                </div>
            `;
        } else {
            confirmEmailMsg.innerHTML = `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 15px;">
                    <i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i>
                    <strong style="color: #f57c00;">⚠️ Email no enviado</strong>
                    <p style="margin: 5px 0 0 0; color: #e65100;">
                        ${emailResponse ? emailResponse.message : 'Error al enviar el email. Por favor, descarga las credenciales y envíalas manualmente.'}
                    </p>
                </div>
            `;
        }
    }

    div.style.display = "block";
}

function generarUsernameFromDNI(dni) {
    let username = "socio" + dni;
    let contador = 1;
    let usernameOriginal = username;

    while (database.usuarios.some((u) => u.username === username)) {
        username = usernameOriginal + contador;
        contador++;
    }

    return username;
}

function mostrarConfirmacionSocio(socio, username, password, plan) {
    const div = document.getElementById("socioRegistrado");

    // Llenar datos de confirmación
    document.getElementById("confirmNombre").textContent = socio.nombre;
    document.getElementById("confirmDni").textContent = socio.dni;
    document.getElementById("confirmPlan").textContent = plan.nombre;
    document.getElementById("confirmVencimiento").textContent = formatDate(
        socio.vencimiento,
    );
    document.getElementById("confirmUsuario").textContent = username;
    document.getElementById("confirmPassword").textContent = password;

    div.style.display = "block";
}

function descargarCredencialesSocio() {
    const nombre = document.getElementById("confirmNombre").textContent;
    const dni = document.getElementById("confirmDni").textContent;
    const usuario = document.getElementById("confirmUsuario").textContent;
    const password = document.getElementById("confirmPassword").textContent;
    const plan = document.getElementById("confirmPlan").textContent;
    const vencimiento =
        document.getElementById("confirmVencimiento").textContent;

    const contenido = `
THE BEST GYM - CREDENCIALES DE SOCIO
====================================

DATOS DEL SOCIO
Nombre: ${nombre}
DNI: ${dni}
Plan: ${plan}
Vencimiento: ${vencimiento}

CREDENCIALES DE ACCESO AL PORTAL
Usuario: ${usuario}
Contraseña: ${password}

Fecha de registro: ${new Date().toLocaleString("es-AR")}

IMPORTANTE: 
- Guarde estas credenciales de forma segura.
- Puede cambiar su contraseña después del primer ingreso desde su perfil.
- Recuerde realizar el pago antes de la fecha de vencimiento.

¡Bienvenido a The Best Gym!
    `;

    const blob = new Blob([contenido], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credenciales_${dni}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function finalizarRegistroSocio() {
    cerrarModalNuevoSocio();
    document.getElementById("formNuevoSocio").style.display = "block";
    document.getElementById("socioRegistrado").style.display = "none";
}
// VERIFICACIÓN DE SOCIO EXISTENTE
function mostrarSocioExistente(socio, tipoCampo) {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalSocioExistente";
    modal.style.display = "flex";

    const estadoBadge =
        socio.estado === "Activo"
            ? '<span class="badge-active">Activo</span>'
            : '<span class="badge-moroso">Moroso</span>';

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalSocioExistente()"></div>
        <div class="modal-content modal-socio-existente">
            <button class="modal-close" onclick="cerrarModalSocioExistente()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-warning">
                <i class="fas fa-exclamation-circle"></i>
                <div>
                    <h3>Socio Existente</h3>
                    <p>Ya existe un socio registrado con este ${tipoCampo === "DNI" ? "DNI" : "correo electrónico"}</p>
                </div>
            </div>

            <div class="modal-body-socio-existente">
                <div class="socio-existente-info">
                    <div class="info-header">
                        <div class="info-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>
                            <h4>${socio.nombre}</h4>
                            ${estadoBadge}
                        </div>
                    </div>

                    <div class="info-grid">
                        <div class="info-item">
                            <i class="fas fa-id-card"></i>
                            <div>
                                <label>DNI</label>
                                <span>${socio.dni}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-envelope"></i>
                            <div>
                                <label>Email</label>
                                <span>${socio.email}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-phone"></i>
                            <div>
                                <label>Teléfono</label>
                                <span>${socio.telefono}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-calendar-alt"></i>
                            <div>
                                <label>Plan</label>
                                <span>${socio.plan}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-calendar-check"></i>
                            <div>
                                <label>Fecha de Alta</label>
                                <span>${formatDate(socio.fechaAlta)}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-clock"></i>
                            <div>
                                <label>Vencimiento</label>
                                <span>${formatDate(socio.vencimiento)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="opciones-socio-existente">
                    <h4><i class="fas fa-question-circle"></i> ¿Qué deseas hacer?</h4>
                    <div class="opciones-buttons">
                        <button class="btn-opcion btn-actualizar" onclick="abrirActualizarDatosSocio(${socio.id})">
                            <i class="fas fa-edit"></i>
                            <div>
                                <strong>Actualizar Datos</strong>
                                <span>Modificar información del socio</span>
                            </div>
                        </button>
                        <button class="btn-opcion btn-renovar" onclick="abrirRenovarPlanSocio(${socio.id})">
                            <i class="fas fa-sync-alt"></i>
                            <div>
                                <strong>Renovar Plan</strong>
                                <span>Extender membresía existente</span>
                            </div>
                        </button>
                        <button class="btn-opcion btn-ver" onclick="verPerfilCompletoSocio(${socio.id})">
                            <i class="fas fa-user-circle"></i>
                            <div>
                                <strong>Ver Perfil Completo</strong>
                                <span>Ver toda la información</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div class="modal-footer-socio-existente">
                <button class="btn-secondary" onclick="cerrarModalSocioExistente()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function cerrarModalSocioExistente() {
    const modal = document.getElementById("modalSocioExistente");
    if (modal) {
        modal.remove();
    }
}

function abrirActualizarDatosSocio(socioId) {
    // Cerrar otros modales si están abiertos
    cerrarModalSocioExistente();
    cerrarModalNuevoSocio();

    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        alert("❌ Error: Socio no encontrado");
        return;
    }

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalActualizarSocio";
    modal.style.display = "flex";

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalActualizarSocio()"></div>
        <div class="modal-content modal-actualizar-socio">
            <button class="modal-close" onclick="cerrarModalActualizarSocio()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-socio">
                <i class="fas fa-user-edit"></i>
                <h3>Actualizar Datos del Socio</h3>
            </div>

            <div class="modal-body-socio">
                <form id="formActualizarSocio">
                    <div class="section-title">
                        <i class="fas fa-user"></i>
                        <h4>Datos Personales</h4>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Nombre Completo *</label>
                            <input type="text" id="updateNombre" class="form-control" value="${socio.nombre}" required />
                        </div>
                        <div class="form-group">
                            <label>DNI *</label>
                            <input type="text" id="updateDni" class="form-control" value="${socio.dni}" readonly />
                            <small class="form-hint">
                                <i class="fas fa-info-circle"></i>
                                El DNI no puede modificarse
                            </small>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Teléfono *</label>
                            <input type="tel" id="updateTelefono" class="form-control" value="${socio.telefono}" required />
                        </div>
                        <div class="form-group">
                            <label>Correo Electrónico *</label>
                            <input type="email" id="updateEmail" class="form-control" value="${socio.email}" required />
                        </div>
                    </div>

                    <div class="section-title">
                        <i class="fas fa-id-card"></i>
                        <h4>Plan y Membresía</h4>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Plan Actual *</label>
                            <select id="updatePlan" class="form-control" required>
                                <option value="Mensual" ${socio.plan === "Mensual" ? "selected" : ""}>Mensual - $15,000</option>
                                <option value="Trimestral" ${socio.plan === "Trimestral" ? "selected" : ""}>Trimestral - $40,000</option>
                                <option value="Anual" ${socio.plan === "Anual" ? "selected" : ""}>Anual - $150,000</option>
                            </select>
                            <small class="form-hint">
                                <i class="fas fa-info-circle"></i>
                                Cambiar el plan no afecta la fecha de vencimiento
                            </small>
                        </div>
                        <div class="form-group">
                            <label>Estado *</label>
                            <select id="updateEstado" class="form-control" required>
                                <option value="Activo" ${socio.estado === "Activo" ? "selected" : ""}>Activo</option>
                                <option value="Moroso" ${socio.estado === "Moroso" ? "selected" : ""}>Moroso</option>
                                <option value="Pausado" ${socio.estado === "Pausado" ? "selected" : ""}>Pausado</option>
                                <option value="Cancelado" ${socio.estado === "Cancelado" ? "selected" : ""}>Cancelado</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Fecha de Vencimiento *</label>
                        <input type="date" id="updateVencimiento" class="form-control" value="${socio.vencimiento}" required />
                    </div>

                    <div id="errorActualizacion" class="error-message-socio" style="display: none">
                        <!-- Mensaje de error dinámico -->
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="cerrarModalActualizarSocio()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("formActualizarSocio")
        .addEventListener("submit", (e) => {
            e.preventDefault();
            guardarCambiosSocio(socioId);
        });
}

function cerrarModalActualizarSocio() {
    const modal = document.getElementById("modalActualizarSocio");
    if (modal) {
        modal.remove();
    }
}

async function guardarCambiosSocio(socioId) {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        alert("❌ Error: Socio no encontrado");
        return;
    }

    const nuevoEmail = document.getElementById("updateEmail").value.trim();
    const errorDiv = document.getElementById("errorActualizacion");

    // Validar que el email no esté en uso por otro socio
    const emailExistente = database.socios.find(
        (s) =>
            s.id !== socioId &&
            s.email.toLowerCase() === nuevoEmail.toLowerCase(),
    );

    if (emailExistente) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Email ya registrado</strong>
                <p>El correo ${nuevoEmail} ya está en uso por ${emailExistente.nombre}</p>
            </div>
        `;
        errorDiv.style.display = "flex";
        return;
    }

    const socioData = {
        id: socioId,
        nombre: document.getElementById("updateNombre").value.trim(),
        telefono: document.getElementById("updateTelefono").value.trim(),
        email: nuevoEmail,
        plan: document.getElementById("updatePlan").value,
        estado: document.getElementById("updateEstado").value,
        vencimiento: document.getElementById("updateVencimiento").value,
    };

    // Guardar en MySQL primero; solo tocar el estado local si la API confirma éxito
    const exito = await actualizarSocioEnAPI(socioData);

    if (!exito) {
        alert("No se pudo actualizar el socio en la base de datos. Intentá de nuevo.");
        return;
    }

    // Actualizar también el usuario asociado si existe
    const usuario = database.usuarios.find((u) => u.socioId === socioId);
    if (usuario) {
        usuario.nombre = socioData.nombre;
        usuario.email = socioData.email;
    }

    alert("✅ Datos del socio actualizados correctamente");
    cerrarModalActualizarSocio();

    // Actualizar dashboard si estamos en él
    if (activeModule === "dashboard") {
        updateDashboard();
    }
}

function abrirRenovarPlanSocio(socioId) {
    cerrarModalSocioExistente();

    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalRenovarPlan";
    modal.style.display = "flex";

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalRenovarPlan()"></div>
        <div class="modal-content modal-renovar-plan">
            <button class="modal-close" onclick="cerrarModalRenovarPlan()">
                <i class="fas fa-times"></i>
            </button>

            <div class="modal-header-socio">
                <i class="fas fa-sync-alt"></i>
                <h3>Renovar Plan de ${socio.nombre}</h3>
            </div>

            <div class="modal-body-socio">
                <div class="info-actual-plan">
                    <h4>Plan Actual</h4>
                    <div class="plan-actual-card">
                        <div><strong>Plan:</strong> ${socio.plan}</div>
                        <div><strong>Vencimiento:</strong> ${formatDate(socio.vencimiento)}</div>
                        <div><strong>Estado:</strong> <span class="badge ${socio.estado === "Activo" ? "badge-active" : "badge-moroso"}">${socio.estado}</span></div>
                    </div>
                </div>

                <form id="formRenovarPlan">
                    <div class="form-group">
                        <label>Seleccionar Nuevo Plan *</label>
                        <select id="renovarPlanId" class="form-control" required>
                            <option value="">Seleccionar plan...</option>
                            <option value="1">Mensual - $15,000</option>
                            <option value="2">Trimestral - $40,000</option>
                            <option value="3">Anual - $150,000</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Método de Pago *</label>
                        <select id="renovarMetodoPago" class="form-control" required>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                        </select>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="cerrarModalRenovarPlan()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-check"></i> Confirmar Renovación
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("formRenovarPlan")
        .addEventListener("submit", (e) => {
            e.preventDefault();
            confirmarRenovacionPlan(socioId);
        });
}

function cerrarModalRenovarPlan() {
    const modal = document.getElementById("modalRenovarPlan");
    if (modal) {
        modal.remove();
    }
}

async function confirmarRenovacionPlan(socioId) {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return;

    const planId = parseInt(document.getElementById("renovarPlanId").value);
    const metodoPago = document.getElementById("renovarMetodoPago").value;

    const plan = database.planes.find((p) => p.id === planId);
    if (!plan) {
        alert("Error: Plan no encontrado");
        return;
    }

    try {
        // ✅ Registrar pago en MySQL
        const pagoData = {
            socio_id: socio.id,
            monto: plan.costo,
            metodo_pago: metodoPago,
            concepto: `Renovación - Plan ${plan.nombre}`
        };

        const result = await registrarPagoEnAPI(pagoData);
        
        if (!result) {
            alert('Error al registrar el pago de renovación');
            return;
        }

        // El pago ya actualiza el vencimiento automáticamente en la API
        alert(`✅ Plan renovado exitosamente`);

        cerrarModalRenovarPlan();
        
        if (activeModule === "dashboard") {
            updateDashboard();
        }
        
    } catch (error) {
        console.error('Error al renovar plan:', error);
        alert('Error al renovar el plan. Revisa la consola para más detalles.');
    }
}

function verPerfilCompletoSocio(socioId) {
    cerrarModalSocioExistente();

    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return;

    const pagos = database.pagos.filter((p) => p.socioId === socioId);
    const asistencias = database.asistencias.filter(
        (a) => a.socioId === socioId,
    );

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "modalPerfilSocio";
    modal.style.display = "flex";

    modal.innerHTML = `
        <div class="modal-overlay" onclick="cerrarModalPerfilSocio()"></div>
        <div class="modal-content modal-perfil-completo">
            <button class="modal-close" onclick="cerrarModalPerfilSocio()">
                <i class="fas fa-times"></i>
            </button>

            <div class="perfil-header">
                <div class="perfil-avatar-large">
                    <i class="fas fa-user"></i>
                </div>
                <div class="perfil-info-header">
                    <h2>${socio.nombre}</h2>
                    <p><i class="fas fa-id-card"></i> DNI: ${socio.dni}</p>
                    <span class="badge ${socio.estado === "Activo" ? "badge-active" : "badge-moroso"}">${socio.estado}</span>
                </div>
            </div>

            <div class="perfil-body">
                <div class="perfil-section">
                    <h4><i class="fas fa-info-circle"></i> Información Personal</h4>
                    <div class="info-grid">
                        <div><strong>Email:</strong> ${socio.email}</div>
                        <div><strong>Teléfono:</strong> ${socio.telefono}</div>
                        <div><strong>Plan:</strong> ${socio.plan}</div>
                        <div><strong>Fecha Alta:</strong> ${formatDate(socio.fechaAlta)}</div>
                        <div><strong>Vencimiento:</strong> ${formatDate(socio.vencimiento)}</div>
                    </div>
                </div>

                <div class="perfil-section">
                    <h4><i class="fas fa-chart-bar"></i> Estadísticas</h4>
                    <div class="stats-perfil">
                        <div class="stat-perfil">
                            <i class="fas fa-dollar-sign"></i>
                            <div>
                                <strong>${pagos.length}</strong>
                                <span>Pagos realizados</span>
                            </div>
                        </div>
                        <div class="stat-perfil">
                            <i class="fas fa-calendar-check"></i>
                            <div>
                                <strong>${asistencias.length}</strong>
                                <span>Asistencias</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="perfil-section">
                    <h4><i class="fas fa-history"></i> Últimos Pagos</h4>
                    ${
                        pagos.length > 0
                            ? `
                        <table class="tabla-mini">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Monto</th>
                                    <th>Método</th>
                                    <th>Concepto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pagos
                                    .slice(-5)
                                    .reverse()
                                    .map(
                                        (p) => `
                                    <tr>
                                        <td>${formatDate(p.fecha)}</td>
                                        <td>${formatCurrency(p.monto)}</td>
                                        <td>${(pago.metodo_pago || pago.metodoPago)}</td>
                                        <td>${p.concepto}</td>
                                    </tr>
                                `,
                                    )
                                    .join("")}
                            </tbody>
                        </table>
                    `
                            : '<p class="text-center" style="color: var(--text-light);">No hay pagos registrados</p>'
                    }
                </div>
            </div>

            <div class="modal-footer-perfil">
                <button class="btn-secondary" onclick="cerrarModalPerfilSocio()">
                    <i class="fas fa-times"></i> Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function cerrarModalPerfilSocio() {
    const modal = document.getElementById("modalPerfilSocio");
    if (modal) {
        modal.remove();
    }
}