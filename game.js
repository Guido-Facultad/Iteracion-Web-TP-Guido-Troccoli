// Variables globales para el seguimiento del juego
let victoriasJugador = 0;
let victoriasComputadora = 0;
let empates = 0;
const EVENT_SERVER_URL = null; // No remote event endpoint on GitHub Pages
const EVENT_HISTORY_KEY = 'rpsGameEventHistory';
const EVENT_COUNTS_KEY = 'rpsGameEventCounts';
let pendingEvents = [];
let eventHistory = [];
let eventCounts = {};

// Elementos del DOM
const opcionesJugador = document.querySelectorAll('.opcion-jugador');
const resultadoTexto = document.getElementById('resultado');
const contadorJugador = document.getElementById('victorias-jugador');
const contadorComputadora = document.getElementById('victorias-computadora');
const contadorEmpates = document.getElementById('empates');
const imagenGanador = document.getElementById('imagen-ganador');
const botonReiniciar = document.getElementById('reiniciar');
const botonFinalizar = document.getElementById('finalizar');

// Función para obtener la elección de la computadora
function obtenerEleccionComputadora() {
    const opciones = ['agua', 'fuego', 'tierra'];
    const indiceAleatorio = Math.floor(Math.random() * 3);
    return opciones[indiceAleatorio];
}

// Función para determinar el ganador
function determinarGanador(eleccionJugador, eleccionComputadora) {
    if (eleccionJugador === eleccionComputadora) {
        return 'empate';
    }

    const reglas = {
        'agua': 'fuego',
        'fuego': 'tierra',
        'tierra': 'agua'
    };

    return reglas[eleccionJugador] === eleccionComputadora ? 'jugador' : 'computadora';
}

// Función para actualizar los contadores
function actualizarContadores(resultado) {
    switch (resultado) {
        case 'jugador':
            victoriasJugador++;
            contadorJugador.textContent = victoriasJugador;
            break;
        case 'computadora':
            victoriasComputadora++;
            contadorComputadora.textContent = victoriasComputadora;
            break;
        case 'empate':
            empates++;
            contadorEmpates.textContent = empates;
            break;
    }
}

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
    const eventObject = {
        name,
        timestamp: new Date().toISOString(),
        details
    };

    eventCounts[name] = (eventCounts[name] || 0) + 1;
    eventHistory.push(eventObject);
    saveEventStore();
    dispatchLocalEvent(eventObject);
}

window.addEventListener('online', flushPendingEvents);
window.addEventListener('beforeunload', () => {
    if (pendingEvents.length > 0) {
        localStorage.setItem('pendingGameEvents', JSON.stringify(pendingEvents));
    }
});
window.addEventListener('load', () => {
    loadEventStore();
    const savedEvents = localStorage.getItem('pendingGameEvents');
    if (savedEvents) {
        try {
            pendingEvents = JSON.parse(savedEvents).concat(pendingEvents);
            localStorage.removeItem('pendingGameEvents');
            flushPendingEvents();
        } catch (error) {
            console.warn('No se pudieron restaurar eventos pendientes del almacenamiento local');
        }
    }
});

// Función para mostrar la imagen del ganador
function mostrarImagenGanador(resultado, eleccionJugador, eleccionComputadora) {
    const imagenes = {
        'agua': 'img/Gomamon.jpg',
        'fuego': 'img/Coronamon.jpg',
        'tierra': 'img/Armadillomon.png'
    };

    if (resultado === 'empate') {
        imagenGanador.style.display = 'none';
        resultadoTexto.textContent += '\n¡Empate! Nadie gana esta ronda.';
    } else {
        const eleccionGanadora = resultado === 'jugador' ? eleccionJugador : eleccionComputadora;
        imagenGanador.src = imagenes[eleccionGanadora];
        imagenGanador.style.display = 'block';
    }
}

// Función para jugar una ronda
function jugarRonda(eleccionJugador) {
    const eleccionComputadora = obtenerEleccionComputadora();
    const resultado = determinarGanador(eleccionJugador, eleccionComputadora);
    
    actualizarContadores(resultado);
    mostrarImagenGanador(resultado, eleccionJugador, eleccionComputadora);
    
    // Mostrar resultado
    let mensaje = `Tu elección: ${eleccionJugador}\n`;
    mensaje += `Computadora: ${eleccionComputadora}\n`;
    mensaje += resultado === 'empate' ? '¡Empate! Nadie gana esta ronda.' : 
               resultado === 'jugador' ? '¡Ganaste!' : '¡Perdiste!';
    
    resultadoTexto.textContent = mensaje;
    logGameEvent('round_played', {
        eleccionJugador,
        eleccionComputadora,
        resultado,
        victoriasJugador,
        victoriasComputadora,
        empates
    });
}

// Eventos
opcionesJugador.forEach(opcion => {
    opcion.addEventListener('click', () => {
        const eleccion = opcion.dataset.opcion;
        logGameEvent('player_choice', { eleccion });
        jugarRonda(eleccion);
    });
});

botonReiniciar.addEventListener('click', () => {
    logGameEvent('game_restart', {
        victoriasJugador,
        victoriasComputadora,
        empates
    });
    victoriasJugador = 0;
    victoriasComputadora = 0;
    empates = 0;
    contadorJugador.textContent = '0';
    contadorComputadora.textContent = '0';
    contadorEmpates.textContent = '0';
    resultadoTexto.textContent = '';
    imagenGanador.style.display = 'none';
});

botonFinalizar.addEventListener('click', () => {
    logGameEvent('game_finish_requested', {
        victoriasJugador,
        victoriasComputadora,
        empates
    });
    
    // Crear el cuadro de resultados finales
    let cuadroResultados = document.getElementById('cuadro-resultados-finales');
    
    // Si ya existe, lo removemos para crear uno nuevo
    if (cuadroResultados) {
        cuadroResultados.remove();
    }
    
    // Crear el nuevo cuadro
    cuadroResultados = document.createElement('div');
    cuadroResultados.id = 'cuadro-resultados-finales';
    cuadroResultados.className = 'cuadro-resultados-finales';
    
    // Determinar el ganador general
    let ganadorGeneral = '';
    if (victoriasJugador > victoriasComputadora) {
        ganadorGeneral = '¡Felicidades! ¡Ganaste la partida!';
    } else if (victoriasComputadora > victoriasJugador) {
        ganadorGeneral = '¡La computadora ganó la partida!';
    } else {
        ganadorGeneral = '¡La partida terminó en empate!';
    }
    
    cuadroResultados.innerHTML = `
        <h3>Resultados Finales de la Partida</h3>
        <div class="resultados-finales-contenido">
            <p class="resultado-ganador">${ganadorGeneral}</p>
            <div class="estadisticas-finales">
                <div class="stat-final">
                    <span class="label">Victorias del Jugador:</span>
                    <span class="valor">${victoriasJugador}</span>
                </div>
                <div class="stat-final">
                    <span class="label">Victorias de la Computadora:</span>
                    <span class="valor">${victoriasComputadora}</span>
                </div>
                <div class="stat-final">
                    <span class="label">Empates:</span>
                    <span class="valor">${empates}</span>
                </div>
            </div>
            <p class="mensaje-final">¡Gracias por jugar!</p>
        </div>
    `;
    
    // Insertar el cuadro después del contenedor de controles
    const controlesContainer = document.querySelector('.controles-container');
    controlesContainer.parentNode.insertBefore(cuadroResultados, controlesContainer.nextSibling);
}); 