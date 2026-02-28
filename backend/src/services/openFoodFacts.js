/**
 * Open Food Facts API Service
 * Free barcode database with focus on packaged products
 * Excellent for Indian brands: Amul, Haldiram's, Parle, Britannia, MTR, Patanjali
 * https://world.openfoodfacts.org/
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://world.openfoodfacts.org';

// Simple in-memory cache (10 min TTL for barcode, 5 min for search)
const cache = new Map();
const BARCODE_CACHE_TTL = 10 * 60 * 1000;
const SEARCH_CACHE_TTL = 5 * 60 * 1000;

class OpenFoodFactsService {
  /**
   * Search for foods by barcode
   */
  async searchByBarcode(barcode) {
    const cacheKey = `barcode_${barcode}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < BARCODE_CACHE_TTL) {
        return cached.data;
      }
      cache.delete(cacheKey);
    }

    try {
      const url = `${BASE_URL}/api/v2/product/${barcode}.json`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Fitzo/1.0 (fitness app)' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      const result = this.parseProduct(data.product);

      if (result) {
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
      }
      return result;
    } catch (error) {
      console.error('Open Food Facts barcode error:', error.message);
      return null;
    }
  }

  /**
   * Search foods by name/query — prioritizes Indian products
   */
  async searchFoods(query, pageSize = 20) {
    const cacheKey = `search_${query.toLowerCase()}_${pageSize}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
        return cached.data;
      }
      cache.delete(cacheKey);
    }

    try {
      // Search with India country filter first for better Indian product results
      const indianParams = new URLSearchParams({
        search_terms: query,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: String(Math.min(pageSize, 50)),
        countries_tags_en: 'india',
      });

      const globalParams = new URLSearchParams({
        search_terms: query,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: String(Math.min(pageSize, 50)),
      });

      // Run Indian + global searches in parallel
      const [indianRes, globalRes] = await Promise.allSettled([
        fetch(`${BASE_URL}/cgi/search.pl?${indianParams}`, {
          headers: { 'User-Agent': 'Fitzo/1.0 (fitness app)' }
        }),
        fetch(`${BASE_URL}/cgi/search.pl?${globalParams}`, {
          headers: { 'User-Agent': 'Fitzo/1.0 (fitness app)' }
        }),
      ]);

      let indianProducts = [];
      let globalProducts = [];

      if (indianRes.status === 'fulfilled' && indianRes.value.ok) {
        const data = await indianRes.value.json();
        indianProducts = (data.products || [])
          .map(p => this.parseProduct(p))
          .filter(p => p !== null);
      }

      if (globalRes.status === 'fulfilled' && globalRes.value.ok) {
        const data = await globalRes.value.json();
        globalProducts = (data.products || [])
          .map(p => this.parseProduct(p))
          .filter(p => p !== null);
      }

      // Deduplicate: Indian results first, then global results not already included
      const seenIds = new Set(indianProducts.map(p => p.id));
      const uniqueGlobal = globalProducts.filter(p => !seenIds.has(p.id));
      const results = [...indianProducts, ...uniqueGlobal].slice(0, pageSize);

      cache.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;
    } catch (error) {
      console.error('Open Food Facts search error:', error.message);
      return [];
    }
  }

  /**
   * Parse product data into normalized format
   * @private
   */
  parseProduct(product) {
    if (!product || !product.code) return null;

    const nutrition = product.nutriments || {};
    const serving_size = product.serving_size || '100g';
    const name = product.product_name || product.name || '';
    if (!name) return null;

    return {
      id: `off_${product.code}`,
      barcode: product.code,
      name: name,
      brand: product.brands || 'Unknown Brand',
      source: 'open_food_facts',
      servingSize: serving_size,
      calories: Math.round(nutrition['energy-kcal_100g'] || nutrition.energy_kcal_100g || 0),
      protein: Math.round((nutrition.proteins_100g || 0) * 10) / 10,
      carbs: Math.round((nutrition.carbohydrates_100g || 0) * 10) / 10,
      fat: Math.round((nutrition.fat_100g || 0) * 10) / 10,
      fiber: Math.round((nutrition.fiber_100g || 0) * 10) / 10,
      sugar: Math.round((nutrition.sugars_100g || 0) * 10) / 10,
      sodium: Math.round((nutrition.sodium_100g || 0) * 10) / 10,
      saturatedFat: Math.round((nutrition['saturated-fat_100g'] || 0) * 10) / 10,
      ingredientsList: product.ingredients_text || null,
      country: product.countries_tags ? product.countries_tags[0] : null,
      imageUrl: product.image_url || null,
      dataQuality: product.completeness || 0
    };
  }
}

module.exports = new OpenFoodFactsService();
