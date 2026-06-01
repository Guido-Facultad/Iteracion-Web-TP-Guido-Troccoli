/**
 * Servidor WebSocket local para testing
 * Emula un servidor de ranking que recibe eventos del juego
 * 
 * Ejecución:
 *   npm install ws
 *   node websocket-server.js
 * 
 * El servidor escucha en ws://localhost:8080
 */

const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false
});

let players = [];
let eventLog = [];

wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substr(2, 9);
    console.log(`[${new Date().toLocaleTimeString()}] Cliente conectado: ${clientId}`);
    
    // Enviar ranking inicial al conectar
    ws.send(JSON.stringify({
        type: 'ranking_update',
        ranking: players
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[${new Date().toLocaleTimeString()}] Mensaje de ${clientId}:`, data);
            
            // Guardar en log de eventos
            eventLog.push({
                clientId,
                timestamp: new Date().toISOString(),
                event: data
            });
            
            // Si es un event de final de juego, añadir al ranking
            if (data.type === 'game_event' && data.payload?.name === 'game_end') {
                const playerName = `Jugador ${Math.floor(Math.random() * 1000)}`;
                const score = data.payload?.details?.score || 0;
                
                // Buscar si ya existe el jugador
                let existingPlayer = players.find(p => p.id === clientId);
                if (!existingPlayer) {
                    existingPlayer = { id: clientId, name: playerName, score: 0 };
                    players.push(existingPlayer);
                }
                existingPlayer.score = Math.max(existingPlayer.score, score);
                
                // Ordenar ranking
                players.sort((a, b) => b.score - a.score);
                
                // Enviar ranking actualizado a todos los clientes
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'ranking_update',
                            ranking: players
                        }));
                    }
                });
                
                console.log('📊 Ranking actualizado:', players);
            }
        } catch (error) {
            console.error('Error al procesar mensaje:', error);
        }
    });

    ws.on('error', (error) => {
        console.error(`Error en cliente ${clientId}:`, error.message);
    });

    ws.on('close', (code, reason) => {
        console.log(`[${new Date().toLocaleTimeString()}] Cliente desconectado: ${clientId} (Código: ${code})`);
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  Servidor WebSocket activo             ║
║  Escuchando en: ws://localhost:${PORT}     ║
║  Clientes conectados: 0                ║
╚════════════════════════════════════════╝
    `);
});

// Mostrar estadísticas cada 10 segundos
setInterval(() => {
    console.log(`👥 Clientes activos: ${wss.clients.size} | 📋 Eventos: ${eventLog.length}`);
}, 10000);

// Manejo de salida limpia
process.on('SIGINT', () => {
    console.log('\n\nCerrando servidor...');
    wss.clients.forEach((client) => {
        client.close(1000, 'Servidor cerrando');
    });
    server.close(() => {
        console.log('Servidor cerrado.');
        process.exit(0);
    });
});
