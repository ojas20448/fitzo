/**
 * Open Food Facts API Service
 * Free barcode database with focus on packaged products
 * Excellent for Indian brands: Amul, Haldiram's, Parle, Britannia, MTR, Patanjali
 * https://world.openfoodfacts.org/api/v2/
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';

class OpenFoodFactsService {
  /**
   * Search for foods by barcode
   * @param {string} barcode - Product barcode (EAN-13, UPC, etc.)
   * @returns {Promise<Object>} Food data with nutrition
   */
  async searchByBarcode(barcode) {
    try {
      const url = `${BASE_URL}/product/${barcode}.json`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Fitzo/1.0' }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.parseProduct(data.product);
    } catch (error) {
      console.error('Open Food Facts barcode error:', error.message);
      return null;
    }
  }

  /**
   * Search foods by name/query
   * @param {string} query - Food name or brand
   * @param {number} pageSize - Results per page (max 100)
   * @returns {Promise<Array>} Array of foods
   */
  async searchFoods(query, pageSize = 20) {
    try {
      const params = new URLSearchParams({
        q: query,
        page_size: Math.min(pageSize, 100),
        action: 'process',
        json: 1
      });

      const url = `${BASE_URL}/cgi/search.pl?${params}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Fitzo/1.0' }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.products || [])
        .map(p => this.parseProduct(p))
        .filter(p => p !== null);
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

    return {
      id: `off_${product.code}`,
      barcode: product.code,
      name: product.name || product.product_name || 'Unknown',
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

  /**
   * Get Indian packaged products (brands filter)
   */
  async getIndianProducts(query, limit = 20) {
    const indianBrands = [
      'Amul', 'Haldiram', 'Parle', 'Britannia', 'MTR', 'Patanjali',
      'Maggi', 'Nestlé India', 'ITC', 'Mahindra', 'Godrej', 'Marico',
      'Monsanto', 'Horlicks', 'Cadbury', 'Bournvita', 'Google Play'
    ];

    const results = await this.searchFoods(query, limit * 2);

    return results.filter(item => {
      const brand = (item.brand || '').toLowerCase();
      return indianBrands.some(b => brand.includes(b.toLowerCase()));
    }).slice(0, limit);
  }
}

module.exports = new OpenFoodFactsService();
