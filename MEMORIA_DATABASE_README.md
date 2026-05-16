# Base de Datos para el Juego de Memoria

## 📋 Descripción

El juego de memoria ahora utiliza una base de datos **SQLite** para almacenar el historial de todas las partidas jugadas. Cada vez que completes o finalices una partida, los datos se guardan automáticamente.

## 🗄️ Estructura de la Base de Datos

### Tabla: `partidas`

La tabla almacena la siguiente información de cada partida:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER | Identificador único (auto-incrementable) |
| `fecha` | DATETIME | Fecha y hora en que se jugó la partida |
| `ganada` | INTEGER | 1 si ganaste, 0 si perdiste |
| `parejas_encontradas` | INTEGER | Número de parejas encontradas |
| `intentos` | INTEGER | Número de intentos realizados |
| `tiempo_transcurrido` | INTEGER | Tiempo en segundos que duró la partida |
| `tiempo_limite` | INTEGER | Tiempo límite configurado (actualmente 120 segundos) |

## 🎮 Funcionalidades

### 1. Guardar Partidas Automáticamente
Cada partida se guarda automáticamente cuando:
- Ganas encontrando todas las parejas
- Se acaba el tiempo
- Finalizas manualmente la partida

### 2. Ver Historial
Haz clic en el botón **"Ver Historial"** para ver las últimas 20 partidas con:
- Fecha y hora
- Resultado (Ganada/Perdida)
- Parejas encontradas
- Intentos realizados
- Tiempo transcurrido

### 3. Ver Estadísticas
Haz clic en el botón **"Ver Estadísticas"** para ver:
- Total de partidas jugadas
- Número de partidas ganadas y porcentaje
- Promedio de intentos
- Mejor partida (menor número de intentos)
- Tiempo promedio en partidas ganadas

### 4. Descargar Base de Datos
Haz clic en el botón **"Descargar Base de Datos"** para descargar el archivo SQLite (`memoria_juego.db`).

## 💻 Usando SQLite Studio

### Pasos para ver la base de datos en SQLite Studio:

1. **Descarga SQLite Studio** (si aún no lo tienes):
   - Visita: https://sqlitestudio.pl/
   - Descarga e instala la versión para tu sistema operativo

2. **Descarga la base de datos desde el juego**:
   - Juega al menos una partida para generar datos
   - Haz clic en el botón "Descargar Base de Datos"
   - Se descargará el archivo `memoria_juego.db`

3. **Abre SQLite Studio**:
   - Abre SQLite Studio

4. **Conectar la base de datos**:
   - Clic en "Database" → "Add a database" (o presiona Ctrl+O)
   - Navega a la ubicación donde guardaste `memoria_juego.db`
   - Selecciona el archivo y haz clic en "Open"

5. **Explorar los datos**:
   - Expande la base de datos en el panel izquierdo
   - Expandee "Tables"
   - Haz doble clic en la tabla `partidas`
   - Verás todas tus partidas con todos los detalles

### Consultas SQL Ejemplo

Puedes ejecutar consultas SQL desde SQLite Studio:

```sql
-- Ver todas las partidas ordenadas por fecha
SELECT * FROM partidas ORDER BY fecha DESC;

-- Ver solo las partidas ganadas
SELECT * FROM partidas WHERE ganada = 1 ORDER BY fecha DESC;

-- Ver el promedio de intentos
SELECT AVG(intentos) as promedio_intentos FROM partidas;

-- Ver la partida con menos intentos
SELECT * FROM partidas WHERE intentos = (SELECT MIN(intentos) FROM partidas);

-- Contar partidas por resultado
SELECT 
    ganada,
    COUNT(*) as total,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM partidas), 2) as porcentaje
FROM partidas
GROUP BY ganada;
```

## 🔧 Tecnologías Utilizadas

- **SQL.js**: Librería JavaScript que permite usar SQLite en el navegador
- **SQLite**: Base de datos ligera y embebida
- **HTML5**: Para la interfaz del juego
- **JavaScript**: Para la lógica del juego y manejo de la base de datos

## 📝 Notas Importantes

- La base de datos se almacena en memoria del navegador (no persiste al cerrar la página por defecto)
- Para mantener los datos entre sesiones, descarga la base de datos usando el botón "Descargar Base de Datos"
- Cada vez que recargas la página, se crea una nueva base de datos vacía
- El historial visible en la interfaz muestra las últimas 20 partidas
- La base de datos completa se puede exportar y abrir en SQLite Studio

## 🎯 Mejoras Futuras

Posibles mejoras que se pueden implementar:
- Guardar la base de datos en localStorage para persistencia
- Rankings globales
- Diferentes niveles de dificultad
- Comparar estadísticas entre jugadores
- Generar reportes en PDF

