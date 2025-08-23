import { amazonFront } from "./classes/AmazonFront";
import { ebayFront } from "./classes/EbayFront";
import { Item } from "./interfaces/products.interface";

// IMMEDIATE CONSOLE LOGS FOR DEBUGGING
console.log("%c🚨 MERCADOLIBRE EXTENSION - CONTENT SCRIPT LOADING! 🚨", "background: #ff0000; color: #ffffff; font-size: 16px; font-weight: bold; padding: 10px;");
console.log("%c📍 CURRENT URL:", "color: #007bff; font-weight: bold;", window.location.href);
console.log("%c⏰ TIMESTAMP:", "color: #28a745; font-weight: bold;", new Date().toISOString());
console.log("%c🔧 USER AGENT:", "color: #6c757d;", navigator.userAgent);

// Test if we're on the right domain
const isOnMercadoLibre = window.location.href.includes("mercadolibre.com");
console.log("%c🎯 ON MERCADOLIBRE:", isOnMercadoLibre ? "✅ YES" : "❌ NO", "color:", isOnMercadoLibre ? "#28a745" : "#dc3545", "font-weight: bold;");

// Constants
const SELECTORS = {
  // Search page product item selectors
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
} as const;

const CURRENCY_MAPPING = {
  ar: "ARS",  // Argentina - Peso argentino
  bo: "BOB",  // Bolivia - Boliviano
  br: "BRL",  // Brazil - Real
  cl: "CLP",  // Chile - Peso chileno
  co: "COP",  // Colombia - Peso colombiano
  cr: "CRC",  // Costa Rica - Colón costarricense
  do: "DOP",  // Dominican Republic - Peso dominicano
  ec: "USD",  // Ecuador - Dólar estadounidense
  sv: "USD",  // El Salvador - Dólar estadounidense
  gt: "GTQ",  // Guatemala - Quetzal
  hn: "HNL",  // Honduras - Lempira
  mx: "MXN",  // Mexico - Peso mexicano
  ni: "NIO",  // Nicaragua - Córdoba oro
  pa: "PAB",  // Panama - Balboa
  py: "PYG",  // Paraguay - Guaraní
  pe: "PEN",  // Peru - Sol
  uy: "UYU",  // Uruguay - Peso uruguayo
  ve: "VES",  // Venezuela - Bolívar soberano
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

// Configuration state
let extensionConfig = {
  enabled: true,
  textSize: "medium",
  animations: true,
  notifications: true,
  language: "es",
};

console.log("🚀 MercadoLibre Extension - Content Script Loaded!");
console.log("🌐 Current URL:", window.location.href);

// Load initial configuration
function loadConfiguration() {
  try {
    chrome.storage.sync.get("extensionConfig", (result) => {
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
  // Check URL pattern (contains /p/ or /MLU)
  const url = window.location.href;
  const isProductURL = /\/(p|MLU)\/[\w-]+/.test(url);

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
  return products.find((el) => el.price) || products[0];
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
function createSearchURL(platform: "ebay" | "amazon", query: string, maxPrice?: number): string {
  const optimizedQuery = optimizeSearchQuery(query);

  if (platform === "ebay") {
    const searchParams: Record<string, string> = {
      _nkw: optimizedQuery,
      _sacat: "0",
      LH_BIN: "1",
      _sop: "15",
      rt: "nc",
      LH_ItemCondition: "1000|1500|2000|2500|3000",
      _pgn: "1",
      _skc: "50",
    };

    // Add max price filter if provided
    if (maxPrice && maxPrice > 0) {
      searchParams._udhi = Math.floor(maxPrice).toString();
    }

    return "https://www.ebay.com/sch/i.html?" + new URLSearchParams(searchParams).toString();
  } else {
    return (
      "https://www.amazon.com/s?" +
      new URLSearchParams({
        k: optimizedQuery,
        ref: "sr_st_price-asc-rank",
        s: "price-asc-rank",
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
function createButtonClickHandler(
  platform: "ebay" | "amazon", 
  productName: string, 
  item: Element, 
  button: HTMLButtonElement, 
  itemType: "search" | "main" | "recommendation" = "search"
) {
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

      const searchURL = createSearchURL(platform, productName, platform === "ebay" ? maxPriceUSD : undefined);
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
        
        if (mlPrice.currency === "USD" && bestMatch.currency === "USD") {
          // Both in USD - direct comparison
          isBetterPrice = bestMatch.price < mlPrice.price;
        } else if (mlPrice.currency === bestMatch.currency) {
          // Same currency - direct comparison
          isBetterPrice = bestMatch.price < mlPrice.price;
        } else {
          // Different currencies - use converted price
          isBetterPrice = priceRaw < mlPrice.price;
        }

        const className = isBetterPrice ? "btn_ml_success" : "btn_ml_danger";
        const icon = isBetterPrice ? "💰 " : "⚠️ ";

        // Add the appropriate CSS classes based on item type
        const baseClasses = itemType === "main" ? "btn_ml_app btn_ml_app_main" : "btn_ml_app";
        button.className = `${baseClasses} ${className}`;
        button.innerHTML = `<div style="color: inherit !important; text-decoration: none !important;">
          ${icon}$${bestMatch.price}
        </div>`;
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

  const element = document.createElement("div");
  element.innerHTML = `
    <div class="btn_ml_app_container" style="font-size: ${fontSize}; transition: ${transition};">
      <button style="font-size: ${fontSize}" class="ebay_btn btn_ml_app">
        <span>🛒 eBay</span>
      </button>
      <button style="font-size: ${fontSize}" class="amazon_btn btn_ml_app">
        <span>📦 Amazon</span>
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
          border-radius: 6px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          transition: ${transition};
        " class="ebay_btn btn_ml_app btn_ml_app_main">
          <span>🛒 eBay</span>
        </button>
        <button style="
          font-size: ${fontSize}; 
          flex: 1; 
          padding: 8px 12px; 
          border-radius: 6px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          transition: ${transition};
        " class="amazon_btn btn_ml_app btn_ml_app_main">
          <span>📦 Amazon</span>
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
  const dummyElement = document.createElement('div');

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
  // Check if extension is enabled
  if (!extensionConfig.enabled) {
    return;
  }

  // Check if we already processed the main product - look for any extension button container in the price area
  const priceContainer = document.querySelector(SELECTORS.PDP_MAIN_PRICE_CONTAINER);
  if (!priceContainer) {
    return;
  }

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
  if (!productName) {
    productName = getProductTitleFromURL();
  }

  if (!productName) {
    console.warn("Could not extract product name for main product");
    return;
  }

  console.log("Processing main product:", productName);

  const buttonContainer = createMainProductButtonContainer();

  // Insert the button container after the price section
  priceContainer.parentNode?.insertBefore(buttonContainer, priceContainer.nextSibling);

  setupMainProductButtonHandlers(buttonContainer, productName);
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
  if (isProductDetailPage()) {
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
    if (window.location.href.includes("mercadolibre.com")) {
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
  if (isInitialized || !window.location.href.includes("mercadolibre.com")) {
    console.log("⚠️ Extension already initialized or not on MercadoLibre, skipping");
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

  if (window.location.href.includes("mercadolibre.com")) {
    console.log("🛒 MercadoLibre detected, initializing extension...");
    await initializeExtension();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 DOMContentLoaded event fired!");
  if (window.location.href.includes("mercadolibre.com") && !isInitialized) {
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

    if (url.includes("mercadolibre.com")) {
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
