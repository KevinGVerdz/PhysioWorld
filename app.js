document.addEventListener('DOMContentLoaded', () => {
    let usuarioActual = null;

    // ==========================================
    // 1. LÓGICA DE LA INTERFAZ
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
                if (window.supabaseCliente) { cargarPacientesGlobales(); setTimeout(() => renderizarCalendario(), 100); }
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
    // 2. CONEXIÓN A SUPABASE Y LOGIN
    // ==========================================
    try {
        const supabaseUrl = 'https://kywususdtqcfpuivgtwy.supabase.co';
        const supabaseKey = 'sb_publishable_LNEyYuxscWZVaXeGZQ-lkw_lgcpK1ic';
        window.supabaseCliente = window.supabase.createClient(supabaseUrl, supabaseKey);
        actualizarDashboardYNotificaciones();
        cargarUsuariosLogin();
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

            if (!userId) return alert("Selecciona un usuario.");
            const { data, error } = await window.supabaseCliente.from('staff').select('id, nombre, rol').eq('id', userId).eq('pin', pinIngresado).single(); 

            if (error || !data) msjError.style.display = 'block'; 
            else {
                msjError.style.display = 'none'; usuarioActual = data; 
                document.getElementById('login-screen').style.display = 'none';
                document.querySelector('.user-info p').innerHTML = `<i class="fas fa-user-md"></i> ${data.nombre}`;
            }
        });
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            usuarioActual = null; document.getElementById('loginPin').value = ''; 
            document.getElementById('login-screen').style.display = 'flex'; 
        });
    }

    // ==========================================
    // 3. DASHBOARD Y NOTIFICACIONES
    // ==========================================
    async function actualizarDashboardYNotificaciones() {
        if (!window.supabaseCliente) return;
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);

        const { data: citasHoy } = await window.supabaseCliente.from('citas').select('id').gte('fecha_hora', hoy.toISOString()).lt('fecha_hora', manana.toISOString());
        if (citasHoy) {
            const contadorCitas = document.getElementById('count-citas-hoy');
            if(contadorCitas) contadorCitas.innerText = citasHoy.length;
            const badge = document.querySelector('.badge');
            if (badge) { badge.innerText = citasHoy.length; badge.style.display = citasHoy.length === 0 ? 'none' : 'inline-block'; }
        }

        const { data: pacientesHoy } = await window.supabaseCliente.from('pacientes').select('id').gte('fecha_registro', hoy.toISOString()).lt('fecha_registro', manana.toISOString());
        if (pacientesHoy) {
            const contadorPacientes = document.getElementById('count-pacientes-nuevos');
            if(contadorPacientes) contadorPacientes.innerText = pacientesHoy.length;
        }
    }

    // ==========================================
    // 4. REGISTRO DE PACIENTE
    // ==========================================
    const formPaciente = document.getElementById('formNuevoPaciente');
    if (formPaciente) {
        formPaciente.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            if(!window.supabaseCliente || !usuarioActual) return alert("Debes iniciar sesión.");

            const btnSubmit = formPaciente.querySelector('button');
            btnSubmit.innerText = 'Guardando...'; btnSubmit.disabled = true;

            const getCheckboxes = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value).join(', ');

            const datosPaciente = {
                nombre_completo: document.getElementById('nombrePaciente').value, edad: parseInt(document.getElementById('edadPaciente').value),
                telefono_emergencia: document.getElementById('telEmergencia').value, antecedentes_personales: getCheckboxes('ant_personal'),
                antecedentes_familiares: document.getElementById('antFamiliares').value, pruebas_reflejos: getCheckboxes('reflejos'),
                sensibilidad: getCheckboxes('sensibilidad'), tipo_marcha: document.getElementById('tipoMarcha').value,
                goniometria: document.getElementById('goniometria').value, nivel_dolor: parseInt(document.getElementById('nivelDolor').value),
                mapa_dolor: document.getElementById('zonasDolor').value, servicio_contratado: document.getElementById('servicioContratado').value,
                observaciones_medicas: document.getElementById('notasTerapeuticas').value, creado_por_id: usuarioActual.id 
            };

            const { error } = await window.supabaseCliente.from('pacientes').insert([datosPaciente]);
            if (error) alert('Error: ' + error.message);
            else {
                alert('¡Expediente registrado!'); formPaciente.reset(); document.getElementById('valorDolor').innerText = '0';
                actualizarDashboardYNotificaciones(); document.getElementById('menu-agenda').click();
            }
            btnSubmit.innerText = 'Guardar Expediente y Agendar'; btnSubmit.disabled = false;
        });
    }

    // ==========================================
    // 5. DIRECTORIO, AGENDA Y CALENDARIO
    // ==========================================
    let calendarioFisio; 
    let listaGlobalPacientes = [];

    // Descarga e inyecta a los pacientes en los Selects y en el Modal del Directorio
    async function cargarPacientesGlobales() {
        if(!window.supabaseCliente) return;
        const { data } = await window.supabaseCliente.from('pacientes').select('id, nombre_completo').order('nombre_completo', { ascending: true }); 
        if (data) {
            listaGlobalPacientes = data;
            
            // Llenar Selects
            const selectA = document.getElementById('selectPacienteAgenda');
            const selectV = document.getElementById('selectPacienteValoracion');
            if(selectA) selectA.innerHTML = '<option value="">-- Seleccione un paciente --</option>';
            if(selectV) selectV.innerHTML = '<option value="">-- Seleccione un paciente --</option>';
            
            // Llenar Ventana Flotante del Directorio
            const contenedorDir = document.getElementById('listaCompletaPacientes');
            if(contenedorDir) contenedorDir.innerHTML = '';

            data.forEach(p => {
                const optA = document.createElement('option'); optA.value = p.id; optA.textContent = p.nombre_completo;
                if(selectA) selectA.appendChild(optA);
                
                const optV = document.createElement('option'); optV.value = p.id; optV.textContent = p.nombre_completo;
                if(selectV) selectV.appendChild(optV);

                // Agregar al directorio flotante con sus dos botones
                if(contenedorDir) {
                    contenedorDir.innerHTML += `
                        <div class="paciente-item">
                            <span style="font-weight:bold; color:#333; font-size:1.1rem;">${p.nombre_completo}</span>
                            <div style="display:flex; gap:10px;">
                                <button onclick="accionDirectorio('${p.id}', 'agenda')" style="background:var(--primary-color); color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer;"><i class="fas fa-calendar-plus"></i> Agendar</button>
                                <button onclick="accionDirectorio('${p.id}', 'valoracion')" style="background:#28a745; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer;"><i class="fas fa-folder-open"></i> Expediente</button>
                            </div>
                        </div>
                    `;
                }
            });
        }
    }

    function renderizarCalendario() {
        const calendarEl = document.getElementById('calendarioGoogle');
        if (!calendarEl) return;
        if (calendarioFisio) { calendarioFisio.render(); return; }

        calendarioFisio = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek', locale: 'es', 
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
            slotMinTime: '07:00:00', slotMaxTime: '21:00:00', allDaySlot: false,
            events: async function(info, successCallback, failureCallback) {
                if(!window.supabaseCliente) return failureCallback('Sin BD');
                const { data, error } = await window.supabaseCliente.from('citas')
                    .select('id, fecha_hora, fecha_fin, evolucion, paciente_id, estado, pacientes(nombre_completo)')
                    .gte('fecha_hora', info.startStr).lt('fecha_hora', info.endStr);
                if (error) failureCallback(error);
                else {
                    const eventos = data.map(cita => ({
                        id: cita.id, title: (cita.pacientes ? cita.pacientes.nombre_completo : '') + (cita.estado === 'listo' ? ' ✔' : ''),
                        start: cita.fecha_hora, end: cita.fecha_fin || cita.fecha_hora, 
                        backgroundColor: cita.estado === 'listo' ? '#28a745' : '#1f73b3', borderColor: cita.estado === 'listo' ? '#28a745' : '#1f73b3',
                        extendedProps: { paciente_id: cita.paciente_id } 
                    }));
                    successCallback(eventos);
                }
            },
            eventClick: async function(info) {
                const pacienteId = info.event.extendedProps.paciente_id;
                if(pacienteId) {
                    document.getElementById('menu-valoraciones').click(); 
                    await cargarPacientesGlobales(); 
                    const selectVal = document.getElementById('selectPacienteValoracion');
                    selectVal.value = pacienteId; selectVal.dispatchEvent(new Event('change')); 
                }
            }
        });
        calendarioFisio.render();
    }

    const formAgendarCita = document.getElementById('formAgendarCita');
    if (formAgendarCita) {
        formAgendarCita.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!window.supabaseCliente || !usuarioActual) return alert("Debes iniciar sesión.");

            const pacienteId = document.getElementById('selectPacienteAgenda').value;
            const tipoCita = document.getElementById('tipoCitaAgenda').value;
            const notas = document.getElementById('notasCita').value; 
            const fechaInicio = new Date(document.getElementById('fechaHoraCita').value).toISOString();
            const fechaFin = new Date(document.getElementById('fechaHoraFinCita').value).toISOString();

            if (!pacienteId || !tipoCita) return alert("Complete los campos obligatorios.");
            if (new Date(fechaFin) <= new Date(fechaInicio)) return alert("La hora de fin debe ser mayor a la de inicio.");

            const btnSubmit = formAgendarCita.querySelector('button'); btnSubmit.innerText = 'Agendando...'; btnSubmit.disabled = true;

            const { error } = await window.supabaseCliente.from('citas').insert([{ 
                paciente_id: pacienteId, tipo_cita: tipoCita, fecha_hora: fechaInicio, fecha_fin: fechaFin, 
                evolucion: notas, estado: 'pendiente', creado_por_id: usuarioActual.id 
            }]);

            if (!error) {
                alert('¡Cita agendada!'); formAgendarCita.reset(); actualizarDashboardYNotificaciones();
                if(calendarioFisio) calendarioFisio.refetchEvents(); 
            } else alert('Error: ' + error.message);
            btnSubmit.innerText = 'Agendar en Calendario'; btnSubmit.disabled = false;
        });
    }

    // ==========================================
    // 6. VALORACIONES Y GESTIÓN
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
                document.getElementById('expEdad').innerText = paciente.edad;
                
                let antecedentesTexto = "";
                if(paciente.antecedentes_personales) antecedentesTexto += `Personales: ${paciente.antecedentes_personales} <br>`;
                if(paciente.antecedentes_familiares) antecedentesTexto += `Familiares: ${paciente.antecedentes_familiares} <br>`;
                
                document.getElementById('expAntecedentes').innerHTML = antecedentesTexto || 'Ninguno registrado';
                document.getElementById('expValoracion').innerText = paciente.observaciones_medicas || 'Ninguna registrada';
                contenedorExpediente.style.display = 'block';
            }

            if(listaCitas) listaCitas.innerHTML = '<p>Cargando historial...</p>'; 
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

                    const nombreFisio = cita.staff ? cita.staff.nombre : 'Desconocido';
                    const colorBorde = cita.estado === 'listo' ? '#28a745' : 'var(--primary-color)';
                    const estadoTexto = cita.estado === 'listo' ? 'LISTO ✔' : 'PENDIENTE ⏳';
                    
                    listaCitas.innerHTML += `
                        <div style="background: var(--background); padding: 15px; margin-bottom: 15px; border-left: 4px solid ${colorBorde}; border-radius: 4px; position: relative;">
                            <button onclick="eliminarCitaBD('${cita.id}')" style="position: absolute; top: 15px; right: 15px; background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"><i class="fas fa-trash"></i> Eliminar</button>
                            <div style="margin-bottom: 10px; padding-right: 80px;"><span style="color:#666; font-size: 0.85rem;">Fisio: <strong>${nombreFisio}</strong> | Servicio: <strong>${cita.tipo_cita || 'No especificado'}</strong></span></div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                                <div><label style="font-size: 0.8rem; font-weight: bold;">Inicio:</label><input type="datetime-local" id="inicio-${cita.id}" value="${valorInicio}" style="width: 100%; padding: 5px; font-size: 0.9rem; border: 1px solid #ccc; border-radius: 3px;"></div>
                                <div><label style="font-size: 0.8rem; font-weight: bold;">Fin:</label><input type="datetime-local" id="fin-${cita.id}" value="${valorFin}" style="width: 100%; padding: 5px; font-size: 0.9rem; border: 1px solid #ccc; border-radius: 3px;"></div>
                            </div>
                            <label style="display:block; margin-top:10px; font-weight:bold; font-size: 0.9rem;">Notas / Evolución:</label>
                            <textarea id="nota-${cita.id}" rows="2" style="width:100%; padding:8px; margin-top:5px; border:1px solid #ccc; border-radius:4px;">${cita.evolucion || ''}</textarea>
                            <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <strong style="color: ${colorBorde}; font-size: 0.9rem; width: 100px;">${estadoTexto}</strong>
                                <button onclick="actualizarCitaBD('${cita.id}', 'pendiente')" style="padding: 6px 12px; cursor:pointer; font-size:0.85rem; border: 1px solid #ccc; background: white; border-radius: 4px;">Guardar (Pendiente)</button>
                                <button onclick="actualizarCitaBD('${cita.id}', 'listo')" style="padding: 6px 12px; cursor:pointer; background: #28a745; color:white; border:none; border-radius:4px; font-size:0.85rem;">Guardar y Marcar Listo</button>
                            </div>
                        </div>
                    `;
                });
            } else if (listaCitas) { listaCitas.innerHTML = '<p style="color:#666; font-style:italic;">No hay citas registradas para este paciente.</p>'; }
        });
    }

    // ==========================================
    // 7. CONTROLES DE LA VENTANA FLOTANTE (MODAL)
    // ==========================================
    const modalDirectorio = document.getElementById('modal-directorio');
    const btnCerrarDirectorio = document.getElementById('btnCerrarDirectorio');
    
    // Abre el modal desde los botones azules
    window.abrirDirectorio = function() {
        if(modalDirectorio) modalDirectorio.style.display = 'flex';
        cargarPacientesGlobales(); // Refresca la lista
    };

    // Cierra el modal desde la 'X'
    if(btnCerrarDirectorio) {
        btnCerrarDirectorio.addEventListener('click', (e) => {
            e.preventDefault();
            modalDirectorio.style.display = 'none';
        });
    }

    // Acción al presionar "Agendar" o "Expediente" adentro del modal
    window.accionDirectorio = async function(pacienteId, destino) {
        modalDirectorio.style.display = 'none'; // Oculta el modal
        
        if(destino === 'agenda') {
            document.getElementById('menu-agenda').click();
            document.getElementById('selectPacienteAgenda').value = pacienteId;
        } else if (destino === 'valoracion') {
            document.getElementById('menu-valoraciones').click();
            await cargarPacientesGlobales(); 
            const selectVal = document.getElementById('selectPacienteValoracion');
            selectVal.value = pacienteId;
            selectVal.dispatchEvent(new Event('change')); // Fuerza que aparezca el historial
        }
    };
}); 

// Funciones globales para citas
window.actualizarCitaBD = async function(citaId, nuevoEstado) {
    if(!window.supabaseCliente) return alert("Error");
    const nuevaNota = document.getElementById(`nota-${citaId}`).value;
    const nuevaFechaInicio = new Date(document.getElementById(`inicio-${citaId}`).value).toISOString();
    const nuevaFechaFin = new Date(document.getElementById(`fin-${citaId}`).value).toISOString();
    if (new Date(nuevaFechaFin) <= new Date(nuevaFechaInicio)) return alert("Error: Fin debe ser mayor al inicio.");

    const { error } = await window.supabaseCliente.from('citas').update({ estado: nuevoEstado, evolucion: nuevaNota, fecha_hora: nuevaFechaInicio, fecha_fin: nuevaFechaFin }).eq('id', citaId);
    if (error) alert("Error: " + error.message);
    else { alert("¡Actualizado!"); document.getElementById('selectPacienteValoracion').dispatchEvent(new Event('change')); if(typeof calendarioFisio !== 'undefined' && calendarioFisio) calendarioFisio.refetchEvents(); }
};

window.eliminarCitaBD = async function(citaId) {
    if(!window.supabaseCliente) return alert("Error");
    if(!confirm("¿Seguro que deseas ELIMINAR la cita?")) return;
    const { error } = await window.supabaseCliente.from('citas').delete().eq('id', citaId);
    if (error) alert("Error: " + error.message);
    else { alert("Eliminada"); document.getElementById('selectPacienteValoracion').dispatchEvent(new Event('change')); if(typeof calendarioFisio !== 'undefined' && calendarioFisio) calendarioFisio.refetchEvents(); }
};
