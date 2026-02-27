import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    TextInput,
    FlatList,
    Modal,
    ScrollView,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { foodAPI, caloriesAPI, nutritionAPI, settingsAPI } from '../../services/api';
import Celebration from '../../components/Celebration';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { defaultFoods } from '../../data/defaultFoods';
import { useNutrition } from '../../context/NutritionContext';
import { FoodCacheService } from '../../services/FoodCacheService';

const { width } = Dimensions.get('window');

interface FoodItem {
    id: string;
    name: string;
    brand: string | null;
    description: string;
    source?: string;
    calories?: number;
    category?: string;
    isLocal?: boolean;
    isAiTrigger?: boolean;
}

interface Serving {
    id: string;
    description: string;
    measurementDescription: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
}

interface FoodDetails {
    id: string;
    name: string;
    brand: string | null;
    servings: Serving[];
}

const CalorieLogScreen: React.FC = () => {
    const toast = useToast();
    const { logFoodOptimistic } = useNutrition();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedFood, setSelectedFood] = useState<FoodDetails | null>(null);
    const [selectedServing, setSelectedServing] = useState<Serving | null>(null);
    const [servingCount, setServingCount] = useState(1);
    const [portionMode, setPortionMode] = useState<'serving' | 'grams'>('serving');
    const [gramAmount, setGramAmount] = useState('100');
    const [showDetail, setShowDetail] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [logging, setLogging] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const [aiAnalyzing, setAiAnalyzing] = useState(false);

    // Frequent foods
    const [frequentFoods, setFrequentFoods] = useState<any[]>([]);

    // Visibility/Privacy
    const [visibility, setVisibility] = useState<'friends' | 'private'>('friends');
    const [shareLogs, setShareLogs] = useState(true);

    useEffect(() => {
        loadFrequentFoods();
        loadSharingPreference();
    }, []);

    const loadFrequentFoods = async () => {
        try {
            const data = await caloriesAPI.getFrequentFoods();
            setFrequentFoods(data.frequent || []);
        } catch (error: any) {
            toast.error('Error', error.message || 'Something went wrong');
        }
    };

    const loadSharingPreference = async () => {
        try {
            const data = await settingsAPI.getSharingPreference();
            setShareLogs(data.share_logs_default);
            setVisibility(data.share_logs_default ? 'friends' : 'private');
        } catch (error) {
            // Default to friends if API fails
            setShareLogs(true);
            setVisibility('friends');
        }
    };


    const handleQuickAdd = async (food: any) => {
        // Prepare for quick logging or detailing
        // For now, let's open details with pre-filled data if possible, 
        // or just log it directly if we trust the historical averages.
        // Let's open the detail modal with "Custom" data derived from history.

        setSelectedFood({
            id: 'custom-' + Date.now(),
            name: food.name,
            brand: 'Frequent',
            servings: [{
                id: 'default',
                description: 'Average Entry',
                measurementDescription: 'serving',
                calories: food.calories,
                protein: food.protein,
                carbs: food.carbs,
                fat: food.fat,
                fiber: 0,
                sugar: 0
            }]
        });
        setSelectedServing({
            id: 'default',
            description: 'Average Entry',
            measurementDescription: 'serving',
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: 0,
            sugar: 0
        });
        setServingCount(1);
        setShowDetail(true);
    };



    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setSearchError(null);
            return;
        }

        const runSearch = async () => {
            // 1. Instant Local Search (Cache + Defaults)
            const queryLower = searchQuery.toLowerCase();

            // Search Cache
            const cachedMatches = await FoodCacheService.searchLocal(queryLower);

            // Search Default Hardcoded DB
            const defaultMatches = defaultFoods.filter(f =>
                f.name.toLowerCase().includes(queryLower) ||
                (f.brand && f.brand.toLowerCase().includes(queryLower)) ||
                (f.category && f.category?.toLowerCase().includes(queryLower))
            );

            // Combine (Cache first)
            const mappedCache = cachedMatches.map(c => ({
                id: c.id,
                name: c.name,
                brand: c.brand,
                description: c.description || `${c.calories} kcal`,
                calories: c.calories,
                isLocal: true,
                source: 'recent'
            }));

            // Dedupe by name roughly
            // We want to prefer mappedCache items over defaultMatches if names collide
            const cacheNames = new Set(mappedCache.map(c => c.name.toLowerCase()));
            const uniqueDefaults = defaultMatches.filter(d => !cacheNames.has(d.name.toLowerCase()));

            const allLocal = [...mappedCache, ...uniqueDefaults];

            // Sort
            allLocal.sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(queryLower);
                const bStarts = b.name.toLowerCase().startsWith(queryLower);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return 0;
            });

            // Add AI Trigger Option
            const aiOption: FoodItem = {
                id: 'ai-trigger',
                name: `Ask AI: "${searchQuery}"`,
                brand: 'Smart Analysis',
                description: 'Get macros from description',
                isAiTrigger: true
            } as any;

            // Show local immediately
            setSearchResults([aiOption, ...allLocal]);

            // 2. Fetch API results in background if needed
            setSearching(true);
            try {
                // Only call API if we don't have many local matches
                if (allLocal.length < 5) {
                    const result = await foodAPI.search(searchQuery);
                    const apiFoods = result.foods || [];

                    setSearchResults(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        // Prevent ID collisions
                        const newApi = apiFoods.filter((f: any) => !existingIds.has(f.id));
                        return [...prev, ...newApi];
                    });
                }
            } catch (err) {
                // ignore
            } finally {
                setSearching(false);
            }
        };

        const timer = setTimeout(runSearch, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleFoodSelect = async (food: any) => {
        // Handle AI Trigger
        if (food.isAiTrigger) {
            setLoadingDetail(true);
            try {
                const res = await foodAPI.analyzeText(searchQuery);
                if (res.food) {
                    const aiFood = res.food;
                    setSelectedFood({
                        id: 'ai-' + Date.now(),
                        name: aiFood.name,
                        brand: 'AI Analysis',
                        servings: [{
                            id: 'default',
                            description: aiFood.serving_size || '1 meal',
                            measurementDescription: 'serving',
                            calories: aiFood.calories,
                            protein: aiFood.protein_g,
                            carbs: aiFood.carbs_g,
                            fat: aiFood.fat_g,
                            fiber: aiFood.fiber_g,
                            sugar: aiFood.sugar_g
                        }]
                    });
                    setSelectedServing({
                        id: 'default',
                        description: aiFood.serving_size || '1 meal',
                        measurementDescription: 'serving',
                        calories: aiFood.calories,
                        protein: aiFood.protein_g,
                        carbs: aiFood.carbs_g,
                        fat: aiFood.fat_g,
                        fiber: aiFood.fiber_g,
                        sugar: aiFood.sugar_g
                    });
                    setServingCount(1);
                    setShowDetail(true);
                } else {
                    toast.error('AI Error', 'Could not analyze meal');
                }
            } catch (err) {
                toast.error('AI Error', 'Analysis failed');
            } finally {
                setLoadingDetail(false);
            }
            return;
        }

        // Handle Local Food Selection (Instant)
        if (food.isLocal) {
            setSelectedFood(food);
            if (food.servings && food.servings.length > 0) {
                setSelectedServing(food.servings[0]);
            }
            setServingCount(1);
            setShowDetail(true);
            return;
        }

        // Handle API Food Selection
        setLoadingDetail(true);
        setShowDetail(true);
        try {
            const details = await foodAPI.getDetails(food.id, food.source || 'indian');
            setSelectedFood(details);
            if (details.servings && details.servings.length > 0) {
                setSelectedServing(details.servings[0]);
            }
            setServingCount(1);
        } catch (error) {
            toast.error('Error', 'Could not load food details');
            setShowDetail(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleLog = async () => {
        if (!selectedFood || !selectedServing) return;

        const totalCalories = Math.round(selectedServing.calories * servingCount);
        const totalProtein = Math.round(selectedServing.protein * servingCount);
        const totalCarbs = Math.round(selectedServing.carbs * servingCount);
        const totalFat = Math.round(selectedServing.fat * servingCount);

        try {
            // Optimistic Log - Instant UI Update
            // Fire API in background but await just for basic validation catch
            // Actually, for true instant feel, we should close modal immediately or show celebration immediately depending on UX
            // User requested: "Home ring animates within <300ms"

            // 1. Kick off optimistic update with visibility
            const { isGoalHit } = await logFoodOptimistic({
                calories: totalCalories,
                protein: totalProtein,
                carbs: totalCarbs,
                fat: totalFat,
                food_name: selectedFood.name,
                serving_size: `${servingCount} ${selectedServing.measurementDescription}`,
                meal_type: 'snack',
                visibility: visibility
            });

            // 2. Success Feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (isGoalHit) {
                toast.success('GOAL REACHED!', `You've hit your daily targets!`);
                router.back();
            } else {
                toast.success('Logged!', `${totalCalories} kcal from ${selectedFood.name}`);
                router.back();
            }

        } catch (error: any) {
            toast.error('Error', error.message || 'Failed to log calories');
        }
    };

    const totalCalories = selectedServing ? Math.round(selectedServing.calories * servingCount) : 0;

    const parseDescription = (desc: string) => {
        // Parse "Per 100g - Calories: 250kcal | Fat: 12g | Carbs: 20g | Protein: 15g"
        const match = desc?.match(/Calories:\s*(\d+)/);
        return match ? match[1] : null;
    };

    const renderSearchItem = ({ item, index }: { item: any, index: number }) => {
        const calories = parseDescription(item.description);
        const isAi = item.isAiTrigger;

        return (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(400).springify()}>
                <Pressable
                    style={({ pressed }) => [
                        styles.foodItem,
                        isAi && styles.aiItem, // New style
                        pressed && styles.foodItemPressed
                    ]}
                    onPress={() => handleFoodSelect(item)}
                >
                    <View style={[styles.foodIcon, isAi && styles.aiIcon]}>
                        <MaterialIcons
                            name={isAi ? "auto-awesome" : "restaurant"}
                            size={20}
                            color={isAi ? colors.background : colors.primary}
                        />
                    </View>
                    <View style={styles.foodInfo}>
                        <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                        {item.brand && (
                            <Text style={styles.foodBrand} numberOfLines={1}>{item.brand}</Text>
                        )}
                    </View>
                    {calories && (
                        <View style={styles.caloriesBadge}>
                            <Text style={styles.caloriesBadgeText}>{calories}</Text>
                            <Text style={styles.caloriesBadgeUnit}>cal</Text>
                        </View>
                    )}
                    <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
                </Pressable>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Celebration
                visible={showCelebration}
                type="calories"
                title="Meal Logged!"
                subtitle="Keep tracking your nutrition!"
                value="Logged"
                onComplete={() => {
                    setShowCelebration(false);
                    router.back();
                }}
            />

            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    accessibilityLabel="Close"
                >
                    <MaterialIcons name="close" size={20} color={colors.text.muted} />
                </Pressable>
                <Text style={styles.headerTitle}>Add Food</Text>
                <Pressable onPress={() => router.push('/member/recipes')}>
                    <MaterialIcons name="menu-book" size={24} color={colors.primary} />
                </Pressable>
            </View>


            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialIcons name="search" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search foods..."
                        placeholderTextColor={colors.text.subtle}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus={false} // Don't auto-focus to show frequent foods
                        returnKeyType="search"
                        keyboardType="default"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')}>
                            <MaterialIcons name="close" size={18} color={colors.text.muted} />
                        </Pressable>
                    )}
                    <View style={styles.searchBarDivider} />
                    <Pressable
                        onPress={() => router.push('/food-scanner')}
                        style={styles.barcodeScanBtn}
                        accessibilityLabel="Scan barcode"
                    >
                        <MaterialIcons name="qr-code-scanner" size={20} color={colors.text.secondary} />
                    </Pressable>
                </View>
            </View>

            {/* AI search results will show Smart Analysis option inline */}


            {/* Frequent Foods */}
            {
                !searching && searchQuery === '' && frequentFoods.length > 0 && (
                    <Animated.View entering={FadeIn.duration(500)} style={styles.frequentContainer}>
                        <Text style={styles.sectionTitle}>QUICK ADD</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.frequentScroll}
                        >
                            {frequentFoods.map((food, index) => (
                                <Animated.View key={index} entering={ZoomIn.delay(index * 50).springify()}>
                                    <TouchableOpacity
                                        style={styles.frequentCard}
                                        onPress={() => handleQuickAdd(food)}
                                    >
                                        <View style={styles.frequentIcon}>
                                            <MaterialIcons name="restaurant" size={16} color={colors.primary} />
                                        </View>
                                        <Text style={styles.frequentName} numberOfLines={1}>{food.name}</Text>
                                        <Text style={styles.frequentCals}>{food.calories} cal</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )
            }

            {/* Results */}
            {
                searching ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Searching...</Text>
                    </View>
                ) : searchResults.length > 0 ? (
                    <FlatList
                        data={searchResults}
                        renderItem={renderSearchItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.resultsList}
                        showsVerticalScrollIndicator={false}
                    />
                ) : searchQuery.length > 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons
                            name={searchError ? "error-outline" : "search-off"}
                            size={48}
                            color={searchError ? colors.error : colors.text.subtle}
                        />
                        <Text style={styles.emptyText}>
                            {searchError ? 'Search Error' : 'No foods found'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {searchError || 'Try a different search term'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.promptContainer}>
                        <View style={styles.promptIcon}>
                            <MaterialIcons name="restaurant-menu" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.promptText}>Search for a food</Text>
                        <Text style={styles.promptSubtext}>Find nutritional info from our database</Text>
                    </View>
                )
            }

            {/* Food Detail Modal */}
            <Modal
                visible={showDetail}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowDetail(false)}
            >
                <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
                    {loadingDetail ? (
                        <View style={styles.modalLoading}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : selectedFood ? (
                        <>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <Pressable
                                    onPress={() => setShowDetail(false)}
                                    style={styles.modalClose}
                                >
                                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                                </Pressable>
                                <Text style={styles.modalTitle} numberOfLines={2}>
                                    {selectedFood.name}
                                </Text>
                                {selectedFood.brand && (
                                    <Text style={styles.modalBrand}>{selectedFood.brand}</Text>
                                )}
                            </View>

                            <ScrollView
                                style={styles.modalContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Large Calorie Display */}
                                <View style={styles.calorieHero}>
                                    <Text style={styles.calorieHeroValue}>{totalCalories}</Text>
                                    <Text style={styles.calorieHeroUnit}>Calories</Text>
                                </View>

                                {/* Macros */}
                                {selectedServing && (
                                    <View style={styles.macrosRow}>
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>
                                                {Math.round(selectedServing.protein * servingCount)}g
                                            </Text>
                                            <Text style={styles.macroLabel}>Protein</Text>
                                        </View>
                                        <View style={styles.macroDivider} />
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>
                                                {Math.round(selectedServing.carbs * servingCount)}g
                                            </Text>
                                            <Text style={styles.macroLabel}>Carbs</Text>
                                        </View>
                                        <View style={styles.macroDivider} />
                                        <View style={styles.macroItem}>
                                            <Text style={styles.macroValue}>
                                                {Math.round(selectedServing.fat * servingCount)}g
                                            </Text>
                                            <Text style={styles.macroLabel}>Fat</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Serving Size Selector */}
                                <View style={styles.servingSection}>
                                    <Text style={styles.servingSectionTitle}>PORTION SIZE</Text>

                                    {/* Serving/Grams Toggle */}
                                    <View style={styles.portionToggle}>
                                        <Pressable
                                            style={[
                                                styles.portionToggleBtn,
                                                portionMode === 'serving' && styles.portionToggleBtnActive
                                            ]}
                                            onPress={() => setPortionMode('serving')}
                                        >
                                            <Text style={[
                                                styles.portionToggleText,
                                                portionMode === 'serving' && styles.portionToggleTextActive
                                            ]}>Serving</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[
                                                styles.portionToggleBtn,
                                                portionMode === 'grams' && styles.portionToggleBtnActive
                                            ]}
                                            onPress={() => setPortionMode('grams')}
                                        >
                                            <Text style={[
                                                styles.portionToggleText,
                                                portionMode === 'grams' && styles.portionToggleTextActive
                                            ]}>Grams</Text>
                                        </Pressable>
                                    </View>

                                    {portionMode === 'serving' ? (
                                        <>
                                            {/* Serving Type Picker */}
                                            {selectedFood.servings.length > 1 && (
                                                <ScrollView
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    style={styles.servingPicker}
                                                >
                                                    {selectedFood.servings.map((serving) => (
                                                        <Pressable
                                                            key={serving.id}
                                                            style={[
                                                                styles.servingOption,
                                                                selectedServing?.id === serving.id && styles.servingOptionActive
                                                            ]}
                                                            onPress={() => setSelectedServing(serving)}
                                                        >
                                                            <Text style={[
                                                                styles.servingOptionText,
                                                                selectedServing?.id === serving.id && styles.servingOptionTextActive
                                                            ]}>
                                                                {serving.description}
                                                            </Text>
                                                        </Pressable>
                                                    ))}
                                                </ScrollView>
                                            )}

                                            {/* Quantity Selector */}
                                            <View style={styles.quantityRow}>
                                                <Pressable
                                                    style={styles.quantityBtn}
                                                    onPress={() => setServingCount(Math.max(0.25, servingCount - 0.25))}
                                                >
                                                    <MaterialIcons name="remove" size={24} color={colors.text.primary} />
                                                </Pressable>
                                                <View style={styles.quantityDisplay}>
                                                    <Text style={styles.quantityValue}>{servingCount}</Text>
                                                    <Text style={styles.quantityUnit}>
                                                        {selectedServing?.description || 'serving'}
                                                    </Text>
                                                </View>
                                                <Pressable
                                                    style={styles.quantityBtn}
                                                    onPress={() => setServingCount(servingCount + 0.25)}
                                                >
                                                    <MaterialIcons name="add" size={24} color={colors.text.primary} />
                                                </Pressable>
                                            </View>
                                        </>
                                    ) : (
                                        /* Gram Input */
                                        <View style={styles.gramInputContainer}>
                                            <TextInput
                                                style={styles.gramInput}
                                                value={gramAmount}
                                                onChangeText={setGramAmount}
                                                keyboardType="decimal-pad"
                                                placeholder="100"
                                                placeholderTextColor={colors.text.subtle}
                                            />
                                            <Text style={styles.gramLabel}>grams</Text>
                                        </View>
                                    )}

                                    {/* Quick gram presets */}
                                    {portionMode === 'grams' && (
                                        <View style={styles.gramPresets}>
                                            {['50', '100', '150', '200', '250'].map((g) => (
                                                <Pressable
                                                    key={g}
                                                    style={[
                                                        styles.gramPresetBtn,
                                                        gramAmount === g && styles.gramPresetBtnActive
                                                    ]}
                                                    onPress={() => setGramAmount(g)}
                                                >
                                                    <Text style={[
                                                        styles.gramPresetText,
                                                        gramAmount === g && styles.gramPresetTextActive
                                                    ]}>{g}g</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* Nutrition Facts */}
                                {selectedServing && (
                                    <View style={styles.nutritionSection}>
                                        <Text style={styles.nutritionTitle}>NUTRITION FACTS</Text>
                                        <View style={styles.nutritionGrid}>
                                            <View style={styles.nutritionRow}>
                                                <Text style={styles.nutritionLabel}>Fiber</Text>
                                                <Text style={styles.nutritionValue}>
                                                    {Math.round(selectedServing.fiber * servingCount)}g
                                                </Text>
                                            </View>
                                            <View style={styles.nutritionRow}>
                                                <Text style={styles.nutritionLabel}>Sugar</Text>
                                                <Text style={styles.nutritionValue}>
                                                    {Math.round(selectedServing.sugar * servingCount)}g
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>

                            {/* Visibility Picker */}
                            {shareLogs && (
                                <View style={styles.visibilitySection}>
                                    <Text style={styles.visibilityLabel}>Who sees this meal?</Text>
                                    <View style={styles.visibilityOptions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.visibilityOption,
                                                visibility === 'friends' && styles.visibilityOptionActive
                                            ]}
                                            onPress={() => setVisibility('friends')}
                                        >
                                            <MaterialIcons
                                                name="people"
                                                size={18}
                                                color={visibility === 'friends' ? colors.primary : colors.text.muted}
                                            />
                                            <Text style={[
                                                styles.visibilityOptionText,
                                                visibility === 'friends' && { color: colors.primary }
                                            ]}>Friends</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.visibilityOption,
                                                visibility === 'private' && styles.visibilityOptionActive
                                            ]}
                                            onPress={() => setVisibility('private')}
                                        >
                                            <MaterialIcons
                                                name="lock"
                                                size={18}
                                                color={visibility === 'private' ? colors.primary : colors.text.muted}
                                            />
                                            <Text style={[
                                                styles.visibilityOptionText,
                                                visibility === 'private' && { color: colors.primary }
                                            ]}>Only Me</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Add Button */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={handleLog}
                                    disabled={logging}
                                >
                                    {logging ? (
                                        <ActivityIndicator color={colors.text.dark} />
                                    ) : (
                                        <>
                                            <MaterialIcons name="check" size={20} color={colors.text.dark} />
                                            <Text style={styles.addButtonText}>
                                                Add {totalCalories} cal
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : null}
                </SafeAreaView>
            </Modal>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    searchContainer: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    searchBarDivider: {
        width: 1,
        height: 20,
        backgroundColor: colors.glass.border,
    },
    barcodeScanBtn: {
        padding: spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        paddingVertical: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.lg,
    },
    loadingText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    resultsList: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['3xl'],
    },
    foodItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    aiItem: {
        backgroundColor: colors.primary + '10', // 10% opacity primary
        borderColor: colors.primary,
    },
    foodItemPressed: {
        backgroundColor: colors.glass.surfaceHover,
    },
    foodIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiIcon: {
        backgroundColor: colors.primary,
    },
    foodInfo: {
        flex: 1,
    },
    foodName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    foodBrand: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    caloriesBadge: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    caloriesBadgeText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    caloriesBadgeUnit: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    promptContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.lg,
        paddingBottom: 100,
    },
    promptIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    promptText: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    promptSubtext: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHeader: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    modalClose: {
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        lineHeight: typography.sizes['2xl'] * 1.2,
    },
    modalBrand: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    modalContent: {
        flex: 1,
    },
    calorieHero: {
        alignItems: 'center',
        paddingVertical: spacing['3xl'],
    },
    calorieHeroValue: {
        fontSize: 72,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -3,
    },
    calorieHeroUnit: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    macrosRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['2xl'],
        gap: spacing.xl,
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroValue: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    macroLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    macroDivider: {
        width: 1,
        height: 32,
        backgroundColor: colors.glass.border,
    },
    servingSection: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    servingSectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    servingPicker: {
        marginBottom: spacing.xl,
    },
    servingOption: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    servingOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    servingOptionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    servingOptionTextActive: {
        color: colors.text.dark,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xl,
    },
    quantityBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    quantityDisplay: {
        alignItems: 'center',
        minWidth: 120,
    },
    quantityValue: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    quantityUnit: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 4,
    },
    nutritionSection: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    nutritionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    nutritionGrid: {
        gap: spacing.md,
    },
    nutritionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    nutritionLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
    },
    nutritionValue: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    modalFooter: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: borderRadius.full,
        gap: spacing.md,
        ...shadows.glow,
    },
    addButtonText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },

    // Portion Toggle Styles
    portionToggle: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.full,
        padding: 4,
        marginBottom: spacing.xl,
    },
    portionToggleBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: borderRadius.full,
    },
    portionToggleBtnActive: {
        backgroundColor: colors.primary,
    },
    portionToggleText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
    },
    portionToggleTextActive: {
        color: colors.text.dark,
    },

    // Gram Input Styles
    gramInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        paddingVertical: spacing.lg,
    },
    gramInput: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        minWidth: 120,
        textAlign: 'center',
    },
    gramLabel: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    gramPresets: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    gramPresetBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    gramPresetBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    gramPresetText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    gramPresetTextActive: {
        color: colors.text.dark,
    },

    // Frequent Foods
    frequentContainer: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginLeft: spacing.xl,
        marginBottom: spacing.sm,
        letterSpacing: 1,
    },
    frequentScroll: {
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
    },
    frequentCard: {
        width: 120,
        padding: spacing.md,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: 4,
    },
    frequentIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    frequentName: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    frequentCals: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    visibilitySection: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        gap: spacing.md,
    },
    visibilityLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    visibilityOptions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    visibilityOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    visibilityOptionActive: {
        backgroundColor: colors.primary + '20',
        borderColor: colors.primary,
    },
    visibilityOptionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default CalorieLogScreen;
