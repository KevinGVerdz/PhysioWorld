// Esperar a que el HTML cargue completamente
document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. LÓGICA DE LA INTERFAZ (MENÚ Y NAVEGACIÓN)
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
            if (seccionDashboard) seccionDashboard.style.display = 'block';
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
                if (window.supabaseCliente) cargarPacientesEnAgenda();
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
    // 2. CONEXIÓN A SUPABASE Y BASE DE DATOS
    // ==========================================
    try {
        const supabaseUrl = 'https://kywususdtqcfpuivgtwy.supabase.co';
        const supabaseKey = 'sb_publishable_LNEyYuxscWZVaXeGZQ-lkw_lgcpK1ic';
        window.supabaseCliente = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // Cargar notificaciones al iniciar
        cargarNotificaciones();
    } catch (error) {
        console.error("Error al conectar con Supabase:", error);
    }

    // ==========================================
    // 3. CAMPANA DE NOTIFICACIONES (Citas de Hoy)
    // ==========================================
    async function cargarNotificaciones() {
        if (!window.supabaseCliente) return;
        
        // Calculamos la fecha de hoy para México
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        // Buscamos citas agendadas para el día de hoy
        const { data, error } = await window.supabaseCliente
            .from('citas')
            .select('id')
            .gte('fecha_hora', hoy.toISOString())
            .lt('fecha_hora', manana.toISOString())
            .eq('estado', 'pendiente');

        if (!error && data) {
            const badge = document.querySelector('.badge');
            if (badge) {
                badge.innerText = data.length; // Cambia el numerito de la campana
                if (data.length === 0) {
                    badge.style.display = 'none'; // Se oculta si no hay citas hoy
                } else {
                    badge.style.display = 'inline-block';
                }
            }
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

            const nombre = document.getElementById('nombrePaciente').value;
            const edad = parseInt(document.getElementById('edadPaciente').value);
            const detalles = document.getElementById('detallesClinicos').value;
            const valoracion = document.getElementById('valoracionInicial').value;

            const btnSubmit = formPaciente.querySelector('button');
            btnSubmit.innerText = 'Guardando...';
            btnSubmit.disabled = true;

            const { data, error } = await window.supabaseCliente
                .from('pacientes')
                .insert([{ nombre_completo: nombre, edad: edad, detalles_clinicos: detalles, valoracion_inicial: valoracion }]);

            if (error) {
                alert('Hubo un error al registrar: ' + error.message);
            } else {
                alert('¡Paciente registrado con éxito!');
                formPaciente.reset();
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
    // 5. CARGAR Y GUARDAR AGENDA
    // ==========================================
    async function cargarPacientesEnAgenda() {
        if(!window.supabaseCliente) return;
        const select = document.getElementById('selectPacienteAgenda');
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

    const formAgendarCita = document.getElementById('formAgendarCita');
    if (formAgendarCita) {
        formAgendarCita.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!window.supabaseCliente) return;

            const pacienteId = document.getElementById('selectPacienteAgenda').value;
            const fechaHora = document.getElementById('fechaHoraCita').value;
            const notas = document.getElementById('notasCita').value; 

            if (!pacienteId) return alert("Por favor seleccione un paciente.");

            const btnSubmit = formAgendarCita.querySelector('button');
            btnSubmit.innerText = 'Agendando...';
            btnSubmit.disabled = true;

            const { error } = await window.supabaseCliente
                .from('citas')
                .insert([{ paciente_id: pacienteId, fecha_hora: fechaHora, evolucion: notas, estado: 'pendiente' }]);

            if (!error) {
                alert('¡Cita agendada con éxito!');
                formAgendarCita.reset();
                cargarNotificaciones(); // Actualizamos la campanita
            }
            btnSubmit.innerText = 'Agendar';
            btnSubmit.disabled = false;
        });
    }

    // ==========================================
    // 6. VALORACIONES Y EXPEDIENTE CLÍNICO
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
            
            if (!pacienteId) {
                contenedorExpediente.style.display = 'none';
                return;
            }

            // Traer datos del paciente
            const { data: paciente, error: errorP } = await window.supabaseCliente
                .from('pacientes')
                .select('*')
                .eq('id', pacienteId)
                .single();

            if (paciente) {
                document.getElementById('expNombre').innerText = paciente.nombre_completo;
                document.getElementById('expEdad').innerText = paciente.edad;
                document.getElementById('expAntecedentes').innerText = paciente.detalles_clinicos || 'Ninguno registrado';
                document.getElementById('expValoracion').innerText = paciente.valoracion_inicial || 'Ninguna registrada';
                contenedorExpediente.style.display = 'block';
            }

            // Traer historial de citas de ese paciente
            const { data: citas, error: errorC } = await window.supabaseCliente
                .from('citas')
                .select('*')
                .eq('paciente_id', pacienteId)
                .order('fecha_hora', { ascending: false }); // Las más recientes arriba

            const listaCitas = document.getElementById('listaHistorialCitas');
            listaCitas.innerHTML = '';

            if (citas && citas.length > 0) {
                citas.forEach(cita => {
                    // Formatear la fecha para que se vea bonita
                    const fechaObj = new Date(cita.fecha_hora);
                    const fechaFormateada = fechaObj.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
                    
                    listaCitas.innerHTML += `
                        <div style="background: var(--background); padding: 15px; margin-bottom: 15px; border-left: 4px solid var(--primary-color); border-radius: 4px;">
                            <strong>Cita:</strong> ${fechaFormateada} <br>
                            <strong>Evolución / Notas:</strong> ${cita.evolucion || 'Sin notas'} <br>
                            <small style="color: #666;"><strong>Estado:</strong> ${cita.estado.toUpperCase()}</small>
                        </div>
                    `;
                });
            } else {
                listaCitas.innerHTML = '<p>No hay citas registradas para este paciente.</p>';
            }
        });
    }

}); // <-- Fin del DOMContentLoaded
