// FUNCIONES DE UTILIDAD
function formatCurrency(amount) {
    return "$" + amount.toLocaleString("es-AR");
}

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("es-AR");
}

function getCurrentDate() {
    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    return new Date().toLocaleDateString("es-AR", options);
}

function getTodayString() {
    const today = new Date();
    return today.toISOString().split("T")[0];
}

function getCurrentTime() {
    const now = new Date();
    return now.toTimeString().split(" ")[0].substring(0, 5);
}
// SISTEMA DE LOGIN
function initLogin() {
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorDiv = document.getElementById("loginError");

    if (!username || !password) {
        errorDiv.textContent = "Por favor ingrese usuario y contraseña";
        errorDiv.style.display = "flex";
        return;
    }

    try {
        console.log('🔐 Intentando login para:', username);
        
        // ✅ Validar contra MySQL usando la API
        const response = await fetch(`api/usuarios.php?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
        
        const result = await response.json();
        console.log('📦 Respuesta del servidor:', result);
        
        if (result.success) {
            console.log('✅ Login exitoso');
            currentUser = result.data;
            errorDiv.style.display = "none";
            
            // Cargar todos los datos
            console.log('🔄 Cargando datos desde MySQL...');
            await inicializarDatosDesdeAPI();
            
            showMainSystem();
        } else {
            console.log('❌ Login fallido:', result.message);
            errorDiv.textContent = result.message || "Credenciales incorrectas";
            errorDiv.style.display = "flex";
        }
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        errorDiv.textContent = "Error de conexión con el servidor";
        errorDiv.style.display = "flex";
    }
});
}

async function showMainSystem() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainSystem").style.display = "flex";

    await initMainSystem();
}

async function logout() {
    console.log('🚪 Cerrando sesión...');
    
    currentUser = null;
    
    // Ocultar sistema y mostrar login
    document.getElementById("mainSystem").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    
    // Limpiar campos
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    
    // Limpiar error de login
    const errorDiv = document.getElementById("loginError");
    if (errorDiv) {
        errorDiv.style.display = "none";
    }
    
    // ✅ RECARGAR usuarios desde MySQL para el próximo login
    console.log('🔄 Recargando usuarios para próximo login...');
    await cargarUsuariosDesdeAPI();
    
    console.log('✅ Sesión cerrada correctamente');
}
// SISTEMA PRINCIPAL
async function initMainSystem() {
    // Actualizar información del usuario
    document.getElementById("userRole").textContent = currentUser.rol;
    document.getElementById("welcomeText").textContent =
        `Bienvenido, ${currentUser.nombre}`;
    document.getElementById("currentDate").textContent = getCurrentDate();
    // Generar menú según rol
    generateMenu();
    console.log('🔄 Cargando datos iniciales desde MySQL...');
    await inicializarDatosDesdeAPI();
    // Inicializar módulos
    verificarVencimientos();
    initDashboard();
    initUsuariosModule();
    initSociosModule();
    initAsistenciasModule();
    initPagosModule();
    initClasesInstructoresModule();
    initMisClasesModule();
    initPlanesModule();
    initReportesModule();
    initMiPlanModule();
    initTurnosModule();
    initPerfilModule();
    // Event listeners
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document
        .getElementById("toggleSidebar")
        .addEventListener("click", toggleSidebar);
    // Mostrar módulo por defecto según rol
    if (currentUser.rol === "Socio") {
        showModule("miPlan");
    } else if (currentUser.rol === "Instructor") {
        showModule("misClases");
    } else {
        showModule("dashboard");
    }
}

async function showModule(moduleName, event) {
    if (moduleName === "usuarios" && !tienePermiso("usuarios", "ver")) {
        mostrarErrorPermisos();
        return;
    }

    // Validar acceso al módulo de clases
    if (moduleName === "clasesInstructores" && !tienePermiso("clases", "ver")) {
        mostrarErrorPermisos();
        return;
    }
    // Ocultar todos los módulos
    document.querySelectorAll(".module").forEach((module) => {
        module.style.display = "none";
    });
    // Mostrar módulo seleccionado
    document.getElementById(moduleName + "Module").style.display = "block";
    // Actualizar menú activo
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.remove("active");
    });
    // Solo actualizar la clase activa si hay un evento (clic del usuario)
    if (event && event.target) {
        event.target.closest(".nav-item").classList.add("active");
    } else {
        // Si se llama programáticamente, buscar el botón del menú correspondiente
        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach((item) => {
            if (
                item.querySelector("span") &&
                item.querySelector("span").textContent ===
                    getModuleLabel(moduleName)
            ) {
                item.classList.add("active");
            }
        });
    }
    activeModule = moduleName;

    // Actualizar datos del módulo
    switch (moduleName) {
        case "dashboard":
            updateDashboard();
            break;
        case "usuarios":
            updateUsuariosTable();
            break;
        case "socios":
            await cargarSociosDesdeAPI();
            updateSociosTable();
        break;
        case "asistencias":
            updateAsistenciasTable();
            break;
        case "pagos":
            await cargarSociosDesdeAPI();
            actualizarSelectSociosPago();
            updatePagosTable();
            break;
        case "clasesInstructores":
            updateClasesTable();
            updateInstructoresGrid();
            break;
        case "misClases":
            updateMisClasesInstructor();
            break;
        case "planes":
            updatePlanesGrid();
            break;
        case "reportes":
            initReportesModule();
            break;
        case "miPlan":
            updateMiPlan();
            break;
        case "turnos":
            updateTurnosModule();
            break;
        case "perfil":
            updatePerfilModule();
            break;
    }
}

function getModuleLabel(moduleId) {
    const labels = {
        dashboard: "Dashboard",
        usuarios: "Usuarios",
        socios: "Socios",
        asistencias: "Asistencias",
        pagos: "Pagos",
        clasesInstructores: "Clases",
        planes: "Planes",
        miPlan: "Mi Plan",
        turnos: "Mis Turnos",
        perfil: "Mi Perfil",
    };
    return labels[moduleId] || "";
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
}