// 1. Inicializar Supabase con tus credenciales
const supabaseUrl = 'https://kywususdtqcfpuivgtwy.supabase.co';
const supabaseKey = 'sb_publishable_LNEyYuxscWZVaXeGZQ-lkw_lgcpK1ic';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Esperar a que el HTML cargue completamente antes de ejecutar funciones
document.addEventListener('DOMContentLoaded', () => {

    // 2. Control de Navegación del Menú
    const seccionDashboard = document.getElementById('seccion-dashboard');
    const seccionRegistro = document.getElementById('seccion-registro');
    const seccionAgenda = document.getElementById('seccion-agenda');

    // Función para ocultar todas las secciones
    function ocultarTodo() {
        if (seccionDashboard) seccionDashboard.style.display = 'none';
        if (seccionRegistro) seccionRegistro.style.display = 'none';
        if (seccionAgenda) seccionAgenda.style.display = 'none';
    }

    // Eventos de los botones del menú (Con validación para evitar errores)
    const btnInicio = document.getElementById('menu-inicio');
    if (btnInicio) {
        btnInicio.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            seccionDashboard.style.display = 'block';
        });
    }

    const btnPacientes = document.getElementById('menu-pacientes');
    if (btnPacientes) {
        btnPacientes.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            seccionRegistro.style.display = 'block';
        });
    }

    const btnAgenda = document.getElementById('menu-agenda');
    if (btnAgenda) {
        btnAgenda.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            if (seccionAgenda) {
                seccionAgenda.style.display = 'block';
                cargarPacientesEnAgenda(); // Cargar la lista al abrir la agenda
            }
        });
    }

    const btnValoraciones = document.getElementById('menu-valoraciones');
    if (btnValoraciones) {
        btnValoraciones.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Módulo de valoraciones en construcción");
        });
    }

    // 3. Guardar Nuevo Paciente en Supabase
    const formPaciente = document.getElementById('formNuevoPaciente');
    if (formPaciente) {
        formPaciente.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evita que recargue la página

            // Obtener valores
            const nombre = document.getElementById('nombrePaciente').value;
            const edad = parseInt(document.getElementById('edadPaciente').value);
            const detalles = document.getElementById('detallesClinicos').value;
            const valoracion = document.getElementById('valoracionInicial').value;

            // Botón en estado de carga
            const btnSubmit = formPaciente.querySelector('button');
            btnSubmit.innerText = 'Guardando...';
            btnSubmit.disabled = true;

            // Enviar a Supabase
            const { data, error } = await supabase
                .from('pacientes')
                .insert([{ 
                    nombre_completo: nombre, 
                    edad: edad, 
                    detalles_clinicos: detalles, 
                    valoracion_inicial: valoracion 
                }])
                .select();

            if (error) {
                console.error('Error:', error);
                alert('Hubo un error al registrar: ' + error.message);
            } else {
                alert('¡Paciente registrado con éxito!');
                formPaciente.reset();
                
                // Mandarlo directo a la agenda después de guardar
                ocultarTodo();
                if(seccionAgenda) {
                    seccionAgenda.style.display = 'block';
                    cargarPacientesEnAgenda(); // Actualiza la lista para que aparezca el nuevo
                }
            }

            // Restaurar botón
            btnSubmit.innerText = 'Guardar Paciente y Agendar Cita';
            btnSubmit.disabled = false;
        });
    }

    // --- LÓGICA DE LA AGENDA ---

    // Función para cargar los pacientes en el Select de la agenda
    async function cargarPacientesEnAgenda() {
        const select = document.getElementById('selectPacienteAgenda');
        
        // Solo cargamos si el select existe en el HTML
        if (!select) return; 

        // Reiniciar el select
        select.innerHTML = '<option value="">-- Seleccione un paciente --</option>';

        // Consultar Supabase
        const { data, error } = await supabase
            .from('pacientes')
            .select('id, nombre_completo')
            .order('nombre_completo', { ascending: true }); // Ordenados alfabéticamente

        if (error) {
            console.error('Error al cargar pacientes:', error);
            return;
        }

        // Llenar el select con los datos
        data.forEach(paciente => {
            const option = document.createElement('option');
            option.value = paciente.id;
            option.textContent = paciente.nombre_completo;
            select.appendChild(option);
        });
    }

    // Guardar nueva cita en Supabase
    const formAgendarCita = document.getElementById('formAgendarCita');
    if (formAgendarCita) {
        formAgendarCita.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pacienteId = document.getElementById('selectPacienteAgenda').value;
            const fechaHora = document.getElementById('fechaHoraCita').value;
            const notas = document.getElementById('notasCita').value; 

            if (!pacienteId) {
                alert("Por favor seleccione un paciente.");
                return;
            }

            const btnSubmit = formAgendarCita.querySelector('button');
            btnSubmit.innerText = 'Agendando...';
            btnSubmit.disabled = true;

            const { error } = await supabase
                .from('citas')
                .insert([{
                    paciente_id: pacienteId,
                    fecha_hora: fechaHora,
                    evolucion: notas, 
                    estado: 'pendiente'
                }]);

            if (error) {
                console.error('Error al agendar:', error);
                alert('Error al agendar la cita.');
            } else {
                alert('¡Cita agendada con éxito!');
                formAgendarCita.reset();
            }

            btnSubmit.innerText = 'Agendar';
            btnSubmit.disabled = false;
        });
    }

}); // <-- FIN DEL DOMContentLoaded (Todo debe ir adentro)
