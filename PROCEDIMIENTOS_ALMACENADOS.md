# Procedimientos Almacenados Implementados en el Juego de Memoria

## 📋 Resumen

Se han implementado **procedimientos almacenados** en SQLite utilizando **TRIGGERS** y **VIEWS** para automatizar cálculos y consultas complejas.

## 🔧 Procedimientos Almacenados Implementados

### 1. TRIGGER: `actualizar_estadisticas_globales`

**Tipo:** AFTER INSERT TRIGGER  
**Tabla:** `partidas`  
**Función:** Se ejecuta automáticamente después de cada INSERT en la tabla `partidas`

#### Descripción
Este trigger actualiza automáticamente la tabla `estadisticas_globales` cada vez que se guarda una nueva partida. Calcula:
- Total de partidas jugadas
- Partidas ganadas y perdidas
- Promedio de intentos
- Mejor partida (menor número de intentos)
- Tiempo promedio en partidas ganadas
- Fecha de última actualización

#### Código SQL
```sql
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
```

#### Ventajas
- ✅ Automatización completa: no requiere código JavaScript adicional
- ✅ Consistencia: siempre mantiene las estadísticas actualizadas
- ✅ Eficiencia: se ejecuta solo cuando es necesario
- ✅ Integridad: garantiza que las estadísticas siempre reflejen el estado real

---

### 2. VIEW: `vista_partidas_detalladas`

**Tipo:** VIEW (Vista)  
**Función:** Proporciona análisis detallado de cada partida con calificaciones automáticas

#### Descripción
Esta vista calcula automáticamente calificaciones y análisis para cada partida:
- **Calificación de Intentos:** Compara los intentos con el promedio y mejor partida
  - "Excelente": Si tiene menos o igual intentos que la mejor partida
  - "Bueno": Si tiene menos o igual intentos que el promedio
  - "Regular": En otros casos
- **Calificación de Tiempo:** Compara el tiempo con el promedio
  - "Rápido": Si es menor o igual al promedio
  - "Normal": En otros casos

#### Código SQL
```sql
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
```

#### Ventajas
- ✅ Consulta simplificada: una sola query obtiene todos los datos analizados
- ✅ Cálculos automáticos: las calificaciones se calculan dinámicamente
- ✅ Mantenibilidad: cambios en la lógica se hacen en un solo lugar
- ✅ Reutilizable: puede usarse en múltiples partes de la aplicación

---

### 3. VIEW: `vista_ranking_mejores`

**Tipo:** VIEW (Vista)  
**Función:** Genera automáticamente el ranking de las 10 mejores partidas

#### Descripción
Esta vista ordena las partidas ganadas por:
1. **Eficiencia** (descendente): Mayor eficiencia = mejor
2. **Intentos** (ascendente): Menos intentos = mejor
3. **Tiempo** (ascendente): Menor tiempo = mejor

Calcula automáticamente la posición de cada partida en el ranking.

#### Código SQL
```sql
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
```

#### Ventajas
- ✅ Ranking automático: siempre muestra las mejores partidas
- ✅ Ordenamiento complejo: múltiples criterios de ordenamiento
- ✅ Actualización en tiempo real: refleja cambios inmediatamente
- ✅ Optimizado: solo muestra las top 10

---

## 📊 Datos Adicionales Recolectados

### Campos Nuevos en la Tabla `partidas`

1. **`eficiencia`** (REAL)
   - Fórmula: `(parejas_encontradas / intentos) * (tiempo_limite / tiempo_transcurrido) * 100`
   - Mide qué tan eficiente fue la partida
   - Mayor valor = mejor rendimiento

2. **`tiempo_promedio_por_pareja`** (REAL)
   - Fórmula: `tiempo_transcurrido / parejas_encontradas`
   - Tiempo promedio que tomó encontrar cada pareja
   - Útil para medir velocidad de juego

3. **`porcentaje_completado`** (REAL)
   - Fórmula: `(parejas_encontradas / total_pares) * 100`
   - Porcentaje de progreso en la partida
   - Útil incluso en partidas perdidas

### Tabla Nueva: `estadisticas_globales`

Almacena estadísticas agregadas que se actualizan automáticamente por el TRIGGER:
- Total de partidas
- Partidas ganadas/perdidas
- Promedio de intentos
- Mejor partida
- Tiempo promedio en partidas ganadas
- Última actualización

---

## 🎮 Funcionalidades del Juego

### Al Finalizar una Partida

Cuando terminas una partida (ganada o perdida), el juego automáticamente:

1. **Guarda la partida** con todos los datos calculados
2. **El TRIGGER se ejecuta** y actualiza las estadísticas globales
3. **Muestra datos adicionales:**
   - Análisis de la partida actual (eficiencia, tiempo por pareja, progreso)
   - Calificaciones automáticas (Excelente/Bueno/Regular, Rápido/Normal)
   - Estadísticas globales actualizadas automáticamente

### Botones Disponibles

1. **Ver Historial:** Muestra las últimas 20 partidas usando `vista_partidas_detalladas`
2. **Ver Ranking:** Muestra el top 10 usando `vista_ranking_mejores`
3. **Ver Estadísticas:** Muestra estadísticas globales actualizadas por el TRIGGER
4. **Descargar Base de Datos:** Exporta el archivo SQLite para abrir en SQLite Studio

---

## 🔍 Verificación en SQLite Studio

### Pasos para Ver los Procedimientos Almacenados

1. **Descarga la base de datos** desde el juego
2. **Abre SQLite Studio** y carga el archivo `memoria_juego.db`
3. **Ver TRIGGERS:**
   - Expande la base de datos → Triggers
   - Verás `actualizar_estadisticas_globales`
   - Puedes ver su código SQL

4. **Ver VIEWS:**
   - Expande la base de datos → Views
   - Verás `vista_partidas_detalladas` y `vista_ranking_mejores`
   - Puedes ejecutar: `SELECT * FROM vista_partidas_detalladas;`

5. **Verificar el TRIGGER:**
   ```sql
   -- Ver estadísticas antes de insertar
   SELECT * FROM estadisticas_globales;
   
   -- Insertar una partida de prueba
   INSERT INTO partidas (ganada, parejas_encontradas, intentos, tiempo_transcurrido, tiempo_limite, eficiencia, tiempo_promedio_por_pareja, porcentaje_completado)
   VALUES (1, 8, 10, 60, 120, 16.0, 7.5, 100.0);
   
   -- Ver estadísticas después (actualizadas automáticamente)
   SELECT * FROM estadisticas_globales;
   ```

6. **Consultar las VIEWS:**
   ```sql
   -- Ver partidas con análisis detallado
   SELECT * FROM vista_partidas_detalladas ORDER BY fecha DESC;
   
   -- Ver ranking
   SELECT * FROM vista_ranking_mejores;
   ```

---

## ✅ Verificación de Funcionamiento

### Pruebas Realizadas

1. ✅ **TRIGGER se ejecuta automáticamente** al guardar partidas
2. ✅ **VIEWS calculan correctamente** las calificaciones y rankings
3. ✅ **Datos adicionales se muestran** al finalizar cada partida
4. ✅ **Estadísticas globales se actualizan** en tiempo real
5. ✅ **Base de datos exportable** y visible en SQLite Studio

### Cómo Verificar

1. Juega al menos 2-3 partidas
2. Al finalizar cada una, verás:
   - Análisis de tu partida con eficiencia y calificaciones
   - Estadísticas globales actualizadas automáticamente
3. Haz clic en "Ver Ranking" para ver el top 10
4. Haz clic en "Ver Estadísticas" para ver las estadísticas globales
5. Descarga la base de datos y ábrela en SQLite Studio
6. Verifica que el TRIGGER y las VIEWS estén creados
7. Ejecuta consultas SQL para verificar los datos

---

## 📝 Notas Técnicas

- **SQLite no tiene procedimientos almacenados tradicionales** como otros SGBD, pero los TRIGGERS y VIEWS cumplen funciones similares
- **Los TRIGGERS** se ejecutan automáticamente en eventos de la base de datos
- **Las VIEWS** son consultas predefinidas que se comportan como tablas virtuales
- **Todas las métricas** se calculan automáticamente sin intervención manual
- **La base de datos** es completamente funcional y puede abrirse en SQLite Studio

---

## 🎯 Beneficios de los Procedimientos Almacenados

1. **Automatización:** Cálculos y actualizaciones automáticas
2. **Consistencia:** Datos siempre actualizados y correctos
3. **Rendimiento:** Consultas optimizadas y reutilizables
4. **Mantenibilidad:** Lógica centralizada en la base de datos
5. **Escalabilidad:** Fácil agregar nuevas métricas o análisis

