# Guía: Servidor WebSocket Local para Balloon Pop

## Problema Original
El servidor remoto `wss://gamehubmanager.azurewebsites.net/ws` no está disponible, por lo que la conexión WebSocket fallaba constantemente.

## Solución: Servidor Local

Se ha creado un servidor WebSocket local que **emula el servidor remoto** para propósitos de desarrollo y testing.

### ✅ Pasos para Ejecutar

#### 1. Instalar dependencias (primera vez)
```bash
npm install
```

#### 2. Iniciar el servidor
```bash
npm start
```

El servidor escuchará en: **`ws://localhost:8080`**

```
╔════════════════════════════════════════╗
║  Servidor WebSocket activo             ║
║  Escuchando en: ws://localhost:8080    ║
║  Clientes conectados: 0                ║
╚════════════════════════════════════════╝
```

#### 3. Abrir el juego en el navegador
1. Desde una terminal en la carpeta del proyecto, sirve los archivos:
   ```bash
   python -m http.server 8000
   ```
   O si tienes Node.js/npm instalado:
   ```bash
   npx http-server
   ```

2. Abre tu navegador en: **`http://localhost:8000/Balloon-Pop.html`**

3. Verás en la consola del navegador:
   ```
   [Intento 1/5] Conectando a ws://localhost:8080 [DEV]...
   ✅ WebSocket conectado a ws://localhost:8080
   ```

### 🔄 Flujo de Reconexión

El cliente ahora:
- Detecta automáticamente si está en `localhost` y usa el servidor local
- Si la conexión falla, intenta reconectar **hasta 5 veces** con backoff exponencial
- Muestra el estado en la UI: "✓ Conectado", "Desconectado (1000)", etc.
- Guarda eventos en cola mientras está desconectado y los envía al reconectar

### 📊 Funcionalidades del Servidor

- ✅ Recibe eventos del juego (`game_event`, `game_start`, `game_end`, etc.)
- ✅ Mantiene un ranking actualizado basado en puntuaciones finales
- ✅ Broadcast ranking a todos los clientes conectados cuando hay cambios
- ✅ Logs en tiempo real de eventos y conexiones
- ✅ Estadísticas cada 10 segundos

### 🧪 Probar la Conexión

En la consola del navegador, ejecuta:
```javascript
// Verificar estado
console.log(socket?.url)      // ws://localhost:8080
console.log(socket?.readyState) // 1 = OPEN
```

### 🔧 Cambiar el Servidor en Producción

Si tienes un servidor remoto disponible en el futuro, edita [balloon.js](balloon.js):

```javascript
const WS_SERVER_URL = isDevelopment 
    ? 'ws://localhost:8080'              // Desarrollo local
    : 'wss://mi-servidor.com/ws';        // Producción
```

### 🚫 Detener el Servidor

Presiona **Ctrl+C** en la terminal donde corre el servidor.

---

**Nota:** Este servidor es para **desarrollo y testing local**. Para producción, necesitarías un servidor WebSocket persistente (AWS, Azure, Heroku, etc.).
