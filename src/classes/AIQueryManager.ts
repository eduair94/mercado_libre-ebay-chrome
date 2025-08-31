import { AIQuery, AIQueryStats } from '../interfaces/products.interface';

class AIQueryManager {
  private static readonly STORAGE_KEY = 'aiQueries';
  private static readonly STATS_KEY = 'aiQueryStats';
  private static readonly MAX_QUERIES_DEFAULT = 1000;
  private static readonly CACHE_EXPIRATION_DAYS = 30;

  /**
   * Save an AI query to storage
   */
  static async saveQuery(originalQuery: string, optimizedQuery: string, source: 'gemini' | 'manual' = 'gemini'): Promise<string> {
    const queryId = this.generateQueryId(originalQuery);
    const timestamp = Date.now();
    
    try {
      const existingQueries = await this.getAllQueries();
      const existingQuery = existingQueries.find(q => q.id === queryId);
      
      if (existingQuery) {
        // Update existing query
        existingQuery.usageCount += 1;
        existingQuery.lastUsed = timestamp;
        existingQuery.optimizedQuery = optimizedQuery; // Update in case the optimization improved
        await this.updateQuery(existingQuery);
        return queryId;
      }

      // Create new query
      const newQuery: AIQuery = {
        id: queryId,
        originalQuery,
        optimizedQuery,
        timestamp,
        usageCount: 1,
        tokensSaved: this.estimateTokensSaved(originalQuery, optimizedQuery),
        source,
        lastUsed: timestamp
      };

      existingQueries.push(newQuery);
      
      // Cleanup old queries if we exceed the limit
      const cleanedQueries = await this.cleanupOldQueries(existingQueries);
      
      await this.saveQueries(cleanedQueries);
      await this.updateStats();
      
      return queryId;
    } catch (error) {
      console.error('Error saving AI query:', error);
      throw error;
    }
  }

  /**
   * Get a cached query result if it exists
   */
  static async getCachedQuery(originalQuery: string): Promise<AIQuery | null> {
    try {
      const queryId = this.generateQueryId(originalQuery);
      const queries = await this.getAllQueries();
      const query = queries.find(q => q.id === queryId);
      
      if (query && this.isQueryValid(query)) {
        // Update last used timestamp
        query.lastUsed = Date.now();
        await this.updateQuery(query);
        return query;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cached query:', error);
      return null;
    }
  }

  /**
   * Get all queries with optional filtering
   */
  static async getAllQueries(filter?: string): Promise<AIQuery[]> {
    try {
      const result = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.local.get([this.STORAGE_KEY], resolve);
      });

      let queries: AIQuery[] = result[this.STORAGE_KEY] || [];
      
      if (filter) {
        const filterLower = filter.toLowerCase();
        queries = queries.filter(q => 
          q.originalQuery.toLowerCase().includes(filterLower) ||
          q.optimizedQuery.toLowerCase().includes(filterLower)
        );
      }

      return queries.sort((a, b) => b.lastUsed - a.lastUsed);
    } catch (error) {
      console.error('Error getting queries:', error);
      return [];
    }
  }

  /**
   * Delete a specific query
   */
  static async deleteQuery(queryId: string): Promise<void> {
    try {
      const queries = await this.getAllQueries();
      const filteredQueries = queries.filter(q => q.id !== queryId);
      await this.saveQueries(filteredQueries);
      await this.updateStats();
    } catch (error) {
      console.error('Error deleting query:', error);
      throw error;
    }
  }

  /**
   * Clear all queries
   */
  static async clearAllQueries(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove([this.STORAGE_KEY, this.STATS_KEY], () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error clearing queries:', error);
      throw error;
    }
  }

  /**
   * Get query statistics
   */
  static async getStats(): Promise<AIQueryStats> {
    try {
      const queries = await this.getAllQueries();
      const totalTokensSaved = queries.reduce((sum, q) => sum + q.tokensSaved, 0);
      
      const stats: AIQueryStats = {
        totalQueries: queries.length,
        cachedQueries: queries.filter(q => q.usageCount > 1).length,
        totalTokensSaved,
        lastCleanup: Date.now()
      };

      // Save updated stats
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [this.STATS_KEY]: stats }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalQueries: 0,
        cachedQueries: 0,
        totalTokensSaved: 0,
        lastCleanup: 0
      };
    }
  }

  /**
   * Export queries as JSON
   */
  static async exportQueries(): Promise<string> {
    try {
      const queries = await this.getAllQueries();
      const stats = await this.getStats();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        stats,
        queries: queries.map(q => ({
          ...q,
          timestamp: new Date(q.timestamp).toISOString(),
          lastUsed: new Date(q.lastUsed).toISOString()
        }))
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting queries:', error);
      throw error;
    }
  }

  // Private helper methods

  private static async saveQueries(queries: AIQuery[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: queries }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async updateQuery(query: AIQuery): Promise<void> {
    const queries = await this.getAllQueries();
    const index = queries.findIndex(q => q.id === query.id);
    if (index !== -1) {
      queries[index] = query;
      await this.saveQueries(queries);
    }
  }

  private static async updateStats(): Promise<void> {
    await this.getStats(); // This will calculate and save updated stats
  }

  private static generateQueryId(query: string): string {
    // Simple hash function for generating consistent IDs
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private static isQueryValid(query: AIQuery): boolean {
    const now = Date.now();
    const expirationTime = this.CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    return (now - query.timestamp) < expirationTime;
  }

  private static async cleanupOldQueries(queries: AIQuery[]): Promise<AIQuery[]> {
    const maxQueries = this.MAX_QUERIES_DEFAULT;
    const now = Date.now();
    const expirationTime = this.CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

    // Remove expired queries
    let validQueries = queries.filter(q => (now - q.timestamp) < expirationTime);

    // If still too many, keep the most recently used ones
    if (validQueries.length > maxQueries) {
      validQueries = validQueries
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, maxQueries);
    }

    return validQueries;
  }

  private static estimateTokensSaved(originalQuery: string, optimizedQuery: string): number {
    // Simple estimation: assume we saved API calls by reusing cached results
    // This is a rough estimate - in real usage, you'd track actual API call savings
    const baseTokens = Math.ceil(originalQuery.length / 4); // Rough token estimation
    return originalQuery === optimizedQuery ? 0 : baseTokens;
  }
}

export default AIQueryManager;
