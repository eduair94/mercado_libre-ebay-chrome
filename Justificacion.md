# Justificación de Permisos - MercadoLibre ↔ eBay Comparador

## Resumen

Esta extensión de Chrome requiere dos permisos específicos: `storage` y `tabs`. Este documento proporciona una justificación técnica detallada para cada permiso, explicando su uso específico en el código y por qué es esencial para la funcionalidad de la extensión.

---

## Permiso: `storage`

### **Justificación Técnica**

El permiso `storage` es **esencial** para que la extensión pueda guardar y recuperar la configuración del usuario de manera persistente entre sesiones del navegador.

### **Uso Específico en el Código**

#### 1. Guardado de Configuración (popup.ts:117)
```typescript
chrome.storage.sync.set({ extensionConfig: this.settings }, () => {
  if (chrome.runtime.lastError) {
    reject(chrome.runtime.lastError);
  } else {
    resolve();
  }
});
```

#### 2. Carga de Configuración (popup.ts:103)
```typescript
chrome.storage.sync.get(["extensionConfig"], resolve);
```

#### 3. Aplicación de Configuración en Content Script (content_script.ts:91)
```typescript
chrome.storage.sync.get("extensionConfig", (result) => {
  if (result.extensionConfig) {
    extensionConfig = { ...extensionConfig, ...result.extensionConfig };
    console.log("⚙️ Configuration loaded:", extensionConfig);
    applyConfigurationChanges();
  }
});
```

### **Configuraciones Guardadas**

La extensión almacena las siguientes configuraciones del usuario:

- **Estado de la extensión** (`enabled`: boolean) - Si la comparación de precios está habilitada o deshabilitada
- **Tamaño del texto** (`textSize`: 'small' | 'medium' | 'large') - Preferencia visual del usuario para el tamaño de texto de las comparaciones
- **Animaciones** (`animations`: boolean) - Si mostrar animaciones en las comparaciones de precios
- **Idioma** (`language`: 'es' | 'pt') - Idioma preferido del usuario para la interfaz

### **¿Por qué es Necesario?**

1. **Persistencia**: Sin este permiso, los usuarios tendrían que reconfigurar la extensión cada vez que abren el navegador
2. **Experiencia de Usuario**: Permite una experiencia personalizada y consistente
3. **Funcionalidad Core**: La extensión debe saber si está habilitada/deshabilitada para funcionar correctamente
4. **Sincronización**: Utiliza `chrome.storage.sync` para mantener la configuración sincronizada entre dispositivos del usuario

---

## Permiso: `tabs`

### **Justificación Técnica**

El permiso `tabs` es **fundamental** para la comunicación en tiempo real entre el popup de configuración y los content scripts activos en las pestañas de MercadoLibre, permitiendo que los cambios de configuración se apliquen instantáneamente.

### **Uso Específico en el Código**

#### 1. Consulta de Pestañas Activas (popup.ts:154-155)
```typescript
const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
  chrome.tabs.query({}, resolve);
});
```

#### 2. Envío de Mensajes a Content Scripts (popup.ts:161-162)
```typescript
if (chrome.tabs.sendMessage && tab.id) {
  await chrome.tabs.sendMessage(tab.id, {
    type: "CONFIG_UPDATED",
    config: this.settings,
    shouldCleanup: !this.settings.enabled,
  });
}
```

### **Funcionalidades Dependientes**

#### 1. **Actualización Inmediata de Configuración**
Cuando el usuario cambia configuraciones en el popup (como habilitar/deshabilitar la extensión), los cambios se aplican inmediatamente en todas las pestañas de MercadoLibre abiertas sin necesidad de recargar.

#### 2. **Limpieza de UI**
Cuando la extensión se deshabilita, automáticamente remove los botones de comparación de precios de todas las pestañas activas.

#### 3. **Aplicación de Estilos**
Los cambios en tamaño de texto y animaciones se aplican instantáneamente en todas las pestañas donde la extensión está activa.

### **Flujo de Comunicación**

```
[Popup] → chrome.tabs.query() → [Obtiene todas las pestañas]
[Popup] → chrome.tabs.sendMessage() → [Content Script en cada pestaña]
[Content Script] → Aplica nueva configuración → [Actualiza UI]
```

### **¿Por qué es Necesario?**

1. **Experiencia de Usuario Sin Interrupciones**: Los usuarios no necesitan recargar las páginas para ver los cambios de configuración
2. **Consistencia**: Garantiza que todas las pestañas muestren la misma configuración
3. **Funcionalidad de Habilitación/Deshabilitación**: Permite activar/desactivar la extensión globalmente de forma inmediata
4. **Comunicación Bidireccional**: Esencial para que el popup y los content scripts trabajen como un sistema integrado

---

## Consideraciones de Privacidad

### **Datos Accedidos**
- **Storage**: Solo configuraciones de usuario (preferencias de la extensión)
- **Tabs**: Solo identificadores de pestañas para comunicación, **no se accede al contenido de las pestañas**

### **Datos NO Accedidos**
- Historial de navegación
- Contenido de páginas web no relacionadas con MercadoLibre
- Información personal del usuario
- Datos de navegación sensibles

### **Seguridad**
- El almacenamiento se limita a configuraciones básicas de la extensión
- La comunicación con pestañas solo se realiza para aplicar configuraciones de UI
- No se recopila, almacena ni transmite información personal

---

## Conclusión

Ambos permisos (`storage` y `tabs`) son **estrictamente necesarios** para la funcionalidad básica de la extensión:

- **`storage`**: Imprescindible para mantener las preferencias del usuario entre sesiones
- **`tabs`**: Esencial para la comunicación en tiempo real entre componentes de la extensión

La extensión utiliza estos permisos de manera responsable, limitándose únicamente a las funcionalidades documentadas y sin acceder a información sensible del usuario.
