/**
 * API Ninjas Nutrition API Service
 * Natural language food queries with instant nutrition data
 * Free tier: 3,000 requests/month
 * https://api-ninjas.com/
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const API_KEY = process.env.API_NINJAS_KEY;
const BASE_URL = 'https://api.api-ninjas.com/v1/nutrition';

// Simple in-memory cache (5 min TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

class APINinjasService {
  /**
   * Get nutrition data by natural language query
   * Examples: "1 cup cooked rice", "100g chicken breast", "1 plate biryani"
   * @param {string} query - Natural language food description
   * @returns {Promise<Array>} Array of nutrition items
   */
  async searchFoods(query) {
    if (!API_KEY) {
      console.warn('API_NINJAS_KEY not configured');
      return [];
    }

    // Check cache
    const cacheKey = `ninjas_${query.toLowerCase()}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
      cache.delete(cacheKey);
    }

    try {
      const url = `${BASE_URL}?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'X-API-Key': API_KEY
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.error('API Ninjas rate limit exceeded');
        }
        return [];
      }

      const data = await response.json();
      const results = (data.items || []).map(item => this.parseNutrition(item, query));

      // Cache results
      cache.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;
    } catch (error) {
      console.error('API Ninjas error:', error.message);
      return [];
    }
  }

  /**
   * Get nutrition for Indian foods (Hinglish support)
   * Supports: "1 katori dal", "2 roti", "1 plate biryani", "100g paneer", etc.
   */
  async searchIndianFood(query) {
    // Try original query
    let results = await this.searchFoods(query);

    if (results.length === 0 && !query.includes('Indian')) {
      // Try with Indian context
      const indianQuery = `${query} Indian`;
      results = await this.searchFoods(indianQuery);
    }

    return results;
  }

  /**
   * Parse API response into normalized format
   * @private
   */
  parseNutrition(item, originalQuery) {
    return {
      id: `ninjas_${item.name.replace(/\s+/g, '_').toLowerCase()}`,
      name: item.name,
      serving_size: item.serving_size_g ? `${item.serving_size_g}g` : 'per serving',
      source: 'api_ninjas',
      calories: Math.round(item.calories || 0),
      protein: Math.round(item.protein_g * 10) / 10,
      carbs: Math.round(item.carbohydrates_g * 10) / 10,
      fat: Math.round(item.fat_g * 10) / 10,
      fiber: item.fiber_g ? Math.round(item.fiber_g * 10) / 10 : null,
      sugar: item.sugar_g ? Math.round(item.sugar_g * 10) / 10 : null,
      serving_size_g: item.serving_size_g,
      originalQuery: originalQuery
    };
  }

  /**
   * Batch query multiple foods at once
   */
  async searchMultiple(queries) {
    const results = await Promise.all(
      queries.map(q => this.searchFoods(q))
    );
    return results.flat();
  }
}

module.exports = new APINinjasService();
