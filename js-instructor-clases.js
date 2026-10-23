// MÓDULO INSTRUCTOR - MIS CLASES
// Con turnos.claseId apuntando directo a clasesGym.id, contar alumnos
// inscritos es un filtro directo por id, sin cruces por nombre.
function turnosDeClaseGym(claseGymId, filtroExtra) {
    return database.turnos.filter((t) => {
        if (t.claseId !== claseGymId) return false;
        if (t.estado !== "Confirmado") return false;
        if (filtroExtra && !filtroExtra(t)) return false;
        return true;
    });
}
function initMisClasesModule() {
    updateMisClasesInstructor();
}
function actualizarMisClases() {
    updateMisClasesInstructor();
}
async function updateMisClasesInstructor() {
    if (currentUser.rol !== 'Instructor') return;
    // Buscar el instructor del usuario actual
    const instructor = database.instructores.find(i => i.usuarioId === currentUser.id);
    if (!instructor) {
        console.error('No se encontró instructor para este usuario');
        console.log('ID del usuario actual:', currentUser.id);
        console.log('Instructores disponibles:', database.instructores);
        
        // Mostrar mensaje en la interfaz
        const container = document.querySelector('.instructor-container');
        if (container) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #f59e0b; margin-bottom: 20px;"></i>
                    <h3 style="color: var(--text-dark); margin-bottom: 12px;">Instructor no configurado</h3>
                    <p style="color: var(--text-light); margin-bottom: 20px;">
                        No se encontró un perfil de instructor asociado a tu usuario.<br>
                        Por favor, contacta al administrador.
                    </p>
                    <p style="color: var(--text-light); font-size: 13px; font-family: monospace;">
                        Usuario ID: ${currentUser.id}<br>
                        Rol: ${currentUser.rol}
                    </p>
                </div>
            `;
        }
        return;
    }
    // Obtener clases asignadas
    const clasesAsignadas = database.clasesGym.filter(c => c.instructorId === instructor.id);
    // Actualizar estadísticas
    document.getElementById('totalClasesInstructor').textContent = clasesAsignadas.length;
    // Calcular alumnos de hoy 
    const hoy = getTodayString();
    let alumnosHoy = 0;
    clasesAsignadas.forEach(clase => {
        const turnosHoy = turnosDeClaseGym(clase.id, t => t.fecha === hoy);
        alumnosHoy += turnosHoy.length;
    });
    document.getElementById('totalAlumnosHoy').textContent = alumnosHoy;
    // Calcular próxima clase
    actualizarProximaClase(clasesAsignadas);
    // Calcular asistencias de la semana
    const asistenciasSemana = calcularAsistenciasSemana();
    document.getElementById('asistenciasSemana').textContent = asistenciasSemana;
    // Generar calendario semanal
    generarCalendarioSemanalInstructor(clasesAsignadas);
    // Generar lista de próximas clases
    generarProximasClasesInstructor(clasesAsignadas);
    // Verificar si hay clase en curso
    verificarClaseEnCurso(clasesAsignadas);
}
function actualizarProximaClase(clases) {
    const ahora = new Date();
    const diaActual = ahora.getDay(); 
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes(); 
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    let proximaClase = null;
    let menorDiferencia = Infinity;
    clases.forEach(clase => {
        // Extraer día y hora del horario (ej: "Lunes y Miércoles 09:00")
        const horarioParts = clase.horario.split(' ');
        const horaStr = horarioParts[horarioParts.length - 1]; 
        const [hora, minutos] = horaStr.split(':').map(Number);
        const minutosDesdeMediaNoche = hora * 60 + minutos;
        // Buscar días de la semana en el horario
        diasSemana.forEach((dia, index) => {
            if (clase.horario.includes(dia)) {
                let diferenciaDias = index - diaActual;
                if (diferenciaDias < 0) diferenciaDias += 7;
                // Si es el mismo día, verificar la hora
                if (diferenciaDias === 0 && minutosDesdeMediaNoche <= horaActual) {
                    diferenciaDias = 7; }
                const diferenciaTotal = diferenciaDias * 1440 + (minutosDesdeMediaNoche - horaActual);
                if (diferenciaTotal > 0 && diferenciaTotal < menorDiferencia) {
                    menorDiferencia = diferenciaTotal;
                    proximaClase = {
                        nombre: clase.nombre,
                        hora: horaStr,
                        dia: dia
                    };
                }
            }
        });
    });
    const horaElem = document.getElementById('proximaClaseHora');
    if (proximaClase) {
        horaElem.textContent = proximaClase.hora;
        horaElem.title = `${proximaClase.nombre} - ${proximaClase.dia}`;
    } else {
        horaElem.textContent = '--:--';
    }
}

function calcularAsistenciasSemana() {
    // Calcular asistencias de la última semana
    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    
    return database.asistencias.filter(a => {
        const fechaAsist = new Date(a.fecha + 'T00:00:00');
        return fechaAsist >= hace7Dias && fechaAsist <= hoy;
    }).length;
}

function generarCalendarioSemanalInstructor(clases) {
    const container = document.getElementById('calendarioSemanalInstructor');
    
    if (clases.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 40px; color: var(--text-light);">No tienes clases asignadas</p>';
        return;
    }
    
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const horas = ['07:00', '08:00', '09:00', '10:00', '14:00', '18:00', '19:00', '20:00'];
    
    let html = '<div class="calendario-grid">';
    
    // Encabezado
    html += '<div class="calendario-header"></div>';
    dias.forEach(dia => {
        html += `<div class="calendario-header">${dia}</div>`;
    });
    
    // Filas por hora
    horas.forEach(hora => {
        html += `<div class="calendario-hora">${hora}</div>`;
        
        dias.forEach(dia => {
            // Buscar clase en este día y hora
            const clase = clases.find(c => {
                const horaClase = c.horario.match(/\d{2}:\d{2}/);
                return c.horario.includes(dia) && horaClase && horaClase[0] === hora;
            });
            
            if (clase) {
                // TEMPORAL: sin filtro de fecha, ver TODO más abajo.
                const alumnos = turnosDeClaseGym(clase.id).length;
                
                html += `
                    <div class="calendario-celda">
                        <div class="clase-calendario" onclick="verDetallesClase(${clase.id})">
                            <div class="clase-calendario-nombre">${clase.nombre}</div>
                            <div class="clase-calendario-info">
                                ${clase.duracion} | ${alumnos}/${clase.cupoMaximo} alumnos
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html += '<div class="calendario-celda"></div>';
            }
        });
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function generarProximasClasesInstructor(clases) {
    const container = document.getElementById('proximasClasesInstructor');
    const hoy = new Date();
    
    // Obtener próximas clases (próximos 7 días)
    const proximasClases = [];
    
    clases.forEach(clase => {
        // Extraer días de la semana del horario
        const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const horarioParts = clase.horario.split(' ');
        const horaStr = horarioParts[horarioParts.length - 1];
        
        diasSemana.forEach((dia, index) => {
            if (clase.horario.includes(dia)) {
                // Calcular próxima fecha para este día
                const fechaClase = getNextClassDate(dia);
                proximasClases.push({
                    ...clase,
                    fechaProxima: fechaClase,
                    horaClase: horaStr,
                    diaClase: dia
                });
            }
        });
    });
    
    // Ordenar por fecha más cercana
    proximasClases.sort((a, b) => new Date(a.fechaProxima) - new Date(b.fechaProxima));
    
    // Tomar solo las próximas 5
    const proximas5 = proximasClases.slice(0, 5);
    
    if (proximas5.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 20px; color: var(--text-light);">No hay clases próximas</p>';
        return;
    }
    
    container.innerHTML = proximas5.map(clase => {
        // TEMPORAL: cuenta todos los turnos de la clase sin filtrar por
        // fecha, para que coincida con el modal de asistencia (ver abajo).
        // TODO: corregir bien el modelo de fechas de turnos y volver a
        // filtrar por clase.fechaProxima acá.
        const alumnos = turnosDeClaseGym(clase.id).length;
        
        // Verificar si es hoy
        const esHoy = clase.fechaProxima === getTodayString();
        
        return `
            <div class="proxima-clase-item" style="${esHoy ? 'border-left-color: #10b981; background: #f0fdf4;' : ''}">
                <div class="proxima-clase-info">
                    <h4>${clase.nombre} ${esHoy ? '🔴 HOY' : ''}</h4>
                    <div class="proxima-clase-detalles">
                        <span><i class="fas fa-calendar"></i> ${formatDate(clase.fechaProxima)} - ${clase.diaClase}</span>
                        <span><i class="fas fa-clock"></i> ${clase.horaClase}</span>
                        <span><i class="fas fa-users"></i> ${alumnos}/${clase.cupoMaximo} alumnos</span>
                        <span><i class="fas fa-hourglass-half"></i> ${clase.duracion}</span>
                    </div>
                </div>
                <div class="proxima-clase-actions">
                    <button class="btn-tomar-asistencia" onclick="abrirTomarAsistencia(${clase.id}, '${clase.fechaProxima}')">
                        <i class="fas fa-clipboard-check"></i> Asistencia
                    </button>
                    <button class="btn-ver-detalles" onclick="verDetallesClase(${clase.id})">
                        <i class="fas fa-info-circle"></i> Detalles
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function verificarClaseEnCurso(clases) {
    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
    const diaActual = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][ahora.getDay()];
    
    const claseEnCurso = clases.find(clase => {
        if (!clase.horario.includes(diaActual)) return false;
        
        const horarioParts = clase.horario.split(' ');
        const horaStr = horarioParts[horarioParts.length - 1];
        const [hora, minutos] = horaStr.split(':').map(Number);
        const minutosDesdeMediaNoche = hora * 60 + minutos;
        
        // Clase dura el tiempo especificado
        const duracionMinutos = parseInt(clase.duracion);
        const finClase = minutosDesdeMediaNoche + duracionMinutos;
        
        return horaActual >= minutosDesdeMediaNoche && horaActual <= finClase;
    });
    
    const card = document.getElementById('claseActualCard');
    const info = document.getElementById('claseActualInfo');
    
    if (claseEnCurso) {
        const alumnos = turnosDeClaseGym(claseEnCurso.id).length;
        
        info.innerHTML = `
            <div class="clase-actual-destacada">
                <div class="clase-actual-info">
                    <h4>🔴 ${claseEnCurso.nombre}</h4>
                    <div class="clase-actual-detalles">
                        <span><i class="fas fa-clock"></i> ${claseEnCurso.horario.match(/\d{2}:\d{2}/)[0]}</span>
                        <span><i class="fas fa-users"></i> ${alumnos}/${claseEnCurso.cupoMaximo} alumnos</span>
                        <span><i class="fas fa-hourglass-half"></i> ${claseEnCurso.duracion}</span>
                    </div>
                </div>
                <button class="btn-tomar-asistencia" onclick="abrirTomarAsistencia(${claseEnCurso.id}, '${getTodayString()}')">
                    <i class="fas fa-clipboard-check"></i> Tomar Asistencia
                </button>
            </div>
        `;
        card.style.display = 'block';
    } else {
        card.style.display = 'none';
    }
}
// TOMAR ASISTENCIA
let claseAsistenciaActual = null;
let fechaAsistenciaActual = null;
let estadoAsistencias = {}; 
function abrirTomarAsistencia(claseId, fecha) {
    const clase = database.clasesGym.find(c => c.id === claseId);
    if (!clase) return;
    
    claseAsistenciaActual = claseId;
    fechaAsistenciaActual = fecha;
    estadoAsistencias = {};
    
    // Llenar información de la clase
    document.getElementById('asistenciaClaseInfo').textContent = clase.nombre;
    document.getElementById('asistenciaFecha').textContent = formatDate(fecha);
    document.getElementById('asistenciaHora').textContent = clase.horario.match(/\d{2}:\d{2}/)[0];
    
    // Obtener alumnos inscritos (turnos confirmados)
    // TEMPORAL: no filtramos por fecha del turno (el modelo de fechas de
    // turnos está desalineado con las ocurrencias reales de la clase).
    // Mientras tanto tomamos TODOS los turnos confirmados de la clase,
    // sin importar su fecha, para que la asistencia sea funcional.
    // TODO: corregir el origen de datos de turnos y volver a filtrar por
    // t.fecha === fecha acá.
    const turnosClase = turnosDeClaseGym(clase.id);
    
    document.getElementById('asistenciaTotal').textContent = turnosClase.length;
    // Generar lista de alumnos
    generarListaAlumnosAsistencia(turnosClase);
    // Mostrar modal
    document.getElementById('modalTomarAsistencia').style.display = 'flex';
    // Actualizar estadísticas iniciales
    actualizarEstadisticasAsistencia();
}

function generarListaAlumnosAsistencia(turnos) {
    const lista = document.getElementById('listaAlumnosAsistencia');
    
    if (turnos.length === 0) {
        lista.innerHTML = '<p class="text-center" style="padding: 40px; color: var(--text-light);">No hay alumnos inscritos en esta clase</p>';
        return;
    }
    
    lista.innerHTML = turnos.map(turno => {
        const socio = database.socios.find(s => s.id === turno.socioId);
        if (!socio) return '';
        
        // Verificar si ya tiene asistencia registrada por recepcionista
        const tieneAsistenciaPrevia = database.asistencias.some(a => 
            a.socioId === socio.id && 
            a.fecha === fechaAsistenciaActual
        );
        
        // Inicializar estado
        if (estadoAsistencias[socio.id] === undefined) {
            estadoAsistencias[socio.id] = tieneAsistenciaPrevia;
        }
        
        const iniciales = socio.nombre.split(' ').map(n => n[0]).join('').substring(0, 2);
        
        return `
            <div class="alumno-asistencia-item" data-socio-id="${socio.id}">
                <div class="alumno-info-asist">
                    <div class="alumno-avatar-asist">${iniciales}</div>
                    <div class="alumno-datos-asist">
                        <h5>${socio.nombre}</h5>
                        <p>DNI: ${socio.dni} ${tieneAsistenciaPrevia ? '✓ Ya registrado' : ''}</p>
                    </div>
                </div>
                <label class="toggle-asistencia">
                    <input 
                        type="checkbox" 
                        ${estadoAsistencias[socio.id] ? 'checked' : ''}
                        ${tieneAsistenciaPrevia ? 'disabled' : ''}
                        onchange="toggleAsistenciaAlumno(${socio.id}, this.checked)"
                    />
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

function toggleAsistenciaAlumno(socioId, presente) {
    estadoAsistencias[socioId] = presente;
    actualizarEstadisticasAsistencia();
}

function filtrarAlumnosAsistencia() {
    const busqueda = document.getElementById('buscarAlumnoAsistencia').value.toLowerCase();
    const items = document.querySelectorAll('.alumno-asistencia-item');
    
    items.forEach(item => {
        const nombre = item.querySelector('h5').textContent.toLowerCase();
        const dni = item.querySelector('p').textContent.toLowerCase();
        
        if (nombre.includes(busqueda) || dni.includes(busqueda)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function actualizarEstadisticasAsistencia() {
    const total = Object.keys(estadoAsistencias).length;
    const presentes = Object.values(estadoAsistencias).filter(v => v === true).length;
    const ausentes = total - presentes;
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    
    document.getElementById('cantPresentes').textContent = presentes;
    document.getElementById('cantAusentes').textContent = ausentes;
    document.getElementById('porcentajeAsistencia').textContent = porcentaje + '%';
}

async function guardarAsistenciaClase() {
    if (!claseAsistenciaActual || !fechaAsistenciaActual) return;
    
    const presentes = Object.entries(estadoAsistencias).filter(([id, estado]) => estado === true);
    
    if (presentes.length === 0) {
        alert('⚠️ No has marcado ningún alumno como presente');
        return;
    }
    
    if (!confirm(`¿Confirmar asistencia de ${presentes.length} alumno(s)?`)) {
        return;
    }
    
    // Registrar asistencias en MySQL
    let exitosos = 0;
    let fallidos = 0;
    
    for (const [socioId, estado] of Object.entries(estadoAsistencias)) {
        if (estado === true) {
            const socio = database.socios.find(s => s.id === parseInt(socioId));
            if (!socio) continue;
            
            // Verificar si ya existe
            const yaRegistrado = database.asistencias.some(a => 
                a.socioId === parseInt(socioId) && 
                a.fecha === fechaAsistenciaActual
            );
            
            if (!yaRegistrado) {
                try {
                    const result = await registrarAsistenciaEnAPI(socio.dni);
                    if (result) {
                        exitosos++;
                    } else {
                        fallidos++;
                    }
                } catch (error) {
                    console.error('Error al registrar asistencia:', error);
                    fallidos++;
                }
            } else {
                exitosos++;
            }
        }
    }
    
    alert(`✅ Asistencia guardada\n\nRegistrados: ${exitosos}\nFallidos: ${fallidos}`);
    
    cerrarModalAsistencia();
    updateMisClasesInstructor();
}

function cerrarModalAsistencia() {
    document.getElementById('modalTomarAsistencia').style.display = 'none';
    claseAsistenciaActual = null;
    fechaAsistenciaActual = null;
    estadoAsistencias = {};
}

function verDetallesClase(claseId) {
    const clase = database.clasesGym.find(c => c.id === claseId);
    if (!clase) return;
    
    const alumnos = turnosDeClaseGym(clase.id);
    
    const alumnosNombres = alumnos.map(t => {
        const socio = database.socios.find(s => s.id === t.socioId);
        return socio ? socio.nombre : 'Desconocido';
    });
    
    alert(`📋 Detalles de la Clase\n\nNombre: ${clase.nombre}\nTipo: ${clase.tipo}\nHorario: ${clase.horario}\nDuración: ${clase.duracion}\nCupo: ${alumnos.length}/${clase.cupoMaximo}\n\nAlumnos inscritos:\n${alumnosNombres.length > 0 ? alumnosNombres.join('\n') : 'Ninguno'}`);
}
// Inicializar el módulo cuando se carga
console.log('✅ Módulo Instructor cargado correctamente');
console.log('👤 Usuario actual:', currentUser);
console.log('📋 Instructores en BD:', database.instructores);