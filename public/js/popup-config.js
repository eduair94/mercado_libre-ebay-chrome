// Popup.js - Immediate configuration updates without page reload
class PopupController {
  constructor() {
    this.defaultConfig = {
      enabled: true,
      textSize: 'medium',
      animations: true,
      notifications: true,
      language: 'es'
    };
    
    this.config = { ...this.defaultConfig };
    this.init();
  }

  async init() {
    await this.loadConfiguration();
    this.setupEventListeners();
    this.updateUI();
    this.setupLanguage();
  }

  // Load configuration from Chrome storage
  async loadConfiguration() {
    try {
      if (chrome.storage && chrome.storage.sync) {
        const result = await chrome.storage.sync.get('extensionConfig');
        if (result.extensionConfig) {
          this.config = { ...this.defaultConfig, ...result.extensionConfig };
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }

  // Save configuration immediately to Chrome storage
  async saveConfiguration() {
    try {
      if (chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ extensionConfig: this.config });
        
        // Notify all content scripts about the configuration change
        this.notifyContentScripts();
        
        // Show success toast
        this.showToast('¡Configuración guardada y aplicada!', 'success');
        
        return true;
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.showToast('Error al guardar la configuración', 'error');
      return false;
    }
  }

  // Notify all content scripts about configuration changes
  async notifyContentScripts() {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        // Get all tabs
        const tabs = await chrome.tabs.query({});
        
        // Send message to each tab's content script
        for (const tab of tabs) {
          try {
            if (chrome.tabs.sendMessage && tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'CONFIG_UPDATED',
                config: this.config,
                // Special cleanup flag when extension is disabled
                shouldCleanup: !this.config.enabled
              });
            }
          } catch (error) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (error) {
      console.error('Error notifying content scripts:', error);
    }
  }

  // Setup all event listeners
  setupEventListeners() {
    // Extension enabled/disabled toggle
    const enabledToggle = document.getElementById('enabledToggle');
    enabledToggle.addEventListener('change', (e) => {
      this.config.enabled = e.target.checked;
      this.updateStatusText();
      
      // Show different messages based on enabled/disabled state
      if (this.config.enabled) {
        this.saveConfiguration();
        // Also send a forced re-initialization message to ensure HTML is rendered
        this.forceReinitialize();
        this.showToast('¡Extensión habilitada - forzando renderizado!', 'success');
      } else {
        this.saveConfiguration();
        this.showToast('Extensión deshabilitada - limpiando elementos...', 'info');
      }
    });

    // Text size buttons
    document.querySelectorAll('.text-size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const size = e.currentTarget.getAttribute('data-size');
        this.config.textSize = size;
        this.updateTextSizeButtons();
        this.saveConfiguration();
      });
    });

    // Animations toggle
    const animationsToggle = document.getElementById('animationsToggle');
    animationsToggle.addEventListener('change', (e) => {
      this.config.animations = e.target.checked;
      this.saveConfiguration();
    });

    // Language selector
    const languageSelect = document.getElementById('languageSelect');
    languageSelect.addEventListener('change', (e) => {
      this.config.language = e.target.value;
      this.saveConfiguration();
      this.updateLanguage();
    });

    // Save button (manual save for additional confirmation)
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', () => {
      if (!this.config.enabled) {
        // If extension is disabled, trigger cleanup
        this.triggerCleanup();
      }
      this.saveConfiguration();
    });

    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', () => {
      this.resetConfiguration();
    });
  }
  
  // Trigger cleanup across all tabs
  async triggerCleanup() {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
          try {
            if (chrome.tabs.sendMessage && tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'FORCE_CLEANUP'
              });
            }
          } catch (error) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (error) {
      console.error('Error triggering cleanup:', error);
    }
  }
  
  // Force re-initialization across all tabs to ensure HTML is rendered
  async forceReinitialize() {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
          try {
            if (chrome.tabs.sendMessage && tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                type: 'FORCE_REINITIALIZE'
              });
            }
          } catch (error) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (error) {
      console.error('Error forcing re-initialization:', error);
    }
  }

  // Update UI elements based on current configuration
  updateUI() {
    // Update toggles
    document.getElementById('enabledToggle').checked = this.config.enabled;
    document.getElementById('animationsToggle').checked = this.config.animations;
    
    // Update language selector
    document.getElementById('languageSelect').value = this.config.language;
    
    // Update status text
    this.updateStatusText();
    
    // Update text size buttons
    this.updateTextSizeButtons();
  }

  // Update status text based on enabled state
  updateStatusText() {
    const statusText = document.getElementById('statusText');
    if (this.config.enabled) {
      statusText.textContent = this.getTranslation('enabled');
      statusText.className = 'text-sm font-medium text-green-600 min-w-[100px]';
    } else {
      statusText.textContent = this.getTranslation('disabled');
      statusText.className = 'text-sm font-medium text-red-600 min-w-[100px]';
    }
  }

  // Update text size button states
  updateTextSizeButtons() {
    document.querySelectorAll('.text-size-btn').forEach(btn => {
      const size = btn.getAttribute('data-size');
      if (size === this.config.textSize) {
        btn.className = 'text-size-btn px-3 py-2 text-xs bg-blue-500 text-white rounded-lg transition-colors border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300';
      } else {
        btn.className = 'text-size-btn px-3 py-2 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300';
      }
    });
  }

  // Reset configuration to defaults
  async resetConfiguration() {
    this.config = { ...this.defaultConfig };
    this.updateUI();
    await this.saveConfiguration();
    this.showToast('Configuración restablecida', 'info');
  }

  // Setup language functionality
  setupLanguage() {
    this.updateLanguage();
  }

  // Update language throughout the popup
  updateLanguage() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.getTranslation(key);
    });
  }

  // Get translation for current language
  getTranslation(key) {
    const translations = {
      es: {
        enabled: 'Habilitada',
        disabled: 'Deshabilitada',
        popupTitle: 'Configuración del Comparador',
        enabledLabel: 'Estado de la Extensión',
        enabledDescription: 'Habilitar o deshabilitar la extensión',
        textSizeLabel: 'Tamaño del Texto',
        textSizeDescription: 'Ajusta el tamaño del texto de la comparación',
        textSizeSmall: 'Pequeño',
        textSizeMedium: 'Mediano',
        textSizeLarge: 'Grande',
        animationsLabel: 'Animaciones',
        animationsDescription: 'Mostrar animaciones en las comparaciones',
        notificationsLabel: 'Notificaciones',
        notificationsDescription: 'Mostrar notificaciones de precios encontrados',
        saveButton: 'Guardar Configuración',
        resetButton: 'Restablecer',
        aboutTitle: 'Acerca de',
        aboutDescription: 'Extensión desarrollada por Eduardo Airaudo para comparar precios de productos entre MercadoLibre y eBay de manera eficiente.',
        versionLabel: 'Versión'
      },
      pt: {
        enabled: 'Habilitada',
        disabled: 'Desabilitada',
        popupTitle: 'Configuração do Comparador',
        enabledLabel: 'Estado da Extensão',
        enabledDescription: 'Habilitar ou desabilitar a extensão',
        textSizeLabel: 'Tamanho do Texto',
        textSizeDescription: 'Ajustar o tamanho do texto da comparação',
        textSizeSmall: 'Pequeno',
        textSizeMedium: 'Médio',
        textSizeLarge: 'Grande',
        animationsLabel: 'Animações',
        animationsDescription: 'Mostrar animações nas comparações',
        notificationsLabel: 'Notificações',
        notificationsDescription: 'Mostrar notificações de preços encontrados',
        saveButton: 'Salvar Configuração',
        resetButton: 'Redefinir',
        aboutTitle: 'Sobre',
        aboutDescription: 'Extensão desenvolvida por Eduardo Airaudo para comparar preços de produtos entre MercadoLibre e eBay de forma eficiente.',
        versionLabel: 'Versão'
      }
    };

    return translations[this.config.language]?.[key] || key;
  }

  // Show toast notification
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set message
    toastMessage.textContent = message;
    
    // Set color based on type
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500'
    };
    
    toast.className = `fixed bottom-4 left-4 right-4 ${colors[type]} text-white p-3 rounded-lg shadow-lg transform transition-transform duration-300 ease-out toast`;
    
    // Show toast
    toast.classList.remove('hidden', 'translate-y-full');
    toast.classList.add('translate-y-0');
    
    // Hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('translate-y-0');
      toast.classList.add('translate-y-full');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 300);
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we have the required Chrome APIs
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error('Chrome extension APIs not available');
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Extension APIs not available. Please reload the extension.</div>';
    return;
  }
  
  window.popupController = new PopupController();
});

// Handle popup reopening to reload configuration
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.popupController) {
    // Popup became visible, reload configuration
    window.popupController.loadConfiguration().then(() => {
      window.popupController.updateUI();
    });
  }
});
