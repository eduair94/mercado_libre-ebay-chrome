import { amazonFront } from "./classes/AmazonFront";
import { ebayFront } from "./classes/EbayFront";
import { AIQuery, Item } from "./interfaces/products.interface";

// Self-contained AI Query Management (inline to avoid module loading issues)
class InlineAIQueryManager {
  private static readonly STORAGE_KEY = "aiQueries";
  private static readonly MAX_QUERIES = 1000;
  private static readonly CACHE_EXPIRATION_DAYS = 30;

  static generateQueryId(originalQuery: string): string {
    return btoa(originalQuery.toLowerCase().trim())
      .replace(/[^A-Za-z0-9]/g, "")
      .substring(0, 16);
  }

  static async saveQuery(
    originalQuery: string,
    optimizedQuery: string,
    source: "gemini" | "manual" = "gemini",
    weightData?: {
      estimatedWeight?: number;
      weightConfidence?: "high" | "medium" | "low";
      weightSource?: string;
    }
  ): Promise<void> {
    try {
      // Check if chrome storage is available
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        console.warn("❌ [AI] Chrome storage not available, skipping query save");
        return;
      }

      const queryId = this.generateQueryId(originalQuery);
      const timestamp = Date.now();

      const result = await new Promise<{ [key: string]: any }>((resolve, reject) => {
        chrome.storage.local.get([this.STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });

      const queries: AIQuery[] = result[this.STORAGE_KEY] || [];
      const existingIndex = queries.findIndex((q) => q.id === queryId);

      if (existingIndex >= 0) {
        // Update existing query
        queries[existingIndex].usageCount += 1;
        queries[existingIndex].lastUsed = timestamp;
        queries[existingIndex].optimizedQuery = optimizedQuery;
        // Update weight data if provided
        if (weightData) {
          queries[existingIndex].estimatedWeight = weightData.estimatedWeight;
          queries[existingIndex].weightConfidence = weightData.weightConfidence;
          queries[existingIndex].weightSource = weightData.weightSource;
        }
      } else {
        // Add new query
        const newQuery: AIQuery = {
          id: queryId,
          originalQuery,
          optimizedQuery,
          timestamp,
          usageCount: 1,
          tokensSaved: Math.floor(originalQuery.length / 4),
          source,
          lastUsed: timestamp,
          ...weightData, // Spread weight data if provided
        };

        queries.push(newQuery);

        // Keep only recent queries
        if (queries.length > this.MAX_QUERIES) {
          queries.sort((a, b) => b.lastUsed - a.lastUsed);
          queries.splice(this.MAX_QUERIES);
        }
      }

      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [this.STORAGE_KEY]: queries }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      console.log("💾 [AI] Query saved successfully:", queryId);
    } catch (error) {
      console.error("❌ [AI] Error saving query:", error);
    }
  }

  static async getCachedQuery(originalQuery: string): Promise<AIQuery | null> {
    try {
      // Check if chrome storage is available
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        console.warn("❌ [AI] Chrome storage not available, skipping cache lookup");
        return null;
      }

      const queryId = this.generateQueryId(originalQuery);
      const result = await new Promise<{ [key: string]: any }>((resolve, reject) => {
        chrome.storage.local.get([this.STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });

      const queries: AIQuery[] = result[this.STORAGE_KEY] || [];
      const query = queries.find((q) => q.id === queryId);

      if (query) {
        // Check if query is still valid (not expired)
        const isExpired = Date.now() - query.timestamp > this.CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        if (!isExpired) {
          // Update usage statistics
          query.usageCount += 1;
          query.lastUsed = Date.now();

          // Save updated query
          await new Promise<void>((resolve, reject) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: queries }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });

          return query;
        }
      }

      return null;
    } catch (error) {
      console.error("❌ [AI] Error getting cached query:", error);
      return null;
    }
  }
}

// IMMEDIATE CONSOLE LOGS FOR DEBUGGING
console.log("%c🚨 MERCADOLIBRE EXTENSION - CONTENT SCRIPT LOADING! 🚨", "background: #ff0000; color: #ffffff; font-size: 16px; font-weight: bold; padding: 10px;");
console.log("%c📍 CURRENT URL:", "color: #007bff; font-weight: bold;", window.location.href);
console.log("%c⏰ TIMESTAMP:", "color: #28a745; font-weight: bold;", new Date().toISOString());
console.log("%c🔧 USER AGENT:", "color: #6c757d;", navigator.userAgent);

// Test if we're on the right domain
const isOnMercadoLibre = window.location.href.includes("mercadolibre.com") || window.location.href.includes("mercadolivre.com");
console.log("%c🎯 ON MERCADOLIBRE:", isOnMercadoLibre ? "✅ YES" : "❌ NO", "color:", isOnMercadoLibre ? "#28a745" : "#dc3545", "font-weight: bold;");

// Test URL patterns immediately
const url = window.location.href;
const isProductURL = /\/(p|ML[A-Z]-\d+)[\w-]*/.test(url) || url.includes("articulo.mercadolibre.") || url.includes("produto.mercadolivre.");
console.log("%c🔍 PRODUCT URL PATTERN:", isProductURL ? "✅ MATCHES" : "❌ NO MATCH", "color:", isProductURL ? "#28a745" : "#dc3545", "font-weight: bold;");

// Constants
const SELECTORS = {
  PRODUCT_ITEMS: ".ui-search-layout .ui-search-result, .ui-search-layout .poly-card, .poly-card, .andes-card.andes-card--flat.andes-card--padding-16",
  PRODUCT_TITLE_OLD: ".ui-search-item__title",
  PRODUCT_TITLE_NEW: ".poly-component__title, .dynamic-carousel__title",

  // Search page price selectors
  PRICE_CURRENCY_OLD: ".ui-search-price__second-line .andes-money-amount__currency-symbol",
  PRICE_CURRENCY_NEW: ".poly-price__current .andes-money-amount__currency-symbol, .poly-component__price .andes-money-amount__currency-symbol, .dynamic-carousel__price span",
  PRICE_FRACTION_OLD: ".ui-search-price__second-line .andes-money-amount__fraction",
  PRICE_FRACTION_NEW: ".poly-price__current .andes-money-amount__fraction, .poly-component__price .andes-money-amount__fraction",

  // Product page main product selectors
  PDP_MAIN_TITLE: ".ui-pdp-title",
  PDP_MAIN_PRICE_CONTAINER: "#price",
  PDP_MAIN_PRICE_CURRENCY: "#price .andes-money-amount__currency-symbol",
  PDP_MAIN_PRICE_FRACTION: "#price .andes-money-amount__fraction",

  // Product page recommendations selectors
  PDP_RECOMMENDATIONS_CONTAINER: ".ui-recommendations-carousel-wrapper-ref, .andes-carousel-snapped__wrapper, .dynamic-carousel",
  PDP_RECOMMENDATION_ITEMS: ".andes-carousel-snapped__slide .recos-polycard, .recos-polycard.poly-card, .dynamic-carousel .andes-card",
  PDP_RECOMMENDATION_TITLE: ".poly-component__title, .dynamic-carousel__title",
  PDP_RECOMMENDATION_PRICE_CURRENCY: ".poly-component__price .andes-money-amount__currency-symbol, .dynamic-carousel__price span",
  PDP_RECOMMENDATION_PRICE_FRACTION: ".poly-component__price .andes-money-amount__fraction",

  // Button selectors
  BUTTON_CONTAINER: ".btn_ml_app_container",
  EBAY_BUTTON: ".ebay_btn",
  AMAZON_BUTTON: ".amazon_btn",
  REFRESH_BUTTON_EBAY: ".refresh_btn_ebay",
  REFRESH_BUTTON_AMAZON: ".refresh_btn_amazon",
  CURRENCY_TOGGLE_EBAY: ".currency_toggle_ebay",
  CURRENCY_TOGGLE_AMAZON: ".currency_toggle_amazon",
} as const;

const CURRENCY_MAPPING = {
  ar: "ARS", // Argentina - Peso argentino
  bo: "BOB", // Bolivia - Boliviano
  br: "BRL", // Brazil - Real
  cl: "CLP", // Chile - Peso chileno
  co: "COP", // Colombia - Peso colombiano
  cr: "CRC", // Costa Rica - Colón costarricense
  do: "DOP", // Dominican Republic - Peso dominicano
  ec: "USD", // Ecuador - Dólar estadounidense
  sv: "USD", // El Salvador - Dólar estadounidense
  gt: "GTQ", // Guatemala - Quetzal
  hn: "HNL", // Honduras - Lempira
  mx: "MXN", // Mexico - Peso mexicano
  ni: "NIO", // Nicaragua - Córdoba oro
  pa: "PAB", // Panama - Balboa
  py: "PYG", // Paraguay - Guaraní
  pe: "PEN", // Peru - Sol
  uy: "UYU", // Uruguay - Peso uruguayo
  ve: "VES", // Venezuela - Bolívar soberano
} as const;

const API_ENDPOINTS = {
  CURRENCY_ALL: "https://trustpilot.digitalshopuy.com/currency/all",
  CURRENCY_FORTEX: "https://api.cambio-uruguay.com/fortex",
} as const;

// Types
interface CurrencyConversionResult {
  priceRaw: number;
  priceAlt: string;
  currencyAlt: string;
}

interface MLPrice {
  currency: string;
  price: number;
}

// Global variables for extension state
let currencyData: any = null;
let currenciesData: any = null;
let isInitialized = false;
let checkInterval: number | null = null;
let processingQueue = new Set<Element>();

// Currency display state - tracks whether each button shows USD or local currency
let currencyDisplayState = new Map<string, { showingLocal: boolean; originalPrice: number; originalCurrency: string; convertedPrice?: number; convertedCurrency?: string }>();

// Configuration state
let extensionConfig = {
  enabled: true,
  textSize: "medium",
  animations: true,
  notifications: true,
  language: "es",
  geminiApiKey: "",
  aiSearchEnabled: false,
  onlyNew: false,
  shippingEnabled: false,
  shippingCostPerKg: 5.0,
  maxCachedQueries: 1000,
  cacheExpirationDays: 30,
  ivaEnabled: true,
  ivaPercentage: 22,
};

console.log("🚀 MercadoLibre Extension - Content Script Loaded!");
console.log("🌐 Current URL:", window.location.href);

// Make InlineAIQueryManager globally accessible for testing and debugging
(window as any).InlineAIQueryManager = InlineAIQueryManager;
console.log("🤖 [AI] InlineAIQueryManager initialized successfully!");

// Set flag for extension detection
(window as any).mercadoLibreExtensionLoaded = true;

// Load initial configuration
function loadConfiguration() {
  try {
    // Check if chrome storage is available
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
      console.warn("❌ Chrome storage not available, using default configuration");
      return;
    }

    chrome.storage.sync.get("extensionConfig", (result) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error loading configuration:", chrome.runtime.lastError);
        return;
      }

      if (result.extensionConfig) {
        extensionConfig = { ...extensionConfig, ...result.extensionConfig };
        console.log("⚙️ Configuration loaded:", extensionConfig);

        // Apply configuration changes immediately
        applyConfigurationChanges();
      }
    });
  } catch (error) {
    console.error("❌ Error loading configuration:", error);
  }
}

// Apply configuration changes to existing elements
function applyConfigurationChanges() {
  if (!extensionConfig.enabled) {
    // Hide all extension buttons if disabled
    document.querySelectorAll(".btn_ml_app_container").forEach((container) => {
      (container as HTMLElement).style.display = "none";
    });
    return;
  } else {
    // Show all extension buttons if enabled and force re-initialization
    const containers = document.querySelectorAll(".btn_ml_app_container");

    // If no containers exist or extension was previously disabled, force re-initialization
    if (containers.length === 0 || !isInitialized) {
      console.log("🔄 Extension enabled - forcing HTML re-rendering and re-initialization");

      // Reset initialization flag
      isInitialized = false;

      // Force re-initialization to render HTML elements
      setTimeout(() => {
        initializeExtension();
      }, 100);

      return; // Exit early since re-initialization will handle everything
    }
  }

  // Apply text size changes
  const sizeMap = {
    small: "12px",
    medium: "14px",
    large: "16px",
  };

  document.querySelectorAll(".btn_ml_app_container, .btn_ml_app").forEach((container) => {
    (container as HTMLElement).style.fontSize = sizeMap[extensionConfig.textSize as keyof typeof sizeMap] || "14px";
  });

  // Apply animation settings
  if (!extensionConfig.animations) {
    document.querySelectorAll(".btn_ml_app_container").forEach((container) => {
      (container as HTMLElement).style.transition = "none";
    });
  } else {
    document.querySelectorAll(".btn_ml_app_container").forEach((container) => {
      (container as HTMLElement).style.transition = "all 0.3s ease";
    });
  }
}

// Cleanup all extension elements and listeners
function cleanupExtension() {
  try {
    console.log("🧹 Starting extension cleanup...");

    // Remove all extension-generated HTML elements
    document.querySelectorAll(".btn_ml_app_container").forEach((container) => {
      console.log("Removing button container:", container);
      container.remove();
    });

    // Remove any price comparison results
    document.querySelectorAll('[class*="ml-price-comparison"], [class*="ebay-result"], [class*="amazon-result"]').forEach((element) => {
      console.log("Removing comparison element:", element);
      element.remove();
    });

    // Remove notifications
    document.querySelectorAll(".ml-extension-notification").forEach((notification) => {
      notification.remove();
    });

    // Clear any intervals
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
      console.log("✅ Cleared monitoring interval");
    }

    // Reset processing queue
    processingQueue.clear();

    // Mark as not initialized to prevent further processing
    isInitialized = false;

    // Reset extension state
    currencyData = null;
    currenciesData = null;

    console.log("✅ Extension cleanup completed successfully");

    // Show completion notification
    setTimeout(() => {
      showNotification("Extensión completamente deshabilitada", "info");
    }, 500);
  } catch (error) {
    console.error("❌ Error during extension cleanup:", error);
  }
}

// Listen for configuration updates from popup
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CONFIG_UPDATED") {
      console.log("🔄 Configuration updated:", message.config);
      extensionConfig = { ...extensionConfig, ...message.config };

      // Check if extension should be cleaned up
      if (message.shouldCleanup) {
        console.log("🧹 Extension disabled - cleaning up...");
        cleanupExtension();
        showNotification("Extensión deshabilitada - limpieza completa", "info");
      } else {
        applyConfigurationChanges();

      // Show notification if enabled
      if (extensionConfig.notifications) {
        showNotification("Configuración actualizada", "success");
      }
    }

    sendResponse({ success: true });
  } else if (message.type === "FORCE_CLEANUP") {
    console.log("🧹 Force cleanup requested from popup");
    cleanupExtension();
    sendResponse({ success: true });
  } else if (message.type === "FORCE_REINITIALIZE") {
    console.log("🔄 Force re-initialization requested from popup");

    // Only reinitialize if on MercadoLibre and extension is enabled
    if (window.location.href.includes("mercadolibre.com") && extensionConfig.enabled) {
      isInitialized = false;
      initializeExtension();
      showNotification("Extensión reinicializada - HTML renderizado", "success");
    }

    sendResponse({ success: true });
  }
  return true;
  });
} else {
  console.warn("❌ Chrome runtime not available for message listening");
}

// Show in-page notification
function showNotification(message: string, type: "success" | "error" | "info" = "info") {
  if (!extensionConfig.notifications) return;

  // Remove existing notification
  const existing = document.querySelector(".ml-extension-notification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.className = "ml-extension-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

/**
 * Generates a unique button ID for currency state tracking
 */
function generateButtonId(platform: string, productName: string, itemType: string): string {
  return `${platform}_${itemType}_${btoa(productName).substring(0, 8)}`;
}

/**
 * Creates currency toggle click handler
 */
function createCurrencyToggleHandler(platform: "ebay" | "amazon", productName: string, item: Element, button: HTMLButtonElement, itemType: "search" | "main" | "recommendation" = "search"): (event: Event) => void {
  return (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const buttonId = generateButtonId(platform, productName, itemType);
    const state = currencyDisplayState.get(buttonId);

    if (!state) {
      console.warn("No currency state found for button:", buttonId);
      return;
    }

    const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
    const localCurrency = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";

    const btnText = button.querySelector(".btn-text");
    const toggleBtn = button.querySelector(`.currency_toggle_${platform}`) as HTMLButtonElement;

    if (!btnText || !toggleBtn) {
      console.warn("Button elements not found for currency toggle");
      return;
    }

    if (state.showingLocal) {
      // Switch back to USD
      btnText.innerHTML = formatPriceWithShipping(productName, state.originalPrice, "USD");
      toggleBtn.textContent = localCurrency;
      toggleBtn.title = `Mostrar en ${localCurrency}`;
      state.showingLocal = false;
    } else {
      // Switch to local currency
      if (!state.convertedPrice || !state.convertedCurrency) {
        // Calculate conversion if not already done
        const mockItem: Item = {
          price: state.originalPrice,
          currency: state.originalCurrency,
          name: productName,
          image: null,
          location: "",
          originalPrice: { currency: state.originalCurrency, price: state.originalPrice },
          shippingCost: { currency: "USD", price: 0 },
          seller: undefined,
          status: "",
          watchCount: 0,
          soldCount: 0,
          bidCount: 0,
          link: null,
        };

        const conversion = currencyConversion(mockItem, localCurrency);
        state.convertedPrice = conversion.priceRaw;
        state.convertedCurrency = conversion.currencyAlt;
      }

      // Show converted price
      let referencePrice = 0;
      if (itemType === "main") {
        referencePrice = getMainProductPrice()?.price || 0;
      } else if (itemType === "recommendation") {
        referencePrice = getRecommendationProductPrice(item)?.price || 0;
      } else {
        referencePrice = getMercadoLibrePrice(item)?.price || 0;
      }

      btnText.innerHTML = formatPriceWithShipping(productName, Math.round(state.convertedPrice!), state.convertedCurrency!, true);
      toggleBtn.textContent = "USD";
      toggleBtn.title = "Mostrar en USD";
      state.showingLocal = true;
    }

    currencyDisplayState.set(buttonId, state);
  };
}

/**
 * Formats currency value for display
 */
function formatCurrency(amount: number, currency: string): string {
  const currencySymbol = currency === "USD" ? "US$" : currency;
  return `${currencySymbol} ${amount.toFixed(2)}`;
}

/**
 * Formats price with shipping cost and IVA if enabled
 */
function formatPriceWithShipping(productName: string, price: number, currency: string, isLocalCurrency = false): string {
  const shippingData = calculateShippingCost(productName);
  const currencySymbol = currency === "USD" ? "US$" : currency;
  
  let finalPrice = price;
  
  // Add shipping cost if enabled
  if (extensionConfig.shippingEnabled && shippingData.shippingCost > 0) {
    finalPrice += shippingData.shippingCost;
  }
  
  // Add IVA if enabled and price (without shipping) exceeds $200 USD
  if (extensionConfig.ivaEnabled && price > 200 && currency === "USD") {
    const ivaAmount = price * (extensionConfig.ivaPercentage / 100);
    finalPrice += ivaAmount;
  }

  return `${currencySymbol} ${finalPrice.toFixed(2)}`;
}

/**
 * Calculates price difference percentage for color coding
 */
function calculatePriceDifferencePercentage(originalPrice: number, comparisonPrice: number): number {
  if (originalPrice <= 0) return 0;
  return ((comparisonPrice - originalPrice) / originalPrice) * 100;
}

/**
 * Gets color class based on price difference percentage
 */
function getPriceColorClass(differencePercentage: number): string {
  if (differencePercentage <= 20) {
    return "price-excellent"; // Green - 20% or less more expensive
  } else if (differencePercentage <= 50) {
    return "price-good"; // Yellow - 21-50% more expensive  
  } else if (differencePercentage <= 100) {
    return "price-warning"; // Orange - 51-100% more expensive
  } else {
    return "price-expensive"; // Red - More than double the price
  }
}

/**
 * Calculates estimated shipping cost based on weight and configuration
 */
function calculateShippingCost(productName: string, weightKg?: number): { shippingCost: number; totalWeight: number; source: string } {
  if (!extensionConfig.shippingEnabled || extensionConfig.shippingCostPerKg <= 0) {
    return { shippingCost: 0, totalWeight: 0, source: "disabled" };
  }

  let estimatedWeight = weightKg;
  let source = "provided";

  // Basic weight estimation as fallback
  if (!estimatedWeight) {
    const productLower = productName.toLowerCase();

    // Electronics weight estimation
    if (productLower.includes("laptop") || productLower.includes("notebook")) {
      estimatedWeight = 2.5;
    } else if (productLower.includes("smartphone") || productLower.includes("celular") || productLower.includes("phone")) {
      estimatedWeight = 0.2;
    } else if (productLower.includes("tablet")) {
      estimatedWeight = 0.5;
    } else if (productLower.includes("monitor") || productLower.includes("pantalla")) {
      estimatedWeight = 5.0;
    } else if (productLower.includes("keyboard") || productLower.includes("teclado")) {
      estimatedWeight = 1.0;
    } else if (productLower.includes("mouse") || productLower.includes("ratón")) {
      estimatedWeight = 0.15;
    } else if (productLower.includes("headphone") || productLower.includes("auricular")) {
      estimatedWeight = 0.3;
    } else if (productLower.includes("book") || productLower.includes("libro")) {
      estimatedWeight = 0.4;
    } else if (productLower.includes("clothing") || productLower.includes("ropa") || productLower.includes("shirt") || productLower.includes("camisa")) {
      estimatedWeight = 0.3;
    } else {
      // Default weight for unknown products
      estimatedWeight = 1.0;
    }

    source = "basic_estimation";
  }

  const shippingCost = estimatedWeight * extensionConfig.shippingCostPerKg;

  return {
    shippingCost: Math.round(shippingCost * 100) / 100, // Round to 2 decimal places
    totalWeight: estimatedWeight,
    source,
  };
}

/**
 * Determines currency based on symbol and current country
 */
function determineCurrency(currencySymbol: string): string {
  // Check if it's explicitly USD
  if (currencySymbol.includes("US$") || currencySymbol.includes("U$S") || currencySymbol.includes("USD")) {
    return "USD";
  }

  // For any other symbol (including $, R$, etc.), use the country's local currency
  const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
  const localCurrency = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";

  return localCurrency;
}

/**
 * Calculates similarity score between two product names
 */
function wordCoincidence(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const cleanStr1 = str1
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanStr2 = str2
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words1 = cleanStr1.split(" ").filter((word) => word.length > 2);
  const words2 = cleanStr2.split(" ").filter((word) => word.length > 2);

  let score = 0;
  words1.forEach((word1) => {
    words2.forEach((word2) => {
      if (word1 === word2) {
        score += 10;
      } else if (word1.includes(word2) || word2.includes(word1)) {
        score += 5;
      }
    });
  });

  const lengthDiff = Math.abs(cleanStr1.length - cleanStr2.length);
  if (lengthDiff < 10) score += 3;

  return score;
}

/**
 * Checks if current page is a product detail page
 */
function isProductDetailPage(): boolean {
  // Check URL pattern - updated to match all MercadoLibre product URL formats
  const url = window.location.href;
  const isProductURL = /\/(p|ML[A-Z]-\d+)[\w-]*/.test(url) || url.includes("articulo.mercadolibre.") || url.includes("produto.mercadolivre.");

  // Check for presence of product page elements
  const hasProductTitle = !!document.querySelector(SELECTORS.PDP_MAIN_TITLE);
  const hasPriceContainer = !!document.querySelector(SELECTORS.PDP_MAIN_PRICE_CONTAINER);

  return isProductURL && (hasProductTitle || hasPriceContainer);
}

/**
 * Gets the product title from the main product on a product detail page
 */
function getMainProductTitle(): string | null {
  const titleElement = document.querySelector(SELECTORS.PDP_MAIN_TITLE);
  return titleElement?.textContent?.trim() || null;
}

/**
 * Gets the product title from the current page URL (for product pages)
 */
function getProductTitleFromURL(): string | null {
  const url = window.location.href;
  const match = url.match(/\/([^\/\?#]+)(?:\/p\/|\-_JM)/);
  if (match && match[1]) {
    // Replace dashes with spaces and decode
    return decodeURIComponent(match[1].replace(/-/g, " "));
  }
  return null;
}

/**
 * Gets MercadoLibre price from main product on product detail page
 */
function getMainProductPrice(): MLPrice {
  const defaultPrice: MLPrice = { currency: "UYU", price: 0 };

  try {
    const currencyElement = document.querySelector(SELECTORS.PDP_MAIN_PRICE_CURRENCY);
    const priceElement = document.querySelector(SELECTORS.PDP_MAIN_PRICE_FRACTION);

    if (currencyElement && priceElement) {
      const currencyText = currencyElement.innerHTML.trim();
      const priceText = priceElement.innerHTML.replace(/\./g, "").replace(/,/g, "");
      const price = parseFloat(priceText);

      // Use the new centralized currency determination logic
      const currency = determineCurrency(currencyText);

      return {
        currency: currency,
        price: price,
      };
    }
  } catch (e) {
    console.warn("Error getting main product price:", e);
  }

  return defaultPrice;
}

/**
 * Gets the product title from a recommendation item
 */
function getRecommendationProductTitle(item: Element): string | null {
  const titleElement = item.querySelector(SELECTORS.PDP_RECOMMENDATION_TITLE);
  return titleElement?.textContent?.trim() || null;
}

/**
 * Gets MercadoLibre price from a recommendation item
 */
function getRecommendationProductPrice(item: Element): MLPrice {
  const defaultPrice: MLPrice = { currency: "UYU", price: 0 };

  try {
    // First try the dynamic carousel format (price includes currency)
    const dynamicPriceElement = item.querySelector(".dynamic-carousel__price span");
    if (dynamicPriceElement) {
      const fullPriceText = dynamicPriceElement.textContent?.trim() || "";
      // Parse "US$ 729" or "$ 1,234" format
      const priceMatch = fullPriceText.match(/(US\$|U\$S|\$|R\$|[A-Z]{3})\s*([0-9,]+(?:\.[0-9]+)?)/);
      if (priceMatch) {
        const currencySymbol = priceMatch[1];
        const priceText = priceMatch[2].replace(/[,\.]/g, "");
        const price = parseFloat(priceText);

        // Use the new centralized currency determination logic
        const currency = determineCurrency(currencySymbol);

        return {
          currency: currency,
          price: price,
        };
      }
    }

    // Fallback to standard format
    const currencyElement = item.querySelector(SELECTORS.PDP_RECOMMENDATION_PRICE_CURRENCY);
    const priceElement = item.querySelector(SELECTORS.PDP_RECOMMENDATION_PRICE_FRACTION);

    if (currencyElement && priceElement) {
      const currencyText = currencyElement.innerHTML.trim();
      const priceText = priceElement.innerHTML.replace(/\./g, "").replace(/,/g, "");
      const price = parseFloat(priceText);

      // Use the new centralized currency determination logic
      const currency = determineCurrency(currencyText);

      return {
        currency: currency,
        price: price,
      };
    }
  } catch (e) {
    console.warn("Error getting recommendation product price:", e);
  }

  return defaultPrice;
}

/**
 * Finds the most similar product from a list
 * Disabled as its not working as expected.
 */
function findMostSimilarProduct(target: string, products: Item[]): Item | null {
  // if (!products || products.length === 0) return null;
  // if (!target) return products[0];

  // let maxScore = 0;
  // let bestMatch: Item | null = null;

  // for (const product of products) {
  //   const score = wordCoincidence(target, product.name);
  //   const adjustedScore = product.price > 0 ? score + 5 : score;

  //   if (adjustedScore > maxScore) {
  //     maxScore = adjustedScore;
  //     bestMatch = product;
  //   }
  // }

  // return bestMatch || products[0];
  console.log("Products", products);
  return products.find((el) => el.price) || products[0];
}

function extractJsonFromString<T = any>(text: string): T {
  // Remove markdown fences like ```json ... ```
  const cleaned = text
    .replace(/```json/i, "") // remove opening ```json
    .replace(/```/g, "") // remove closing ```
    .trim();

  // Extract the JSON block
  const match = cleaned.match(/{[\s\S]*}/);
  if (!match) {
    throw new Error("No JSON found in string");
  }

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Extract the JSON block
    const match = cleaned.match(/{[\s\S]*}/);
    if (!match) {
      throw new Error("No JSON found in string");
    }

    try {
      return JSON.parse(match[0]) as T;
    } catch {
      throw new Error("Invalid JSON found in string");
    }
  }
}

/**
 * Optimizes search query using Gemini AI
 * Now respects aiSearchEnabled setting and stores/caches queries
 */
async function optimizeSearchQueryWithGemini(productName: string, geminiApiKey?: string): Promise<string> {
  // If AI search is disabled, use fallback optimization
  if (!extensionConfig.aiSearchEnabled) {
    console.log("🤖 [AI] AI Search is disabled, using fallback optimization");
    return optimizeSearchQuery(productName);
  }

  // If no API key or product name, use fallback
  if (!geminiApiKey || !productName) {
    console.log("🤖 [AI] Missing API key or product name, using fallback optimization");
    return optimizeSearchQuery(productName);
  }

  try {
    // Check if we have a cached query first
    const cachedQuery = await InlineAIQueryManager.getCachedQuery(productName);
    if (cachedQuery) {
      console.log("🤖 [AI] Using cached optimized query:", cachedQuery.optimizedQuery);
      return cachedQuery.optimizedQuery;
    }

    console.log("🤖 [GEMINI] Optimizing search query with AI:", productName);

    const prompt = [
      `Given this product name from MercadoLibre: "${productName}"`,
      `Please provide a JSON response with the following structure:`,
      `{`,
      `  "optimizedQuery": "optimized search query",`,
      `  "estimatedWeight": weight_in_kg_as_number_or_null,`,
      `  "weightConfidence": "high|medium|low",`,
      `  "weightSource": "explanation_of_weight_estimation"`,
      `}`,
      ``,
      `For the optimizedQuery:`,
      `1. PRESERVE EXACT MODEL NUMBERS AND HARDWARE SPECIFICATIONS (RTX 5060, RTX 4090, i7-12700F, etc.)`,
      `2. Keep essential product features, technical specifications, and model numbers exactly as written`,
      `3. Remove only generic filler words like "para", "de", "con", "original", "nuevo", etc.`,
      `4. Use English terms when appropriate for international marketplaces`,
      `5. Be concise but descriptive (max 12 words)`,
      `6. CRITICAL: Never change hardware model numbers`,
      ``,
      `For the weight estimation:`,
      `1. Estimate the weight in kilograms based on the product type and specifications`,
      `2. Use your knowledge of typical weights for similar products`,
      `3. For electronics: consider components, size, materials`,
      `4. For clothing: estimate based on material and size`,
      `5. For books/media: estimate based on format and page count`,
      `6. For tools/hardware: consider materials and size`,
      `7. If weight cannot be reasonably estimated, set estimatedWeight to null`,
      `8. Set weightConfidence: "high" for products with predictable weights, "medium" for reasonable estimates, "low" for very uncertain`,
      `9. Explain in weightSource how you estimated the weight`,
      ``,
      `Respond ONLY with valid JSON, no additional text.`,
    ].join("\n");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Response IA", data);
    let aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (aiResponse && aiResponse.length > 0) {
      console.log("🤖 [GEMINI] AI raw response:", aiResponse);

      try {
        const parsedResponse = extractJsonFromString(aiResponse);

        if (parsedResponse.optimizedQuery) {
          const optimizedQuery = parsedResponse.optimizedQuery;
          console.log("🤖 [GEMINI] AI optimized query:", optimizedQuery);

          // Extract weight data if available
          const weightData: any = {};
          if (parsedResponse.estimatedWeight !== null && parsedResponse.estimatedWeight !== undefined) {
            weightData.estimatedWeight = parseFloat(parsedResponse.estimatedWeight);
            weightData.weightConfidence = parsedResponse.weightConfidence || "medium";
            weightData.weightSource = parsedResponse.weightSource || "AI estimation";

            console.log(`🤖 [GEMINI] Estimated weight: ${weightData.estimatedWeight}kg (${weightData.weightConfidence} confidence)`);
            console.log(`🤖 [GEMINI] Weight source: ${weightData.weightSource}`);
          }

          // Save the query with weight data to storage for future use
          await InlineAIQueryManager.saveQuery(productName, optimizedQuery, "gemini", weightData);

          return optimizedQuery;
        }
      } catch (jsonError) {
        console.warn("🤖 [GEMINI] Failed to parse JSON response, treating as plain text:", jsonError);

        // Fallback: treat as plain text response (old format)
        const optimizedQuery = aiResponse;
        console.log("🤖 [GEMINI] AI optimized query (plain text):", optimizedQuery);

        // Save without weight data
        await InlineAIQueryManager.saveQuery(productName, optimizedQuery, "gemini");

        return optimizedQuery;
      }
    }

    throw new Error("Empty or invalid response from Gemini");
  } catch (error) {
    console.warn("🤖 [GEMINI] AI optimization failed, using fallback:", error);
    return optimizeSearchQuery(productName);
  }
}

/**
 * Optimizes search query
 * Disabled by now as its not working as expected
 */
function optimizeSearchQuery(productName: string): string {
  // if (!productName) return "";

  // let cleanQuery = productName
  //   .toLowerCase()
  //   .replace(/marca\s+/g, "")
  //   .replace(/color\s+\w+/g, "")
  //   .replace(/\b(para|de|con|sin|en|la|el|los|las|un|una)\b/g, "")
  //   .replace(/[^\w\s-]/g, " ")
  //   .replace(/\s+/g, " ")
  //   .trim();

  // const words = cleanQuery.split(" ").filter((word) => word.length > 2);
  // const optimizedQuery = words.slice(0, 8).join(" ");

  // return optimizedQuery || productName;
  return productName;
}

/**
 * Gets the product title from an item
 */
function getProductTitle(item: Element): string | null {
  const titleElement = item.querySelector(`${SELECTORS.PRODUCT_TITLE_OLD}, ${SELECTORS.PRODUCT_TITLE_NEW}`);
  return titleElement?.textContent?.trim() || null;
}

/**
 * Gets MercadoLibre price from an item
 */
function getMercadoLibrePrice(item: Element): MLPrice {
  const defaultPrice: MLPrice = { currency: "UYU", price: 0 };

  try {
    // First try the dynamic carousel format (price includes currency)
    const dynamicPriceElement = item.querySelector(".dynamic-carousel__price span");
    if (dynamicPriceElement) {
      const fullPriceText = dynamicPriceElement.textContent?.trim() || "";
      // Parse "US$ 729" or "$ 1,234" format
      const priceMatch = fullPriceText.match(/(US\$|U\$S|\$|R\$|[A-Z]{3})\s*([0-9,]+(?:\.[0-9]+)?)/);
      if (priceMatch) {
        const currencySymbol = priceMatch[1];
        const priceText = priceMatch[2].replace(/[,\.]/g, "");
        const price = parseFloat(priceText);

        // Use the new centralized currency determination logic
        const currency = determineCurrency(currencySymbol);

        return {
          currency: currency,
          price: price,
        };
      }
    }

    // Fallback to standard format
    const currencyElement = item.querySelector(`${SELECTORS.PRICE_CURRENCY_NEW}, ${SELECTORS.PRICE_CURRENCY_OLD}`);
    const priceElement = item.querySelector(`${SELECTORS.PRICE_FRACTION_NEW}, ${SELECTORS.PRICE_FRACTION_OLD}`);

    if (currencyElement && priceElement) {
      const currencyText = currencyElement.innerHTML.trim();
      const priceText = priceElement.innerHTML.replace(/\./g, "").replace(/,/g, "");
      const price = parseFloat(priceText);

      // Use the new centralized currency determination logic
      const currency = determineCurrency(currencyText);

      return {
        currency: currency,
        price: price,
      };
    }
  } catch (e) {
    console.warn("Error getting MercadoLibre price:", e);
  }

  return defaultPrice;
}

/**
 * Currency conversion function - improved to handle all MercadoLibre currencies
 */
function currencyConversion(item: Item, currencySymbol = "UYU"): CurrencyConversionResult {
  const price = item.price;
  const currency = item.currency;
  let priceAlt = 0;
  let currencyAlt = "";

  if (!currenciesData || !currencyData) {
    return { priceRaw: 0, priceAlt: "N/A", currencyAlt: "" };
  }

  // Try to get USD conversion rate for the target currency
  let usdRate: number | undefined;

  if (currenciesData[currencySymbol]?.["USD"]) {
    usdRate = currenciesData[currencySymbol]["USD"];
  } else if (currencyData.rates?.[currencySymbol]?.to) {
    usdRate = currencyData.rates[currencySymbol].to;
  }

  if (!usdRate) {
    return { priceRaw: price, priceAlt: price.toString(), currencyAlt: currency };
  }

  if (currency === "USD") {
    // Convert USD to target currency
    priceAlt = price * usdRate;
    currencyAlt = currencySymbol;
  } else if (currency === currencySymbol) {
    // Convert target currency to USD
    priceAlt = price / usdRate;
    currencyAlt = "USD";
  } else {
    // For different currencies, try to convert through USD
    let itemUsdRate: number | undefined;

    if (currenciesData[currency]?.["USD"]) {
      itemUsdRate = currenciesData[currency]["USD"];
    } else if (currencyData.rates?.[currency]?.to) {
      itemUsdRate = currencyData.rates[currency].to;
    }

    if (itemUsdRate) {
      // Convert item currency to USD, then USD to target currency
      const priceInUSD = price / itemUsdRate;
      priceAlt = priceInUSD * usdRate;
      currencyAlt = currencySymbol;
    } else {
      // Fallback: return original price
      priceAlt = price;
      currencyAlt = currency;
    }
  }

  const currFormatter = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return {
    priceRaw: priceAlt,
    priceAlt: currFormatter.format(priceAlt),
    currencyAlt,
  };
}

/**
 * Creates search URL for platform
 */
async function createSearchURL(platform: "ebay" | "amazon", query: string, maxPrice?: number, onlyNew = false): Promise<string> {
  let minPriceStr = "";
  let maxPriceStr = "";

  // Add max price filter if provided
  if (maxPrice && maxPrice > 0) {
    maxPriceStr = Math.floor(maxPrice).toString();
    if (maxPrice > 900) {
      minPriceStr = Math.floor(maxPrice * 0.4).toString();
    } else if (maxPrice > 100) {
      minPriceStr = Math.min(Math.floor(maxPrice) - 50, 100).toString();
    } else if (maxPrice > 50) {
      minPriceStr = Math.floor(maxPrice * 0.5).toString();
    }
  }

  const optimizedQuery = await optimizeSearchQueryWithGemini(query, extensionConfig.geminiApiKey);

  if (platform === "ebay") {
    const searchParams: Record<string, string> = {
      _nkw: optimizedQuery,
      _sacat: "0",
      LH_BIN: "1",
      _sop: "15",
      rt: "nc",
      LH_ItemCondition: onlyNew ? "2000|3" : "1000|1500|2000|2500|3000",
      _pgn: "1",
      _skc: "50",
    };

    if (maxPriceStr) {
      searchParams._udhi = maxPriceStr;
    }
    if (minPriceStr) {
      searchParams._udlo = minPriceStr;
    }

    return "https://www.ebay.com/sch/i.html?" + new URLSearchParams(searchParams).toString();
  } else {
    return (
      "https://www.amazon.com/s?" +
      new URLSearchParams({
        k: optimizedQuery,
        s: "price-asc-rank",
        "low-price": minPriceStr,
        "high-price": maxPriceStr,
        qid: Date.now().toString(),
      }).toString()
    );
  }
}

/**
 * Promise wrapper for chrome.runtime.sendMessage
 */
function sendMessagePromise(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if chrome runtime is available
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn("❌ Chrome runtime not available, message cannot be sent:", message);
      reject(new Error("Chrome runtime not available"));
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Generic button click handler that works for search results, main product, and recommendations
 */
function createButtonClickHandler(platform: "ebay" | "amazon", productName: string, item: Element, button: HTMLButtonElement, itemType: "search" | "main" | "recommendation" = "search") {
  return async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const originalText = button.textContent;
    button.textContent = "Loading...";
    button.disabled = true;

    try {
      // Get MercadoLibre price for filtering based on item type
      let mlPrice: MLPrice;
      switch (itemType) {
        case "main":
          mlPrice = getMainProductPrice();
          break;
        case "recommendation":
          mlPrice = getRecommendationProductPrice(item);
          break;
        default:
          mlPrice = getMercadoLibrePrice(item);
          break;
      }

      let maxPriceUSD: number | undefined;

      // Convert ML price to USD for eBay filtering
      if (mlPrice.price > 0) {
        if (mlPrice.currency === "USD") {
          maxPriceUSD = mlPrice.price;
        } else {
          // For any other currency, try to convert to USD using available exchange rates
          const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
          const localCurrency = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";

          if (mlPrice.currency === localCurrency && currenciesData && currenciesData[localCurrency]?.["USD"]) {
            // Convert local currency to USD
            const usdRate = currenciesData[localCurrency]["USD"];
            maxPriceUSD = mlPrice.price / usdRate;
          } else if (currencyData?.rates?.[mlPrice.currency]?.to) {
            // Fallback to general currency data
            const usdRate = currencyData.rates[mlPrice.currency].to;
            maxPriceUSD = mlPrice.price / usdRate;
          }
        }
      }

      const searchURL = await createSearchURL(platform, productName, maxPriceUSD, extensionConfig.onlyNew);
      console.log(`${itemType} ${platform} search URL:`, searchURL);

      const response = await sendMessagePromise({
        url: searchURL,
        msg: "request",
        searchType: platform,
        productName: productName,
      });

      if (!response?.success || !response?.htmlData) {
        throw new Error(response?.error || `${platform} request failed`);
      }

      const parsedResult = platform === "ebay" ? ebayFront.parseHTML(response.htmlData) : amazonFront.parseHTML(response.htmlData);

      if (!parsedResult.items || parsedResult.items.length === 0) {
        button.textContent = "No Results";
        return;
      }

      let bestMatch = findMostSimilarProduct(productName, parsedResult.items);
      if (!bestMatch || bestMatch.price <= 0) {
        button.textContent = "No Price";
        bestMatch = {
          link: searchURL,
        } as Item;
      } else {
        const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
        const currencySymbol = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";
        const { priceRaw } = currencyConversion(bestMatch, currencySymbol);

        // Improved price comparison logic that handles all currencies
        let isBetterPrice = false;
        let mlPriceForComparison = mlPrice.price;
        let comparisonPrice = bestMatch.price;

        if (mlPrice.currency === "USD" && bestMatch.currency === "USD") {
          // Both in USD - direct comparison
          isBetterPrice = bestMatch.price < mlPrice.price;
          comparisonPrice = bestMatch.price;
          mlPriceForComparison = mlPrice.price;
        } else if (mlPrice.currency === bestMatch.currency) {
          // Same currency - direct comparison
          isBetterPrice = bestMatch.price < mlPrice.price;
          comparisonPrice = bestMatch.price;
          mlPriceForComparison = mlPrice.price;
        } else {
          // Different currencies - use existing conversion logic
          isBetterPrice = priceRaw < mlPrice.price;
          comparisonPrice = priceRaw;
          mlPriceForComparison = mlPrice.price;
        }

        // Calculate price difference percentage for color coding
        const differencePercentage = calculatePriceDifferencePercentage(mlPriceForComparison, comparisonPrice);
        const colorClass = getPriceColorClass(differencePercentage);

        // Add the appropriate CSS classes based on item type and price difference
        const baseClasses = itemType === "main" ? "btn_ml_app btn_ml_app_main" : "btn_ml_app";
        const platformClass = `${platform}_btn`;
        button.className = `${platformClass} ${baseClasses} ${colorClass}`;

        // Store currency state for this button
        const buttonId = generateButtonId(platform, productName, itemType);
        const localCurrency = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";

        currencyDisplayState.set(buttonId, {
          showingLocal: false,
          originalPrice: bestMatch.price,
          originalCurrency: bestMatch.currency,
        });

        // Update button content and show refresh and currency toggle buttons
        const btnText = button.querySelector(".btn-text");
        if (btnText) {
          btnText.innerHTML = formatPriceWithShipping(productName, bestMatch.price, "USD");
        } else {
          button.innerHTML = `
            <span class="btn-text" style="color: inherit !important; text-decoration: none !important;">
              ${formatPriceWithShipping(productName, bestMatch.price, "USD")}
            </span>
            <button class="currency_toggle_${platform}" style="
              position: absolute; 
              right: ${itemType === "main" ? "26px" : "22px"}; 
              top: 50%; 
              transform: translateY(-50%); 
              width: ${itemType === "main" ? "18px" : "16px"}; 
              height: ${itemType === "main" ? "18px" : "16px"}; 
              font-size: ${itemType === "main" ? "8px" : "7px"}; 
              background: rgba(255,255,255,0.9); 
              border: ${itemType === "main" ? "1px solid #ddd" : "none"}; 
              border-radius: 3px; 
              cursor: pointer;
              display: block;
              padding: 0;
              line-height: 1;
              font-weight: bold;
            " title="Mostrar en ${localCurrency}">${localCurrency}</button>
            <button class="refresh_btn_${platform}" style="
              position: absolute; 
              right: ${itemType === "main" ? "4px" : "2px"}; 
              top: 50%; 
              transform: translateY(-50%); 
              width: ${itemType === "main" ? "18px" : "16px"}; 
              height: ${itemType === "main" ? "18px" : "16px"}; 
              font-size: 10px; 
              background: rgba(255,255,255,0.9); 
              border: ${itemType === "main" ? "1px solid #ddd" : "none"}; 
              border-radius: 50%; 
              cursor: pointer;
              display: block;
              padding: 0;
              line-height: 1;
            " title="Actualizar ${platform === "ebay" ? "eBay" : "Amazon"}">🔄</button>
          `;
        }

        // Show the refresh button for this platform
        const refreshBtn = button.querySelector(`.refresh_btn_${platform}`) as HTMLButtonElement;
        if (refreshBtn) {
          refreshBtn.style.display = "block";
          refreshBtn.onclick = createIndividualRefreshHandler(platform, productName, item, button, itemType);
        }

        // Show and set up the currency toggle button for this platform
        const currencyToggleBtn = button.querySelector(`.currency_toggle_${platform}`) as HTMLButtonElement;
        if (currencyToggleBtn) {
          currencyToggleBtn.style.display = "block";
          currencyToggleBtn.onclick = createCurrencyToggleHandler(platform, productName, item, button, itemType);
        }
      }

      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Always use searchURL for both platforms to avoid about:blank issues
        // For eBay: use searchURL directly
        // For Amazon: use searchURL (don't use bestMatch.link which may be invalid)
        window.open(searchURL, "_blank");
      };
    } catch (error) {
      console.error(`Error processing ${itemType} ${platform} request:`, error);
      button.textContent = "Error";
    } finally {
      button.disabled = false;
    }
  };
}

/**
 * Creates individual refresh button click handler for a specific platform
 */
function createIndividualRefreshHandler(platform: "ebay" | "amazon", productName: string, item: Element, button: HTMLButtonElement, itemType: "search" | "main" | "recommendation" = "search"): (event: Event) => Promise<void> {
  return async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const refreshBtn = event.target as HTMLButtonElement;

    // Show refresh animation
    refreshBtn.textContent = "🔄";
    refreshBtn.disabled = true;
    refreshBtn.style.animation = "spin 1s linear infinite";

    // Add the spin animation CSS if it doesn't exist
    if (!document.querySelector("#refresh-spin-animation")) {
      const style = document.createElement("style");
      style.id = "refresh-spin-animation";
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    try {
      // Reset this specific button state
      button.disabled = false;

      // Reset button appearance and text
      const btnText = button.querySelector(".btn-text");
      if (btnText) {
        btnText.textContent = platform === "ebay" ? "🛒 eBay" : "📦 Amazon";
      } else {
        button.textContent = platform === "ebay" ? "🛒 eBay" : "📦 Amazon";
      }

      button.className = button.className.replace(/btn_ml_(success|danger)|price-(excellent|good|warning|expensive)/g, "").trim();
      if (itemType === "main") {
        button.className = `${platform}_btn btn_ml_app btn_ml_app_main`;
      } else {
        button.className = `${platform}_btn btn_ml_app`;
      }

      // Hide the refresh and currency toggle buttons again until new search completes
      refreshBtn.style.display = "none";

      const currencyToggleBtn = button.querySelector(`.currency_toggle_${platform}`) as HTMLButtonElement;
      if (currencyToggleBtn) {
        currencyToggleBtn.style.display = "none";
        // Reset currency state for this button
        const buttonId = generateButtonId(platform, productName, itemType);
        currencyDisplayState.delete(buttonId);
      }

      // Re-setup button handler with fresh data
      button.onclick = createButtonClickHandler(platform, productName, item, button, itemType);

      console.log(`🔄 Refreshed ${platform} button for ${itemType} item: ${productName}`);

      // Show success feedback briefly
      refreshBtn.textContent = "✅";
      refreshBtn.style.animation = "";
      setTimeout(() => {
        refreshBtn.style.display = "none";
      }, 800);
    } catch (error) {
      console.error(`Error refreshing ${platform} button for ${itemType}:`, error);
      refreshBtn.textContent = "❌";
      refreshBtn.style.animation = "";
      setTimeout(() => {
        refreshBtn.style.display = "none";
      }, 1500);
    } finally {
      refreshBtn.disabled = false;
    }
  };
}

/**
 * Creates button container
 */
function createButtonContainer(): HTMLElement {
  const sizeMap = {
    small: "12px",
    medium: "14px",
    large: "16px",
  };

  const fontSize = sizeMap[extensionConfig.textSize as keyof typeof sizeMap] || "14px";
  const transition = extensionConfig.animations ? "all 0.3s ease" : "none";

  // Get the local currency for this country
  const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
  const localCurrency = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";

  const element = document.createElement("div");
  element.innerHTML = `
    <div class="btn_ml_app_container" style="font-size: ${fontSize}; transition: ${transition};">
      <button style="font-size: ${fontSize}; position: relative;" class="ebay_btn btn_ml_app">
        <span class="btn-text">🛒 eBay</span>
        <button class="currency_toggle_ebay" style="
          position: absolute; 
          right: 22px; 
          top: 50%; 
          transform: translateY(-50%); 
          width: 16px; 
          height: 16px; 
          font-size: 7px; 
          background: rgba(255,255,255,0.8); 
          border: none; 
          border-radius: 3px; 
          cursor: pointer;
          display: none;
          padding: 0;
          line-height: 1;
          font-weight: bold;
        " title="Cambiar moneda">${localCurrency}</button>
        <button class="refresh_btn_ebay" style="
          position: absolute; 
          right: 2px; 
          top: 50%; 
          transform: translateY(-50%); 
          width: 16px; 
          height: 16px; 
          font-size: 10px; 
          background: rgba(255,255,255,0.8); 
          border: none; 
          border-radius: 50%; 
          cursor: pointer;
          display: none;
          padding: 0;
          line-height: 1;
        " title="Actualizar eBay">🔄</button>
      </button>
      <button style="font-size: ${fontSize}; position: relative;" class="amazon_btn btn_ml_app">
        <span class="btn-text">📦 Amazon</span>
        <button class="currency_toggle_amazon" style="
          position: absolute; 
          right: 22px; 
          top: 50%; 
          transform: translateY(-50%); 
          width: 16px; 
          height: 16px; 
          font-size: 7px; 
          background: rgba(255,255,255,0.8); 
          border: none; 
          border-radius: 3px; 
          cursor: pointer;
          display: none;
          padding: 0;
          line-height: 1;
          font-weight: bold;
        " title="Cambiar moneda">${localCurrency}</button>
        <button class="refresh_btn_amazon" style="
          position: absolute; 
          right: 2px; 
          top: 50%; 
          transform: translateY(-50%); 
          width: 16px; 
          height: 16px; 
          font-size: 10px; 
          background: rgba(255,255,255,0.8); 
          border: none; 
          border-radius: 50%; 
          cursor: pointer;
          display: none;
          padding: 0;
          line-height: 1;
        " title="Actualizar Amazon">🔄</button>
      </button>
    </div>
  `;
  return element;
}

/**
 * Setup button handlers
 */
function setupButtonHandlers(container: HTMLElement, productName: string, item: Element): void {
  const ebayBtn = container.querySelector(SELECTORS.EBAY_BUTTON) as HTMLButtonElement;
  const amazonBtn = container.querySelector(SELECTORS.AMAZON_BUTTON) as HTMLButtonElement;

  if (ebayBtn) {
    ebayBtn.onclick = createButtonClickHandler("ebay", productName, item, ebayBtn);
  }

  if (amazonBtn) {
    amazonBtn.onclick = createButtonClickHandler("amazon", productName, item, amazonBtn);
  }
}

/**
 * Creates a main product button container with better styling for product pages
 */
function createMainProductButtonContainer(): HTMLElement {
  const sizeMap = {
    small: "12px",
    medium: "14px",
    large: "16px",
  };

  const fontSize = sizeMap[extensionConfig.textSize as keyof typeof sizeMap] || "14px";
  const transition = extensionConfig.animations ? "all 0.3s ease" : "none";

  // Get the local currency for this country
  const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
  const localCurrency = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";

  const element = document.createElement("div");
  element.innerHTML = `
    <div class="btn_ml_app_container btn_ml_app_main_product" style="
      font-size: ${fontSize}; 
      transition: ${transition}; 
      margin: 16px 0; 
      padding: 12px; 
      border: 1px solid #e6e6e6; 
      border-radius: 8px; 
      background: #f8f9fa;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    ">
      <div style="margin-bottom: 8px; font-weight: 600; color: #333; font-size: ${fontSize};">
        Comparar precios en:
      </div>
      <div style="display: flex; gap: 8px;">
        <button style="
          font-size: ${fontSize}; 
          flex: 1; 
          padding: 8px 12px; 
          padding-right: 48px;
          border-radius: 6px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          transition: ${transition};
          position: relative;
        " class="ebay_btn btn_ml_app btn_ml_app_main">
          <span class="btn-text">🛒 eBay</span>
          <button class="currency_toggle_ebay" style="
            position: absolute; 
            right: 26px; 
            top: 50%; 
            transform: translateY(-50%); 
            width: 18px; 
            height: 18px; 
            font-size: 8px; 
            background: rgba(255,255,255,0.9); 
            border: 1px solid #ddd; 
            border-radius: 3px; 
            cursor: pointer;
            display: none;
            padding: 0;
            line-height: 1;
            font-weight: bold;
          " title="Cambiar moneda">${localCurrency}</button>
          <button class="refresh_btn_ebay" style="
            position: absolute; 
            right: 4px; 
            top: 50%; 
            transform: translateY(-50%); 
            width: 18px; 
            height: 18px; 
            font-size: 10px; 
            background: rgba(255,255,255,0.9); 
            border: 1px solid #ddd; 
            border-radius: 50%; 
            cursor: pointer;
            display: none;
            padding: 0;
            line-height: 1;
          " title="Actualizar eBay">🔄</button>
        </button>
        <button style="
          font-size: ${fontSize}; 
          flex: 1; 
          padding: 8px 12px; 
          padding-right: 48px;
          border-radius: 6px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          transition: ${transition};
          position: relative;
        " class="amazon_btn btn_ml_app btn_ml_app_main">
          <span class="btn-text">📦 Amazon</span>
          <button class="currency_toggle_amazon" style="
            position: absolute; 
            right: 26px; 
            top: 50%; 
            transform: translateY(-50%); 
            width: 18px; 
            height: 18px; 
            font-size: 8px; 
            background: rgba(255,255,255,0.9); 
            border: 1px solid #ddd; 
            border-radius: 3px; 
            cursor: pointer;
            display: none;
            padding: 0;
            line-height: 1;
            font-weight: bold;
          " title="Cambiar moneda">${localCurrency}</button>
          <button class="refresh_btn_amazon" style="
            position: absolute; 
            right: 4px; 
            top: 50%; 
            transform: translateY(-50%); 
            width: 18px; 
            height: 18px; 
            font-size: 10px; 
            background: rgba(255,255,255,0.9); 
            border: 1px solid #ddd; 
            border-radius: 50%; 
            cursor: pointer;
            display: none;
            padding: 0;
            line-height: 1;
          " title="Actualizar Amazon">🔄</button>
        </button>
      </div>
    </div>
  `;
  return element;
}

/**
 * Setup main product button handlers
 */
function setupMainProductButtonHandlers(container: HTMLElement, productName: string): void {
  const ebayBtn = container.querySelector(SELECTORS.EBAY_BUTTON) as HTMLButtonElement;
  const amazonBtn = container.querySelector(SELECTORS.AMAZON_BUTTON) as HTMLButtonElement;

  // Create a dummy element for the main product context since we don't have a specific item element
  const dummyElement = document.createElement("div");

  if (ebayBtn) {
    ebayBtn.onclick = createButtonClickHandler("ebay", productName, dummyElement, ebayBtn, "main");
  }

  if (amazonBtn) {
    amazonBtn.onclick = createButtonClickHandler("amazon", productName, dummyElement, amazonBtn, "main");
  }
}

/**
 * Process a single product item
 */
function processProductItem(item: Element, index: number): void {
  // Check if extension is enabled
  if (!extensionConfig.enabled) {
    processingQueue.delete(item);
    return;
  }

  if (processingQueue.has(item)) return;
  processingQueue.add(item);

  if (item.querySelector(SELECTORS.BUTTON_CONTAINER)) {
    processingQueue.delete(item);
    return;
  }

  const productName = getProductTitle(item);
  if (!productName) {
    processingQueue.delete(item);
    return;
  }

  const buttonContainer = createButtonContainer();
  (item as HTMLElement).style.position = "relative";
  (item as HTMLElement).appendChild(buttonContainer);
  setupButtonHandlers(buttonContainer, productName, item);
  processingQueue.delete(item);
}

/**
 * Process the main product on a product detail page
 */
function processMainProduct(): void {
  console.log("🔍 processMainProduct() called");

  // Check if extension is enabled
  if (!extensionConfig.enabled) {
    console.log("⚠️ Extension disabled, skipping main product processing");
    return;
  }

  console.log("🔍 Looking for price container with selector:", SELECTORS.PDP_MAIN_PRICE_CONTAINER);

  // Check if we already processed the main product - look for any extension button container in the price area
  const priceContainer = document.querySelector(SELECTORS.PDP_MAIN_PRICE_CONTAINER);
  if (!priceContainer) {
    console.log("❌ Price container not found with selector:", SELECTORS.PDP_MAIN_PRICE_CONTAINER);

    // Debug: try to find what price elements exist
    const allPriceElements = document.querySelectorAll('[id*="price"], [class*="price"], [class*="pdp"]');
    console.log("🔍 Found price-related elements:", allPriceElements.length);
    allPriceElements.forEach((el, i) => {
      if (i < 5) {
        // Only log first 5 to avoid spam
        console.log(`  ${i + 1}. ${el.tagName}#${el.id || "no-id"}.${el.className || "no-class"}`);
      }
    });

    return;
  }

  console.log("✅ Price container found:", priceContainer);

  // Check multiple ways to see if buttons already exist
  const existingContainer = document.querySelector(".btn_ml_app_main_product");
  const existingInPrice = priceContainer.querySelector(".btn_ml_app_container");
  const existingInParent = priceContainer.parentElement?.querySelector(".btn_ml_app_container");

  if (existingContainer || existingInPrice || existingInParent) {
    console.log("🔄 Main product buttons already exist, skipping");
    return;
  }

  // Get product name from title or URL
  let productName = getMainProductTitle();
  console.log("🏷️ Product name from title:", productName);

  if (!productName) {
    productName = getProductTitleFromURL();
    console.log("🏷️ Product name from URL:", productName);
  }

  if (!productName) {
    console.warn("❌ Could not extract product name for main product");

    // Debug: check what title elements exist
    const titleElements = document.querySelectorAll('h1, [class*="title"], [class*="pdp"]');
    console.log("🔍 Found title-related elements:", titleElements.length);
    titleElements.forEach((el, i) => {
      if (i < 3) {
        console.log(`  ${i + 1}. ${el.tagName}.${el.className || "no-class"}: "${el.textContent?.substring(0, 50) || "no-text"}"`);
      }
    });

    return;
  }

  console.log("✅ Processing main product:", productName);

  const buttonContainer = createMainProductButtonContainer();

  // Insert the button container after the price section
  if (priceContainer.parentNode) {
    priceContainer.parentNode.insertBefore(buttonContainer, priceContainer.nextSibling);
    console.log("✅ Button container inserted after price section");
  } else {
    console.error("❌ Price container has no parent node");
    return;
  }

  setupMainProductButtonHandlers(buttonContainer, productName);
  console.log("✅ Main product button handlers set up successfully");
}

/**
 * Process a single recommendation item
 */
function processRecommendationItem(item: Element, index: number): void {
  // Check if extension is enabled
  if (!extensionConfig.enabled) {
    processingQueue.delete(item);
    return;
  }

  if (processingQueue.has(item)) return;
  processingQueue.add(item);

  if (item.querySelector(SELECTORS.BUTTON_CONTAINER)) {
    processingQueue.delete(item);
    return;
  }

  const productName = getRecommendationProductTitle(item);
  if (!productName) {
    console.log("❌ No product name found for recommendation item:", item);
    processingQueue.delete(item);
    return;
  }

  console.log("🔍 Processing recommendation item:", productName, item);

  // Use the smaller button container for recommendations to avoid disrupting layout
  const buttonContainer = createButtonContainer();

  // Try multiple insertion strategies for different layouts
  let inserted = false;

  // Strategy 1: Insert after price section
  const priceSection = item.querySelector(".poly-card");
  if (priceSection && priceSection.parentNode) {
    (item as HTMLElement).style.position = "relative";
    priceSection.parentNode.insertBefore(buttonContainer, priceSection.nextSibling);
    inserted = true;
  }

  // Strategy 3: Fallback - add at the end of the item
  if (!inserted) {
    (item as HTMLElement).style.position = "relative";
    (item as HTMLElement).appendChild(buttonContainer);
  }

  // Use getRecommendationProductPrice for recommendations
  setupRecommendationButtonHandlers(buttonContainer, productName, item);
  processingQueue.delete(item);
}

/**
 * Setup recommendation button handlers (adapted for recommendation context)
 */
function setupRecommendationButtonHandlers(container: HTMLElement, productName: string, item: Element): void {
  const ebayBtn = container.querySelector(SELECTORS.EBAY_BUTTON) as HTMLButtonElement;
  const amazonBtn = container.querySelector(SELECTORS.AMAZON_BUTTON) as HTMLButtonElement;

  if (ebayBtn) {
    ebayBtn.onclick = createButtonClickHandler("ebay", productName, item, ebayBtn, "recommendation");
  }

  if (amazonBtn) {
    amazonBtn.onclick = createButtonClickHandler("amazon", productName, item, amazonBtn, "recommendation");
  }
}

/**
 * Process recommendation items (extracted from processAllItems)
 */
function processRecommendationItems(): void {
  const recommendationItems = document.querySelectorAll(SELECTORS.PDP_RECOMMENDATION_ITEMS);
  console.log(`🔍 Found ${recommendationItems.length} recommendation items using selector: "${SELECTORS.PDP_RECOMMENDATION_ITEMS}"`);

  // Debug: log the carousel containers found
  const containers = document.querySelectorAll(SELECTORS.PDP_RECOMMENDATIONS_CONTAINER);
  console.log(`📦 Found ${containers.length} carousel containers using selector: "${SELECTORS.PDP_RECOMMENDATIONS_CONTAINER}"`);

  // Debug: log some sample elements
  if (recommendationItems.length === 0) {
    console.log("⚠️ No recommendation items found. Let's debug:");

    // Check what carousel slides exist
    const slides = document.querySelectorAll(".andes-carousel-snapped__slide");
    console.log(`- Found ${slides.length} carousel slides`);

    // Check what recos-polycard exist
    const polycards = document.querySelectorAll(".recos-polycard");
    console.log(`- Found ${polycards.length} recos-polycard elements`);

    // Check what poly-card exist
    const polyCards = document.querySelectorAll(".poly-card");
    console.log(`- Found ${polyCards.length} poly-card elements`);

    // More specific check
    const slidePolycards = document.querySelectorAll(".andes-carousel-snapped__slide .recos-polycard");
    console.log(`- Found ${slidePolycards.length} slide recos-polycard elements`);
  }

  recommendationItems.forEach((item, index) => {
    console.log(`📋 Processing recommendation item ${index + 1}:`, item);
    processRecommendationItem(item, index);
  });
}

/**
 * Set up MutationObserver for carousel changes
 */
function setupCarouselObserver(): void {
  const carouselContainer = document.querySelector(SELECTORS.PDP_RECOMMENDATIONS_CONTAINER);
  console.log(`🎠 Setting up carousel observer. Container found:`, !!carouselContainer);

  if (!carouselContainer) {
    console.log("⚠️ No carousel container found for MutationObserver using selector:", SELECTORS.PDP_RECOMMENDATIONS_CONTAINER);
    // Try alternative selectors
    const altContainer = document.querySelector('.andes-carousel-snapped__wrapper, .ui-recommendations-carousel-wrapper-ref, section[aria-label*="relacionados"]');
    if (altContainer) {
      console.log("✅ Found alternative carousel container:", altContainer);
    }
    return;
  }

  const observer = new MutationObserver((mutations) => {
    let shouldProcessRecommendations = false;

    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Check if new slides were added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.querySelector && (element.querySelector(".andes-carousel-snapped__slide") || element.classList.contains("andes-carousel-snapped__slide"))) {
              console.log("🆕 New carousel slide detected:", element);
              shouldProcessRecommendations = true;
            }
          }
        });
      }
    });

    if (shouldProcessRecommendations) {
      console.log("🔄 New carousel items detected, processing recommendations...");
      setTimeout(() => processRecommendationItems(), 100); // Small delay to ensure DOM is ready
    }
  });

  observer.observe(carouselContainer, {
    childList: true,
    subtree: true,
  });

  console.log("👁️ Carousel MutationObserver set up successfully");
}

/**
 * Process all product items
 */
function processAllItems(): void {
  console.log("🚀 processAllItems() called");
  console.log("🌐 Current URL:", window.location.href);

  // Don't process if extension is disabled
  if (!extensionConfig.enabled) {
    console.log("⚠️ Extension is disabled, skipping item processing");
    return;
  }

  if (!currenciesData || !currencyData) {
    console.log("⚠️ Currency data not loaded yet, waiting...");
    return;
  }

  // Check if we're on a product detail page
  const isProductPage = isProductDetailPage();
  console.log("🔍 Is product detail page:", isProductPage);

  if (isProductPage) {
    console.log("📄 Processing product detail page...");

    // Process the main product
    processMainProduct();

    // Process recommendation items (initial load)
    processRecommendationItems();

    // Set up observer for dynamically loaded carousel items
    setupCarouselObserver();
  } else {
    console.log("🔍 Processing search results page...");

    // Process search result items
    const items = document.querySelectorAll(SELECTORS.PRODUCT_ITEMS);
    console.log("🔍 Found", items.length, "product items");
    if (items.length === 0) return;

    items.forEach((item, index) => {
      processProductItem(item, index);
    });
  }
}

/**
 * Setup interval monitoring
 */
function setupIntervalMonitoring(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  checkInterval = window.setInterval(() => {
    const isMercadoLibre = window.location.href.includes("mercadolibre.com") || window.location.href.includes("mercadolivre.com");
    if (isMercadoLibre) {
      // Only process search results, not PDP items in interval
      if (!isProductDetailPage()) {
        processAllItems();
      } else {
        // For PDP, only check for new recommendation items that might load dynamically
        const allRecommendations = document.querySelectorAll(SELECTORS.PDP_RECOMMENDATION_ITEMS);
        const unprocessedRecommendations = Array.from(allRecommendations).filter((item) => !item.querySelector(SELECTORS.BUTTON_CONTAINER));

        if (unprocessedRecommendations.length > 0) {
          console.log(`🔄 Found ${unprocessedRecommendations.length} unprocessed recommendations in interval check`);
          unprocessedRecommendations.forEach((item, index) => {
            processRecommendationItem(item, index);
          });
        }
      }
    } else {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }
  }, 3000); // Increased to 3 seconds to reduce frequency

  console.log("⏰ Interval monitoring started - checking every 3 seconds");
}

/**
 * Initialize currency data
 */
async function initializeCurrencyData(): Promise<{ currencyList: any; currencies: any }> {
  if (currencyData && currenciesData) {
    return { currencyList: currencyData, currencies: currenciesData };
  }

  try {
    const [currencyList, currencies] = await Promise.all([fetch(API_ENDPOINTS.CURRENCY_ALL).then((res) => res.json()), fetch(API_ENDPOINTS.CURRENCY_FORTEX).then((res) => res.json())]);

    currencyData = currencyList;
    currenciesData = currencies;

    return { currencyList, currencies };
  } catch (error) {
    console.error("❌ Error loading currency data:", error);
    return { currencyList: {}, currencies: {} };
  }
}

/**
 * Initialize the extension
 */
async function initializeExtension(): Promise<void> {
  const isMercadoLibre = window.location.href.includes("mercadolibre.com") || window.location.href.includes("mercadolivre.com");

  if (isInitialized || !isMercadoLibre) {
    console.log("⚠️ Extension already initialized or not on MercadoLibre, skipping");
    console.log("📍 Current URL:", window.location.href);
    console.log("🔍 Is MercadoLibre domain:", isMercadoLibre);
    return;
  }

  console.log("🚀 Initializing MercadoLibre Extension...");

  try {
    // Mark as initialized early to prevent duplicate initialization
    isInitialized = true;

    // Load configuration first
    loadConfiguration();

    await initializeCurrencyData();
    console.log("💱 Currency data loaded successfully");

    setTimeout(() => {
      processAllItems();
      setupIntervalMonitoring();
      console.log("✅ Extension initialization complete");
    }, 1000);
  } catch (error) {
    console.error("❌ Extension initialization failed:", error);
    isInitialized = false; // Reset on error
  }
}

// Event listeners
onload = async (event) => {
  console.log("🎬 Window onload event triggered!");
  console.log("🌐 Current URL:", window.location.href);

  const isMercadoLibre = window.location.href.includes("mercadolibre.com") || window.location.href.includes("mercadolivre.com");
  if (isMercadoLibre) {
    console.log("🛒 MercadoLibre detected, initializing extension...");
    await initializeExtension();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 DOMContentLoaded event fired!");
  const isMercadoLibre = window.location.href.includes("mercadolibre.com") || window.location.href.includes("mercadolivre.com");
  if (isMercadoLibre && !isInitialized) {
    console.log("🛒 MercadoLibre detected via DOMContentLoaded");
    initializeExtension();
  }
});

// Navigation change handler
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log("🔄 URL changed to:", url);

    // Clean up existing buttons when navigating
    cleanupAllExtensionElements();

    if (url.includes("mercadolibre.com") || url.includes("mercadolivre.com")) {
      console.log("🛒 Navigated within MercadoLibre, processing items...");
      isInitialized = false;
      setTimeout(() => {
        initializeExtension();
      }, 1000);
    } else {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
        isInitialized = false;
      }
    }
  }
}).observe(document, { subtree: true, childList: true });

// Helper function to clean up all extension elements
function cleanupAllExtensionElements(): void {
  try {
    // Remove all button containers
    document.querySelectorAll(".btn_ml_app_container").forEach((container) => {
      container.remove();
    });

    // Reset processing queue
    processingQueue.clear();

    console.log("🧹 Cleaned up all extension elements for navigation");
  } catch (error) {
    console.error("❌ Error cleaning up extension elements:", error);
  }
}

// Cleanup
window.addEventListener("beforeunload", () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("🧹 Extension cleanup completed");
  }
});
