interface ExtensionSettings {
  enabled: boolean;
  textSize: "small" | "medium" | "large";
  animations: boolean;
  notifications: boolean;
  language: "es" | "pt";
}

interface ChromeMessages {
  [key: string]: {
    message: string;
    description: string;
  };
}

interface Translations {
  [language: string]: {
    [key: string]: string;
  };
}

class PopupController {
  private settings: ExtensionSettings = {
    enabled: true,
    textSize: "medium",
    animations: true,
    notifications: true,
    language: "es",
  };

  private messages: ChromeMessages = {};

  // Embedded translations to avoid async loading issues
  private translations: Translations = {
    es: {
      enabled: "Habilitada",
      disabled: "Deshabilitada",
      popupTitle: "Configuración del Comparador",
      enabledLabel: "Estado de la Extensión",
      enabledDescription: "Habilitar o deshabilitar la extensión",
      textSizeLabel: "Tamaño del Texto",
      textSizeDescription: "Ajusta el tamaño del texto de la comparación",
      textSizeSmall: "Pequeño",
      textSizeMedium: "Mediano",
      textSizeLarge: "Grande",
      animationsLabel: "Animaciones",
      animationsDescription: "Mostrar animaciones en las comparaciones",
      notificationsLabel: "Notificaciones",
      notificationsDescription: "Mostrar notificaciones de precios encontrados",
      saveButton: "Guardar Configuración",
      resetButton: "Restablecer",
      aboutTitle: "Acerca de",
      aboutDescription: "Extensión desarrollada por Eduardo Airaudo para comparar precios de productos entre MercadoLibre y eBay de manera eficiente.",
      supportDescription: "¿Problemas o sugerencias? Contáctame a través de mi perfil de LinkedIn para obtener soporte.",
      versionLabel: "Versión",
      settingsSaved: "¡Configuración guardada y aplicada!",
      settingsReset: "Configuración restablecida",
      extensionEnabled: "¡Extensión habilitada - forzando renderizado!",
      extensionDisabled: "Extensión deshabilitada - limpiando elementos...",
    },
    pt: {
      enabled: "Habilitada",
      disabled: "Desabilitada",
      popupTitle: "Configuração do Comparador",
      enabledLabel: "Estado da Extensão",
      enabledDescription: "Habilitar ou desabilitar a extensão",
      textSizeLabel: "Tamanho do Texto",
      textSizeDescription: "Ajustar o tamanho do texto da comparação",
      textSizeSmall: "Pequeno",
      textSizeMedium: "Médio",
      textSizeLarge: "Grande",
      animationsLabel: "Animações",
      animationsDescription: "Mostrar animações nas comparações",
      notificationsLabel: "Notificações",
      notificationsDescription: "Mostrar notificações de preços encontrados",
      saveButton: "Salvar Configuração",
      resetButton: "Redefinir",
      aboutTitle: "Sobre",
      aboutDescription: "Extensão desenvolvida por Eduardo Airaudo para comparar preços de produtos entre MercadoLibre e eBay de forma eficiente.",
      supportDescription: "Problemas ou sugestões? Entre em contato comigo através do meu perfil do LinkedIn para obter suporte.",
      versionLabel: "Versão",
      settingsSaved: "Configuração salva e aplicada!",
      settingsReset: "Configuração redefinida",
      extensionEnabled: "Extensão habilitada - forçando renderização!",
      extensionDisabled: "Extensão desabilitada - limpando elementos...",
    },
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    await this.loadLanguage();
    this.setupEventListeners();
    this.updateUI();
  }

  public async loadSettings(): Promise<void> {
    try {
      const result = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.sync.get(["extensionConfig"], resolve);
      });

      if (result.extensionConfig) {
        this.settings = { ...this.settings, ...result.extensionConfig };
      }
    } catch (error) {
      console.warn("Failed to load settings:", error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.sync.set({ extensionConfig: this.settings }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      // Notify all content scripts about the configuration change
      await this.notifyContentScripts();

      this.showToast("settingsSaved");
    } catch (error) {
      console.error("Failed to save settings:", error);
      this.showToast("Error saving settings", "error");
    }
  }

  private async loadLanguage(): Promise<void> {
    try {
      // Load messages for current language
      const response = await fetch(`/_locales/${this.settings.language}/messages.json`);
      this.messages = await response.json();
      this.updateTextContent();
    } catch (error) {
      console.warn("Failed to load language file:", error);
      // Fallback to embedded translations if loading fails
      this.updateTextContent();
    }
  }

  // Notify all content scripts about configuration changes
  private async notifyContentScripts(): Promise<void> {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        // Get all tabs
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({}, resolve);
        });

        // Send message to each tab's content script
        for (const tab of tabs) {
          try {
            if (chrome.tabs.sendMessage && tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                type: "CONFIG_UPDATED",
                config: this.settings,
                // Special cleanup flag when extension is disabled
                shouldCleanup: !this.settings.enabled,
              });
            }
          } catch (error) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (error) {
      console.error("Error notifying content scripts:", error);
    }
  }

  // Trigger cleanup across all tabs
  private async triggerCleanup(): Promise<void> {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({}, resolve);
        });

        for (const tab of tabs) {
          try {
            if (chrome.tabs.sendMessage && tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                type: "FORCE_CLEANUP",
              });
            }
          } catch (error) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (error) {
      console.error("Error triggering cleanup:", error);
    }
  }

  // Force re-initialization across all tabs to ensure HTML is rendered
  private async forceReinitialize(): Promise<void> {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({}, resolve);
        });

        for (const tab of tabs) {
          try {
            if (chrome.tabs.sendMessage && tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                type: "FORCE_REINITIALIZE",
              });
            }
          } catch (error) {
            // Ignore errors for tabs without content scripts
          }
        }
      }
    } catch (error) {
      console.error("Error forcing re-initialization:", error);
    }
  }

  private updateTextContent(): void {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (key) {
        // Try embedded translations first, fallback to chrome messages
        const translation = this.getTranslation(key);
        element.textContent = translation;
      }
    });
  }

  private setupEventListeners(): void {
    // Extension toggle
    const enabledToggle = document.getElementById("enabledToggle") as HTMLInputElement;
    enabledToggle?.addEventListener("change", async (e) => {
      const target = e.target as HTMLInputElement;
      this.settings.enabled = target.checked;
      this.updateStatusText();

      // Show different messages based on enabled/disabled state
      if (this.settings.enabled) {
        await this.saveSettings();
        // Also send a forced re-initialization message to ensure HTML is rendered
        await this.forceReinitialize();
        this.showToast("extensionEnabled", "success");
      } else {
        await this.saveSettings();
        this.showToast("extensionDisabled", "info");
      }
    });

    // Text size buttons
    const textSizeButtons = document.querySelectorAll(".text-size-btn");
    textSizeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const size = target.getAttribute("data-size") as "small" | "medium" | "large";
        this.settings.textSize = size;
        this.updateTextSizeButtons();
        this.saveSettings();
      });
    });

    // Animation toggle
    const animationsToggle = document.getElementById("animationsToggle") as HTMLInputElement;
    animationsToggle?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.settings.animations = target.checked;
      this.saveSettings();
    });

    // Notifications toggle
    const notificationsToggle = document.getElementById("notificationsToggle") as HTMLInputElement;
    notificationsToggle?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.settings.notifications = target.checked;
      this.saveSettings();
    });

    // Language selector
    const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;
    languageSelect?.addEventListener("change", async (e) => {
      const target = e.target as HTMLSelectElement;
      this.settings.language = target.value as "es" | "pt";
      await this.loadLanguage();
      this.saveSettings();
    });

    // Save button (manual save for additional confirmation)
    const saveBtn = document.getElementById("saveBtn");
    saveBtn?.addEventListener("click", async () => {
      if (!this.settings.enabled) {
        // If extension is disabled, trigger cleanup
        await this.triggerCleanup();
      }
      await this.saveSettings();
    });

    // Reset button
    const resetBtn = document.getElementById("resetBtn");
    resetBtn?.addEventListener("click", () => {
      this.resetToDefaults();
    });
  }

  public updateUI(): void {
    this.updateStatusText();
    this.updateTextSizeButtons();
    this.updateToggles();
    this.updateLanguageSelect();
  }

  private updateStatusText(): void {
    const statusText = document.getElementById("statusText");
    const enabledToggle = document.getElementById("enabledToggle") as HTMLInputElement;

    if (statusText && enabledToggle) {
      if (this.settings.enabled) {
        statusText.textContent = this.getTranslation("enabled");
        statusText.className = "text-sm font-medium text-green-600 min-w-[100px]";
        enabledToggle.checked = true;
      } else {
        statusText.textContent = this.getTranslation("disabled");
        statusText.className = "text-sm font-medium text-red-600 min-w-[100px]";
        enabledToggle.checked = false;
      }
    }
  }

  private updateTextSizeButtons(): void {
    const buttons = document.querySelectorAll(".text-size-btn");
    buttons.forEach((button) => {
      const size = button.getAttribute("data-size");
      const isActive = size === this.settings.textSize;

      if (isActive) {
        button.className = "text-size-btn px-3 py-2 text-xs bg-blue-500 text-white rounded-lg transition-colors border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300";
      } else {
        button.className = "text-size-btn px-3 py-2 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300";
      }
    });
  }

  private updateToggles(): void {
    const animationsToggle = document.getElementById("animationsToggle") as HTMLInputElement;
    const notificationsToggle = document.getElementById("notificationsToggle") as HTMLInputElement;

    if (animationsToggle) animationsToggle.checked = this.settings.animations;
    if (notificationsToggle) notificationsToggle.checked = this.settings.notifications;
  }

  private updateLanguageSelect(): void {
    const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;
    if (languageSelect) {
      languageSelect.value = this.settings.language;
    }
  }

  private getMessage(key: string): string {
    // Try chrome messages first, fallback to embedded translations
    if (this.messages[key]) {
      return this.messages[key].message;
    }
    return this.getTranslation(key);
  }

  // Get translation from embedded translations
  private getTranslation(key: string): string {
    return this.translations[this.settings.language]?.[key] || key;
  }

  private showToast(messageKey: string, type: "success" | "error" | "info" = "success"): void {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    if (!toast || !toastMessage) return;

    // Get message from translations
    const message = this.getTranslation(messageKey);
    toastMessage.textContent = message;

    // Set color based on type
    const colors = {
      success: "bg-green-500",
      error: "bg-red-500",
      info: "bg-blue-500",
    };

    toast.className = `fixed bottom-4 left-4 right-4 ${colors[type]} text-white p-3 rounded-lg shadow-lg transform transition-transform duration-300 ease-out toast`;

    // Show toast
    toast.classList.remove("hidden", "translate-y-full");
    toast.classList.add("translate-y-0");

    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove("translate-y-0");
      toast.classList.add("translate-y-full");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 300);
    }, 3000);
  }

  private async resetToDefaults(): Promise<void> {
    this.settings = {
      enabled: true,
      textSize: "medium",
      animations: true,
      notifications: true,
      language: "es",
    };

    await this.loadLanguage();
    this.updateUI();
    await this.saveSettings();
    this.showToast("settingsReset");
  }

  // Public method to get current settings for content scripts
  public getSettings(): ExtensionSettings {
    return { ...this.settings };
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Check if we have the required Chrome APIs
  if (typeof chrome === "undefined" || !chrome.storage) {
    console.error("Chrome extension APIs not available");
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Extension APIs not available. Please reload the extension.</div>';
    return;
  }

  // Create global instance
  (window as any).popupController = new PopupController();
});

// Handle popup reopening to reload configuration
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && (window as any).popupController) {
    // Popup became visible, reload configuration
    (window as any).popupController.loadSettings().then(() => {
      (window as any).popupController.updateUI();
    });
  }
});
