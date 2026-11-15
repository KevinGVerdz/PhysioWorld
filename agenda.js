/* =========================================================================
   PHYSIO WORLD - AGENDA ESTILO GOOGLE CALENDAR + RECORDATORIOS
   -------------------------------------------------------------------------
   - Vistas Día / Semana / Mes / Año / Programación / 4 días
   - Crear con clic o arrastrando sobre el calendario (creación rápida)
   - Arrastrar y redimensionar citas, con "Deshacer"
   - Mini calendario, filtros por servicio, búsqueda y atajos de teclado
   - Hora de término automática: 1 hora después del inicio por defecto
   - Notificaciones del navegador antes de que inicie cada cita
   ========================================================================= */
(function () {
    'use strict';

    // ------------------------------------------------------------------
    // CONSTANTES Y PREFERENCIAS
    // ------------------------------------------------------------------
    const SERVICIOS = [
        { valor: 'Valoración - $100', nombre: 'Valoración', precio: '$100', color: '#039be5' },
        { valor: 'Sesión - $450', nombre: 'Sesión', precio: '$450', color: '#3f51b5' },
        { valor: 'Paquete de 5 sesiones - $2000', nombre: 'Paquete 5 sesiones', precio: '$2,000', color: '#8e24aa' },
        { valor: 'Media Descarga - $400', nombre: 'Media Descarga', precio: '$400', color: '#f4511e' },
        { valor: 'Descarga Completa - $700', nombre: 'Descarga Completa', precio: '$700', color: '#0b8043' }
    ];
    const OTRO = { valor: '__otro__', nombre: 'Otros', precio: '', color: '#616161' };

    const DURACION_DEFAULT_MIN = 60;
    const TEMP_ID = '__nueva__';

    const OPCIONES_RECORDATORIO = [
        { v: -1, t: 'Sin notificación' },
        { v: 0, t: 'Al iniciar la cita' },
        { v: 5, t: '5 minutos antes' },
        { v: 10, t: '10 minutos antes' },
        { v: 15, t: '15 minutos antes' },
        { v: 30, t: '30 minutos antes' },
        { v: 60, t: '1 hora antes' },
        { v: 120, t: '2 horas antes' },
        { v: 1440, t: '1 día antes' }
    ];

    const VISTAS = [
        { id: 'timeGridDay', nombre: 'Día', tecla: 'D' },
        { id: 'timeGridWeek', nombre: 'Semana', tecla: 'W' },
        { id: 'dayGridMonth', nombre: 'Mes', tecla: 'M' },
        { id: 'multiMonthYear', nombre: 'Año', tecla: 'Y' },
        { id: 'listProgramacion', nombre: 'Programación', tecla: 'A' },
        { id: 'timeGridFourDay', nombre: '4 días', tecla: 'X' }
    ];

    const COLUMNAS_CITA = 'id, fecha_hora, fecha_fin, tipo_cita, evolucion, paciente_id, estado, creado_por_id, pacientes(nombre_completo, telefono_emergencia)';

    const LS_PREFS = 'physio_agenda_prefs';
    const LS_RECORDATORIOS = 'physio_recordatorios';
    const LS_AVISADAS = 'physio_avisos_enviados';

    function leerLS(clave, porDefecto) {
        try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto; }
        catch (e) { return porDefecto; }
    }
    function guardarLS(clave, valor) {
        try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* almacenamiento no disponible */ }
    }

    const prefs = Object.assign({
        vista: 'timeGridWeek',
        primerDia: 0,
        finesSemana: true,
        ocultos: [],
        mostrarCompletadas: true,
        recordatorio: 10,
        sonido: true,
        sidebar: true
    }, leerLS(LS_PREFS, {}));
    const guardarPrefs = () => guardarLS(LS_PREFS, prefs);

    // ------------------------------------------------------------------
    // UTILIDADES
    // ------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    const db = () => window.supabaseCliente;
    const app = () => window.PhysioApp || {};
    const usuario = () => (app().getUsuario ? app().getUsuario() : null);
    const pacientes = () => (app().getPacientes ? app().getPacientes() : []);
    const toast = (m, t) => { if (window.mostrarToast) window.mostrarToast(m, t); };

    const pad = (n) => String(n).padStart(2, '0');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const medianoche = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const sumarMin = (d, min) => new Date(d.getTime() + min * 60000);
    const aFechaInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const fmtHora = (d) => d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    const fmtFecha = (d) => cap(d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }));
    const fmtMesCorto = (d) => cap(d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''));

    // "7:00 – 8:00 a.m." (como Google: el sufijo sólo una vez si coincide)
    function fmtRangoCorto(a, b) {
        const ha = fmtHora(a), hb = fmtHora(b);
        const sufijo = (h) => (h.match(/\s?[ap]\.?\s?m\.?$/i) || [''])[0];
        const sa = sufijo(ha);
        if (sa && sa === sufijo(hb)) return `${ha.slice(0, -sa.length)} – ${hb}`;
        return `${ha} – ${hb}`;
    }

    function fmtDuracion(min) {
        if (min < 60) return `${min} min`;
        const h = Math.round((min / 60) * 100) / 100;
        return `${h} h`;
    }
    function fmtFaltan(min) {
        if (min <= 0) return 'ahora';
        if (min < 60) return `${min} min`;
        const h = Math.floor(min / 60), m = min % 60;
        return m ? `${h} h ${m} min` : `${h} h`;
    }

    function servicioDe(valor) { return SERVICIOS.find((s) => s.valor === valor) || null; }
    function infoServicio(valor) { return servicioDe(valor) || Object.assign({}, OTRO, { nombre: valor || 'Sin servicio' }); }
    function claveFiltro(valor) { return servicioDe(valor) ? valor : OTRO.valor; }

    function finDe(cita) {
        const ini = new Date(cita.fecha_hora);
        const fin = cita.fecha_fin ? new Date(cita.fecha_fin) : null;
        return fin && fin > ini ? fin : sumarMin(ini, DURACION_DEFAULT_MIN);
    }
    function nombrePaciente(cita) {
        if (cita.pacientes && cita.pacientes.nombre_completo) return cita.pacientes.nombre_completo;
        const p = pacientes().find((x) => String(x.id) === String(cita.paciente_id));
        return p ? p.nombre_completo : 'Paciente';
    }
    function telefonoPaciente(cita) {
        const p = pacientes().find((x) => String(x.id) === String(cita.paciente_id));
        return (cita.pacientes && cita.pacientes.telefono_emergencia) || (p && p.telefono_emergencia) || '';
    }

    // Recordatorio por cita (guardado en este navegador)
    function recordatorioDe(id) {
        const mapa = leerLS(LS_RECORDATORIOS, {});
        return Object.prototype.hasOwnProperty.call(mapa, id) ? mapa[id] : prefs.recordatorio;
    }
    function fijarRecordatorio(id, minutos) {
        const mapa = leerLS(LS_RECORDATORIOS, {});
        if (minutos === prefs.recordatorio) delete mapa[id]; else mapa[id] = minutos;
        guardarLS(LS_RECORDATORIOS, mapa);
    }
    function textoRecordatorio(min) {
        const op = OPCIONES_RECORDATORIO.find((o) => o.v === min);
        return op ? op.t : `${min} minutos antes`;
    }

    // ------------------------------------------------------------------
    // ESTADO
    // ------------------------------------------------------------------
    let calendar = null;
    let mesMini = medianoche(new Date());
    let citaDetalle = null;      // cita mostrada en el popover de detalle
    let citaModal = null;        // cita editada en el modal (null = nueva)
    let tempEvento = null;       // evento temporal mientras se crea
    let pendienteAbrir = null;   // cita a abrir cuando cargue el calendario
    let editorRapido = null, editorModal = null;

    const agendaVisible = () => { const s = $('seccion-agenda'); return s && s.style.display !== 'none'; };

    // ------------------------------------------------------------------
    // EDITOR DE HORARIO (fecha + inicio + fin con duración, como Google)
    // ------------------------------------------------------------------
    function crearEditorHorario(fechaEl, inicioEl, finEl, alCambiar) {
        const st = { inicio: null, fin: null };

        const etiqueta = (m) => fmtHora(new Date(2000, 0, 1, 0, m));
        function llenar() {
            const base = medianoche(st.inicio);
            const iniMin = Math.round((st.inicio - base) / 60000);
            const finMin = Math.round((st.fin - base) / 60000);

            const inicios = [];
            for (let m = 0; m < 1440; m += 15) inicios.push(m);
            if (!inicios.includes(iniMin)) { inicios.push(iniMin); inicios.sort((a, b) => a - b); }
            inicioEl.innerHTML = inicios.map((m) => `<option value="${m}">${etiqueta(m)}</option>`).join('');
            inicioEl.value = String(iniMin);

            const fines = [];
            for (let m = iniMin + 15; m <= Math.max(1440, iniMin + 15); m += 15) fines.push(m);
            if (!fines.includes(finMin)) { fines.push(finMin); fines.sort((a, b) => a - b); }
            finEl.innerHTML = fines.map((m) => `<option value="${m}">${etiqueta(m % 1440)} (${fmtDuracion(m - iniMin)})</option>`).join('');
            finEl.value = String(finMin);

            fechaEl.value = aFechaInput(st.inicio);
        }

        function fijar(inicio, fin) {
            st.inicio = new Date(inicio);
            st.fin = fin && fin > inicio ? new Date(fin) : sumarMin(st.inicio, DURACION_DEFAULT_MIN);
            llenar();
        }

        fechaEl.addEventListener('change', () => {
            if (!fechaEl.value) return;
            const [y, mo, d] = fechaEl.value.split('-').map(Number);
            const dur = st.fin - st.inicio;
            const nuevo = new Date(y, mo - 1, d, st.inicio.getHours(), st.inicio.getMinutes());
            fijar(nuevo, new Date(nuevo.getTime() + dur));
            alCambiar && alCambiar();
        });
        // Al cambiar el inicio, el término se recorre solo conservando la duración (1 h por defecto)
        inicioEl.addEventListener('change', () => {
            const dur = (st.fin - st.inicio) || DURACION_DEFAULT_MIN * 60000;
            const nuevo = sumarMin(medianoche(st.inicio), Number(inicioEl.value));
            fijar(nuevo, new Date(nuevo.getTime() + dur));
            alCambiar && alCambiar();
        });
        finEl.addEventListener('change', () => {
            fijar(st.inicio, sumarMin(medianoche(st.inicio), Number(finEl.value)));
            alCambiar && alCambiar();
        });

        return { fijar, obtener: () => ({ inicio: new Date(st.inicio), fin: new Date(st.fin) }) };
    }

    // ------------------------------------------------------------------
    // SELECTORES COMPARTIDOS
    // ------------------------------------------------------------------
    function opcionesPacientes(seleccionado) {
        const lista = pacientes();
        let html = '<option value="">Agregar paciente</option>';
        html += lista.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre_completo)}</option>`).join('');
        return { html, valor: seleccionado ? String(seleccionado) : '' };
    }
    function llenarPacientes(sel, valor) {
        const { html } = opcionesPacientes(valor);
        sel.innerHTML = html;
        sel.value = valor ? String(valor) : '';
    }
    function llenarServicios(sel, valor) {
        let html = '<option value="">Seleccionar servicio</option>';
        html += SERVICIOS.map((s) => `<option value="${esc(s.valor)}">${esc(s.nombre)} — ${s.precio}</option>`).join('');
        if (valor && !servicioDe(valor)) html += `<option value="${esc(valor)}">${esc(valor)}</option>`;
        sel.innerHTML = html;
        sel.value = valor || '';
    }
    function llenarRecordatorios(sel, valor) {
        sel.innerHTML = OPCIONES_RECORDATORIO.map((o) => `<option value="${o.v}">${o.t}</option>`).join('');
        sel.value = String(valor);
    }
    function pintarColor(iconEl, servicio) {
        iconEl.style.color = servicio ? infoServicio(servicio).color : '#dadce0';
    }

    // ------------------------------------------------------------------
    // CALENDARIO
    // ------------------------------------------------------------------
    function citaVisible(cita) {
        if (prefs.ocultos.includes(claveFiltro(cita.tipo_cita))) return false;
        if (!prefs.mostrarCompletadas && cita.estado === 'listo') return false;
        return true;
    }

    function aEvento(cita) {
        const inicio = new Date(cita.fecha_hora);
        const fin = finDe(cita);
        const color = infoServicio(cita.tipo_cita).color;
        const clases = [];
        if (cita.estado === 'listo') clases.push('gcal-ev-done');
        if (fin < new Date()) clases.push('gcal-ev-past');
        return {
            id: String(cita.id),
            title: nombrePaciente(cita),
            start: inicio,
            end: fin,
            backgroundColor: color,
            borderColor: color,
            textColor: '#ffffff',
            classNames: clases,
            extendedProps: { cita }
        };
    }

    async function cargarEventos(info, exito, fallo) {
        if (!db()) return fallo(new Error('Sin conexión a la base de datos'));
        const { data, error } = await db().from('citas').select(COLUMNAS_CITA)
            .gte('fecha_hora', info.start.toISOString())
            .lt('fecha_hora', info.end.toISOString())
            .order('fecha_hora', { ascending: true });
        if (error) { toast('Error al cargar la agenda: ' + error.message, 'error'); return fallo(error); }
        exito((data || []).filter(citaVisible).map(aEvento));
    }

    function tituloVista(view) {
        const s = view.currentStart;
        const e = new Date(view.currentEnd.getTime() - 1);
        if (view.type === 'multiMonthYear') return String(s.getFullYear());
        if (view.type === 'timeGridDay') return cap(s.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }));
        if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
            return cap(`${s.toLocaleDateString('es-MX', { month: 'long' })} de ${s.getFullYear()}`);
        }
        if (s.getFullYear() === e.getFullYear()) return `${fmtMesCorto(s)} – ${fmtMesCorto(e)} ${s.getFullYear()}`;
        return `${fmtMesCorto(s)} ${s.getFullYear()} – ${fmtMesCorto(e)} ${e.getFullYear()}`;
    }

    const esMovil = () => window.innerWidth <= 768;
    function vistaInicial() {
        const v = VISTAS.some((x) => x.id === prefs.vista) ? prefs.vista : 'timeGridWeek';
        // En el celular la semana completa no cabe: se usa la vista de 4 días
        return esMovil() && v === 'timeGridWeek' ? 'timeGridFourDay' : v;
    }

    function iniciarCalendario() {
        const el = $('calendarioGoogle');
        if (!el || typeof FullCalendar === 'undefined') return;

        calendar = new FullCalendar.Calendar(el, {
            locale: 'es',
            initialView: vistaInicial(),
            headerToolbar: false,
            height: '100%',
            firstDay: prefs.primerDia,
            weekends: prefs.finesSemana,
            nowIndicator: true,
            navLinks: true,
            allDaySlot: false,
            editable: true,
            selectable: true,
            selectMirror: false,
            unselectAuto: true,
            dayMaxEvents: true,
            slotDuration: '00:30:00',
            snapDuration: '00:15:00',
            slotLabelInterval: '01:00',
            scrollTime: '07:00:00',
            scrollTimeReset: false,
            defaultTimedEventDuration: '01:00',
            forceEventDuration: true,
            eventTimeFormat: { hour: 'numeric', minute: '2-digit', hour12: true, meridiem: 'short' },
            slotLabelFormat: { hour: 'numeric', hour12: true, meridiem: 'short' },
            views: {
                timeGridFourDay: { type: 'timeGrid', duration: { days: 4 } },
                multiMonthYear: { multiMonthMaxColumns: 4, multiMonthMinWidth: 220 },
                listProgramacion: { type: 'list', duration: { days: 30 }, noEventsContent: 'No hay citas programadas en este periodo' }
            },
            events: cargarEventos,

            dayHeaderContent(arg) {
                if (arg.view.type.indexOf('timeGrid') === 0) {
                    const dia = arg.date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase();
                    return { html: `<div class="gcal-dh${arg.isToday ? ' is-today' : ''}"><span class="gcal-dh-dow">${dia}</span><span class="gcal-dh-num">${arg.date.getDate()}</span></div>` };
                }
                if (arg.view.type === 'dayGridMonth') {
                    return arg.date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase();
                }
                return arg.text;
            },

            eventContent(arg) {
                if (arg.view.type.indexOf('timeGrid') !== 0) return true; // render por defecto
                const ev = arg.event;
                const cita = ev.extendedProps.cita;
                const rango = ev.end ? fmtRangoCorto(ev.start, ev.end) : fmtHora(ev.start);
                const servicio = cita ? infoServicio(cita.tipo_cita).nombre : '';
                const check = cita && cita.estado === 'listo' ? '<i class="fas fa-check"></i> ' : '';
                return {
                    html: `<div class="gcal-ev">
                        <div class="gcal-ev-title">${check}${esc(ev.title || '(Sin paciente)')}</div>
                        <div class="gcal-ev-time">${rango}</div>
                        ${servicio ? `<div class="gcal-ev-sub">${esc(servicio)}</div>` : ''}
                    </div>`
                };
            },

            eventDidMount(info) {
                info.el.dataset.citaId = info.event.id;
                const cita = info.event.extendedProps.cita;
                if (cita) info.el.title = `${nombrePaciente(cita)} · ${infoServicio(cita.tipo_cita).nombre}\n${fmtHora(info.event.start)} – ${fmtHora(info.event.end)}`;
            },

            select(info) {
                if (!usuario()) { calendar.unselect(); return toast('Debes iniciar sesión', 'error'); }
                let inicio = info.start, fin = info.end;
                if (info.allDay) {
                    // Vista de mes / año: crea la cita a las 9:00 (o la siguiente hora si es hoy)
                    inicio = new Date(info.start);
                    const ahora = new Date();
                    if (mismoDia(inicio, ahora) && ahora.getHours() >= 9) inicio.setHours(ahora.getHours() + 1, 0, 0, 0);
                    else inicio.setHours(9, 0, 0, 0);
                    fin = sumarMin(inicio, DURACION_DEFAULT_MIN);
                } else if ((fin - inicio) / 60000 <= 30) {
                    // Un clic simple crea una cita de 1 hora (como Google Calendar)
                    fin = sumarMin(inicio, DURACION_DEFAULT_MIN);
                }
                calendar.unselect();
                abrirRapido({ inicio, fin, ancla: info.jsEvent ? puntoRect(info.jsEvent) : null });
            },

            eventClick(info) {
                info.jsEvent.preventDefault();
                if (info.event.id === TEMP_ID) return;
                abrirDetalle(info.event.extendedProps.cita, info.el.getBoundingClientRect());
            },

            eventDrop: moverEvento,
            eventResize: moverEvento,
            eventAllow: () => !!usuario(),

            datesSet(info) {
                $('gcalTitulo').textContent = tituloVista(info.view);
                const v = VISTAS.find((x) => x.id === info.view.type);
                $('gcalVistaTxt').textContent = v ? v.nombre : 'Vista';
                if (!esMovil() && prefs.vista !== info.view.type) { prefs.vista = info.view.type; guardarPrefs(); }
                const ref = calendar ? calendar.getDate() : info.view.currentStart;
                const refMes = info.view.type === 'multiMonthYear' || (ref >= info.view.currentStart && ref < info.view.currentEnd) ? ref : info.view.currentStart;
                mesMini = new Date(refMes.getFullYear(), refMes.getMonth(), 1);
                renderMini();
                renderMenuVistas();
            },

            eventsSet() {
                if (pendienteAbrir) intentarAbrirPendiente();
            }
        });

        calendar.render();
    }

    function puntoRect(ev) {
        return { left: ev.clientX, right: ev.clientX, top: ev.clientY, bottom: ev.clientY, width: 0, height: 0 };
    }

    async function moverEvento(info) {
        const ev = info.event;
        if (ev.id === TEMP_ID) {
            if (editorRapido) editorRapido.fijar(ev.start, ev.end);
            return;
        }
        if (!db() || !usuario()) { info.revert(); return toast('Debes iniciar sesión', 'error'); }
        const cita = ev.extendedProps.cita;
        const antes = { fecha_hora: cita.fecha_hora, fecha_fin: cita.fecha_fin };
        const fin = ev.end || sumarMin(ev.start, DURACION_DEFAULT_MIN);
        const ahora = { fecha_hora: ev.start.toISOString(), fecha_fin: fin.toISOString() };
        const { error } = await db().from('citas').update(ahora).eq('id', cita.id);
        if (error) { info.revert(); return toast('No se pudo mover la cita: ' + error.message, 'error'); }
        cerrarPopovers();
        despuesDeCambio();
        snackbar(info.oldEvent && info.oldEvent.end && ev.start.getTime() === info.oldEvent.start.getTime() ? 'Se cambió la duración de la cita' : 'Se reprogramó la cita', 'Deshacer', async () => {
            const r = await db().from('citas').update(antes).eq('id', cita.id);
            if (r.error) return toast('No se pudo deshacer: ' + r.error.message, 'error');
            despuesDeCambio();
        });
    }

    function despuesDeCambio() {
        if (calendar) calendar.refetchEvents();
        if (app().actualizarDashboard) app().actualizarDashboard();
        Recordatorios.recargar();
    }

    // ------------------------------------------------------------------
    // MINI CALENDARIO Y LISTA DE CALENDARIOS
    // ------------------------------------------------------------------
    function renderMini() {
        const cont = $('gcalMini');
        if (!cont) return;
        const hoy = new Date();
        const primero = new Date(mesMini.getFullYear(), mesMini.getMonth(), 1);
        const desfase = (primero.getDay() - prefs.primerDia + 7) % 7;
        const inicio = new Date(primero); inicio.setDate(1 - desfase);

        let rangoIni = null, rangoFin = null;
        if (calendar && calendar.view.type.indexOf('timeGrid') === 0) {
            rangoIni = calendar.view.currentStart; rangoFin = calendar.view.currentEnd;
        }
        const seleccionado = calendar ? calendar.getDate() : hoy;

        const letras = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(2023, 0, 1 + ((i + prefs.primerDia) % 7)); // 1 ene 2023 = domingo
            letras.push(d.toLocaleDateString('es-MX', { weekday: 'narrow' }).toUpperCase());
        }

        let dias = '';
        for (let i = 0; i < 42; i++) {
            const d = new Date(inicio); d.setDate(inicio.getDate() + i);
            const cls = ['gcal-mini-day'];
            if (d.getMonth() !== mesMini.getMonth()) cls.push('otro');
            if (mismoDia(d, hoy)) cls.push('hoy');
            else if (rangoIni && d >= rangoIni && d < rangoFin) cls.push('rango');
            else if (!rangoIni && mismoDia(d, seleccionado)) cls.push('sel');
            dias += `<button type="button" class="${cls.join(' ')}" data-fecha="${aFechaInput(d)}">${d.getDate()}</button>`;
        }

        cont.innerHTML = `
            <div class="gcal-mini-head">
                <span>${cap(mesMini.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))}</span>
                <div>
                    <button type="button" class="gcal-icon-btn xs" data-mini="-1" aria-label="Mes anterior"><i class="fas fa-chevron-left"></i></button>
                    <button type="button" class="gcal-icon-btn xs" data-mini="1" aria-label="Mes siguiente"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="gcal-mini-grid">
                ${letras.map((l) => `<span class="gcal-mini-dow">${l}</span>`).join('')}
                ${dias}
            </div>`;
    }

    function renderCalendariosSidebar() {
        const cont = $('gcalCalendarios');
        if (!cont) return;
        cont.innerHTML = SERVICIOS.concat([OTRO]).map((s) => `
            <label class="gcal-cal-item" style="--c:${s.color}">
                <input type="checkbox" data-filtro="${esc(s.valor)}" ${prefs.ocultos.includes(s.valor) ? '' : 'checked'}>
                <span>${esc(s.nombre)}</span>
            </label>`).join('');
        $('gcalMostrarCompletadas').checked = prefs.mostrarCompletadas;
    }

    function renderMenuVistas() {
        const menu = $('gcalVistaMenu');
        if (!menu) return;
        const actual = calendar ? calendar.view.type : prefs.vista;
        menu.innerHTML = VISTAS.map((v) => `
            <button type="button" class="gcal-menu-item${v.id === actual ? ' active' : ''}" data-vista="${v.id}">
                <span>${v.nombre}</span><kbd>${v.tecla}</kbd>
            </button>`).join('') + `
            <div class="gcal-menu-sep"></div>
            <label class="gcal-menu-item check"><input type="checkbox" data-opcion="finesSemana" ${prefs.finesSemana ? 'checked' : ''}> <span>Mostrar fines de semana</span></label>
            <label class="gcal-menu-item check"><input type="checkbox" data-opcion="mostrarCompletadas" ${prefs.mostrarCompletadas ? 'checked' : ''}> <span>Mostrar citas completadas</span></label>`;
    }

    function cambiarVista(id) {
        if (!calendar) return;
        calendar.changeView(id);
        cerrarMenus();
    }

    // ------------------------------------------------------------------
    // POPOVERS: POSICIONAMIENTO Y CIERRE
    // ------------------------------------------------------------------
    function posicionar(pop, rect) {
        pop.hidden = false;
        const vw = window.innerWidth, vh = window.innerHeight, m = 12;
        if (vw < 640) { pop.classList.add('sheet'); pop.style.left = ''; pop.style.top = ''; return; }
        pop.classList.remove('sheet');
        const w = pop.offsetWidth, h = pop.offsetHeight;
        let left, top;
        if (!rect) {
            left = (vw - w) / 2;
            top = Math.max(m, (vh - h) / 3);
        } else {
            left = rect.right + m;
            if (left + w > vw - m) left = rect.left - w - m;
            if (left < m) left = Math.min(vw - w - m, Math.max(m, rect.left + rect.width / 2 - w / 2));
            top = rect.top;
            if (top + h > vh - m) top = vh - h - m;
            if (top < m) top = m;
        }
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(top)}px`;
    }

    function quitarTemporal() {
        if (tempEvento) { tempEvento.remove(); tempEvento = null; }
    }

    function soltarFoco(contenedores) {
        const a = document.activeElement;
        if (a && a !== document.body && contenedores.some((id) => $(id).contains(a))) a.blur();
    }

    function cerrarPopovers() {
        soltarFoco(['gcalQuick', 'gcalDetalle']);
        $('gcalQuick').hidden = true;
        $('gcalDetalle').hidden = true;
        quitarTemporal();
        cerrarMenus();
    }
    function cerrarMenus() {
        document.querySelectorAll('.gcal-menu.open').forEach((m) => m.classList.remove('open'));
    }
    function cerrarModales() {
        soltarFoco(['gcalModal', 'gcalConfig', 'gcalAtajos']);
        ['gcalModal', 'gcalConfig', 'gcalAtajos'].forEach((id) => { $(id).hidden = true; });
        document.body.classList.remove('gcal-modal-abierto');
    }
    function abrirModalEl(id) {
        $(id).hidden = false;
        document.body.classList.add('gcal-modal-abierto');
    }
    const hayModalAbierto = () => ['gcalModal', 'gcalConfig', 'gcalAtajos'].some((id) => !$(id).hidden);

    // ------------------------------------------------------------------
    // CREACIÓN RÁPIDA
    // ------------------------------------------------------------------
    function siguienteHora() {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0);
        return d;
    }

    function actualizarTemporal() {
        if (!tempEvento) return;
        const { inicio, fin } = editorRapido.obtener();
        tempEvento.setDates(inicio, fin);
        const pid = $('qPaciente').value;
        const p = pacientes().find((x) => String(x.id) === pid);
        tempEvento.setProp('title', p ? p.nombre_completo : '(Sin paciente)');
        const color = $('qServicio').value ? infoServicio($('qServicio').value).color : '#039be5';
        tempEvento.setProp('backgroundColor', color);
        tempEvento.setProp('borderColor', color);
    }

    function abrirRapido({ inicio, fin, pacienteId = '', servicio = '', ancla = null }) {
        cerrarPopovers();
        if (!pacientes().length && app().cargarPacientesGlobales) app().cargarPacientesGlobales();

        llenarPacientes($('qPaciente'), pacienteId);
        if (!servicio && pacienteId) {
            const p = pacientes().find((x) => String(x.id) === String(pacienteId));
            servicio = p && p.servicio_contratado ? p.servicio_contratado : '';
        }
        llenarServicios($('qServicio'), servicio);
        pintarColor($('qColor'), servicio);
        llenarRecordatorios($('qRecordatorio'), prefs.recordatorio);
        $('qNotas').value = '';
        editorRapido.fijar(inicio, fin || sumarMin(inicio, DURACION_DEFAULT_MIN));

        if (calendar && agendaVisible()) {
            const r = editorRapido.obtener();
            tempEvento = calendar.addEvent({
                id: TEMP_ID, title: '(Sin paciente)', start: r.inicio, end: r.fin,
                classNames: ['gcal-ev-temp'], editable: true
            });
            actualizarTemporal();
        }

        requestAnimationFrame(() => {
            const el = document.querySelector('.fc .gcal-ev-temp');
            posicionar($('gcalQuick'), el ? el.getBoundingClientRect() : ancla);
            $('qPaciente').focus();
        });
    }

    function datosRapido() {
        const { inicio, fin } = editorRapido.obtener();
        return {
            id: null,
            pacienteId: $('qPaciente').value,
            servicio: $('qServicio').value,
            inicio, fin,
            notas: $('qNotas').value.trim(),
            estado: 'pendiente',
            recordatorio: Number($('qRecordatorio').value)
        };
    }

    // ------------------------------------------------------------------
    // GUARDAR / ELIMINAR
    // ------------------------------------------------------------------
    async function guardarCita(d) {
        if (!db() || !usuario()) { toast('Debes iniciar sesión', 'error'); return null; }
        if (!d.pacienteId) { toast('Selecciona un paciente', 'error'); return null; }
        if (!d.servicio) { toast('Selecciona el servicio a realizar', 'error'); return null; }
        if (d.fin <= d.inicio) { toast('La hora de término debe ser posterior al inicio', 'error'); return null; }

        const fila = {
            paciente_id: d.pacienteId,
            tipo_cita: d.servicio,
            fecha_hora: d.inicio.toISOString(),
            fecha_fin: d.fin.toISOString(),
            evolucion: d.notas,
            estado: d.estado || 'pendiente'
        };
        let res;
        if (d.id) {
            res = await db().from('citas').update(fila).eq('id', d.id).select().single();
        } else {
            fila.creado_por_id = usuario().id;
            res = await db().from('citas').insert([fila]).select().single();
        }
        if (res.error) { toast('Error: ' + res.error.message, 'error'); return null; }

        const id = res.data ? res.data.id : d.id;
        if (id != null) fijarRecordatorio(id, d.recordatorio);
        despuesDeCambio();
        snackbar(d.id ? 'Se guardó la cita' : `Se creó la cita · ${fmtFecha(d.inicio)}, ${fmtHora(d.inicio)}`);
        return res.data || true;
    }

    async function eliminarCita(cita) {
        if (!db() || !usuario()) return toast('Debes iniciar sesión', 'error');
        const { error } = await db().from('citas').delete().eq('id', cita.id);
        if (error) return toast('Error al eliminar: ' + error.message, 'error');
        cerrarPopovers();
        despuesDeCambio();
        const copia = {
            paciente_id: cita.paciente_id, tipo_cita: cita.tipo_cita, fecha_hora: cita.fecha_hora,
            fecha_fin: cita.fecha_fin, evolucion: cita.evolucion, estado: cita.estado, creado_por_id: cita.creado_por_id
        };
        const recordatorio = recordatorioDe(cita.id);
        snackbar('Se eliminó la cita', 'Deshacer', async () => {
            const r = await db().from('citas').insert([copia]).select().single();
            if (r.error) return toast('No se pudo restaurar: ' + r.error.message, 'error');
            if (r.data) fijarRecordatorio(r.data.id, recordatorio);
            despuesDeCambio();
        });
    }

    async function cambiarEstado(cita) {
        if (!db() || !usuario()) return toast('Debes iniciar sesión', 'error');
        const nuevo = cita.estado === 'listo' ? 'pendiente' : 'listo';
        const { error } = await db().from('citas').update({ estado: nuevo }).eq('id', cita.id);
        if (error) return toast('Error: ' + error.message, 'error');
        cerrarPopovers();
        despuesDeCambio();
        snackbar(nuevo === 'listo' ? 'Cita marcada como completada' : 'Cita marcada como pendiente', 'Deshacer', async () => {
            await db().from('citas').update({ estado: cita.estado }).eq('id', cita.id);
            despuesDeCambio();
        });
    }

    // ------------------------------------------------------------------
    // DETALLE DE CITA
    // ------------------------------------------------------------------
    function telefonoWhatsApp(tel) {
        const limpio = String(tel || '').replace(/\D/g, '');
        if (limpio.length === 10) return '52' + limpio;
        if (limpio.length >= 11) return limpio;
        return '';
    }

    function abrirDetalle(cita, rect) {
        if (!cita) return;
        cerrarPopovers();
        citaDetalle = cita;
        const ini = new Date(cita.fecha_hora), fin = finDe(cita);
        const srv = infoServicio(cita.tipo_cita);
        const listo = cita.estado === 'listo';
        const tel = telefonoPaciente(cita);
        const rec = recordatorioDe(cita.id);
        const fechaTxt = mismoDia(ini, fin)
            ? `${fmtFecha(ini)} · ${fmtHora(ini)} – ${fmtHora(fin)}`
            : `${fmtFecha(ini)}, ${fmtHora(ini)} – ${fmtFecha(fin)}, ${fmtHora(fin)}`;

        $('dCuerpo').innerHTML = `
            <div class="gcal-det-head">
                <span class="gcal-sq" style="background:${srv.color}"></span>
                <div>
                    <h3 class="${listo ? 'tachado' : ''}">${esc(nombrePaciente(cita))}</h3>
                    <p>${esc(fechaTxt)}</p>
                </div>
            </div>
            <div class="gcal-row"><i class="fas fa-tag"></i><div>${esc(srv.nombre)}${srv.precio ? ` <span class="gcal-muted">· ${srv.precio}</span>` : ''}</div></div>
            <div class="gcal-row"><i class="far fa-bell"></i><div>${esc(textoRecordatorio(rec))}</div></div>
            <div class="gcal-row"><i class="far fa-check-circle"></i><div>${listo ? '<span class="gcal-pill ok">Completada</span>' : '<span class="gcal-pill pend">Pendiente</span>'}</div></div>
            ${tel ? `<div class="gcal-row"><i class="fas fa-phone-alt"></i><div>${esc(tel)}</div></div>` : ''}
            ${cita.evolucion ? `<div class="gcal-row"><i class="fas fa-align-left"></i><div class="gcal-notas">${esc(cita.evolucion)}</div></div>` : ''}
            <div class="gcal-det-actions">
                <button type="button" class="gcal-outline-btn" data-acc="estado"><i class="fas ${listo ? 'fa-undo' : 'fa-check'}"></i> ${listo ? 'Marcar como pendiente' : 'Marcar como completada'}</button>
                <button type="button" class="gcal-outline-btn" data-acc="expediente"><i class="fas fa-folder-open"></i> Abrir expediente</button>
            </div>`;

        $('dMenuEstado').textContent = listo ? 'Marcar como pendiente' : 'Marcar como completada';
        const btnWa = document.querySelector('#gcalDetalle [data-acc="whatsapp"]');
        btnWa.disabled = !telefonoWhatsApp(tel);
        btnWa.title = btnWa.disabled ? 'El paciente no tiene teléfono registrado' : 'Enviar recordatorio por WhatsApp';
        posicionar($('gcalDetalle'), rect);
    }

    function accionDetalle(acc) {
        const cita = citaDetalle;
        if (!cita) return;
        switch (acc) {
            case 'editar': abrirModal({ cita }); break;
            case 'eliminar': eliminarCita(cita); break;
            case 'estado': cambiarEstado(cita); break;
            case 'duplicar': abrirModal({ cita, duplicar: true }); break;
            case 'expediente':
                cerrarPopovers();
                if (window.accionDirectorio) window.accionDirectorio(cita.paciente_id, 'valoracion');
                break;
            case 'whatsapp': {
                const numero = telefonoWhatsApp(telefonoPaciente(cita));
                if (!numero) return;
                const ini = new Date(cita.fecha_hora);
                const msj = `Hola ${nombrePaciente(cita)}, te recordamos tu cita de ${infoServicio(cita.tipo_cita).nombre} en Physio World el ${fmtFecha(ini).toLowerCase()} a las ${fmtHora(ini)}. ¡Te esperamos!`;
                window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msj)}`, '_blank', 'noopener');
                break;
            }
            case 'mas': $('dMasMenu').classList.toggle('open'); break;
        }
    }

    // ------------------------------------------------------------------
    // MODAL DE EDICIÓN COMPLETA
    // ------------------------------------------------------------------
    function abrirModal({ cita = null, duplicar = false, datos = null } = {}) {
        cerrarPopovers();
        citaModal = cita && !duplicar ? cita : null;

        let d = datos;
        if (!d && cita) {
            d = {
                pacienteId: cita.paciente_id, servicio: cita.tipo_cita,
                inicio: new Date(cita.fecha_hora), fin: finDe(cita),
                notas: duplicar ? '' : (cita.evolucion || ''),
                estado: duplicar ? 'pendiente' : (cita.estado || 'pendiente'),
                recordatorio: recordatorioDe(cita.id)
            };
        }
        if (!d) {
            const ini = siguienteHora();
            d = { pacienteId: '', servicio: '', inicio: ini, fin: sumarMin(ini, DURACION_DEFAULT_MIN), notas: '', estado: 'pendiente', recordatorio: prefs.recordatorio };
        }

        llenarPacientes($('mPaciente'), d.pacienteId);
        llenarServicios($('mServicio'), d.servicio);
        pintarColor($('mColor'), d.servicio);
        llenarRecordatorios($('mRecordatorio'), d.recordatorio);
        $('mEstado').value = d.estado === 'listo' ? 'listo' : 'pendiente';
        $('mNotas').value = d.notas || '';
        editorModal.fijar(d.inicio, d.fin);
        abrirModalEl('gcalModal');
        setTimeout(() => $('mPaciente').focus(), 50);
    }

    // ------------------------------------------------------------------
    // BÚSQUEDA
    // ------------------------------------------------------------------
    async function buscar(texto) {
        const q = texto.trim();
        if (!q) return cerrarBusqueda();
        if (!db()) return;
        const limpio = q.replace(/[,()%*\\]/g, ' ').trim();
        const ids = pacientes().filter((p) => (p.nombre_completo || '').toLowerCase().includes(q.toLowerCase())).map((p) => p.id);
        const filtros = [];
        if (ids.length) filtros.push(`paciente_id.in.(${ids.join(',')})`);
        if (limpio) filtros.push(`evolucion.ilike.%${limpio}%`, `tipo_cita.ilike.%${limpio}%`);
        if (!filtros.length) return;

        $('gcalResultados').hidden = false;
        $('gcalResultadosTitulo').textContent = `Resultados para "${q}"`;
        $('gcalResultadosLista').innerHTML = '<p class="gcal-empty">Buscando…</p>';

        const { data, error } = await db().from('citas').select(COLUMNAS_CITA).or(filtros.join(','))
            .order('fecha_hora', { ascending: true }).limit(300);
        if (error) { $('gcalResultadosLista').innerHTML = `<p class="gcal-empty">Error: ${esc(error.message)}</p>`; return; }
        if (!data || !data.length) { $('gcalResultadosLista').innerHTML = '<p class="gcal-empty">No se encontraron citas.</p>'; return; }

        const hoy = medianoche(new Date());
        let html = '', diaPrevio = '', marcado = false;
        data.forEach((c) => {
            const ini = new Date(c.fecha_hora), fin = finDe(c);
            const clave = aFechaInput(ini);
            const srv = infoServicio(c.tipo_cita);
            const ancla = !marcado && ini >= hoy ? ' id="gcalPrimerFuturo"' : '';
            if (ancla) marcado = true;
            html += `
                <button type="button" class="gcal-res-row${ini < hoy ? ' pasado' : ''}" data-cita-id="${esc(c.id)}"${ancla}>
                    <span class="gcal-res-fecha">${clave !== diaPrevio ? `<strong>${ini.getDate()}</strong> ${fmtMesCorto(ini).toUpperCase()} ${ini.getFullYear()}, ${ini.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase()}` : ''}</span>
                    <span class="gcal-res-dot" style="background:${srv.color}"></span>
                    <span class="gcal-res-hora">${fmtHora(ini)} – ${fmtHora(fin)}</span>
                    <span class="gcal-res-nombre">${c.estado === 'listo' ? '<i class="fas fa-check"></i> ' : ''}${esc(nombrePaciente(c))} <span class="gcal-muted">· ${esc(srv.nombre)}</span></span>
                </button>`;
            diaPrevio = clave;
        });
        $('gcalResultadosLista').innerHTML = html;
        const primero = $('gcalPrimerFuturo');
        const panel = $('gcalResultados');
        panel.scrollTop = primero ? primero.offsetTop - panel.querySelector('.gcal-search-results-head').offsetHeight : 0;
    }

    function cerrarBusqueda() {
        $('gcalResultados').hidden = true;
        $('gcalBuscar').value = '';
        $('gcalSearch').classList.remove('abierta');
    }

    // ------------------------------------------------------------------
    // ABRIR UNA CITA ESPECÍFICA (desde notificación, búsqueda o panel)
    // ------------------------------------------------------------------
    async function abrirCita(id, vista) {
        if (!db()) return;
        const { data, error } = await db().from('citas').select(COLUMNAS_CITA).eq('id', id).single();
        if (error || !data) return toast('No se encontró la cita', 'error');
        if (!agendaVisible()) $('menu-agenda').click();
        if (!calendar) iniciarCalendario();
        if (vista) calendar.changeView(vista);
        pendienteAbrir = { cita: data, limite: Date.now() + 2500 };
        const ini = new Date(data.fecha_hora);
        calendar.gotoDate(ini);
        if (calendar.view.type.indexOf('timeGrid') === 0) {
            calendar.scrollToTime({ hours: Math.max(0, ini.getHours() - 1), minutes: 0 });
        }
        requestAnimationFrame(intentarAbrirPendiente);
        setTimeout(() => {
            if (pendienteAbrir && pendienteAbrir.cita === data) { pendienteAbrir = null; abrirDetalle(data, null); }
        }, 2500);
    }

    function intentarAbrirPendiente() {
        if (!pendienteAbrir) return;
        const cita = pendienteAbrir.cita;
        const el = document.querySelector(`.fc-event[data-cita-id="${CSS.escape(String(cita.id))}"]`);
        if (el) {
            pendienteAbrir = null;
            setTimeout(() => abrirDetalle(cita, el.getBoundingClientRect()), 120);
        }
    }

    // ------------------------------------------------------------------
    // SNACKBAR
    // ------------------------------------------------------------------
    let snackTimer = null;
    function snackbar(mensaje, accion, alAccionar) {
        const el = $('gcalSnackbar');
        clearTimeout(snackTimer);
        el.innerHTML = `<span>${esc(mensaje)}</span>${accion ? `<button type="button" class="gcal-snack-btn">${esc(accion)}</button>` : ''}<button type="button" class="gcal-snack-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>`;
        el.hidden = false;
        const ocultar = () => { el.hidden = true; };
        const btn = el.querySelector('.gcal-snack-btn');
        if (btn) btn.onclick = () => { ocultar(); alAccionar && alAccionar(); };
        el.querySelector('.gcal-snack-close').onclick = ocultar;
        snackTimer = setTimeout(ocultar, accion ? 8000 : 4000);
    }

    // ------------------------------------------------------------------
    // RECORDATORIOS / NOTIFICACIONES
    // ------------------------------------------------------------------
    let swRegistro = null;
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').then((r) => { swRegistro = r; }).catch(() => { /* sin service worker */ });
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data && e.data.tipo === 'abrir-cita' && e.data.citaId) abrirCita(e.data.citaId);
        });
    }

    let audioCtx = null;
    document.addEventListener('pointerdown', () => {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            else if (audioCtx.state === 'suspended') audioCtx.resume();
        } catch (e) { /* audio no disponible */ }
    }, { passive: true });

    function sonar() {
        if (!prefs.sonido || !audioCtx) return;
        try {
            const t = audioCtx.currentTime;
            [880, 1318.5].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                const t0 = t + i * 0.18;
                o.type = 'sine'; o.frequency.value = f;
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(t0); o.stop(t0 + 0.45);
            });
        } catch (e) { /* ignorar */ }
    }

    const tituloOriginal = document.title;
    let parpadeo = null;
    function parpadearTitulo(texto) {
        if (!document.hidden) return;
        clearInterval(parpadeo);
        let on = false;
        parpadeo = setInterval(() => { document.title = (on = !on) ? `🔔 ${texto}` : tituloOriginal; }, 1200);
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { clearInterval(parpadeo); document.title = tituloOriginal; Recordatorios.revisar(); }
    });

    const soportaNotif = () => 'Notification' in window;
    const permisoNotif = () => (soportaNotif() ? Notification.permission : 'unsupported');

    async function pedirPermiso() {
        if (!soportaNotif()) { toast('Este navegador no soporta notificaciones', 'error'); return 'unsupported'; }
        let r = Notification.permission;
        if (r === 'default') {
            try { r = await Notification.requestPermission(); } catch (e) { r = Notification.permission; }
        }
        if (r === 'granted') toast('Notificaciones activadas. Te avisaremos antes de cada cita.');
        else if (r === 'denied') toast('Las notificaciones están bloqueadas. Actívalas desde el candado de la barra de direcciones.', 'error');
        actualizarUIPermiso();
        return r;
    }

    function actualizarUIPermiso() {
        const p = permisoNotif();
        const txt = {
            granted: 'Activadas: recibirás avisos antes de cada cita.',
            denied: 'Bloqueadas por el navegador. Permítelas desde el ícono del candado junto a la dirección.',
            default: 'Aún no has dado permiso.',
            unsupported: 'Este navegador no soporta notificaciones.'
        }[p];
        if ($('cfgPermiso')) $('cfgPermiso').textContent = txt;
        if ($('cfgActivarNotif')) {
            $('cfgActivarNotif').disabled = p !== 'default';
            $('cfgActivarNotif').textContent = p === 'granted' ? 'Activadas' : 'Activar';
        }
        if ($('gcalNotifCta')) $('gcalNotifCta').hidden = p !== 'default';
    }

    async function notificacionSistema(titulo, cuerpo, citaId) {
        if (permisoNotif() !== 'granted') return;
        const opciones = {
            body: cuerpo,
            icon: 'PhysioWorld.png',
            badge: 'PhysioWorld.png',
            tag: `cita-${citaId}`,
            renotify: true,
            requireInteraction: true,
            data: { citaId }
        };
        try {
            if (swRegistro && swRegistro.showNotification) { await swRegistro.showNotification(titulo, opciones); return; }
        } catch (e) { /* usar API directa */ }
        try {
            const n = new Notification(titulo, opciones);
            n.onclick = () => { window.focus(); if (citaId !== 'prueba') abrirCita(citaId); n.close(); };
        } catch (e) { /* p. ej. Android sin service worker */ }
    }

    const Recordatorios = {
        cache: [],
        ultimaCarga: 0,

        async recargar() {
            if (!db() || !usuario()) { this.cache = []; renderPanel(); return; }
            const ahora = Date.now();
            const desde = new Date(ahora - 60 * 60000).toISOString();
            const hasta = new Date(ahora + 26 * 3600000).toISOString();
            const { data, error } = await db().from('citas').select(COLUMNAS_CITA)
                .gte('fecha_hora', desde).lt('fecha_hora', hasta).order('fecha_hora', { ascending: true });
            if (!error && data) { this.cache = data; this.ultimaCarga = Date.now(); }
            renderPanel();
            this.revisar();
        },

        async tick() {
            if (!usuario()) return;
            if (Date.now() - this.ultimaCarga > 2 * 60000) await this.recargar();
            else this.revisar();
        },

        revisar() {
            if (!usuario()) return;
            const ahora = Date.now();
            const avisadas = leerLS(LS_AVISADAS, {});
            let cambio = false;
            this.cache.forEach((c) => {
                if (c.estado === 'listo') return;
                const min = recordatorioDe(c.id);
                if (min < 0) return;
                const inicio = new Date(c.fecha_hora).getTime();
                const disparo = inicio - min * 60000;
                const clave = `${c.id}|${c.fecha_hora}|${min}`;
                if (ahora >= disparo && ahora < inicio + 10 * 60000 && !avisadas[clave]) {
                    avisadas[clave] = ahora;
                    cambio = true;
                    this.notificar(c, inicio);
                }
            });
            if (cambio) {
                const limite = ahora - 3 * 24 * 3600000;
                Object.keys(avisadas).forEach((k) => { if (avisadas[k] < limite) delete avisadas[k]; });
                guardarLS(LS_AVISADAS, avisadas);
            }
            renderPanel();
        },

        notificar(c, inicio) {
            const nombre = nombrePaciente(c);
            const faltan = Math.round((inicio - Date.now()) / 60000);
            const ini = new Date(inicio), fin = finDe(c);
            const titulo = faltan > 0 ? `Cita en ${fmtFaltan(faltan)}: ${nombre}` : `Cita iniciando: ${nombre}`;
            const cuerpo = `${infoServicio(c.tipo_cita).nombre} · ${fmtHora(ini)} – ${fmtHora(fin)}` + (c.evolucion ? `\n${String(c.evolucion).slice(0, 120)}` : '');
            toast(`🔔 ${titulo}`);
            sonar();
            parpadearTitulo(titulo);
            notificacionSistema(titulo, cuerpo, c.id);
            snackbar(titulo, 'Ver cita', () => abrirCita(c.id));
        }
    };

    function renderPanel() {
        const panel = $('panelNotificaciones');
        if (!panel) return;
        const ahora = Date.now();
        const proximas = Recordatorios.cache
            .filter((c) => c.estado !== 'listo' && finDe(c).getTime() > ahora)
            .slice(0, 8);
        const p = permisoNotif();
        const aviso = p === 'granted'
            ? `<p class="notif-estado ok"><i class="fas fa-bell"></i> Notificaciones activadas · aviso ${esc(textoRecordatorio(prefs.recordatorio).toLowerCase())}</p>`
            : p === 'default'
                ? `<button type="button" class="notif-activar" data-notif="activar"><i class="far fa-bell"></i> Activar notificaciones de citas</button>`
                : `<p class="notif-estado"><i class="fas fa-bell-slash"></i> ${p === 'denied' ? 'Notificaciones bloqueadas en el navegador' : 'Notificaciones no disponibles'}</p>`;

        panel.innerHTML = `
            <div class="notif-head">
                <strong>Próximas citas</strong>
                <button type="button" class="gcal-icon-btn xs" data-notif="config" title="Configurar notificaciones"><i class="fas fa-cog"></i></button>
            </div>
            ${aviso}
            <div class="notif-lista">
                ${proximas.length ? proximas.map((c) => {
                    const ini = new Date(c.fecha_hora);
                    const faltan = Math.round((ini.getTime() - ahora) / 60000);
                    const enCurso = faltan <= 0;
                    return `<button type="button" class="notif-item" data-cita-id="${esc(c.id)}">
                        <span class="notif-dot" style="background:${infoServicio(c.tipo_cita).color}"></span>
                        <span class="notif-info">
                            <strong>${esc(nombrePaciente(c))}</strong>
                            <span>${mismoDia(ini, new Date()) ? '' : esc(fmtFecha(ini)) + ' · '}${fmtHora(ini)} · ${esc(infoServicio(c.tipo_cita).nombre)}</span>
                        </span>
                        <span class="notif-faltan${enCurso ? ' ahora' : faltan <= 15 ? ' pronto' : ''}">${enCurso ? 'En curso' : 'en ' + fmtFaltan(faltan)}</span>
                    </button>`;
                }).join('') : '<p class="gcal-empty">No hay citas pendientes en las próximas 24 horas.</p>'}
            </div>
            <button type="button" class="notif-ver-agenda" data-notif="agenda">Abrir agenda</button>`;
    }

    window.togglePanelNotificaciones = function (e) {
        if (e) e.stopPropagation();
        const panel = $('panelNotificaciones');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        if (!panel.hidden) { renderPanel(); Recordatorios.recargar(); }
    };

    // ------------------------------------------------------------------
    // EVENTOS DE LA INTERFAZ
    // ------------------------------------------------------------------
    function enlazarUI() {
        // Encabezado
        $('gcalHoy').addEventListener('click', () => calendar && calendar.today());
        $('gcalPrev').addEventListener('click', () => calendar && calendar.prev());
        $('gcalNext').addEventListener('click', () => calendar && calendar.next());
        $('gcalCrear').addEventListener('click', () => abrirRapido({ inicio: siguienteHora() }));
        $('gcalToggleSidebar').addEventListener('click', () => {
            const appEl = $('gcalApp');
            if (window.innerWidth <= 900) appEl.classList.toggle('sidebar-movil');
            else { prefs.sidebar = !prefs.sidebar; guardarPrefs(); appEl.classList.toggle('sin-sidebar', !prefs.sidebar); }
            setTimeout(() => calendar && calendar.updateSize(), 220);
        });
        $('gcalVistaBtn').addEventListener('click', (e) => { e.stopPropagation(); $('gcalVistaMenu').classList.toggle('open'); });
        $('gcalVistaMenu').addEventListener('click', (e) => {
            const b = e.target.closest('[data-vista]');
            if (b) cambiarVista(b.dataset.vista);
        });
        $('gcalVistaMenu').addEventListener('change', (e) => {
            const op = e.target.dataset.opcion;
            if (!op) return;
            prefs[op] = e.target.checked; guardarPrefs();
            if (op === 'finesSemana') { calendar.setOption('weekends', prefs.finesSemana); $('cfgFines').checked = prefs.finesSemana; }
            if (op === 'mostrarCompletadas') { $('gcalMostrarCompletadas').checked = prefs.mostrarCompletadas; calendar.refetchEvents(); }
        });
        $('gcalConfigBtn').addEventListener('click', abrirConfig);
        $('gcalAyuda').addEventListener('click', () => abrirModalEl('gcalAtajos'));

        // Búsqueda
        $('gcalSearchBtn').addEventListener('click', () => {
            const f = $('gcalSearch');
            if (f.classList.contains('abierta') && $('gcalBuscar').value.trim()) buscar($('gcalBuscar').value);
            else { f.classList.add('abierta'); $('gcalBuscar').focus(); }
        });
        $('gcalSearch').addEventListener('submit', (e) => { e.preventDefault(); buscar($('gcalBuscar').value); });
        $('gcalSearchClear').addEventListener('click', cerrarBusqueda);
        $('gcalResultadosVolver').addEventListener('click', cerrarBusqueda);
        $('gcalResultadosLista').addEventListener('click', (e) => {
            const row = e.target.closest('[data-cita-id]');
            if (!row) return;
            $('gcalResultados').hidden = true;
            abrirCita(row.dataset.citaId, 'timeGridDay');
        });

        // Mini calendario
        $('gcalMini').addEventListener('click', (e) => {
            const nav = e.target.closest('[data-mini]');
            if (nav) { mesMini = new Date(mesMini.getFullYear(), mesMini.getMonth() + Number(nav.dataset.mini), 1); renderMini(); return; }
            const dia = e.target.closest('[data-fecha]');
            if (dia && calendar) {
                const [y, m, d] = dia.dataset.fecha.split('-').map(Number);
                calendar.gotoDate(new Date(y, m - 1, d));
                if (window.innerWidth <= 900) $('gcalApp').classList.remove('sidebar-movil');
            }
        });

        // Filtros de calendarios
        $('gcalCalendarios').addEventListener('change', (e) => {
            const v = e.target.dataset.filtro;
            if (!v) return;
            prefs.ocultos = e.target.checked ? prefs.ocultos.filter((x) => x !== v) : prefs.ocultos.concat([v]);
            guardarPrefs();
            if (calendar) calendar.refetchEvents();
        });
        $('gcalMostrarCompletadas').addEventListener('change', (e) => {
            prefs.mostrarCompletadas = e.target.checked; guardarPrefs();
            renderMenuVistas();
            if (calendar) calendar.refetchEvents();
        });
        $('gcalNotifCta').addEventListener('click', pedirPermiso);

        // Creación rápida
        editorRapido = crearEditorHorario($('qFecha'), $('qInicio'), $('qFin'), actualizarTemporal);
        $('qPaciente').addEventListener('change', () => {
            const p = pacientes().find((x) => String(x.id) === $('qPaciente').value);
            if (p && p.servicio_contratado && !$('qServicio').value) llenarServicios($('qServicio'), p.servicio_contratado);
            pintarColor($('qColor'), $('qServicio').value);
            actualizarTemporal();
        });
        $('qServicio').addEventListener('change', () => { pintarColor($('qColor'), $('qServicio').value); actualizarTemporal(); });
        $('qGuardar').addEventListener('click', async () => {
            const btn = $('qGuardar');
            btn.disabled = true;
            const ok = await guardarCita(datosRapido());
            btn.disabled = false;
            if (ok) cerrarPopovers();
        });
        $('qMasOpciones').addEventListener('click', () => {
            const d = datosRapido();
            abrirModal({ datos: d });
        });
        $('gcalQuick').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); $('qGuardar').click(); }
        });

        // Detalle
        $('gcalDetalle').addEventListener('click', (e) => {
            const b = e.target.closest('[data-acc]');
            if (b && !b.disabled) { e.stopPropagation(); accionDetalle(b.dataset.acc); }
        });

        // Modal completo
        editorModal = crearEditorHorario($('mFecha'), $('mInicio'), $('mFin'));
        $('mServicio').addEventListener('change', () => pintarColor($('mColor'), $('mServicio').value));
        $('mPaciente').addEventListener('change', () => {
            const p = pacientes().find((x) => String(x.id) === $('mPaciente').value);
            if (p && p.servicio_contratado && !$('mServicio').value) { llenarServicios($('mServicio'), p.servicio_contratado); pintarColor($('mColor'), p.servicio_contratado); }
        });
        $('mGuardar').addEventListener('click', async () => {
            const { inicio, fin } = editorModal.obtener();
            const btn = $('mGuardar');
            btn.disabled = true;
            const ok = await guardarCita({
                id: citaModal ? citaModal.id : null,
                pacienteId: $('mPaciente').value,
                servicio: $('mServicio').value,
                inicio, fin,
                notas: $('mNotas').value.trim(),
                estado: $('mEstado').value,
                recordatorio: Number($('mRecordatorio').value)
            });
            btn.disabled = false;
            if (ok) cerrarModales();
        });

        // Configuración
        llenarRecordatorios($('cfgRecordatorio'), prefs.recordatorio);
        $('cfgRecordatorio').addEventListener('change', (e) => { prefs.recordatorio = Number(e.target.value); guardarPrefs(); renderPanel(); });
        $('cfgSonido').addEventListener('change', (e) => { prefs.sonido = e.target.checked; guardarPrefs(); if (prefs.sonido) sonar(); });
        $('cfgPrimerDia').addEventListener('change', (e) => { prefs.primerDia = Number(e.target.value); guardarPrefs(); if (calendar) calendar.setOption('firstDay', prefs.primerDia); renderMini(); });
        $('cfgFines').addEventListener('change', (e) => { prefs.finesSemana = e.target.checked; guardarPrefs(); if (calendar) calendar.setOption('weekends', prefs.finesSemana); renderMenuVistas(); });
        $('cfgActivarNotif').addEventListener('click', pedirPermiso);
        $('cfgProbar').addEventListener('click', async () => {
            if (permisoNotif() === 'default') await pedirPermiso();
            const ini = sumarMin(new Date(), 10);
            toast('🔔 Así se verán los avisos de tus citas');
            sonar();
            notificacionSistema('Cita en 10 min: Paciente de prueba', `Sesión · ${fmtHora(ini)} – ${fmtHora(sumarMin(ini, 60))}`, 'prueba');
        });

        // Cerrar ventanas
        document.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => { cerrarPopovers(); cerrarModales(); }));
        ['gcalModal', 'gcalConfig', 'gcalAtajos'].forEach((id) => {
            $(id).addEventListener('mousedown', (e) => { if (e.target === $(id)) cerrarModales(); });
        });
        document.addEventListener('mousedown', (e) => {
            const t = e.target;
            if (!t.closest) return;
            if (!$('gcalQuick').hidden && !t.closest('#gcalQuick') && !t.closest('.gcal-ev-temp') && !hayModalAbierto()) cerrarPopovers();
            if (!$('gcalDetalle').hidden && !t.closest('#gcalDetalle') && !t.closest('#gcalModal') && !t.closest('.fc-event')) {
                $('gcalDetalle').hidden = true; cerrarMenus();
            }
            if (!t.closest('.gcal-dropdown')) cerrarMenus();
            const panel = $('panelNotificaciones');
            if (panel && !panel.hidden && !t.closest('.notif-wrapper')) panel.hidden = true;
        });

        // Panel de notificaciones
        $('panelNotificaciones').addEventListener('click', (e) => {
            const item = e.target.closest('[data-cita-id]');
            const acc = e.target.closest('[data-notif]');
            if (item) { $('panelNotificaciones').hidden = true; abrirCita(item.dataset.citaId); }
            else if (acc && acc.dataset.notif === 'activar') pedirPermiso().then(renderPanel);
            else if (acc && acc.dataset.notif === 'config') { $('panelNotificaciones').hidden = true; abrirConfig(); }
            else if (acc && acc.dataset.notif === 'agenda') { $('panelNotificaciones').hidden = true; $('menu-agenda').click(); }
        });

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (hayModalAbierto()) cerrarModales(); else cerrarPopovers();
                const panel = $('panelNotificaciones'); if (panel) panel.hidden = true;
                return;
            }
            if (!agendaVisible() || !calendar || e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (hayModalAbierto() || !$('gcalQuick').hidden) return;
            const accion = {
                t: () => calendar.today(), j: () => calendar.next(), n: () => calendar.next(),
                k: () => calendar.prev(), p: () => calendar.prev(),
                d: () => cambiarVista('timeGridDay'), w: () => cambiarVista('timeGridWeek'),
                m: () => cambiarVista('dayGridMonth'), y: () => cambiarVista('multiMonthYear'),
                a: () => cambiarVista('listProgramacion'), x: () => cambiarVista('timeGridFourDay'),
                c: () => abrirRapido({ inicio: siguienteHora() }),
                r: () => despuesDeCambio(),
                '/': () => { $('gcalSearch').classList.add('abierta'); $('gcalBuscar').focus(); },
                '?': () => abrirModalEl('gcalAtajos')
            }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
            if (accion) { e.preventDefault(); cerrarPopovers(); accion(); }
        });

        window.addEventListener('resize', () => { cerrarPopovers(); });
    }

    function abrirConfig() {
        llenarRecordatorios($('cfgRecordatorio'), prefs.recordatorio);
        $('cfgSonido').checked = prefs.sonido;
        $('cfgPrimerDia').value = String(prefs.primerDia);
        $('cfgFines').checked = prefs.finesSemana;
        actualizarUIPermiso();
        abrirModalEl('gcalConfig');
    }

    // ------------------------------------------------------------------
    // API PÚBLICA
    // ------------------------------------------------------------------
    window.Agenda = {
        mostrar() {
            cerrarPopovers();
            if (!calendar) iniciarCalendario();
            else { calendar.updateSize(); calendar.refetchEvents(); }
            requestAnimationFrame(() => calendar && calendar.updateSize());
            renderCalendariosSidebar();
            renderMini();
        },
        abrirCrear({ pacienteId = '', servicio = '' } = {}) {
            if (!agendaVisible()) $('menu-agenda').click();
            if (!calendar) iniciarCalendario();
            const inicio = siguienteHora();
            calendar.gotoDate(inicio);
            const abrir = () => abrirRapido({ inicio, pacienteId, servicio });
            if (!pacientes().length && app().cargarPacientesGlobales) app().cargarPacientesGlobales().then(abrir);
            else setTimeout(abrir, 60);
        },
        abrirCita,
        refrescar() { if (calendar) calendar.refetchEvents(); Recordatorios.recargar(); },
        pacientesActualizados() {
            // Mantener los selectores abiertos al día sin perder la selección
            [['qPaciente', 'gcalQuick'], ['mPaciente', 'gcalModal']].forEach(([selId, contId]) => {
                if (!$(contId).hidden) llenarPacientes($(selId), $(selId).value);
            });
        },
        alIniciarSesion() {
            Recordatorios.recargar();
            if (permisoNotif() === 'default' && !sessionStorage.getItem('physio_notif_preguntado')) {
                sessionStorage.setItem('physio_notif_preguntado', '1');
                setTimeout(() => snackbar('¿Quieres recibir avisos antes de cada cita?', 'Activar', pedirPermiso), 1200);
            }
        }
    };

    // ------------------------------------------------------------------
    // INICIO
    // ------------------------------------------------------------------
    function iniciar() {
        const dia = $('gcalBrandDia');
        if (dia) dia.textContent = new Date().getDate();
        if (!prefs.sidebar) $('gcalApp').classList.add('sin-sidebar');
        enlazarUI();
        renderCalendariosSidebar();
        renderMini();
        renderMenuVistas();
        actualizarUIPermiso();

        // Revisión de recordatorios cada 30 s (también con la pestaña en segundo plano)
        setInterval(() => Recordatorios.tick(), 30000);
        setTimeout(() => {
            Recordatorios.tick();
            if (usuario() && permisoNotif() === 'default' && !sessionStorage.getItem('physio_notif_preguntado')) {
                sessionStorage.setItem('physio_notif_preguntado', '1');
                snackbar('¿Quieres recibir avisos antes de cada cita?', 'Activar', pedirPermiso);
            }
        }, 1500);

        // Abrir una cita indicada en la URL (?cita=ID), p. ej. al tocar una notificación
        const params = new URLSearchParams(location.search);
        const citaUrl = params.get('cita');
        if (citaUrl && usuario()) {
            history.replaceState(null, '', location.pathname);
            setTimeout(() => abrirCita(citaUrl), 600);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
