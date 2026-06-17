// Configuración del juego
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'juego-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 200 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Variables globales del juego
let game = null;
let player;
let balloons;
let cursors;
let score = 0;
let lives = 3;
let timeLeft = 60;
let gameOver = false;
let scoreText;
let livesText;
let timeText;
let balloonTypes = ['red', 'yellow', 'blue', 'green'];

let motionControlsEnabled = false;
let motionPermissionGranted = false;
let currentMotionDirection = 'none';
let lastMotionAction = null;
let activeMotionVelocity = { x: 0, y: 0 };

const MOTION_ACTION_OPTIONS = [
    { value: 'none', label: 'Ninguno' },
    { value: 'move_left', label: 'Mover Izquierda' },
    { value: 'move_right', label: 'Mover Derecha' },
    { value: 'move_up', label: 'Mover Arriba' },
    { value: 'move_down', label: 'Mover Abajo' },
    { value: 'start_game', label: 'Iniciar Juego' },
    { value: 'restart_game', label: 'Reiniciar Juego' },
    { value: 'finish_game', label: 'Finalizar Partida' }
];

const DEFAULT_MOTION_MAPPINGS = {
    left: 'move_left',
    right: 'move_right',
    up: 'move_up',
    down: 'move_down'
};

const motionControlMappings = { ...DEFAULT_MOTION_MAPPINGS };

const EVENT_SERVER_URL = null; // No remote event endpoint on GitHub Pages
const EVENT_HISTORY_KEY = 'gameEventHistory';
const EVENT_COUNTS_KEY = 'gameEventCounts';

// Detectar si estamos en desarrollo local o producción
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const WS_SERVER_URL = isDevelopment 
    ? 'ws://localhost:8080'  // Servidor local para desarrollo
    : 'wss://gamehubmanager.azurewebsites.net/ws';  // Servidor remoto (no disponible)

let pendingEvents = [];
let websocketQueue = [];
let wsConnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;
let eventHistory = [];
let eventCounts = {};
let socket = null;

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

function isWebSocketOpen() {
    return socket && socket.readyState === WebSocket.OPEN;
}

function setWebSocketStatus(status) {
    const statusElement = document.getElementById('ws-connection-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

function connectWebSocket() {
    if (!('WebSocket' in window)) {
        console.warn('WebSocket no es compatible en este navegador.');
        setWebSocketStatus('No soportado');
        return;
    }
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket ya está conectando o conectado.');
        return;
    }

    wsConnectionAttempts++;
    const serverUrlDisplay = isDevelopment ? `ws://localhost:8080 [DEV]` : WS_SERVER_URL;
    
    console.log(`[Intento ${wsConnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}] Conectando a ${serverUrlDisplay}...`);
    
    try {
        socket = new WebSocket(WS_SERVER_URL);
    } catch (creationError) {
        console.error('Fallo al crear WebSocket con URL', WS_SERVER_URL, creationError);
        setWebSocketStatus('Error al crear socket');
        return;
    }

    setWebSocketStatus('Conectando...');

    socket.addEventListener('open', (evt) => {
        console.log('✅ WebSocket conectado a', WS_SERVER_URL);
        wsConnectionAttempts = 0; // Reiniciar contador
        stopRankingSimulation();
        setWebSocketStatus('✓ Conectado');
        
        while (websocketQueue.length > 0) {
            sendWebSocketEvent(websocketQueue.shift());
        }
        while (pendingEvents.length > 0) {
            sendWebSocketEvent(pendingEvents.shift());
        }
        localStorage.removeItem('pendingGameEvents');
    });

    socket.addEventListener('message', (message) => {
        try {
            const payload = JSON.parse(message.data);
            console.log('📨 Mensaje del servidor:', payload);
            if (payload.type === 'ranking_update' || payload.ranking || payload.players || payload.data) {
                updateRankingUI(payload);
            }
        } catch (error) {
            console.warn('No se pudo parsear el mensaje WebSocket:', error, message.data);
        }
    });

    socket.addEventListener('close', (event) => {
        console.warn('⚠️ WebSocket desconectado.', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        setWebSocketStatus(`Desconectado (${event.code})`);
        
        // Intentar reconectar si no hemos llegado al máximo de intentos
        if (wsConnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
            const delay = Math.min(5000 * wsConnectionAttempts, 30000); // Backoff exponencial máx 30s
            console.log(`Reintentando en ${delay}ms...`);
            setTimeout(connectWebSocket, delay);
        } else {
            console.error(`❌ No se pudo conectar después de ${MAX_RECONNECTION_ATTEMPTS} intentos. Usa el botón "Reconectar" para intentar de nuevo.`);
            setWebSocketStatus(`Falló (${MAX_RECONNECTION_ATTEMPTS} intentos)`);
            // Iniciar simulación para que la UI muestre datos aunque el servidor no exista
            startRankingSimulation();
        }
    });

    socket.addEventListener('error', (event) => {
        console.error('❌ Error de WebSocket:', {
            readyState: socket?.readyState,
            url: socket?.url,
            error: event
        });
        setWebSocketStatus('Error de conexión');
        
        try {
            if (socket && socket.readyState !== WebSocket.CLOSED) {
                socket.close();
            }
        } catch (closeErr) {
            console.warn('Error al cerrar socket:', closeErr);
        }
    });
}

function sendWebSocketEvent(eventObject) {
    if (!isWebSocketOpen()) {
        websocketQueue.push(eventObject);
        return;
    }

    const envelope = {
        type: 'game_event',
        payload: eventObject
    };

    socket.send(JSON.stringify(envelope));
}

function flushPendingEvents() {
    if (isWebSocketOpen()) {
        while (websocketQueue.length > 0) {
            sendWebSocketEvent(websocketQueue.shift());
        }
        while (pendingEvents.length > 0) {
            sendWebSocketEvent(pendingEvents.shift());
        }
        localStorage.removeItem('pendingGameEvents');
    }
}

function exportEventsAsJSON() {
    const exportData = {
        exportDate: new Date().toISOString(),
        gameStats: {
            totalEvents: eventHistory.length,
            eventCounts: eventCounts
        },
        events: eventHistory
    };
    return JSON.stringify(exportData, null, 2);
}

function downloadEventsJSON() {
    const jsonData = exportEventsAsJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game-events-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('Eventos descargados como JSON');
}

function getEventsJSON() {
    return exportEventsAsJSON();
}

function sendEventsToServer(serverURL) {
    const jsonData = exportEventsAsJSON();
    fetch(serverURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: jsonData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Eventos enviados al servidor:', data);
        logGameEvent('events_sent_to_server', { serverURL, eventCount: eventHistory.length });
    })
    .catch(error => {
        console.error('Error al enviar eventos:', error);
        logGameEvent('events_send_error', { error: error.message });
    });
}

function updateRankingUI(serverPayload) {
    const rankingContainer = document.getElementById('ranking-list');
    if (!rankingContainer) {
        return;
    }

    let ranking = [];
    if (Array.isArray(serverPayload.ranking)) {
        ranking = serverPayload.ranking;
    } else if (Array.isArray(serverPayload.players)) {
        ranking = serverPayload.players;
    } else if (Array.isArray(serverPayload.data)) {
        ranking = serverPayload.data;
    } else if (serverPayload.type === 'ranking_update' && Array.isArray(serverPayload.payload)) {
        ranking = serverPayload.payload;
    }
    // Asegurarse que los datos estén ordenados por score descendente
    ranking.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Mostrar únicamente el top 5
    const top = ranking.slice(0, 5);

    rankingContainer.innerHTML = '';
    if (top.length === 0) {
        rankingContainer.innerHTML = '<li>No hay datos de ranking disponibles</li>';
        return;
    }

    top.forEach((player, index) => {
        const item = document.createElement('li');
        const name = player.name || player.username || player.id || `Jugador ${index + 1}`;
        const value = (player.score !== undefined) ? player.score : (player.points || '');
        item.textContent = `${index + 1}. ${name}${value !== '' ? ` — ${value}` : ''}`;
        rankingContainer.appendChild(item);
    });
}

// --- Fallback: simulación de ranking para demos locales cuando no hay servidor ---
let rankingSimInterval = null;
function startRankingSimulation() {
    if (rankingSimInterval) return;
    console.log('Iniciando simulación de ranking (fallback)');
    const generate = () => {
        const players = [];
        for (let i = 0; i < 5; i++) {
            players.push({
                id: `sim-${i+1}`,
                name: `SimJugador ${i+1}`,
                score: Math.floor(Math.random() * 5000)
            });
        }
        updateRankingUI({ ranking: players });
    };
    generate();
    rankingSimInterval = setInterval(generate, 4000);
}

function stopRankingSimulation() {
    if (!rankingSimInterval) return;
    clearInterval(rankingSimInterval);
    rankingSimInterval = null;
    console.log('Simulación de ranking detenida');
}

function showEventsModal() {
    const eventosInfo = document.getElementById('eventos-info');
    const totalEventos = document.getElementById('total-eventos');
    const eventosPreview = document.getElementById('eventos-preview');
    
    totalEventos.textContent = eventHistory.length;
    eventosPreview.textContent = exportEventsAsJSON();
    eventosInfo.style.display = 'block';
    
    console.log('Mostrando eventos:', eventHistory);
}

function clearAllEvents() {
    if (confirm('¿Estás seguro de que deseas limpiar todos los eventos registrados?')) {
        eventHistory = [];
        eventCounts = {};
        saveEventStore();
        alert('Todos los eventos han sido eliminados.');
        logGameEvent('events_cleared', {});
        const eventosInfo = document.getElementById('eventos-info');
        if (eventosInfo) {
            eventosInfo.style.display = 'none';
        }
    }
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

    if (isWebSocketOpen()) {
        sendWebSocketEvent(eventObject);
    } else {
        websocketQueue.push(eventObject);
    }
}

window.addEventListener('online', flushPendingEvents);
window.addEventListener('beforeunload', () => {
    if (pendingEvents.length > 0) {
        localStorage.setItem('pendingGameEvents', JSON.stringify(pendingEvents));
    }
});

window.addEventListener('load', () => {
    loadEventStore();
    console.log('Eventos acumulados cargados:', eventCounts);

    initializeMotionControls();

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

    connectWebSocket();
});

function initializeMotionControls() {
    const directions = ['left', 'right', 'up', 'down'];
    directions.forEach((direction) => {
        const select = document.getElementById(`motion-${direction}`);
        if (!select) return;
        select.innerHTML = '';
        MOTION_ACTION_OPTIONS.forEach((option) => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            if (option.value === DEFAULT_MOTION_MAPPINGS[direction]) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
        select.addEventListener('change', () => {
            motionControlMappings[direction] = select.value;
        });
        motionControlMappings[direction] = select.value;
    });

    const enableCheckbox = document.getElementById('motion-enable');
    if (enableCheckbox) {
        enableCheckbox.checked = false;
        enableCheckbox.addEventListener('change', updateMotionEnable);
    }

    const permissionButton = document.getElementById('motion-permission');
    if (permissionButton) {
        permissionButton.addEventListener('click', requestGyroscopePermission);
    }

    const resetButton = document.getElementById('motion-reset');
    if (resetButton) {
        resetButton.addEventListener('click', resetMotionMappings);
    }
}

function updateMotionEnable() {
    motionControlsEnabled = document.getElementById('motion-enable')?.checked === true;
    if (motionControlsEnabled) {
        startMotionListener();
    } else {
        stopMotionListener();
        currentMotionDirection = 'none';
        activeMotionVelocity = { x: 0, y: 0 };
    }
}

function startMotionListener() {
    if (!('DeviceOrientationEvent' in window)) {
        alert('Este navegador no soporta controles de orientación. Usa un navegador móvil compatible o el emulador de sensores.');
        return;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' && !motionPermissionGranted) {
        alert('Presiona "Solicitar permiso del giroscopio" antes de habilitar los controles por movimiento.');
        document.getElementById('motion-enable').checked = false;
        motionControlsEnabled = false;
        return;
    }

    window.addEventListener('deviceorientation', handleDeviceOrientation);
    window.addEventListener('devicemotion', handleDeviceMotion);
    logGameEvent('motion_controls_enabled', { motionPermissionGranted });
}

function stopMotionListener() {
    window.removeEventListener('deviceorientation', handleDeviceOrientation);
    window.removeEventListener('devicemotion', handleDeviceMotion);
    logGameEvent('motion_controls_disabled', {});
}

function requestGyroscopePermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then((permissionState) => {
                if (permissionState === 'granted') {
                    motionPermissionGranted = true;
                    logGameEvent('gyroscope_permission_granted', {});
                    if (document.getElementById('motion-enable')?.checked) {
                        startMotionListener();
                    }
                    alert('Permiso de giroscopio otorgado. Ahora habilita los controles por movimiento si deseas usarlos.');
                } else {
                    logGameEvent('gyroscope_permission_denied', { permissionState });
                    alert('Permiso de giroscopio denegado. No se podrán usar los controles por movimiento.');
                }
            })
            .catch((error) => {
                motionPermissionGranted = false;
                console.warn('Error solicitando permiso de giroscopio:', error);
                alert('No se pudo solicitar permiso al giroscopio: ' + error.message);
            });
    } else {
        motionPermissionGranted = true;
        logGameEvent('gyroscope_permission_not_required', {});
        alert('Tu navegador no requiere permiso explícito para acceder al giroscopio. Activa los controles por movimiento y prueba la inclinación.');
    }
}

function handleDeviceOrientation(event) {
    if (!motionControlsEnabled) return;
    const beta = event.beta;
    const gamma = event.gamma;
    if (typeof beta !== 'number' || typeof gamma !== 'number') return;

    const threshold = 15;
    let direction = 'none';

    if (gamma <= -threshold) {
        direction = 'left';
    } else if (gamma >= threshold) {
        direction = 'right';
    } else if (beta <= -threshold) {
        direction = 'up';
    } else if (beta >= threshold) {
        direction = 'down';
    }

    if (direction === currentMotionDirection) {
        updateMotionVelocityForDirection(direction);
        return;
    }

    currentMotionDirection = direction;
    lastMotionAction = null;
    updateMotionVelocityForDirection(direction);
}

function handleDeviceMotion(event) {
    if (!motionControlsEnabled) return;
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;
    const total = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
    if (total > 30) {
        logGameEvent('device_shake_detected', { total });
    }
}

function updateMotionVelocityForDirection(direction) {
    const action = direction === 'none' ? 'none' : motionControlMappings[direction];
    if (direction === 'none') {
        activeMotionVelocity = { x: 0, y: 0 };
        return;
    }

    if (action === 'move_left') {
        activeMotionVelocity = { x: -300, y: 0 };
    } else if (action === 'move_right') {
        activeMotionVelocity = { x: 300, y: 0 };
    } else if (action === 'move_up') {
        activeMotionVelocity = { x: 0, y: -300 };
    } else if (action === 'move_down') {
        activeMotionVelocity = { x: 0, y: 300 };
    } else {
        activeMotionVelocity = { x: 0, y: 0 };
        if (action && action !== 'none' && action !== lastMotionAction) {
            performMotionAction(action);
            lastMotionAction = action;
        }
    }

    if (action && action.startsWith('move_')) {
        logGameEvent('motion_control_movement', { direction, action });
    }
}

function performMotionAction(action) {
    if (action === 'start_game') {
        document.getElementById('iniciar')?.click();
    } else if (action === 'restart_game') {
        document.getElementById('reiniciar')?.click();
    } else if (action === 'finish_game') {
        document.getElementById('finalizar')?.click();
    }
}

function resetMotionMappings() {
    Object.assign(motionControlMappings, DEFAULT_MOTION_MAPPINGS);
    ['left', 'right', 'up', 'down'].forEach((direction) => {
        const select = document.getElementById(`motion-${direction}`);
        if (select) {
            select.value = DEFAULT_MOTION_MAPPINGS[direction];
        }
    });
    logGameEvent('motion_control_mappings_reset', {});
}


// Precarga de recursos
function preload() {
    // Agregar mensajes de depuración
    console.log('Iniciando carga de recursos...');
    
    // Cargar imágenes con manejo de errores
    this.load.on('loaderror', (file) => {
        console.error('Error al cargar:', file.src);
    });

    this.load.on('filecomplete', (key) => {
        console.log('Archivo cargado exitosamente:', key);
    });

    // Cargar imágenes usando rutas relativas
    this.load.image('player', 'img/assets/Gumdramon.png');
    this.load.image('redBalloon', 'img/assets/Red Balloon.png');
    this.load.image('yellowBalloon', 'img/assets/Yellow Balloon.png');
    this.load.image('blueBalloon', 'img/assets/Blue Balloon.png');
    this.load.image('greenBalloon', 'img/assets/Green Balloon.png');
    this.load.image('background', 'img/assets/background.png');

    // Esperar a que todas las imágenes se carguen
    this.load.on('complete', () => {
        console.log('Todas las imágenes han sido cargadas');
        logGameEvent('assets_loaded', { files: this.load.totalToLoad });
    });
}

// Creación de elementos del juego
function create() {
    console.log('Creando elementos del juego...');
    
    // Verificar que las texturas existan
    console.log('Texturas disponibles:', this.textures.getTextureKeys());
    
    // Fondo
    const background = this.add.image(400, 300, 'background');
    background.setDisplaySize(800, 600);
    console.log('Fondo creado');

    // Jugador
    player = this.physics.add.sprite(400, 500, 'player');
    player.setCollideWorldBounds(true);
    player.setScale(0.5); // Ajustar el tamaño del jugador
    console.log('Jugador creado');

    // Grupo de globos
    balloons = this.physics.add.group();
    console.log('Grupo de globos creado');

    // Controles
    cursors = this.input.keyboard.createCursorKeys();

    // Textos
    scoreText = this.add.text(16, 16, 'Globos: 0', { fontSize: '32px', fill: '#fff' });
    livesText = this.add.text(16, 56, 'Vidas: 3', { fontSize: '32px', fill: '#fff' });
    timeText = this.add.text(16, 96, 'Tiempo: 60', { fontSize: '32px', fill: '#fff' });

    logGameEvent('game_created', { score, lives, timeLeft });

    // Timer
    this.time.addEvent({
        delay: 1000,
        callback: updateTimer,
        callbackScope: this,
        loop: true
    });

    // Spawn de globos
    this.time.addEvent({
        delay: 2000,
        callback: spawnBalloon,
        callbackScope: this,
        loop: true
    });

    // Colisiones
    this.physics.add.overlap(player, balloons, popBalloon, null, this);
}

// Actualización del juego
function update() {
    if (gameOver) return;

    let velocityX = 0;
    let velocityY = 0;

    if (motionControlsEnabled) {
        velocityX = activeMotionVelocity.x;
        velocityY = activeMotionVelocity.y;
    }

    if (cursors.left.isDown) {
        velocityX = -300;
    } else if (cursors.right.isDown) {
        velocityX = 300;
    }

    if (cursors.up.isDown) {
        velocityY = -300;
    } else if (cursors.down.isDown) {
        velocityY = 300;
    }

    player.setVelocityX(velocityX);
    player.setVelocityY(velocityY);

    // Verificar globos que tocan el suelo
    balloons.getChildren().forEach(balloon => {
        if (balloon.y > 550) {
            balloon.destroy();
            loseLife();
        }
    });
}

// Función para crear globos
function spawnBalloon() {
    if (gameOver) return;
    
    const x = Phaser.Math.Between(50, 750);
    const balloonType = balloonTypes[Phaser.Math.Between(0, balloonTypes.length - 1)];
    const balloon = balloons.create(x, 0, balloonType + 'Balloon');
    
    // Ajustar el tamaño de los globos
    balloon.setScale(0.3); // Reducido de 0.5 a 0.3
    
    // Ajustar el cuerpo físico para que coincida con el tamaño visual
    balloon.body.setSize(balloon.width * 0.3, balloon.height * 0.3);
    
    balloon.setVelocity(Phaser.Math.Between(-50, 50), 100);
    balloon.setBounce(0.5);
    balloon.setCollideWorldBounds(true);
}

// Función para reventar globos
function popBalloon(player, balloon) {
    balloon.destroy();
    score += 1;
    scoreText.setText('Globos: ' + score);
    
    // Actualizar el contador en el HTML
    document.getElementById('globos-reventados').textContent = score;
    logGameEvent('balloon_popped', { score });
}

// Función para perder vidas
function loseLife() {
    lives -= 1;
    livesText.setText('Vidas: ' + lives);
    
    // Actualizar el contador de vidas en el HTML
    document.getElementById('vidas').textContent = lives;
    logGameEvent('life_lost', { lives });
    
    if (lives <= 0) {
        const scene = game.scene.scenes[0];
        endGame(scene, true); // Pasamos la escena y el flag
    }
}

// Función para actualizar el timer
function updateTimer() {
    if (gameOver) return;
    
    timeLeft -= 1;
    timeText.setText('Tiempo: ' + timeLeft);
    
    // Actualizar el contador de tiempo en el HTML
    document.getElementById('tiempo').textContent = timeLeft;
    
    if (timeLeft <= 0) {
        const scene = game.scene.scenes[0];
        endGame(scene, false, true); // Agregamos un tercer parámetro para indicar victoria
    }
}

// Función para terminar el juego
function endGame(scene, perdioPorVidas = false, victoria = false) {
    gameOver = true;
    scene.physics.pause();
    
    // Crear un fondo semi-transparente para el mensaje
    const overlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    
    let mensajeFinal;
    if (victoria) {
        mensajeFinal = '¡Felicidades! ¡Has ganado!';
    } else if (perdioPorVidas) {
        mensajeFinal = '¡Te quedaste sin vidas!';
    } else {
        mensajeFinal = '¡Juego Terminado!';
    }
    
    // Mensaje principal
    const gameOverText = scene.add.text(400, 250, mensajeFinal, {
        fontSize: '48px',
        fill: '#fff',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 6
    }).setOrigin(0.5);
    
    // Puntuación final
    const finalScoreText = scene.add.text(400, 350, `Puntuación Final: ${score}`, {
        fontSize: '36px',
        fill: '#fff',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(0.5);
    
    // Mensaje adicional
    const continueText = scene.add.text(400, 450, 'Presiona "Reiniciar Juego" para jugar de nuevo', {
        fontSize: '24px',
        fill: '#fff',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5);
    
    // Actualizar el resultado en el HTML
    document.getElementById('resultado').textContent = 
        `${mensajeFinal}\nPuntuación Final: ${score} globos reventados`;
    logGameEvent('game_end', { result: mensajeFinal, score, lives, timeLeft });
}

// Eventos de los botones
document.getElementById('iniciar').addEventListener('click', () => {
    logGameEvent('game_start', { hasGame: Boolean(game) });
    if (!game) {
        game = new Phaser.Game(config);
    } else {
        game.scene.restart();
    }
    resetGame();
});

document.getElementById('reiniciar').addEventListener('click', () => {
    logGameEvent('game_restart', { score, lives, timeLeft });
    // Limpiar los contadores en el HTML
    document.getElementById('resultado').textContent = '';
    document.getElementById('globos-reventados').textContent = '0';
    document.getElementById('vidas').textContent = '3';
    document.getElementById('tiempo').textContent = '60';
    
    // Limpiar el contenedor del juego
    const juegoContainer = document.getElementById('juego-container');
    juegoContainer.innerHTML = '';

    // Destruir la instancia actual del juego si existe
    if (game) {
        game.destroy(true);
        game = null;
    }
});

document.getElementById('finalizar').addEventListener('click', () => {
    logGameEvent('game_finish_requested', { score, lives, timeLeft });
    if (game) {
        const scene = game.scene.scenes[0];
        endGame(scene, false);
    }
});

document.getElementById('reconectar-websocket').addEventListener('click', () => {
    // Reiniciar contador para permitir nuevos intentos y detener la simulación fallback
    wsConnectionAttempts = 0;
    stopRankingSimulation();
    connectWebSocket();
    logGameEvent('websocket_reconnect_requested', {});
});

// Función para reiniciar el juego
function resetGame() {
    score = 0;
    lives = 3;
    timeLeft = 60;
    gameOver = false;
    scoreText.setText('Globos: 0');
    livesText.setText('Vidas: 3');
    timeText.setText('Tiempo: 60');
    document.getElementById('resultado').textContent = '';
    document.getElementById('globos-reventados').textContent = '0';
    document.getElementById('vidas').textContent = '3';
    document.getElementById('tiempo').textContent = '60';
} 