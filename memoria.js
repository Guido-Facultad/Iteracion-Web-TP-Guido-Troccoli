// Configuración del juego
const config = {
    totalPares: 8,
    tiempoMostrar: 1000, // 1 segundo para mostrar las cartas
    tiempoJuego: 120, // 2 minutos de juego
};
// Eventos
const EVENT_SERVER_URL = null; // No remote event endpoint on GitHub Pages
const EVENT_HISTORY_KEY = 'memoriaEventHistory';
const EVENT_COUNTS_KEY = 'memoriaEventCounts';
let pendingEvents = [];
let eventHistory = [];
let eventCounts = {};

function loadEventStore() {
    try {
        eventHistory = JSON.parse(localStorage.getItem(EVENT_HISTORY_KEY)) || [];
        eventCounts = JSON.parse(localStorage.getItem(EVENT_COUNTS_KEY)) || {};
    } catch (error) {
        console.warn('No se pudo cargar el historial de eventos acumulados:', error);
        eventHistory = [];
        eventCounts = {};
    }
}

function saveEventStore() {
    try {
        localStorage.setItem(EVENT_HISTORY_KEY, JSON.stringify(eventHistory));
        localStorage.setItem(EVENT_COUNTS_KEY, JSON.stringify(eventCounts));
    } catch (error) {
        console.warn('No se pudo guardar el historial de eventos acumulados:', error);
    }
}

function flushPendingEvents() {
    // No remote server available on GitHub Pages; los eventos se guardan localmente.
}

function dispatchLocalEvent(eventObject) {
    console.log('Evento local generado:', eventObject);
    document.dispatchEvent(new CustomEvent('gameEvent', { detail: eventObject }));
}

function logGameEvent(name, details = {}) {
    const eventObject = { name, timestamp: new Date().toISOString(), details };
    eventCounts[name] = (eventCounts[name] || 0) + 1;
    eventHistory.push(eventObject);
    saveEventStore();
    dispatchLocalEvent(eventObject);
}

window.addEventListener('online', flushPendingEvents);
window.addEventListener('beforeunload', () => {
    if (pendingEvents.length > 0) localStorage.setItem('pendingGameEvents', JSON.stringify(pendingEvents));
});

// Estado del juego
let estado = {
    cartas: [],
    cartasSeleccionadas: [],
    parejasEncontradas: 0,
    intentos: 0,
    tiempoRestante: config.tiempoJuego,
    juegoActivo: false,
    timer: null
};

// Base de datos SQLite
let db = null;

// Elementos del DOM
const elementos = {
    contenedorCartas: document.createElement('div'),
    parejasEncontradas: document.getElementById('parejas-encontradas'),
    tiempo: document.getElementById('tiempo'),
    intentos: document.getElementById('intentos'),
    resultado: document.getElementById('resultado'),
    botonReiniciar: document.getElementById('reiniciar'),
    botonFinalizar: document.getElementById('finalizar'),
    botonIniciar: document.getElementById('iniciar'),
    verHistorial: document.getElementById('ver-historial'),
    verRanking: document.getElementById('ver-ranking'),
    exportarDb: document.getElementById('exportar-db'),
    estadisticas: document.getElementById('estadisticas'),
    historialContainer: document.getElementById('historial-container')
};

// Nombres de las imágenes
const imagenes = [
    'Agumon.png',
    'Gabumon.png',
    'Gomamon.png',
    'Coronamon2.png',
    'Metalgarurumon.png',
    'Wargreymon.png',
    'Plesiomon.png',
    'Gatomon.png'
];

// Inicialización del juego
function inicializarJuego() {
    // Crear contenedor de cartas
    elementos.contenedorCartas.className = 'contenedor-cartas';
    
    // Buscar la sección de controles y insertar el contenedor de cartas después
    const seccionControles = document.querySelector('.seccion:nth-child(2)');
    if (seccionControles) {
        seccionControles.insertAdjacentElement('afterend', elementos.contenedorCartas);
    }

    // Crear array de cartas
    estado.cartas = [...imagenes, ...imagenes]
        .sort(() => Math.random() - 0.5)
        .map((imagen, index) => ({
            id: index,
            imagen: imagen,
            volteada: false,
            encontrada: false
        }));

    // Crear elementos HTML para cada carta
    estado.cartas.forEach(carta => {
        const elementoCarta = document.createElement('div');
        elementoCarta.className = 'carta';
        elementoCarta.dataset.id = carta.id;
        
        const imagen = document.createElement('img');
        imagen.src = `img/${carta.imagen}`;
        imagen.alt = 'Digimon';
        imagen.style.display = 'none';
        
        elementoCarta.appendChild(imagen);
        elementos.contenedorCartas.appendChild(elementoCarta);
        
        elementoCarta.addEventListener('click', () => seleccionarCarta(carta.id));
    });
    logGameEvent('game_initialized', { totalCartas: estado.cartas.length });
}

// Función para seleccionar una carta
function seleccionarCarta(id) {
    if (!estado.juegoActivo || estado.cartasSeleccionadas.length >= 2) return;
    
    const carta = estado.cartas.find(c => c.id === id);
    if (carta.volteada || carta.encontrada) return;

    // Voltear carta
    carta.volteada = true;
    const elementoCarta = document.querySelector(`[data-id="${id}"]`);
    const imagen = elementoCarta.querySelector('img');
    imagen.style.display = 'block';
    elementoCarta.classList.add('volteada');

    estado.cartasSeleccionadas.push(carta);
    logGameEvent('card_selected', { id: carta.id, imagen: carta.imagen });

    if (estado.cartasSeleccionadas.length === 2) {
        estado.intentos++;
        elementos.intentos.textContent = estado.intentos;
        verificarPareja();
    }
}

// Función para verificar si las cartas seleccionadas forman una pareja
function verificarPareja() {
    const [carta1, carta2] = estado.cartasSeleccionadas;
    
    if (carta1.imagen === carta2.imagen) {
        // Pareja encontrada
        carta1.encontrada = carta2.encontrada = true;
        estado.parejasEncontradas++;
        elementos.parejasEncontradas.textContent = estado.parejasEncontradas;
        logGameEvent('pair_found', { imagen: carta1.imagen, parejasEncontradas: estado.parejasEncontradas });
        
        if (estado.parejasEncontradas === config.totalPares) {
            finalizarJuego(true);
        }
    } else {
        logGameEvent('pair_miss', { imagen1: carta1.imagen, imagen2: carta2.imagen });
        // No es pareja
        setTimeout(() => {
            carta1.volteada = carta2.volteada = false;
            const elementoCarta1 = document.querySelector(`[data-id="${carta1.id}"]`);
            const elementoCarta2 = document.querySelector(`[data-id="${carta2.id}"]`);
            elementoCarta1.querySelector('img').style.display = 'none';
            elementoCarta2.querySelector('img').style.display = 'none';
            elementoCarta1.classList.remove('volteada');
            elementoCarta2.classList.remove('volteada');
        }, config.tiempoMostrar);
    }
    
    estado.cartasSeleccionadas = [];
}

// Función para iniciar el temporizador
function iniciarTemporizador() {
    estado.tiempoRestante = config.tiempoJuego;
    actualizarTiempo();
    
    estado.timer = setInterval(() => {
        estado.tiempoRestante--;
        actualizarTiempo();
        
        if (estado.tiempoRestante <= 0) {
            finalizarJuego(false);
        }
    }, 1000);
}

// Función para actualizar el tiempo mostrado
function actualizarTiempo() {
    const minutos = Math.floor(estado.tiempoRestante / 60);
    const segundos = estado.tiempoRestante % 60;
    elementos.tiempo.textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}

// Función para obtener estadísticas globales (usando la tabla actualizada por el TRIGGER)
function obtenerEstadisticasGlobales() {
    if (!db) return null;
    
    try {
        const resultado = db.exec('SELECT * FROM estadisticas_globales WHERE id = 1');
        if (resultado.length > 0 && resultado[0].values.length > 0) {
            const stats = resultado[0].values[0];
            return {
                totalPartidas: stats[1],
                partidasGanadas: stats[2],
                partidasPerdidas: stats[3],
                promedioIntentos: stats[4],
                mejorIntentos: stats[5],
                promedioTiempoGanadas: stats[6],
                ultimaActualizacion: stats[7]
            };
        }
    } catch (error) {
        console.error('Error al obtener estadísticas globales:', error);
    }
    return null;
}

// Función para obtener datos de la partida actual desde la view detallada
function obtenerPartidaDetallada() {
    if (!db) return null;
    
    try {
        const resultado = db.exec(`
            SELECT * FROM vista_partidas_detalladas 
            ORDER BY id DESC 
            LIMIT 1
        `);
        if (resultado.length > 0 && resultado[0].values.length > 0) {
            const partida = resultado[0].values[0];
            return {
                id: partida[0],
                fecha: partida[1],
                ganada: partida[2],
                parejasEncontradas: partida[3],
                intentos: partida[4],
                tiempoTranscurrido: partida[5],
                eficiencia: partida[6],
                tiempoPromedioPorPareja: partida[7],
                porcentajeCompletado: partida[8],
                calificacionIntentos: partida[9],
                calificacionTiempo: partida[10]
            };
        }
    } catch (error) {
        console.error('Error al obtener partida detallada:', error);
    }
    return null;
}

// Función para finalizar el juego
function finalizarJuego(ganador) {
    estado.juegoActivo = false;
    clearInterval(estado.timer);
    
    // Calcular tiempo transcurrido
    const tiempoTranscurrido = config.tiempoJuego - estado.tiempoRestante;
    
    // Deshabilitar todas las cartas
    const todasLasCartas = document.querySelectorAll('.carta');
    todasLasCartas.forEach(carta => {
        carta.style.pointerEvents = 'none';
    });
    
    // Guardar partida en la base de datos (el TRIGGER actualizará estadísticas automáticamente)
    guardarPartida(ganador, tiempoTranscurrido);
    logGameEvent('game_end', { ganador: ganador ? 1 : 0, parejasEncontradas: estado.parejasEncontradas, intentos: estado.intentos, tiempoTranscurrido });
    
    // Esperar un momento para que el TRIGGER se ejecute antes de obtener los datos
    setTimeout(() => {
        mostrarResultadoConDatos(ganador);
    }, 100);
}

// Función para mostrar el resultado con datos adicionales
function mostrarResultadoConDatos(ganador) {
    // Obtener datos adicionales usando las views y estadísticas globales
    const partidaDetallada = obtenerPartidaDetallada();
    const estadisticasGlobales = obtenerEstadisticasGlobales();
    
    // Construir mensaje con datos adicionales
    let mensajeHTML = '';
    
    if (ganador) {
        mensajeHTML = `
            <div class="resultado-ganador">
                <p><strong>¡Felicitaciones! Has encontrado todas las parejas.</strong></p>
            <img src="img/Victory.jpg" alt="Imagen de victoria" class="imagen-ganador">
            </div>
        `;
    } else {
        mensajeHTML = `
            <div class="resultado-perdedor">
                <p><strong>¡Se acabó el tiempo! Inténtalo de nuevo.</strong></p>
            </div>
        `;
    }
    
    // Agregar datos adicionales calculados por procedimientos almacenados
    if (partidaDetallada) {
        mensajeHTML += `
            <div class="datos-adicionales">
                <h3>📊 Análisis de tu Partida</h3>
                <div class="metricas-grid">
                    <div class="metrica">
                        <span class="metrica-label">Eficiencia:</span>
                        <span class="metrica-valor">${partidaDetallada.eficiencia || 0}</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Tiempo por pareja:</span>
                        <span class="metrica-valor">${partidaDetallada.tiempoPromedioPorPareja || 0}s</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Progreso:</span>
                        <span class="metrica-valor">${partidaDetallada.porcentajeCompletado || 0}%</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Calificación Intentos:</span>
                        <span class="metrica-valor ${partidaDetallada.calificacionIntentos?.toLowerCase()}">${partidaDetallada.calificacionIntentos || 'N/A'}</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Calificación Tiempo:</span>
                        <span class="metrica-valor ${partidaDetallada.calificacionTiempo?.toLowerCase()}">${partidaDetallada.calificacionTiempo || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Agregar estadísticas globales (actualizadas por el TRIGGER)
    if (estadisticasGlobales && estadisticasGlobales.totalPartidas > 0) {
        const porcentajeGanadas = estadisticasGlobales.totalPartidas > 0 
            ? Math.round((estadisticasGlobales.partidasGanadas / estadisticasGlobales.totalPartidas) * 100)
            : 0;
        
        mensajeHTML += `
            <div class="estadisticas-globales">
                <h3>📈 Estadísticas Generales (Actualizadas Automáticamente)</h3>
                <div class="metricas-grid">
                    <div class="metrica">
                        <span class="metrica-label">Total Partidas:</span>
                        <span class="metrica-valor">${estadisticasGlobales.totalPartidas}</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Partidas Ganadas:</span>
                        <span class="metrica-valor">${estadisticasGlobales.partidasGanadas} (${porcentajeGanadas}%)</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Promedio Intentos:</span>
                        <span class="metrica-valor">${Math.round(estadisticasGlobales.promedioIntentos * 100) / 100}</span>
                    </div>
                    <div class="metrica">
                        <span class="metrica-label">Mejor Partida:</span>
                        <span class="metrica-valor">${estadisticasGlobales.mejorIntentos !== 999999 ? estadisticasGlobales.mejorIntentos + ' intentos' : 'N/A'}</span>
                    </div>
                    ${estadisticasGlobales.promedioTiempoGanadas ? `
                    <div class="metrica">
                        <span class="metrica-label">Tiempo Promedio (Ganadas):</span>
                        <span class="metrica-valor">${Math.round(estadisticasGlobales.promedioTiempoGanadas)}s</span>
                    </div>
                    ` : ''}
                </div>
                <p class="nota-trigger"><small>💡 Estas estadísticas se actualizan automáticamente mediante un TRIGGER en la base de datos</small></p>
            </div>
        `;
    }
    
    elementos.resultado.innerHTML = mensajeHTML;
    elementos.resultado.className = ganador ? 'resultado-texto ganador' : 'resultado-texto perdedor';
}

// Función para inicializar la base de datos SQLite
async function inicializarBaseDatos() {
    try {
        // Verificar si SQL.js ya está cargado
        if (typeof initSqlJs === 'undefined') {
            console.error('SQL.js no está cargado. Asegúrate de incluir el CDN en el HTML.');
            return;
        }
        
        // Cargar SQL.js
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
        });
        
        // Crear o cargar base de datos
        db = new SQL.Database();
        
        // Crear tabla de partidas con campos adicionales
        db.run(`
            CREATE TABLE IF NOT EXISTS partidas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                ganada INTEGER,
                parejas_encontradas INTEGER,
                intentos INTEGER,
                tiempo_transcurrido INTEGER,
                tiempo_limite INTEGER,
                eficiencia REAL,
                tiempo_promedio_por_pareja REAL,
                porcentaje_completado REAL
            )
        `);
        
        // Crear tabla de estadísticas globales
        db.run(`
            CREATE TABLE IF NOT EXISTS estadisticas_globales (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_partidas INTEGER DEFAULT 0,
                partidas_ganadas INTEGER DEFAULT 0,
                partidas_perdidas INTEGER DEFAULT 0,
                promedio_intentos REAL DEFAULT 0,
                mejor_intentos INTEGER DEFAULT 999999,
                promedio_tiempo_ganadas REAL DEFAULT 0,
                ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Inicializar estadísticas globales si no existen
        db.run(`
            INSERT OR IGNORE INTO estadisticas_globales (id, total_partidas, partidas_ganadas, partidas_perdidas)
            VALUES (1, 0, 0, 0)
        `);
        
        // Crear TRIGGER para actualizar estadísticas automáticamente (procedimiento almacenado)
        db.run(`
            CREATE TRIGGER IF NOT EXISTS actualizar_estadisticas_globales
            AFTER INSERT ON partidas
            BEGIN
                UPDATE estadisticas_globales SET
                    total_partidas = (SELECT COUNT(*) FROM partidas),
                    partidas_ganadas = (SELECT COUNT(*) FROM partidas WHERE ganada = 1),
                    partidas_perdidas = (SELECT COUNT(*) FROM partidas WHERE ganada = 0),
                    promedio_intentos = (SELECT AVG(intentos) FROM partidas),
                    mejor_intentos = (SELECT MIN(intentos) FROM partidas WHERE ganada = 1),
                    promedio_tiempo_ganadas = (
                        SELECT AVG(tiempo_transcurrido) 
                        FROM partidas 
                        WHERE ganada = 1
                    ),
                    ultima_actualizacion = CURRENT_TIMESTAMP
                WHERE id = 1;
            END
        `);
        
        // Crear VIEW para partidas con análisis detallado (procedimiento almacenado tipo view)
        db.run(`
            CREATE VIEW IF NOT EXISTS vista_partidas_detalladas AS
            SELECT 
                id,
                fecha,
                ganada,
                parejas_encontradas,
                intentos,
                tiempo_transcurrido,
                eficiencia,
                tiempo_promedio_por_pareja,
                porcentaje_completado,
                CASE 
                    WHEN intentos <= (SELECT MIN(intentos) FROM partidas WHERE ganada = 1) THEN 'Excelente'
                    WHEN intentos <= (SELECT AVG(intentos) FROM partidas WHERE ganada = 1) THEN 'Bueno'
                    ELSE 'Regular'
                END as calificacion_intentos,
                CASE
                    WHEN tiempo_transcurrido <= (SELECT AVG(tiempo_transcurrido) FROM partidas WHERE ganada = 1) THEN 'Rápido'
                    ELSE 'Normal'
                END as calificacion_tiempo
            FROM partidas
        `);
        
        // Crear VIEW para ranking de mejores partidas
        // Nota: SQLite no soporta ROW_NUMBER() en versiones antiguas, usamos subconsulta
        db.run(`
            CREATE VIEW IF NOT EXISTS vista_ranking_mejores AS
            SELECT 
                p1.id,
                p1.fecha,
                p1.intentos,
                p1.tiempo_transcurrido,
                p1.eficiencia,
                (SELECT COUNT(*) + 1 
                 FROM partidas p2 
                 WHERE p2.ganada = 1 
                 AND (p2.eficiencia > p1.eficiencia 
                      OR (p2.eficiencia = p1.eficiencia AND p2.intentos < p1.intentos)
                      OR (p2.eficiencia = p1.eficiencia AND p2.intentos = p1.intentos AND p2.tiempo_transcurrido < p1.tiempo_transcurrido)
                 )
                ) as posicion
            FROM partidas p1
            WHERE p1.ganada = 1
            ORDER BY p1.eficiencia DESC, p1.intentos ASC, p1.tiempo_transcurrido ASC
            LIMIT 10
        `);
        
        console.log('Base de datos inicializada correctamente con triggers y views');
        logGameEvent('db_initialized');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    }
}

// Función para guardar una partida en la base de datos
function guardarPartida(ganada, tiempoTranscurrido) {
    if (!db) return;
    
    try {
        // Calcular métricas adicionales
        const porcentajeCompletado = (estado.parejasEncontradas / config.totalPares) * 100;
        const tiempoPromedioPorPareja = estado.parejasEncontradas > 0 
            ? tiempoTranscurrido / estado.parejasEncontradas 
            : 0;
        
        // Calcular eficiencia: (parejas encontradas / intentos) * (tiempo límite / tiempo usado)
        // Mayor eficiencia = mejor rendimiento
        let eficiencia = 0;
        if (estado.intentos > 0 && tiempoTranscurrido > 0) {
            const ratioParejasIntentos = estado.parejasEncontradas / estado.intentos;
            const ratioTiempo = config.tiempoJuego / tiempoTranscurrido;
            eficiencia = (ratioParejasIntentos * ratioTiempo * 100).toFixed(2);
        }
        
        db.run(`
            INSERT INTO partidas (
                ganada, 
                parejas_encontradas, 
                intentos, 
                tiempo_transcurrido, 
                tiempo_limite,
                eficiencia,
                tiempo_promedio_por_pareja,
                porcentaje_completado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ganada ? 1 : 0,
            estado.parejasEncontradas,
            estado.intentos,
            tiempoTranscurrido,
            config.tiempoJuego,
            parseFloat(eficiencia),
            parseFloat(tiempoPromedioPorPareja.toFixed(2)),
            parseFloat(porcentajeCompletado.toFixed(2))
        ]);
        
        console.log('Partida guardada en la base de datos con métricas calculadas');
        console.log('Eficiencia:', eficiencia, 'Tiempo por pareja:', tiempoPromedioPorPareja);
        logGameEvent('match_saved', { ganada: ganada ? 1 : 0, parejasEncontradas: estado.parejasEncontradas, intentos: estado.intentos, tiempoTranscurrido, eficiencia });
        
        // El TRIGGER se ejecutará automáticamente para actualizar estadísticas_globales
    } catch (error) {
        console.error('Error al guardar la partida:', error);
    }
}

// Función para obtener todas las partidas
function obtenerPartidas() {
    if (!db) return [];
    
    try {
        const resultado = db.exec('SELECT * FROM partidas ORDER BY fecha DESC LIMIT 20');
        if (resultado.length > 0) {
            return resultado[0].values;
        }
    } catch (error) {
        console.error('Error al obtener partidas:', error);
    }
    return [];
}

// Función para mostrar el historial
function mostrarHistorial() {
    if (!db) {
        elementos.historialContainer.innerHTML = '<p>Base de datos no inicializada.</p>';
        return;
    }
    logGameEvent('view_history');
    
    try {
        // Usar la VIEW para obtener datos detallados
        const resultado = db.exec(`
            SELECT * FROM vista_partidas_detalladas 
            ORDER BY fecha DESC 
            LIMIT 20
        `);
        
        if (resultado.length === 0 || resultado[0].values.length === 0) {
            elementos.historialContainer.innerHTML = '<p>No hay partidas registradas todavía.</p>';
            return;
        }
        
        const partidas = resultado[0].values;
        
        let html = '<table class="tabla-historial"><thead><tr>';
        html += '<th>Fecha</th><th>Resultado</th><th>Parejas</th><th>Intentos</th><th>Tiempo</th>';
        html += '<th>Eficiencia</th><th>Tiempo/Pareja</th><th>Calificación</th>';
        html += '</tr></thead><tbody>';
        
        partidas.forEach(partida => {
            const fecha = new Date(partida[1]).toLocaleString('es-AR');
            const resultado = partida[2] ? 'Ganada' : 'Perdida';
            const tiempo = `${partida[5]}s`;
            const eficiencia = partida[6] ? partida[6].toFixed(2) : '0';
            const tiempoPorPareja = partida[7] ? `${partida[7].toFixed(1)}s` : 'N/A';
            const calificacion = partida[9] || 'N/A';
            
            html += `<tr>
                <td>${fecha}</td>
                <td>${resultado}</td>
                <td>${partida[3]}</td>
                <td>${partida[4]}</td>
                <td>${tiempo}</td>
                <td>${eficiencia}</td>
                <td>${tiempoPorPareja}</td>
                <td>${calificacion}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        html += '<p class="nota-trigger"><small>💡 Datos calculados automáticamente por VIEW</small></p>';
        elementos.historialContainer.innerHTML = html;
    } catch (error) {
        console.error('Error al mostrar historial:', error);
        elementos.historialContainer.innerHTML = '<p>Error al cargar el historial.</p>';
    }
}

// Función para exportar la base de datos
function exportarBaseDatos() {
    if (!db) {
        alert('Base de datos no inicializada');
        return;
    }
    
    try {
        const datos = db.export();
        const buffer = new Uint8Array(datos);
        const blob = new Blob([buffer]);
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'memoria_juego.db';
        a.click();
        
        URL.revokeObjectURL(url);
        alert('Base de datos descargada como memoria_juego.db. Puedes abrirla con SQLite Studio.');
        logGameEvent('export_db');
    } catch (error) {
        console.error('Error al exportar la base de datos:', error);
        alert('Error al exportar la base de datos');
    }
}

// Función para mostrar estadísticas usando la tabla actualizada por el TRIGGER
function mostrarEstadisticas() {
    if (!db) {
        alert('Base de datos no inicializada');
        return;
    }
    logGameEvent('view_stats');
    
    try {
        const estadisticasGlobales = obtenerEstadisticasGlobales();
        
        if (estadisticasGlobales && estadisticasGlobales.totalPartidas > 0) {
            const porcentaje = Math.round((estadisticasGlobales.partidasGanadas / estadisticasGlobales.totalPartidas) * 100);
            
            let html = '<div class="estadisticas">';
            html += '<h3>📊 Estadísticas Generales</h3>';
            html += '<p class="nota-trigger"><small>💡 Actualizadas automáticamente por TRIGGER</small></p>';
            html += `<p><strong>Total de partidas:</strong> ${estadisticasGlobales.totalPartidas}</p>`;
            html += `<p><strong>Partidas ganadas:</strong> ${estadisticasGlobales.partidasGanadas} (${porcentaje}%)</p>`;
            html += `<p><strong>Partidas perdidas:</strong> ${estadisticasGlobales.partidasPerdidas}</p>`;
            html += `<p><strong>Promedio de intentos:</strong> ${Math.round(estadisticasGlobales.promedioIntentos * 100) / 100}</p>`;
            html += `<p><strong>Mejor partida (menor intentos):</strong> ${estadisticasGlobales.mejorIntentos !== 999999 ? estadisticasGlobales.mejorIntentos + ' intentos' : 'N/A'}</p>`;
            if (estadisticasGlobales.promedioTiempoGanadas) {
                html += `<p><strong>Tiempo promedio en partidas ganadas:</strong> ${Math.round(estadisticasGlobales.promedioTiempoGanadas)}s</p>`;
            }
            html += '</div>';
            elementos.historialContainer.innerHTML = html;
        } else {
            elementos.historialContainer.innerHTML = '<p>No hay estadísticas disponibles todavía. Juega al menos una partida.</p>';
        }
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        elementos.historialContainer.innerHTML = '<p>Error al obtener estadísticas.</p>';
    }
}

// Función para mostrar ranking usando la VIEW
function mostrarRanking() {
    if (!db) {
        alert('Base de datos no inicializada');
        return;
    }
    logGameEvent('view_ranking');
    
    try {
        const resultado = db.exec('SELECT * FROM vista_ranking_mejores');
        
        if (resultado.length > 0 && resultado[0].values.length > 0) {
            const partidas = resultado[0].values;
            
            let html = '<div class="ranking-container">';
            html += '<h3>🏆 Top 10 Mejores Partidas</h3>';
            html += '<p class="nota-trigger"><small>💡 Generado automáticamente por VIEW</small></p>';
            html += '<table class="tabla-historial"><thead><tr>';
            html += '<th>Posición</th><th>Fecha</th><th>Intentos</th><th>Tiempo</th><th>Eficiencia</th>';
            html += '</tr></thead><tbody>';
            
            partidas.forEach(partida => {
                const fecha = new Date(partida[1]).toLocaleString('es-AR');
                const posicion = partida[5];
                const intentos = partida[2];
                const tiempo = `${partida[3]}s`;
                const eficiencia = partida[4] ? partida[4].toFixed(2) : '0';
                
                html += `<tr>
                    <td><strong>#${posicion}</strong></td>
                    <td>${fecha}</td>
                    <td>${intentos}</td>
                    <td>${tiempo}</td>
                    <td>${eficiencia}</td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            elementos.historialContainer.innerHTML = html;
        } else {
            elementos.historialContainer.innerHTML = '<p>No hay partidas ganadas todavía para mostrar el ranking.</p>';
        }
    } catch (error) {
        console.error('Error al obtener ranking:', error);
        elementos.historialContainer.innerHTML = '<p>Error al obtener ranking.</p>';
    }
}

// Función para comenzar el juego
function comenzarJuego() {
    if (!estado.juegoActivo) {
        logGameEvent('game_start');
        iniciarTemporizador();
        estado.juegoActivo = true;
        // Deshabilitar el botón de iniciar solo cuando se comienza el juego
        elementos.botonIniciar.disabled = true;
        elementos.botonIniciar.style.opacity = '0.5';
        elementos.botonIniciar.style.cursor = 'not-allowed';
        
        // Habilitar todas las cartas
        const todasLasCartas = document.querySelectorAll('.carta');
        todasLasCartas.forEach(carta => {
            carta.style.pointerEvents = 'auto';
        });
    }
}

// Event Listeners
elementos.botonIniciar.addEventListener('click', comenzarJuego);

elementos.verHistorial.addEventListener('click', mostrarHistorial);
elementos.verRanking.addEventListener('click', mostrarRanking);
elementos.exportarDb.addEventListener('click', exportarBaseDatos);
elementos.estadisticas.addEventListener('click', mostrarEstadisticas);

elementos.botonReiniciar.addEventListener('click', () => {
    logGameEvent('game_restart');
    // Limpiar el temporizador anterior si existe
    if (estado.timer) {
        clearInterval(estado.timer);
    }

    
    elementos.contenedorCartas.innerHTML = '';
    estado = {
        cartas: [],
        cartasSeleccionadas: [],
        parejasEncontradas: 0,
        intentos: 0,
        tiempoRestante: config.tiempoJuego,
        juegoActivo: false,
        timer: null
    };
    elementos.parejasEncontradas.textContent = '0';
    elementos.intentos.textContent = '0';
    elementos.resultado.textContent = '';
    elementos.resultado.className = 'resultado-texto';
    inicializarJuego();
    
    // Habilitar todas las cartas nuevamente
    const todasLasCartas = document.querySelectorAll('.carta');
    todasLasCartas.forEach(carta => {
        carta.style.pointerEvents = 'auto';
    });
    
    // Habilitar el botón de iniciar
    elementos.botonIniciar.disabled = false;
    elementos.botonIniciar.style.opacity = '1';
    elementos.botonIniciar.style.cursor = 'pointer';
});

elementos.botonFinalizar.addEventListener('click', () => {
    logGameEvent('game_finish_requested');
    if (estado.juegoActivo) {
        finalizarJuego(false);
    }
});

// Iniciar el juego cuando se carga la página
document.addEventListener('DOMContentLoaded', async () => {
    loadEventStore();
    await inicializarBaseDatos();
    inicializarJuego();
    // Deshabilitar todas las cartas inicialmente
    const todasLasCartas = document.querySelectorAll('.carta');
    todasLasCartas.forEach(carta => {
        carta.style.pointerEvents = 'none';
    });
}); 