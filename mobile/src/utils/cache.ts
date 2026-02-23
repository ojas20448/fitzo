import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
    EXERCISES: 'cache_exercises',
    EXERCISE_FILTERS: 'cache_exercise_filters',
    AI_CONVERSATIONS: 'cache_ai_conversations',
    VIDEOS_TRENDING: 'cache_videos_trending',
    FOOD_SEARCHES: 'cache_food_searches',
};

const CACHE_DURATION = {
    SHORT: 5 * 60 * 1000,      // 5 minutes
    MEDIUM: 30 * 60 * 1000,    // 30 minutes
    LONG: 24 * 60 * 60 * 1000, // 24 hours
    PERSISTENT: -1,             // Never expires
};

/**
 * Save data to cache with expiration
 */
export async function cacheData(key: string, data: any, duration: number = CACHE_DURATION.MEDIUM) {
    try {
        const cacheItem = {
            data,
            timestamp: Date.now(),
            duration,
        };
        await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
    }
}

/**
 * Retrieve data from cache if not expired
 */
export async function getCachedData(key: string): Promise<any | null> {
    try {
        const cached = await AsyncStorage.getItem(key);
        if (!cached) return null;

        const { data, timestamp, duration } = JSON.parse(cached);

        // Check if cache is still valid
        if (duration === CACHE_DURATION.PERSISTENT) {
            return data;
        }

        const isExpired = Date.now() - timestamp > duration;
        if (isExpired) {
            await AsyncStorage.removeItem(key);
            return null;
        }

        return data;
    } catch (error) {
        return null;
    }
}

/**
 * Clear specific cache
 */
export async function clearCache(key: string) {
    try {
        await AsyncStorage.removeItem(key);
    } catch (error) {
    }
}

/**
 * Clear all app cache
 */
export async function clearAllCache() {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith('cache_'));
        await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
    }
}

export { CACHE_KEYS, CACHE_DURATION };
