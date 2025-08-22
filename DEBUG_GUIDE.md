# 🔧 Guía de Debugging - MercadoLibre Extension

## ✅ Cambios Realizados

He agregado logs detallados en el `content_script.ts` para identificar exactamente por qué no aparecen los botones comparadores. Los logs incluyen:

### 🚀 Logs de Inicio
- ✅ Carga del content script
- ✅ Estado del documento  
- ✅ URL actual

### 🎬 Logs de Window.onload
- ✅ Evento onload activado
- ✅ Datos de moneda cargados
- ✅ Detección de sitio MercadoLibre

### 🔍 Logs de Búsqueda de Elementos
- ✅ Búsqueda de productos con selectores antiguos y nuevos
- ✅ Conteo de elementos encontrados
- ✅ Selectores alternativos probados

### 📦 Logs de Procesamiento
- ✅ Procesamiento de cada item
- ✅ Extracción de títulos
- ✅ Búsqueda de elementos objetivo
- ✅ Inserción de botones

### ⚡ Sistema de Respaldo
- ✅ Event listener DOMContentLoaded adicional
- ✅ Inyección manual después de 3 segundos
- ✅ Verificaciones múltiples de elementos

## 🧪 Cómo Debuggear

### Opción 1: Página de Prueba Local
1. Abrir `test_debug.html` en el navegador
2. Este archivo simula la estructura HTML de MercadoLibre
3. Incluye un panel de debugging que muestra los logs en tiempo real

### Opción 2: Sitio Real de MercadoLibre
1. **Cargar la extensión en Chrome:**
   ```
   - Abrir Chrome Extensions (chrome://extensions/)
   - Activar "Modo de desarrollador"
   - Hacer clic en "Cargar extensión sin empaquetar"
   - Seleccionar la carpeta del proyecto
   ```

2. **Ir a MercadoLibre:**
   - Navegar a: https://listado.mercadolibre.com.uy/
   - Buscar cualquier producto

3. **Abrir DevTools (F12):**
   - Ir a la pestaña "Console"
   - Buscar logs que empiecen con emojis (🚀, 🔍, ✅, etc.)

## 🔍 Qué Buscar en los Logs

### ✅ Logs Esperados (Funcionando):
```
🚀 MercadoLibre Extension - Content Script Loaded!
🎬 Window onload event triggered!
✅ MercadoLibre site detected! Starting product detection...
🔍 Searching for items...
🎯 Total items found: 3
✅ Creating buttons for: "iPhone 14 Pro Max..."
🚀 Appending buttons to target element for: "iPhone 14 Pro Max..."
✅ Buttons successfully added for: "iPhone 14 Pro Max..."
```

### ❌ Logs de Problemas Comunes:
```
🎯 Total items found: 0
❌ No target element found for: "Product Name"
🔍 Available selectors in item: {...}
```

## 🎯 Selectores Soportados

La extensión ahora busca elementos con estos selectores:

### Contenedores de Productos:
- `.ui-search-layout .ui-search-result` (antiguo)
- `.ui-search-layout .poly-card` (nuevo)
- `.poly-card` (directo, para respaldo)

### Títulos de Productos:
- `.ui-search-item__title` (antiguo)
- `.poly-component__title` (nuevo)

### Elementos Objetivo para Botones:
- `.ui-search-item__group--title` (antiguo)
- `.poly-component__title-wrapper` (nuevo)
- `.poly-card__content` (respaldo)

### Precios:
- `.ui-search-price__second-line` (antiguo)
- `.poly-price__current` (nuevo)

## 🚨 Problemas Posibles y Soluciones

### 1. **Content Script no se carga**
- Verificar que la URL coincida con las del manifest.json
- Verificar permisos de host_permissions

### 2. **No se encuentran elementos**
- Los logs mostrarán conteos de 0
- MercadoLibre puede haber cambiado los selectores de nuevo
- Usar inspector de elementos para verificar la estructura HTML actual

### 3. **Botones se crean pero no aparecen**
- Verificar que el elemento objetivo exista
- Verificar CSS que pueda estar ocultando los botones
- Los logs mostrarán si se encontró el targetElement

### 4. **APIs de moneda fallan**
- Los logs mostrarán errores de fetch
- La funcionalidad principal debería funcionar sin conversión de moneda

## 📊 Información Adicional

Los logs incluyen información detallada sobre:
- URLs detectadas
- Conteos de elementos por selector
- Estructura HTML disponible
- Errores de inyección
- Elementos objetivo encontrados/perdidos

## 🔄 Próximos Pasos

1. Cargar la extensión actualizada
2. Ir a MercadoLibre
3. Abrir DevTools > Console
4. Buscar los logs con emojis
5. Reportar qué logs aparecen y cuáles no

¡Con estos logs detallados podremos identificar exactamente dónde está fallando la extensión! 🎯
