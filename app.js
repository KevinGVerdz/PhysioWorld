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

    const btnInicio = document.getElementById('menu-inicio');
    const btnPacientes = document.getElementById('menu-pacientes');
    const btnAgenda = document.getElementById('menu-agenda');
    const btnValoraciones = document.getElementById('menu-valoraciones');

    // Función para ocultar todas las secciones
    function ocultarTodo() {
        if (seccionDashboard) seccionDashboard.style.display = 'none';
        if (seccionRegistro) seccionRegistro.style.display = 'none';
        if (seccionAgenda) seccionAgenda.style.display = 'none';
    }

    // Función para quitar la clase 'active' de todos los botones
    function limpiarMenu() {
        if (btnInicio) btnInicio.classList.remove('active');
        if (btnPacientes) btnPacientes.classList.remove('active');
        if (btnAgenda) btnAgenda.classList.remove('active');
        if (btnValoraciones) btnValoraciones.classList.remove('active');
    }

    // Eventos de los botones del menú
    if (btnInicio) {
        btnInicio.addEventListener('click', (e) => {
            e.preventDefault();
            ocultarTodo();
            limpiarMenu();
            btnInicio.classList.add('active'); // Marca el botón como seleccionado
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
                cargarPacientesEnAgenda(); // Cargar la lista de la base de datos al abrir
            }
        });
    }

    if (btnValoraciones) {
        btnValoraciones.addEventListener('click', (e) => {
            e.preventDefault();
            limpiarMenu();
            btnValoraciones.classList.add('active');
            alert("Módulo de valoraciones en construcción");
        });
    }

    // 3. Guardar Nuevo Paciente en Supabase
    const formPaciente = document.getElementById('formNuevoPaciente');
    if (formPaciente) {
        formPaciente.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const nombre = document.getElementById('nombrePaciente').value;
            const edad = parseInt(document.getElementById('edadPaciente').value);
            const detalles = document.getElementById('detallesClinicos').value;
            const valoracion = document.getElementById('valoracionInicial').value;

            const btnSubmit = formPaciente.querySelector('button');
            btnSubmit.innerText = 'Guardando...';
            btnSubmit.disabled = true;

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
                
                // Manda a la agenda después de guardar
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

    // --- LÓGICA DE LA AGENDA ---

    async function cargarPacientesEnAgenda() {
        const select = document.getElementById('selectPacienteAgenda');
        if (!select) return; 

        select.innerHTML = '<option value="">-- Seleccione un paciente --</option>';

        const { data, error } = await supabase
            .from('pacientes')
            .select('id, nombre_completo')
            .order('nombre_completo', { ascending: true }); 

        if (error) {
            console.error('Error al cargar pacientes:', error);
            return;
        }

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

}); // <-- Fin del DOMContentLoaded
