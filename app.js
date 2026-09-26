// 1. Inicializar Supabase con tus credenciales
const supabaseUrl = 'https://kywususdtqcfpuivgtwy.supabase.co';
const supabaseKey = 'sb_publishable_LNEyYuxscWZVaXeGZQ-lkw_lgcpK1ic';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Control de Navegación del Menú
const seccionDashboard = document.getElementById('seccion-dashboard');
const seccionRegistro = document.getElementById('seccion-registro');
const seccionAgenda = document.getElementById('seccion-agenda'); // La crearemos en el paso 2

// Función para ocultar todas las secciones
function ocultarTodo() {
    seccionDashboard.style.display = 'none';
    seccionRegistro.style.display = 'none';
    if(seccionAgenda) seccionAgenda.style.display = 'none';
}

// Eventos de los botones del menú
document.getElementById('menu-inicio').addEventListener('click', (e) => {
    e.preventDefault();
    ocultarTodo();
    seccionDashboard.style.display = 'block';
});

document.getElementById('menu-pacientes').addEventListener('click', (e) => {
    e.preventDefault();
    ocultarTodo();
    seccionRegistro.style.display = 'block';
});

document.getElementById('menu-agenda').addEventListener('click', (e) => {
    e.preventDefault();
    ocultarTodo();
    if(seccionAgenda) seccionAgenda.style.display = 'block';
});

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
            
            // Opcional: Mandarlo directo a la agenda después de guardar
            ocultarTodo();
            if(seccionAgenda) seccionAgenda.style.display = 'block';
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

// Actualizar el evento del menú "Agenda" para que cargue los pacientes al hacer clic
document.getElementById('menu-agenda').addEventListener('click', (e) => {
    e.preventDefault();
    ocultarTodo();
    if(seccionAgenda) {
        seccionAgenda.style.display = 'block';
        cargarPacientesEnAgenda(); // <-- Llama a la función al abrir la sección
    }
});

// Guardar nueva cita en Supabase
const formAgendarCita = document.getElementById('formAgendarCita');

if (formAgendarCita) {
    formAgendarCita.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pacienteId = document.getElementById('selectPacienteAgenda').value;
        const fechaHora = document.getElementById('fechaHoraCita').value;
        // Por ahora guardamos las notas en 'evolucion', aunque estén pendientes
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
            // Aquí en el futuro llamaremos a una función para actualizar la "Lista de citas del día"
        }

        btnSubmit.innerText = 'Agendar';
        btnSubmit.disabled = false;
    });
}