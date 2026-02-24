import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_RECENTS = 'fitzo_food_recents_v1';
const CACHE_KEY_FAVORITES = 'fitzo_food_favorites_v1';
const MAX_RECENTS = 50;

export interface CachedFoodItem {
    id: string;
    name: string;
    brand: string | null;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string;
    data_source: 'api' | 'user' | 'local';
    timestamp: number;
    category?: string;
    details?: any; // Full detail object if available
}

export const FoodCacheService = {

    // Save a food item to recents after logging
    addToRecents: async (food: CachedFoodItem) => {
        try {
            const existing = await FoodCacheService.getRecents();
            // Remove if already exists (to bump to top)
            const filtered = existing.filter(f => f.name.toLowerCase() !== food.name.toLowerCase());

            const newRecents = [food, ...filtered].slice(0, MAX_RECENTS);
            await AsyncStorage.setItem(CACHE_KEY_RECENTS, JSON.stringify(newRecents));
        } catch {
            // Cache write failed - non-critical, recents will be rebuilt over time
        }
    },

    // Get recent foods
    getRecents: async (): Promise<CachedFoodItem[]> => {
        try {
            const json = await AsyncStorage.getItem(CACHE_KEY_RECENTS);
            return json ? JSON.parse(json) : [];
        } catch {
            // Cache miss / expired - caller will fetch fresh data
            return [];
        }
    },

    // Search local cache first
    searchLocal: async (query: string): Promise<CachedFoodItem[]> => {
        try {
            const recents = await FoodCacheService.getRecents();
            const queryLower = query.toLowerCase().trim();

            if (!queryLower) return [];

            return recents.filter(item =>
                item.name.toLowerCase().includes(queryLower) ||
                (item.brand && item.brand.toLowerCase().includes(queryLower))
            );
        } catch {
            // Cache miss / expired - caller will fetch fresh data
            return [];
        }
    },

    // Clear cache (debug)
    clearCache: async () => {
        await AsyncStorage.removeItem(CACHE_KEY_RECENTS);
    }
};
