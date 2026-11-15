document.addEventListener('DOMContentLoaded', () => {
    let usuarioActual = null;
    let listaGlobalPacientes = [];

    // Puente para el módulo de Agenda (agenda.js)
    window.PhysioApp = {
        getUsuario: () => usuarioActual,
        getPacientes: () => listaGlobalPacientes,
        cargarPacientesGlobales: () => cargarPacientesGlobales(),
        actualizarDashboard: () => actualizarDashboardYNotificaciones()
    };

    // ==========================================
    // 0. UTILIDAD: NOTIFICACIONES TOAST Y FECHA
    // ==========================================
    window.mostrarToast = function(mensaje, tipo = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return alert(mensaje);

        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        const icono = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
        toast.innerHTML = `<i class="fas ${icono}"></i> <span>${mensaje}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    const spanFecha = document.getElementById('fechaActualTop');
    if (spanFecha) {
        const opcionesFecha = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
        spanFecha.innerText = new Date().toLocaleDateString('es-MX', opcionesFecha);
    }

    // Semáforo dinámico para el slider de dolor (EVA)
    const inputDolor = document.getElementById('nivelDolor');
    const badgeDolor = document.getElementById('badgeDolor');
    if (inputDolor && badgeDolor) {
        inputDolor.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            let texto = 'Sin dolor';
            let bg = 'var(--success-bg)';
            let color = 'var(--success)';

            if (val >= 1 && val <= 3) { texto = 'Dolor Leve'; bg = '#e0f2fe'; color = '#0284c7'; }
            else if (val >= 4 && val <= 7) { texto = 'Dolor Moderado'; bg = 'var(--warning-bg)'; color = '#d97706'; }
            else if (val >= 8) { texto = 'Dolor Severo'; bg = 'var(--danger-bg)'; color = 'var(--danger)'; }

            badgeDolor.style.background = bg;
            badgeDolor.style.color = color;
            badgeDolor.innerHTML = `Nivel: <span id="valorDolor">${val}</span>/10 (${texto})`;
        });
    }

    // ==========================================
    // 1. NAVEGACIÓN DE LA INTERFAZ
    // ==========================================
    const seccionDashboard = document.getElementById('seccion-dashboard');
    const seccionRegistro = document.getElementById('seccion-registro');
    const seccionAgenda = document.getElementById('seccion-agenda');
    const seccionValoraciones = document.getElementById('seccion-valoraciones');

    const btnInicio = document.getElementById('menu-inicio');
    const btnPacientes = document.getElementById('menu-pacientes');
    const btnAgenda = document.getElementById('menu-agenda');
    const btnValoraciones = document.getElementById('menu-valoraciones');

    function ocultarTodo() {
        if (seccionDashboard) seccionDashboard.style.display = 'none';
        if (seccionRegistro) seccionRegistro.style.display = 'none';
        if (seccionAgenda) seccionAgenda.style.display = 'none';
        if (seccionValoraciones) seccionValoraciones.style.display = 'none';
    }

    function limpiarMenu() {
        if (btnInicio) btnInicio.classList.remove('active');
        if (btnPacientes) btnPacientes.classList.remove('active');
        if (btnAgenda) btnAgenda.classList.remove('active');
        if (btnValoraciones) btnValoraciones.classList.remove('active');
    }

    if (btnInicio) {
        btnInicio.addEventListener('click', (e) => {
            e.preventDefault(); ocultarTodo(); limpiarMenu();
            btnInicio.classList.add('active');
            if (seccionDashboard) { seccionDashboard.style.display = 'block'; actualizarDashboardYNotificaciones(); }
        });
    }

    if (btnPacientes) {
        btnPacientes.addEventListener('click', (e) => {
            e.preventDefault(); ocultarTodo(); limpiarMenu();
            btnPacientes.classList.add('active');
            if (seccionRegistro) seccionRegistro.style.display = 'block';
        });
    }

    if (btnAgenda) {
        btnAgenda.addEventListener('click', (e) => {
            e.preventDefault(); ocultarTodo(); limpiarMenu();
            btnAgenda.classList.add('active');
            if (seccionAgenda) {
                seccionAgenda.style.display = 'block';
                if (window.supabaseCliente) cargarPacientesGlobales();
                if (window.Agenda) window.Agenda.mostrar();
            }
        });
    }

    if (btnValoraciones) {
        btnValoraciones.addEventListener('click', (e) => {
            e.preventDefault(); ocultarTodo(); limpiarMenu();
            btnValoraciones.classList.add('active');
            if (seccionValoraciones) {
                seccionValoraciones.style.display = 'block';
                if (window.supabaseCliente) cargarPacientesGlobales();
            }
        });
    }

    // ==========================================
    // 2. CONEXIÓN A SUPABASE Y LOGIN CON SESIÓN
    // ==========================================
    try {
        const supabaseUrl = 'https://kywususdtqcfpuivgtwy.supabase.co';
        const supabaseKey = 'sb_publishable_LNEyYuxscWZVaXeGZQ-lkw_lgcpK1ic';
        window.supabaseCliente = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // Restaurar sesión si ya había entrado
        const sesionGuardada = sessionStorage.getItem('physio_staff_activo');
        if (sesionGuardada) {
            usuarioActual = JSON.parse(sesionGuardada);
            document.getElementById('login-screen').style.display = 'none';
            document.querySelector('.user-info p').innerHTML = `<i class="fas fa-user-md"></i> <span>${usuarioActual.nombre}</span>`;
        }

        actualizarDashboardYNotificaciones();
        cargarUsuariosLogin();
        cargarPacientesGlobales();
    } catch (error) { console.error("Error BD:", error); }

    async function cargarUsuariosLogin() {
        if (!window.supabaseCliente) return;
        const selectLogin = document.getElementById('loginUsuario');
        const { data, error } = await window.supabaseCliente.from('staff').select('id, nombre, rol');
        if (error || !data) return;
        data.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id; option.textContent = `${user.nombre} (${user.rol})`;
            selectLogin.appendChild(option);
        });
    }

    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('loginUsuario').value;
            const pinIngresado = document.getElementById('loginPin').value;
            const msjError = document.getElementById('loginError');

            if (!userId) return mostrarToast("Selecciona un especialista", "error");
            const { data, error } = await window.supabaseCliente.from('staff').select('id, nombre, rol').eq('id', userId).eq('pin', pinIngresado).single(); 

            if (error || !data) {
                msjError.style.display = 'block'; 
            } else {
                msjError.style.display = 'none';
                usuarioActual = data; 
                sessionStorage.setItem('physio_staff_activo', JSON.stringify(data));
                document.getElementById('login-screen').style.display = 'none';
                document.querySelector('.user-info p').innerHTML = `<i class="fas fa-user-md"></i> <span>${data.nombre}</span>`;
                mostrarToast(`Bienvenido(a), ${data.nombre}`);
                actualizarDashboardYNotificaciones();
                if (window.Agenda) window.Agenda.alIniciarSesion();
            }
        });
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            usuarioActual = null;
            sessionStorage.removeItem('physio_staff_activo');
            document.getElementById('loginPin').value = ''; 
            document.getElementById('login-screen').style.display = 'flex'; 
        });
    }

    // ==========================================
    // 3. DASHBOARD INTELIGENTE Y NOTIFICACIONES
    // ==========================================
    async function actualizarDashboardYNotificaciones() {
        if (!window.supabaseCliente) return;
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

        // 1. Citas de Hoy y Lista Rápida
        const { data: citasHoy } = await window.supabaseCliente
            .from('citas')
            .select('id, fecha_hora, tipo_cita, estado, paciente_id, pacientes(nombre_completo)')
            .gte('fecha_hora', hoy.toISOString())
            .lt('fecha_hora', manana.toISOString())
            .order('fecha_hora', { ascending: true });

        if (citasHoy) {
            const pendientes = citasHoy.filter(c => c.estado !== 'listo').length;
            const elCitasHoy = document.getElementById('count-citas-hoy');
            const elPendientes = document.getElementById('count-citas-pendientes');
            if (elCitasHoy) elCitasHoy.innerText = citasHoy.length;
            if (elPendientes) elPendientes.innerText = pendientes;

            const badge = document.querySelector('.badge');
            if (badge) {
                badge.innerText = pendientes;
                badge.style.display = pendientes === 0 ? 'none' : 'inline-block';
            }

            // Renderizar tabla rápida en Dashboard
            const contenedorAgendaHoy = document.getElementById('listaCitasHoyDashboard');
            if (contenedorAgendaHoy) {
                if (citasHoy.length === 0) {
                    contenedorAgendaHoy.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted);"><i class="far fa-calendar-check" style="font-size: 2rem; margin-bottom: 8px; color: var(--primary-color);"></i><p>No hay citas programadas para el día de hoy.</p></div>`;
                } else {
                    contenedorAgendaHoy.innerHTML = citasHoy.map(c => {
                        const hora = new Date(c.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                        const esListo = c.estado === 'listo';
                        const badgeEstado = esListo 
                            ? `<span style="background:var(--success-bg); color:var(--success); padding:4px 10px; border-radius:50px; font-size:0.75rem; font-weight:800;">ATENDIDO ✔</span>`
                            : `<span style="background:var(--warning-bg); color:#d97706; padding:4px 10px; border-radius:50px; font-size:0.75rem; font-weight:800;">PENDIENTE ⏳</span>`;
                        return `
                            <div class="paciente-item" style="margin-bottom: 8px;">
                                <div style="display:flex; align-items:center; gap: 14px;">
                                    <div style="background: var(--primary-light); color: var(--primary-dark); font-weight: 800; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem;">${hora}</div>
                                    <div>
                                        <strong style="font-size: 1rem; color: var(--text-dark);">${c.pacientes ? c.pacientes.nombre_completo : 'Paciente'}</strong>
                                        <p style="font-size: 0.82rem; color: var(--text-muted);">${c.tipo_cita || 'Sesión programada'}</p>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap: 10px;">
                                    ${badgeEstado}
                                    <button onclick="accionDirectorio('${c.paciente_id}', 'valoracion')" class="btn-primary" style="padding: 7px 12px; font-size: 0.8rem;">Abrir Expediente</button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        }

        // 2. Pacientes Nuevos Hoy
        const { data: pacientesHoy } = await window.supabaseCliente.from('pacientes').select('id').gte('fecha_registro', hoy.toISOString()).lt('fecha_registro', manana.toISOString());
        if (pacientesHoy) {
            const contadorPacientes = document.getElementById('count-pacientes-nuevos');
            if(contadorPacientes) contadorPacientes.innerText = pacientesHoy.length;
        }

        // 3. Total Histórico de Pacientes
        const { count: totalPacientes } = await window.supabaseCliente.from('pacientes').select('*', { count: 'exact', head: true });
        const elTotalPacientes = document.getElementById('count-total-pacientes');
        if (elTotalPacientes && totalPacientes !== null) elTotalPacientes.innerText = totalPacientes;
    }

    // ==========================================
    // 4. REGISTRO DE PACIENTE (MEGA FORMULARIO)
    // ==========================================
    const formPaciente = document.getElementById('formNuevoPaciente');
    if (formPaciente) {
        formPaciente.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            if(!window.supabaseCliente || !usuarioActual) return mostrarToast("Debes iniciar sesión primero", "error");

            const btnSubmit = formPaciente.querySelector('button[type="submit"]');
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando Expediente...';
            btnSubmit.disabled = true;

            const getCheckboxes = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value).join(', ');

            const datosPaciente = {
                nombre_completo: document.getElementById('nombrePaciente').value.trim(),
                edad: parseInt(document.getElementById('edadPaciente').value),
                telefono_emergencia: document.getElementById('telEmergencia').value.trim(),
                antecedentes_personales: getCheckboxes('ant_personal'),
                antecedentes_familiares: document.getElementById('antFamiliares').value,
                pruebas_reflejos: getCheckboxes('reflejos'),
                sensibilidad: getCheckboxes('sensibilidad'),
                tipo_marcha: document.getElementById('tipoMarcha').value,
                goniometria: document.getElementById('goniometria').value,
                nivel_dolor: parseInt(document.getElementById('nivelDolor').value),
                mapa_dolor: document.getElementById('zonasDolor').value,
                servicio_contratado: document.getElementById('servicioContratado').value,
                observaciones_medicas: document.getElementById('notasTerapeuticas').value,
                creado_por_id: usuarioActual.id 
            };

            const { data: nuevoPac, error } = await window.supabaseCliente.from('pacientes').insert([datosPaciente]).select().single();
            if (error) {
                mostrarToast('Error al registrar: ' + error.message, 'error');
            } else {
                mostrarToast('¡Expediente clínico guardado con éxito!');
                formPaciente.reset();
                if (inputDolor) inputDolor.dispatchEvent(new Event('input'));
                await cargarPacientesGlobales();
                actualizarDashboardYNotificaciones();
                
                // Redirigir a Agenda y abrir la creación de cita con el paciente recién creado
                document.getElementById('menu-agenda').click();
                if (nuevoPac && nuevoPac.id && window.Agenda) {
                    window.Agenda.abrirCrear({ pacienteId: nuevoPac.id, servicio: datosPaciente.servicio_contratado });
                }
            }
            btnSubmit.innerHTML = '<i class="fas fa-save"></i> Guardar Expediente y Pasar a Agenda';
            btnSubmit.disabled = false;
        });
    }

    // ==========================================
    // 5. DIRECTORIO, AGENDA Y CALENDARIO
    // ==========================================
    async function cargarPacientesGlobales() {
        if(!window.supabaseCliente) return;
        const { data } = await window.supabaseCliente.from('pacientes').select('id, nombre_completo, telefono_emergencia, servicio_contratado').order('nombre_completo', { ascending: true }); 
        if (data) {
            listaGlobalPacientes = data;
            
            const selectV = document.getElementById('selectPacienteValoracion');
            const valorPrevioV = selectV ? selectV.value : '';
            if(selectV) selectV.innerHTML = '<option value="">-- Seleccione un paciente --</option>';

            data.forEach(p => {
                const optV = document.createElement('option'); optV.value = p.id; optV.textContent = p.nombre_completo;
                if(selectV) selectV.appendChild(optV);
            });

            if (selectV && valorPrevioV) selectV.value = valorPrevioV;
            if (window.Agenda) window.Agenda.pacientesActualizados();

            renderizarListaDirectorio('');
        }
    }

    function renderizarListaDirectorio(filtro = '') {
        const contenedorDir = document.getElementById('listaCompletaPacientes');
        if (!contenedorDir) return;
        contenedorDir.innerHTML = '';

        const filtrados = listaGlobalPacientes.filter(p => 
            p.nombre_completo.toLowerCase().includes(filtro.toLowerCase()) ||
            (p.telefono_emergencia && p.telefono_emergencia.includes(filtro))
        );

        if (filtrados.length === 0) {
            contenedorDir.innerHTML = `<p style="text-align:center; padding: 20px; color: var(--text-muted);">No se encontraron pacientes.</p>`;
            return;
        }

        filtrados.forEach(p => {
            const nombreSeguro = p.nombre_completo.replace(/'/g, "\\'");
            contenedorDir.innerHTML += `
                <div class="paciente-item" style="flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span style="font-weight:800; color:var(--text-dark); font-size:1.02rem;">${p.nombre_completo}</span>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">
                            <i class="fas fa-phone-alt"></i> ${p.telefono_emergencia || 'Sin teléfono'} · ${p.servicio_contratado || 'Paciente general'}
                        </p>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button onclick="accionDirectorio('${p.id}', 'agenda')" style="background:var(--primary-color); color:white; border:none; padding:8px 13px; border-radius:8px; cursor:pointer; font-weight:700; font-size: 0.84rem;"><i class="fas fa-calendar-plus"></i> Agendar</button>
                        <button onclick="accionDirectorio('${p.id}', 'valoracion')" style="background:var(--success); color:white; border:none; padding:8px 13px; border-radius:8px; cursor:pointer; font-weight:700; font-size: 0.84rem;"><i class="fas fa-folder-open"></i> Expediente</button>
                        <button onclick="eliminarPacienteBD('${p.id}', '${nombreSeguro}')" style="background:var(--danger-bg); color:var(--danger); border:none; padding:8px 11px; border-radius:8px; cursor:pointer;" title="Eliminar Paciente"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    }

    const inputFiltroModal = document.getElementById('filtroModalPacientes');
    if (inputFiltroModal) {
        inputFiltroModal.addEventListener('input', (e) => renderizarListaDirectorio(e.target.value));
    }

    // ==========================================
    // 6. EXPEDIENTE CLÍNICO COMPLETO Y EVOLUCIÓN
    // ==========================================
    const selectPacienteValoracion = document.getElementById('selectPacienteValoracion');
    if (selectPacienteValoracion) {
        selectPacienteValoracion.addEventListener('change', async (e) => {
            const pacienteId = e.target.value;
            const contenedorExpediente = document.getElementById('expedientePaciente');
            const listaCitas = document.getElementById('listaHistorialCitas');
            
            if (!pacienteId) { if(contenedorExpediente) contenedorExpediente.style.display = 'none'; return; }

            const { data: paciente } = await window.supabaseCliente.from('pacientes').select('*').eq('id', pacienteId).single();

            if (paciente && contenedorExpediente) {
                document.getElementById('expNombre').innerText = paciente.nombre_completo;
                document.getElementById('expEdad').innerText = paciente.edad || '-';
                document.getElementById('expTelefono').innerText = paciente.telefono_emergencia || 'No registrado';
                document.getElementById('expMarchaGonio').innerText = `${paciente.tipo_marcha || 'Normal'} | ${paciente.goniometria || 'S/D'}`;
                document.getElementById('expDolor').innerText = `${paciente.nivel_dolor ?? 0} / 10 EVA`;
                document.getElementById('expServicio').innerText = paciente.servicio_contratado || 'No especificado';

                // Botón directo a WhatsApp si tiene teléfono
                const divContacto = document.getElementById('expAccionesContacto');
                if (divContacto) {
                    const telLimpio = (paciente.telefono_emergencia || '').replace(/\D/g, '');
                    if (telLimpio.length >= 10) {
                        const msjWa = encodeURIComponent(`Hola ${paciente.nombre_completo}, te contactamos de la clínica Physio World Rehabilitación.`);
                        divContacto.innerHTML = `
                            <a href="https://wa.me/52${telLimpio}?text=${msjWa}" target="_blank" style="background:#25D366; color:white; text-decoration:none; padding:9px 16px; border-radius:8px; font-weight:700; font-size:0.86rem; display:inline-flex; align-items:center; gap:7px; box-shadow: 0 4px 10px rgba(37,211,102,0.3);">
                                <i class="fab fa-whatsapp" style="font-size:1.1rem;"></i> Enviar WhatsApp
                            </a>
                        `;
                    } else {
                        divContacto.innerHTML = '';
                    }
                }

                // Antecedentes completos
                document.getElementById('expAntecedentes').innerHTML = `
                    <strong>Personales:</strong> ${paciente.antecedentes_personales || 'Negados'}<br>
                    <strong>Heredofamiliares:</strong> ${paciente.antecedentes_familiares || 'Sin registro'}
                `;

                // Exploración completa
                document.getElementById('expExploracion').innerHTML = `
                    <strong>Reflejos:</strong> ${paciente.pruebas_reflejos || 'Sin alteración'}<br>
                    <strong>Sensibilidad:</strong> ${paciente.sensibilidad || 'Conservada'}<br>
                    <strong>Zonas de Dolor:</strong> ${paciente.mapa_dolor || 'No especificadas'}
                `;

                document.getElementById('expValoracion').innerText = paciente.observaciones_medicas || 'Sin observaciones iniciales registradas.';
                contenedorExpediente.style.display = 'block';
            }

            if(listaCitas) listaCitas.innerHTML = '<p style="color:var(--text-muted);">Cargando historial de sesiones...</p>'; 
            const { data: citas } = await window.supabaseCliente.from('citas').select('*, staff(nombre)').eq('paciente_id', pacienteId).order('fecha_hora', { ascending: false }); 
            if(listaCitas) listaCitas.innerHTML = ''; 

            if (citas && citas.length > 0 && listaCitas) {
                citas.forEach(cita => {
                    const fechaObj = new Date(cita.fecha_hora);
                    const tzOffset = fechaObj.getTimezoneOffset() * 60000;
                    const valorInicio = (new Date(fechaObj - tzOffset)).toISOString().slice(0, 16);
                    
                    const fechaObjFin = cita.fecha_fin ? new Date(cita.fecha_fin) : new Date(fechaObj.getTime() + 3600000);
                    const tzOffsetFin = fechaObjFin.getTimezoneOffset() * 60000;
                    const valorFin = (new Date(fechaObjFin - tzOffsetFin)).toISOString().slice(0, 16);
                    const duracionMin = Math.max(15, Math.round((fechaObjFin - fechaObj) / 60000)) || 60;

                    const nombreFisio = cita.staff ? cita.staff.nombre : 'Staff';
                    const esListo = cita.estado === 'listo';
                    const colorBorde = esListo ? 'var(--success)' : 'var(--primary-color)';
                    const estadoBadge = esListo 
                        ? `<span style="background:var(--success-bg); color:var(--success); padding:5px 12px; border-radius:50px; font-size:0.78rem; font-weight:800;">SESIÓN COMPLETADA ✔</span>`
                        : `<span style="background:var(--warning-bg); color:#d97706; padding:5px 12px; border-radius:50px; font-size:0.78rem; font-weight:800;">PENDIENTE ⏳</span>`;
                    
                    listaCitas.innerHTML += `
                        <div style="background: #f8fafc; padding: 20px; margin-bottom: 16px; border: 1px solid var(--border-color); border-left: 5px solid ${colorBorde}; border-radius: 12px; position: relative;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; flex-wrap:wrap; gap:10px;">
                                <div>
                                    ${estadoBadge}
                                    <span style="margin-left: 10px; color:var(--text-muted); font-size: 0.86rem;">
                                        Atendió: <strong style="color:var(--text-dark);">${nombreFisio}</strong> · Servicio: <strong style="color:var(--primary-dark);">${cita.tipo_cita || 'Sesión'}</strong>
                                    </span>
                                </div>
                                <button class="no-print" onclick="eliminarCitaBD('${cita.id}')" style="background: var(--danger-bg); color: var(--danger); border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight:700; font-size: 0.8rem;">
                                    <i class="fas fa-trash"></i> Eliminar Cita
                                </button>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px;">
                                <div><label>Inicio de Sesión:</label><input type="datetime-local" id="inicio-${cita.id}" value="${valorInicio}" data-cita="${cita.id}" data-duracion="${duracionMin}"></div>
                                <div><label>Fin de Sesión:</label><input type="datetime-local" id="fin-${cita.id}" value="${valorFin}" data-cita-fin="${cita.id}"></div>
                            </div>
                            
                            <label>Notas de Evolución Clínica:</label>
                            <textarea id="nota-${cita.id}" rows="2" placeholder="Escribe la evolución del paciente en esta sesión...">${cita.evolucion || ''}</textarea>
                            
                            <div class="no-print" style="margin-top: 14px; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                                <button onclick="actualizarCitaBD('${cita.id}', 'pendiente')" style="padding: 8px 14px; cursor:pointer; font-size:0.85rem; font-weight:700; border: 1.5px solid var(--border-color); background: white; border-radius: 8px;">
                                    Guardar Cambios (Pendiente)
                                </button>
                                <button onclick="actualizarCitaBD('${cita.id}', 'listo')" style="padding: 8px 16px; cursor:pointer; background: var(--success); color:white; border:none; border-radius:8px; font-weight:700; font-size:0.85rem;">
                                    <i class="fas fa-check"></i> Guardar y Marcar Completada
                                </button>
                            </div>
                        </div>
                    `;
                });
            } else if (listaCitas) {
                listaCitas.innerHTML = '<p style="color:var(--text-muted); font-style:italic; padding: 15px 0;">No hay sesiones registradas para este paciente todavía.</p>';
            }
        });
    }

    // Hora de término automática en el historial: al mover el inicio, el fin se recorre
    // conservando la duración (1 hora por defecto).
    const listaHistorial = document.getElementById('listaHistorialCitas');
    if (listaHistorial) {
        const aValorLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        listaHistorial.addEventListener('change', (e) => {
            const el = e.target;
            if (el.dataset.cita) {
                const inicio = new Date(el.value);
                if (isNaN(inicio)) return;
                const dur = parseInt(el.dataset.duracion, 10) || 60;
                const fin = document.getElementById(`fin-${el.dataset.cita}`);
                if (fin) fin.value = aValorLocal(new Date(inicio.getTime() + dur * 60000));
            } else if (el.dataset.citaFin) {
                const ini = document.getElementById(`inicio-${el.dataset.citaFin}`);
                if (!ini) return;
                const dur = Math.round((new Date(el.value) - new Date(ini.value)) / 60000);
                if (dur > 0) ini.dataset.duracion = dur;
            }
        });
    }

    // ==========================================
    // 7. MODAL DEL DIRECTORIO
    // ==========================================
    const modalDirectorio = document.getElementById('modal-directorio');
    const btnCerrarDirectorio = document.getElementById('btnCerrarDirectorio');
    
    window.abrirDirectorio = function() {
        if(modalDirectorio) modalDirectorio.style.display = 'flex';
        if(inputFiltroModal) inputFiltroModal.value = '';
        cargarPacientesGlobales(); 
    };

    if(btnCerrarDirectorio) {
        btnCerrarDirectorio.addEventListener('click', (e) => {
            e.preventDefault();
            modalDirectorio.style.display = 'none';
        });
    }

    window.accionDirectorio = async function(pacienteId, destino) {
        if(modalDirectorio) modalDirectorio.style.display = 'none'; 
        
        if(destino === 'agenda') {
            document.getElementById('menu-agenda').click();
            await cargarPacientesGlobales();
            const pac = listaGlobalPacientes.find(p => String(p.id) === String(pacienteId));
            if (window.Agenda) window.Agenda.abrirCrear({ pacienteId, servicio: pac ? pac.servicio_contratado : '' });
        } else if (destino === 'valoracion') {
            document.getElementById('menu-valoraciones').click();
            await cargarPacientesGlobales(); 
            const selectVal = document.getElementById('selectPacienteValoracion');
            selectVal.value = pacienteId;
            selectVal.dispatchEvent(new Event('change')); 
        }
    };
}); 

// ==========================================
// FUNCIONES GLOBALES (ACTUALIZAR / ELIMINAR)
// ==========================================
window.actualizarCitaBD = async function(citaId, nuevoEstado) {
    if(!window.supabaseCliente) return mostrarToast("Error de conexión", "error");
    const nuevaNota = document.getElementById(`nota-${citaId}`).value;
    const nuevaFechaInicio = new Date(document.getElementById(`inicio-${citaId}`).value).toISOString();
    const nuevaFechaFin = new Date(document.getElementById(`fin-${citaId}`).value).toISOString();
    if (new Date(nuevaFechaFin) <= new Date(nuevaFechaInicio)) return mostrarToast("La hora de fin debe ser mayor al inicio", "error");

    const { error } = await window.supabaseCliente.from('citas').update({ estado: nuevoEstado, evolucion: nuevaNota, fecha_hora: nuevaFechaInicio, fecha_fin: nuevaFechaFin }).eq('id', citaId);
    if (error) mostrarToast("Error: " + error.message, "error");
    else {
        mostrarToast("¡Sesión actualizada correctamente!");
        if (window.Agenda) window.Agenda.refrescar();
        document.getElementById('selectPacienteValoracion').dispatchEvent(new Event('change'));
    }
};

window.eliminarCitaBD = async function(citaId) {
    if(!window.supabaseCliente) return mostrarToast("Error de conexión", "error");
    if(!confirm("¿Seguro que deseas ELIMINAR esta cita del expediente?")) return;
    const { error } = await window.supabaseCliente.from('citas').delete().eq('id', citaId);
    if (error) mostrarToast("Error: " + error.message, "error");
    else {
        mostrarToast("Cita eliminada del historial");
        if (window.Agenda) window.Agenda.refrescar();
        document.getElementById('selectPacienteValoracion').dispatchEvent(new Event('change'));
    }
};

window.eliminarPacienteBD = async function(pacienteId, nombrePaciente) {
    if(!window.supabaseCliente) return mostrarToast("Error de conexión", "error");
    
    const primeraAlerta = confirm(`⚠️ ATENCIÓN: Estás a punto de eliminar a "${nombrePaciente}".\n\n¿Estás seguro de continuar?`);
    if(!primeraAlerta) return;

    const palabraSeguridad = prompt(`Para confirmar que deseas eliminar a "${nombrePaciente}" y TODAS sus citas, escribe la palabra: BORRAR`);
    if (palabraSeguridad !== "BORRAR") return mostrarToast("Eliminación cancelada por seguridad", "error");

    const { error: errorCitas } = await window.supabaseCliente.from('citas').delete().eq('paciente_id', pacienteId);
    if (errorCitas) return mostrarToast("Error al limpiar citas: " + errorCitas.message, "error");

    const { error: errorPaciente } = await window.supabaseCliente.from('pacientes').delete().eq('id', pacienteId);
    if (errorPaciente) {
        mostrarToast("Error al eliminar paciente: " + errorPaciente.message, "error");
    } else {
        mostrarToast("Expediente eliminado permanentemente");
        abrirDirectorio(); 
        const selectVal = document.getElementById('selectPacienteValoracion');
        if (selectVal && selectVal.value === pacienteId) {
            selectVal.value = "";
            document.getElementById('expedientePaciente').style.display = 'none';
        }
    }
};
