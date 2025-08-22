import { amazonFront } from "./classes/AmazonFront";
import { ebayFront } from "./classes/EbayFront";
import { Item } from "./interfaces/products.interface";

// Constants
const SELECTORS = {
  // Product item selectors
  PRODUCT_ITEMS: ".ui-search-layout .ui-search-result, .ui-search-layout .poly-card, .poly-card",
  PRODUCT_TITLE_OLD: ".ui-search-item__title",
  PRODUCT_TITLE_NEW: ".poly-component__title",

  // Price selectors
  PRICE_CURRENCY_OLD: ".ui-search-price__second-line .andes-money-amount__currency-symbol",
  PRICE_CURRENCY_NEW: ".poly-price__current .andes-money-amount__currency-symbol, .poly-component__price .andes-money-amount__currency-symbol",
  PRICE_FRACTION_OLD: ".ui-search-price__second-line .andes-money-amount__fraction",
  PRICE_FRACTION_NEW: ".poly-price__current .andes-money-amount__fraction, .poly-component__price .andes-money-amount__fraction",

  // Button selectors
  BUTTON_CONTAINER: ".btn_ml_app_container",
  EBAY_BUTTON: ".ebay_btn",
  AMAZON_BUTTON: ".amazon_btn",
} as const;

const CURRENCY_MAPPING = {
  uy: "UYU",
  co: "COP",
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

console.log("🚀 MercadoLibre Extension - Content Script Loaded!");
console.log("🌐 Current URL:", window.location.href);

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
 * Finds the most similar product from a list
 */
function findMostSimilarProduct(target: string, products: Item[]): Item | null {
  if (!products || products.length === 0) return null;
  if (!target) return products[0];

  let maxScore = 0;
  let bestMatch: Item | null = null;

  for (const product of products) {
    const score = wordCoincidence(target, product.name);
    const adjustedScore = product.price > 0 ? score + 5 : score;

    if (adjustedScore > maxScore) {
      maxScore = adjustedScore;
      bestMatch = product;
    }
  }

  return bestMatch || products[0];
}

/**
 * Optimizes search query
 */
function optimizeSearchQuery(productName: string): string {
  if (!productName) return "";

  let cleanQuery = productName
    .toLowerCase()
    .replace(/marca\s+/g, "")
    .replace(/color\s+\w+/g, "")
    .replace(/\b(para|de|con|sin|en|la|el|los|las|un|una)\b/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleanQuery.split(" ").filter((word) => word.length > 2);
  const optimizedQuery = words.slice(0, 8).join(" ");

  return optimizedQuery || productName;
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
    const currencyElement = item.querySelector(`${SELECTORS.PRICE_CURRENCY_NEW}, ${SELECTORS.PRICE_CURRENCY_OLD}`);
    const priceElement = item.querySelector(`${SELECTORS.PRICE_FRACTION_NEW}, ${SELECTORS.PRICE_FRACTION_OLD}`);

    if (currencyElement && priceElement) {
      const currencyText = currencyElement.innerHTML.trim();
      const priceText = priceElement.innerHTML.replace(/\./g, "").replace(/,/g, "");
      const price = parseFloat(priceText);

      // Determine currency based on symbol
      let currency = "UYU";
      if (currencyText.includes("US$") || currencyText.includes("U$S")) {
        currency = "USD";
      } else if (currencyText === "$") {
        currency = "UYU";
      }

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
 * Currency conversion function
 */
function currencyConversion(item: Item, currencySymbol = "UYU"): CurrencyConversionResult {
  const price = item.price;
  const currency = item.currency;
  let priceAlt = 0;
  let currencyAlt = "";

  if (!currenciesData || !currencyData) {
    return { priceRaw: 0, priceAlt: "N/A", currencyAlt: "" };
  }

  const usdCurr = currencySymbol === "UYU" ? currenciesData[currencySymbol]?.["USD"] : currencyData.rates?.[currencySymbol]?.to;

  if (!usdCurr) {
    return { priceRaw: price, priceAlt: price.toString(), currencyAlt: currency };
  }

  if (currency === "USD") {
    priceAlt = price * usdCurr;
    currencyAlt = currencySymbol;
  } else if (currency === currencySymbol) {
    priceAlt = price / usdCurr;
    currencyAlt = "USD";
  } else {
    priceAlt = price;
    currencyAlt = currency;
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
function createSearchURL(platform: "ebay" | "amazon", query: string): string {
  const optimizedQuery = optimizeSearchQuery(query);

  if (platform === "ebay") {
    return (
      "https://www.ebay.com/sch/i.html?" +
      new URLSearchParams({
        _nkw: optimizedQuery,
        _sacat: "0",
        LH_BIN: "1",
        _sop: "15",
        rt: "nc",
        LH_ItemCondition: "1000|1500|2000|2500|3000",
        _pgn: "1",
        _skc: "50",
      }).toString()
    );
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
 * Button click handler
 */
function createButtonClickHandler(platform: "ebay" | "amazon", productName: string, item: Element, button: HTMLButtonElement) {
  return async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const originalText = button.textContent;
    button.textContent = "Loading...";
    button.disabled = true;

    try {
      const searchURL = createSearchURL(platform, productName);
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

      const bestMatch = findMostSimilarProduct(productName, parsedResult.items);
      if (!bestMatch || bestMatch.price <= 0) {
        button.textContent = "No Price";
        return;
      }

      const country = window.location.hostname.split(".").pop()?.toLowerCase() || "uy";
      const currencySymbol = CURRENCY_MAPPING[country as keyof typeof CURRENCY_MAPPING] || "UYU";
      const { priceRaw } = currencyConversion(bestMatch, currencySymbol);
      const mlPrice = getMercadoLibrePrice(item);

      const isBetterPrice = mlPrice.currency === "U$S" ? bestMatch.price < mlPrice.price : priceRaw < mlPrice.price;

      const className = isBetterPrice ? "btn_ml_success" : "btn_ml_danger";
      const icon = isBetterPrice ? "💰 " : "⚠️ ";

      button.className = `${platform}_content ${className}`;
      button.innerHTML = `<div style="color: inherit !important; text-decoration: none !important;">
        ${icon}$${bestMatch.price}
      </div>`;

      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = platform === "ebay" ? searchURL : bestMatch.link;
        window.open(link, "_blank");
      };
    } catch (error) {
      console.error(`Error processing ${platform} request:`, error);
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
  const element = document.createElement("div");
  element.innerHTML = `
    <div class="btn_ml_app_container">
      <button class="ebay_btn btn_ml_app">
        <span>🛒 eBay</span>
      </button>
      <button class="amazon_btn btn_ml_app">
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
 * Process a single product item
 */
function processProductItem(item: Element, index: number): void {
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
 * Process all product items
 */
function processAllItems(): void {
  if (!currenciesData || !currencyData) {
    console.log("⚠️ Currency data not loaded yet, waiting...");
    return;
  }

  const items = document.querySelectorAll(SELECTORS.PRODUCT_ITEMS);
  if (items.length === 0) return;

  items.forEach((item, index) => {
    processProductItem(item, index);
  });
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
      processAllItems();
    } else {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }
  }, 2000);

  console.log("⏰ Interval monitoring started - checking every 2 seconds");
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
    return;
  }

  console.log("🚀 Initializing MercadoLibre Extension...");

  try {
    await initializeCurrencyData();
    console.log("💱 Currency data loaded successfully");

    setTimeout(() => {
      processAllItems();
      setupIntervalMonitoring();
      isInitialized = true;
      console.log("✅ Extension initialization complete");
    }, 1000);
  } catch (error) {
    console.error("❌ Extension initialization failed:", error);
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

// Cleanup
window.addEventListener("beforeunload", () => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log("🧹 Extension cleanup completed");
  }
});
