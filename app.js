// Esperar a que el HTML cargue completamente
document.addEventListener('DOMContentLoaded', () => {
    
    let usuarioActual = null; // Aquí guardaremos quién inició sesión

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
            e.preventDefault();
            ocultarTodo();
            limpiarMenu();
            btnInicio.classList.add('active');
            if (seccionDashboard) {
                seccionDashboard.style.display = 'block';
                actualizarDashboardYNotificaciones();
            }
        });
    }

    if (btnPacientes) {
        btnPacientes.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            limpiarMenu();
            btnPacientes.classList.add('active');
            if (seccionRegistro) seccionRegistro.style.display = 'block';
        });
    }

    if (btnAgenda) {
        btnAgenda.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            limpiarMenu();
            btnAgenda.classList.add('active');
            if (seccionAgenda) {
                seccionAgenda.style.display = 'block';
                if (window.supabaseCliente) {
                    cargarPacientesEnAgenda();
                    cargarCitasProximas();
                }
            }
        });
    }

    if (btnValoraciones) {
        btnValoraciones.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            limpiarMenu();
            btnValoraciones.classList.add('active');
            if (seccionValoraciones) {
                seccionValoraciones.style.display = 'block';
                if (window.supabaseCliente) cargarPacientesEnValoraciones();
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
    } catch (error) {
        console.error("Error al conectar con Supabase:", error);
    }

    async function cargarUsuariosLogin() {
        if (!window.supabaseCliente) return;
        const selectLogin = document.getElementById('loginUsuario');
        if (!selectLogin) return;

        console.log("Intentando descargar usuarios desde Supabase...");
        const { data, error } = await window.supabaseCliente.from('staff').select('id, nombre, rol');
        
        if (error) {
            console.error("Supabase rechazó la lectura de la tabla staff:", error);
            return;
        }

        console.log("Usuarios encontrados:", data);
        selectLogin.innerHTML = '<option value="">-- Selecciona tu usuario --</option>';
        
        data.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nombre} (${user.rol})`;
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

            const { data, error } = await window.supabaseCliente
                .from('staff')
                .select('id, nombre, rol')
                .eq('id', userId)
                .eq('pin', pinIngresado)
                .single(); 

            if (error || !data) {
                msjError.style.display = 'block'; 
            } else {
                msjError.style.display = 'none';
                usuarioActual = data; 
                
                document.getElementById('login-screen').style.display = 'none';
                
                const userInfoIcon = document.querySelector('.user-info p');
                if(userInfoIcon) userInfoIcon.innerHTML = `<i class="fas fa-user-md"></i> ${data.nombre}`;
            }
        });
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            usuarioActual = null;
            document.getElementById('loginPin').value = ''; 
            document.getElementById('login-screen').style.display = 'flex'; 
        });
    }

    // ==========================================
    // 3. DASHBOARD
    // ==========================================
    async function actualizarDashboardYNotificaciones() {
        if (!window.supabaseCliente) return;
        
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const hoyISO = hoy.toISOString();
        const mananaISO = manana.toISOString();

        const { data: citasHoy, error: errorC } = await window.supabaseCliente
            .from('citas').select('id').gte('fecha_hora', hoyISO).lt('fecha_hora', mananaISO);

        if (!errorC && citasHoy) {
            const contadorCitas = document.getElementById('count-citas-hoy');
            if(contadorCitas) contadorCitas.innerText = citasHoy.length;

            const badge = document.querySelector('.badge');
            if (badge) {
                badge.innerText = citasHoy.length; 
                badge.style.display = citasHoy.length === 0 ? 'none' : 'inline-block';
            }
        }

        const { data: pacientesHoy, error: errorP } = await window.supabaseCliente
            .from('pacientes').select('id').gte('fecha_registro', hoyISO).lt('fecha_registro', mananaISO);

        if (!errorP && pacientesHoy) {
            const contadorPacientes = document.getElementById('count-pacientes-nuevos');
            if(contadorPacientes) contadorPacientes.innerText = pacientesHoy.length;
        }
    }

    // ==========================================
    // 4. REGISTRAR PACIENTE
    // ==========================================
    const formPaciente = document.getElementById('formNuevoPaciente');
    if (formPaciente) {
        formPaciente.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            if(!window.supabaseCliente) return alert("Error de conexión a la BD");
            if(!usuarioActual) return alert("Debes iniciar sesión para registrar.");

            const nombre = document.getElementById('nombrePaciente').value;
            const edad = parseInt(document.getElementById('edadPaciente').value);
            const detalles = document.getElementById('detallesClinicos').value;
            const valoracion = document.getElementById('valoracionInicial').value;

            const btnSubmit = formPaciente.querySelector('button');
            btnSubmit.innerText = 'Guardando...';
            btnSubmit.disabled = true;

            const { data, error } = await window.supabaseCliente
                .from('pacientes')
                .insert([{ 
                    nombre_completo: nombre, 
                    edad: edad, 
                    detalles_clinicos: detalles, 
                    valoracion_inicial: valoracion,
                    creado_por_id: usuarioActual.id // Guarda quién lo registró
                }]);

            if (error) {
                alert('Hubo un error al registrar: ' + error.message);
            } else {
                alert('¡Paciente registrado con éxito!');
                formPaciente.reset();
                actualizarDashboardYNotificaciones(); 
                
                ocultarTodo();
                limpiarMenu();
                if(btnAgenda) btnAgenda.classList.add('active');
                if(seccionAgenda) {
                    seccionAgenda.style.display = 'block';
                    cargarPacientesEnAgenda(); 
                }
            }
            btnSubmit.innerText = 'Guardar Paciente y Agendar Cita';
            btnSubmit.disabled = false;
        });
    }

    // ==========================================
    // 5. AGENDA
    // ==========================================
    async function cargarPacientesEnAgenda() {
        if(!window.supabaseCliente) return;
        const select = document.getElementById('selectPacienteAgenda');
        if (!select) return; 

        select.innerHTML = '<option value="">-- Seleccione un paciente --</option>';

        const { data, error } = await window.supabaseCliente
            .from('pacientes').select('id, nombre_completo').order('nombre_completo', { ascending: true }); 
        if (error) return;

        data.forEach(paciente => {
            const option = document.createElement('option');
            option.value = paciente.id;
            option.textContent = paciente.nombre_completo;
            select.appendChild(option);
        });
    }

    async function cargarCitasProximas() {
        if(!window.supabaseCliente) return;
        const listaCitas = document.getElementById('listaCitas');
        if (!listaCitas) return;
        
        listaCitas.innerHTML = '<p style="color: #666; font-style: italic;">Cargando citas...</p>';

        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
        const { data, error } = await window.supabaseCliente
            .from('citas')
            .select(`id, fecha_hora, evolucion, pacientes ( nombre_completo )`)
            .gte('fecha_hora', hoy.toISOString())
            .order('fecha_hora', { ascending: true }); 

        listaCitas.innerHTML = ''; 

        if (error || !data || data.length === 0) {
            listaCitas.innerHTML = '<p style="color: #666; font-style: italic;">No hay citas próximas agendadas.</p>';
            return;
        }

        data.forEach(cita => {
            const fechaObj = new Date(cita.fecha_hora);
            const fechaFormateada = fechaObj.toLocaleString('es-MX', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            const nombrePaciente = cita.pacientes ? cita.pacientes.nombre_completo : 'Paciente Desconocido';

            listaCitas.innerHTML += `
                <div style="padding: 10px; border-left: 4px solid var(--primary-color); background: var(--background); margin-bottom: 10px; border-radius: 4px;">
                    <strong>${nombrePaciente}</strong> - <span style="color: var(--primary-color);">${fechaFormateada}</span><br>
                    <small>${cita.evolucion || 'Sin notas'}</small>
                </div>
            `;
        });
    }

    const formAgendarCita = document.getElementById('formAgendarCita');
    if (formAgendarCita) {
        formAgendarCita.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!window.supabaseCliente) return;
            if(!usuarioActual) return alert("Debes iniciar sesión para agendar.");

            const pacienteId = document.getElementById('selectPacienteAgenda').value;
            const fechaHora = document.getElementById('fechaHoraCita').value;
            const notas = document.getElementById('notasCita').value; 

            if (!pacienteId) return alert("Seleccione un paciente.");

            const btnSubmit = formAgendarCita.querySelector('button');
            btnSubmit.innerText = 'Agendando...';
            btnSubmit.disabled = true;

            const { error } = await window.supabaseCliente
                .from('citas')
                .insert([{ 
                    paciente_id: pacienteId, 
                    fecha_hora: fechaHora, 
                    evolucion: notas, 
                    estado: 'pendiente',
                    creado_por_id: usuarioActual.id // Guarda quién agendó
                }]);

            if (!error) {
                alert('¡Cita agendada con éxito!');
                formAgendarCita.reset();
                actualizarDashboardYNotificaciones();
                cargarCitasProximas(); 
            }
            btnSubmit.innerText = 'Agendar';
            btnSubmit.disabled = false;
        });
    }

    // ==========================================
    // 6. VALORACIONES
    // ==========================================
    async function cargarPacientesEnValoraciones() {
        if(!window.supabaseCliente) return;
        const select = document.getElementById('selectPacienteValoracion');
        if (!select) return; 

        select.innerHTML = '<option value="">-- Seleccione un paciente --</option>';
        const { data, error } = await window.supabaseCliente.from('pacientes').select('id, nombre_completo').order('nombre_completo', { ascending: true }); 
        if (error) return;

        data.forEach(paciente => {
            const option = document.createElement('option');
            option.value = paciente.id;
            option.textContent = paciente.nombre_completo;
            select.appendChild(option);
        });
    }

    const selectPacienteValoracion = document.getElementById('selectPacienteValoracion');
    if (selectPacienteValoracion) {
        selectPacienteValoracion.addEventListener('change', async (e) => {
            const pacienteId = e.target.value;
            const contenedorExpediente = document.getElementById('expedientePaciente');
            const listaCitas = document.getElementById('listaHistorialCitas');
            
            if (!pacienteId) {
                if(contenedorExpediente) contenedorExpediente.style.display = 'none';
                return;
            }

            const { data: paciente, error: errorP } = await window.supabaseCliente
                .from('pacientes').select('*').eq('id', pacienteId).single();

            if (paciente && contenedorExpediente) {
                document.getElementById('expNombre').innerText = paciente.nombre_completo;
                document.getElementById('expEdad').innerText = paciente.edad;
                document.getElementById('expAntecedentes').innerText = paciente.detalles_clinicos || 'Ninguno registrado';
                document.getElementById('expValoracion').innerText = paciente.valoracion_inicial || 'Ninguna registrada';
                contenedorExpediente.style.display = 'block';
            }

            if(listaCitas) listaCitas.innerHTML = '<p>Cargando historial...</p>'; 
            
            // Unimos con la tabla staff para saber el nombre del Fisio
            const { data: citas, error: errorC } = await window.supabaseCliente
                .from('citas')
                .select('*, staff(nombre)')
                .eq('paciente_id', pacienteId)
                .order('fecha_hora', { ascending: false }); 

            if(listaCitas) listaCitas.innerHTML = ''; 

            if (citas && citas.length > 0 && listaCitas) {
                citas.forEach(cita => {
                    const fechaObj = new Date(cita.fecha_hora);
                    const fechaFormateada = fechaObj.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
                    const nombreFisio = cita.staff ? cita.staff.nombre : 'Desconocido';
                    
                    listaCitas.innerHTML += `
                        <div style="background: var(--background); padding: 15px; margin-bottom: 15px; border-left: 4px solid var(--primary-color); border-radius: 4px;">
                            <strong>Cita:</strong> ${fechaFormateada} <span style="float:right; color:#666; font-size: 0.85rem;">Fisio: ${nombreFisio}</span><br>
                            <strong>Evolución / Notas:</strong> ${cita.evolucion || 'Sin notas'} <br>
                            <small style="color: #666;"><strong>Estado:</strong> ${cita.estado.toUpperCase()}</small>
                        </div>
                    `;
                });
            } else if (listaCitas) {
                listaCitas.innerHTML = '<p style="color:#666; font-style:italic;">No hay citas registradas para este paciente.</p>';
            }
        });
    }

});
