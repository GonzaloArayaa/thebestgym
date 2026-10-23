// FUNCIONES DE ENVÍO DE EMAIL
/**
 * Envía credenciales de usuario por email
 */
async function enviarCredencialesPorEmail(email, nombre, username, password, rol) {
    try {
        console.log('📧 Enviando credenciales por email a:', email);
        
        const response = await fetch('api/enviar_email.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tipo: 'usuario',
                destinatario: email,
                nombre: nombre,
                username: username,
                password: password,
                rol: rol
            })
        });
        
        const result = await response.json();
        console.log('📧 Respuesta del servidor de email:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error al enviar email:', error);
        return {
            success: false,
            message: 'Error de conexión al enviar el email'
        };
    }
}

/**
 * Envía credenciales de socio por email (incluye info del plan)
 */
async function enviarCredencialesSocioPorEmail(email, nombre, dni, username, password, planNombre, vencimiento, costo) {
    try {
        console.log('📧 Enviando credenciales de socio por email a:', email);
        
        const response = await fetch('api/enviar_email.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tipo: 'socio',
                destinatario: email,
                nombre: nombre,
                dni: dni,
                username: username,
                password: password,
                planNombre: planNombre,
                vencimiento: vencimiento,
                costo: costo
            })
        });
        
        const result = await response.json();
        console.log('📧 Respuesta del servidor de email:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error al enviar email:', error);
        return {
            success: false,
            message: 'Error de conexión al enviar el email'
        };
    }
}
// GESTIÓN DE PLANES DESDE ADMIN/RECEPCIONISTA
let socioSeleccionadoPlanAdmin = null;
// MODAL: VER ESTADO DEL PLAN (Admin/Recep)
function abrirModalEstadoPlan(socioId) {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        alert("Socio no encontrado");
        return;
    }
    socioSeleccionadoPlanAdmin = socio;
    // Calcular días restantes
    const hoy = new Date();
    const vencimiento = new Date(socio.vencimiento);
    const diasRestantes = Math.ceil(
        (vencimiento - hoy) / (1000 * 60 * 60 * 24),
    );
    const estado = diasRestantes > 0 ? "Activo" : "Vencido";
    // Llenar datos
    document.getElementById("estadoPlanNombre").textContent = socio.nombre;
    document.getElementById("estadoPlanDni").textContent = socio.dni;
    document.getElementById("estadoPlanNombrePlan").textContent = socio.plan;
    document.getElementById("estadoPlanInicio").textContent = formatDate(
        socio.fechaAlta,
    );
    document.getElementById("estadoPlanVencimiento").textContent = formatDate(
        socio.vencimiento,
    );
    document.getElementById("estadoPlanDiasRestantes").textContent =
        diasRestantes > 0 ? `${diasRestantes} días` : "Vencido";
    const estadoBadge = document.getElementById("estadoPlanEstado");
    estadoBadge.textContent = estado;
    estadoBadge.className =
        diasRestantes > 0 ? "badge badge-active" : "badge badge-moroso";
    // Estado de congelamiento
    const congeladoBadge = document.getElementById("estadoPlanCongelado");
    if (socio.congelado) {
        congeladoBadge.textContent = `Congelado (${socio.diasCongelados || 0} días)`;
        congeladoBadge.className = "badge";
        congeladoBadge.style.background = "#d1ecf1";
        congeladoBadge.style.color = "#0c5460";
    } else {
        congeladoBadge.textContent = "No congelado";
        congeladoBadge.className = "badge badge-active";
    }
    // Obtener precio del plan
    const planInfo = database.planes.find((p) => p.nombre === socio.plan);
    document.getElementById("estadoPlanPrecio").textContent = planInfo
        ? planInfo.precio
        : "-";

    document.getElementById("modalEstadoPlan").style.display = "flex";
}

function cerrarModalEstadoPlan() {
    document.getElementById("modalEstadoPlan").style.display = "none";
    socioSeleccionadoPlanAdmin = null;
}

// MODAL: CONGELAR PLAN (Admin/Recep)
function abrirModalCongelarPlanAdmin(socioId) {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        alert("Socio no encontrado");
        return;
    }

    if (socio.congelado) {
        alert("Este plan ya está congelado.");
        return;
    }

    socioSeleccionadoPlanAdmin = socio;

    document.getElementById("congelarPlanNombre").textContent = socio.nombre;
    document.getElementById("congelarPlanDni").textContent = socio.dni;
    document.getElementById("congelarPlanNombrePlan").textContent = socio.plan;
    document.getElementById("congelarPlanVencimiento").textContent = formatDate(
        socio.vencimiento,
    );
    document.getElementById("congelarPlanSocioId").value = socio.id;

    document.getElementById("congelarPlanDias").value = "";
    document.getElementById("congelarPlanMotivo").value = "";
    document.getElementById("congelarPlanNuevaFecha").value = "";

    document.getElementById("modalCongelarPlan").style.display = "flex";
}

function cerrarModalCongelarPlan() {
    document.getElementById("modalCongelarPlan").style.display = "none";
    socioSeleccionadoPlanAdmin = null;
}

// Calcular nueva fecha al escribir días
if (!window.congelarDiasListenerAdded) {
    window.congelarDiasListenerAdded = true;

    document.addEventListener("DOMContentLoaded", function () {
        const inputDias = document.getElementById("congelarPlanDias");
        if (inputDias) {
            inputDias.addEventListener("input", function () {
                const dias = parseInt(this.value);
                if (dias > 0 && dias <= 90 && socioSeleccionadoPlanAdmin) {
                    const fechaActual = new Date(
                        socioSeleccionadoPlanAdmin.vencimiento,
                    );
                    fechaActual.setDate(fechaActual.getDate() + dias);
                    document.getElementById("congelarPlanNuevaFecha").value =
                        fechaActual.toISOString().split("T")[0];
                } else {
                    document.getElementById("congelarPlanNuevaFecha").value =
                        "";
                }
            });
        }

        const formCongelar = document.getElementById("formCongelarPlan");
        if (formCongelar && !formCongelar.dataset.listenerAdded) {
            formCongelar.dataset.listenerAdded = "true";
            formCongelar.addEventListener("submit", function (e) {
                e.preventDefault();
                confirmarCongelamientoPlanAdmin();
            });
        }

        const formCancelar = document.getElementById("formCancelarPlan");
        if (formCancelar && !formCancelar.dataset.listenerAdded) {
            formCancelar.dataset.listenerAdded = "true";
            formCancelar.addEventListener("submit", function (e) {
                e.preventDefault();
                confirmarCancelacionPlanAdmin();
            });
        }
    });
}

async function confirmarCongelamientoPlanAdmin() {
    const socioId = parseInt(
        document.getElementById("congelarPlanSocioId").value,
    );
    const diasCongelar = parseInt(
        document.getElementById("congelarPlanDias").value,
    );
    const nuevaFecha = document.getElementById("congelarPlanNuevaFecha").value;

    if (!diasCongelar || diasCongelar < 1 || diasCongelar > 90) {
        alert("Por favor ingresa un número válido de días (1-90)");
        return;
    }

    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return;

    const exito = await actualizarSocioEnAPI({
        id: socio.id,
        nombre: socio.nombre,
        email: socio.email,
        telefono: socio.telefono,
        plan: socio.plan,
        estado: "Pausado",
        vencimiento: nuevaFecha,
    });

    if (!exito) {
        alert(
            "No se pudo congelar el plan en el servidor. Intentá de nuevo.",
        );
        return;
    }

    cerrarModalCongelarPlan();
    alert(
        `✅ Plan congelado exitosamente por ${diasCongelar} días.\nNueva fecha de vencimiento: ${formatDate(nuevaFecha)}`,
    );
}

// MODAL: CANCELAR PLAN (Admin/Recep)
function abrirModalCancelarPlanAdmin(socioId) {
    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) {
        alert("Socio no encontrado");
        return;
    }

    socioSeleccionadoPlanAdmin = socio;

    document.getElementById("cancelPlanNombre").textContent = socio.nombre;
    document.getElementById("cancelPlanDni").textContent = socio.dni;
    document.getElementById("cancelPlanNombrePlan").textContent = socio.plan;
    document.getElementById("cancelPlanVencimiento").textContent = formatDate(
        socio.vencimiento,
    );
    document.getElementById("cancelPlanSocioId").value = socio.id;
    document.getElementById("cancelPlanMotivo").value = "";

    document.getElementById("modalCancelarPlan").style.display = "flex";
}

function cerrarModalCancelarPlanAdmin() {
    document.getElementById("modalCancelarPlan").style.display = "none";
    socioSeleccionadoPlanAdmin = null;
}

async function confirmarCancelacionPlanAdmin() {
    const socioId = parseInt(
        document.getElementById("cancelPlanSocioId").value,
    );

    const confirmacion = confirm(
        "¿Estás seguro de cancelar este plan?\nEsta acción cambiará el estado del socio a Cancelado.",
    );

    if (!confirmacion) return;

    const socio = database.socios.find((s) => s.id === socioId);
    if (!socio) return;

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

    cerrarModalCancelarPlanAdmin();
    alert(
        `✅ Plan cancelado para ${socio.nombre}.\nEl socio ha sido marcado como Cancelado.`,
    );
}

console.log(
    "✅ Funciones de gestión de planes (Admin/Recep) cargadas correctamente",
);

// Inicializar datos desde MySQL
window.addEventListener('load', function() {
    console.log('🔄 Inicializando aplicación...');
    setTimeout(function() {
        if (currentUser) {
            inicializarDatosDesdeAPI();
        }
    }, 500);
});