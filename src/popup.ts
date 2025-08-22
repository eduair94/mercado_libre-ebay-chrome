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

class PopupController {
  private settings: ExtensionSettings = {
    enabled: true,
    textSize: "medium",
    animations: true,
    notifications: true,
    language: "es",
  };

  private messages: ChromeMessages = {};

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    await this.loadLanguage();
    this.setupEventListeners();
    this.updateUI();
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.sync.get(["extensionSettings"], resolve);
      });

      if (result.extensionSettings) {
        this.settings = { ...this.settings, ...result.extensionSettings };
      }
    } catch (error) {
      console.warn("Failed to load settings:", error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.sync.set({ extensionSettings: this.settings }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
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
      // Fallback to default messages if loading fails
    }
  }

  private updateTextContent(): void {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (key && this.messages[key]) {
        element.textContent = this.messages[key].message;
      }
    });
  }

  private setupEventListeners(): void {
    // Extension toggle
    const enabledToggle = document.getElementById("enabledToggle") as HTMLInputElement;
    enabledToggle?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.settings.enabled = target.checked;
      this.updateStatusText();
      this.saveSettings();
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

    // Save button
    const saveBtn = document.getElementById("saveBtn");
    saveBtn?.addEventListener("click", () => {
      this.saveSettings();
    });

    // Reset button
    const resetBtn = document.getElementById("resetBtn");
    resetBtn?.addEventListener("click", () => {
      this.resetToDefaults();
    });
  }

  private updateUI(): void {
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
        statusText.textContent = this.getMessage("enabled");
        statusText.className = "text-sm font-medium text-green-600";
        enabledToggle.checked = true;
      } else {
        statusText.textContent = this.getMessage("disabled");
        statusText.className = "text-sm font-medium text-red-600";
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
    return this.messages[key]?.message || key;
  }

  private showToast(messageKey: string, type: "success" | "error" = "success"): void {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    if (!toast || !toastMessage) return;

    const message = this.getMessage(messageKey);
    toastMessage.textContent = message;

    // Update toast styling based on type
    if (type === "error") {
      toast.className = toast.className.replace("bg-green-500", "bg-red-500");
    } else {
      toast.className = toast.className.replace("bg-red-500", "bg-green-500");
    }

    // Show toast
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.style.transform = "translateY(0)";
    }, 10);

    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.style.transform = "translateY(100px)";
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
  new PopupController();
});

// Export for potential use by other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PopupController };
}
