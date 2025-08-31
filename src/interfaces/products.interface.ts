export interface Item {
  image: string | null;
  name: string;
  currency: string;
  price: number;
  location: string;
  originalPrice: { currency: string; price: number };
  shippingCost: { currency: string; price: number };
  seller: { name: string; reviews: number; positivePercentage: number } | undefined;
  status: string;
  watchCount: number;
  soldCount: number;
  bidCount: number;
  link: string | null;
}

export interface ParseHTMLResult {
  items: Item[];
  total: number;
  totalPages: number;
  proxy: string;
}

export interface AIQuery {
  id: string;
  originalQuery: string;
  optimizedQuery: string;
  estimatedWeight?: number; // Weight in kg extracted from AI analysis
  weightConfidence?: 'high' | 'medium' | 'low'; // AI confidence in weight estimation
  weightSource?: string; // Description of how weight was estimated
  timestamp: number;
  usageCount: number;
  tokensSaved: number;
  source: 'gemini' | 'manual';
  results?: string[];
  lastUsed: number;
}

export interface AIQueryStats {
  totalQueries: number;
  cachedQueries: number;
  totalTokensSaved: number;
  lastCleanup: number;
}

export interface ExtensionSettings {
  enabled: boolean;
  textSize: "small" | "medium" | "large";
  animations: boolean;
  notifications: boolean;
  language: "es" | "pt";
  geminiApiKey: string;
  aiSearchEnabled: boolean;
  onlyNew: boolean;
  shippingEnabled: boolean;
  shippingCostPerKg: number;
  maxCachedQueries: number;
  cacheExpirationDays: number;
}
