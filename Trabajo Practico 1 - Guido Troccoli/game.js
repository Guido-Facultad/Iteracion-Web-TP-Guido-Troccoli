// Variables globales para el seguimiento del juego
let victoriasJugador = 0;
let victoriasComputadora = 0;
let empates = 0;

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

// Función para mostrar la imagen del ganador
function mostrarImagenGanador(resultado, eleccionJugador, eleccionComputadora) {
    const imagenes = {
        'agua': 'img/gomamon.jpg',
        'fuego': 'img/coronamon.jpg',
        'tierra': 'img/armadillomon.png'
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
}

// Event Listeners
opcionesJugador.forEach(opcion => {
    opcion.addEventListener('click', () => {
        const eleccion = opcion.dataset.opcion;
        jugarRonda(eleccion);
    });
});

botonReiniciar.addEventListener('click', () => {
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
    const mensajeFinal = `Resultados finales:\n`;
    mensajeFinal += `Victorias del jugador: ${victoriasJugador}\n`;
    mensajeFinal += `Victorias de la computadora: ${victoriasComputadora}\n`;
    mensajeFinal += `Empates: ${empates}\n`;
    mensajeFinal += `¡Gracias por jugar!`;
    
    alert(mensajeFinal);
    window.close();
}); 