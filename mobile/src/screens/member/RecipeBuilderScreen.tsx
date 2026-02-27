import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Pressable,
    Modal,
    FlatList,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { foodAPI, recipesAPI } from '../../services/api';
import { useToast } from '../../components/Toast';

// Interfaces
interface Ingredient {
    id: string; // unique handle for the list
    foodId: string;
    name: string;
    brand?: string | null;
    calories: number; // per serving/gram used
    protein: number;
    carbs: number;
    fat: number;
    amount: number;
    unit: 'serving' | 'gram';
    unitName: string;
    originalFood: any; // Keep reference for adjustments
}

const RecipeBuilderScreen = () => {
    const params = useLocalSearchParams();
    const recipeId = params.id as string;
    const toast = useToast();

    // Recipe State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    // UI State
    const [saving, setSaving] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Search State (Duplicated from CalorieLog for simplicity)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Editing Ingredient State
    const [selectedFood, setSelectedFood] = useState<any | null>(null);
    const [selectedServing, setSelectedServing] = useState<any | null>(null);
    const [servingCount, setServingCount] = useState(1);
    const [portionMode, setPortionMode] = useState<'serving' | 'grams'>('serving');
    const [gramAmount, setGramAmount] = useState('100');
    const [showIngredientDetail, setShowIngredientDetail] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Load existing recipe if editing
    useEffect(() => {
        if (recipeId) {
            loadRecipe(recipeId);
        }
    }, [recipeId]);

    const loadRecipe = async (id: string) => {
        try {
            const data = await recipesAPI.getOne(id);
            if (data.recipe) {
                setName(data.recipe.name);
                setDescription(data.recipe.description || '');
                setInstructions(data.recipe.instructions || '');
                setIngredients(data.recipe.ingredients || []);
            }
        } catch (error) {
            toast.error('Error', 'Could not load recipe');
            router.back();
        }
    };

    // Derived Totals
    const totals = ingredients.reduce((acc, curr) => ({
        calories: acc.calories + curr.calories,
        protein: acc.protein + curr.protein,
        carbs: acc.carbs + curr.carbs,
        fat: acc.fat + curr.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // Search Logic
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setSearchError(null);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const result = await foodAPI.search(searchQuery);
                setSearchResults(result.foods || []);
                if (result.foods?.length === 0) setSearchError('No foods found');
                else setSearchError(null);
            } catch (error) {
                setSearchError('Search failed');
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleFoodSelect = async (food: any) => {
        setLoadingDetail(true);
        setShowIngredientDetail(true); // Open detail modal
        try {
            const details = await foodAPI.getDetails(food.id, food.source || 'indian');
            setSelectedFood(details);
            if (details.servings?.length > 0) setSelectedServing(details.servings[0]);
            setServingCount(1);
            setPortionMode('serving');
        } catch (error) {
            toast.error('Error', 'Could not load food details');
            setShowIngredientDetail(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const confirmAddIngredient = () => {
        if (!selectedFood || !selectedServing) return;

        // Calculate values based on serving/grams
        let calories = 0, protein = 0, carbs = 0, fat = 0;
        let amount = 0;
        let unit: 'serving' | 'gram' = 'serving';
        let unitName = '';

        if (portionMode === 'serving') {
            const ratio = servingCount;
            calories = Math.round(selectedServing.calories * ratio);
            protein = Math.round(selectedServing.protein * ratio);
            carbs = Math.round(selectedServing.carbs * ratio);
            fat = Math.round(selectedServing.fat * ratio);
            amount = servingCount;
            unit = 'serving';
            unitName = selectedServing.description;
        } else {
            const grams = parseFloat(gramAmount) || 0;
            // Assuming serving metric_serving_amount is available or we convert from serving calories
            // Fallback: If serving is 100g, easy. If not, this logic needs to be robust. 
            // For now, let's use the 'serving' calculation but try to infer per-gram.
            // Fitzo API returns standard servings. 
            // Simplified: Just use the per-serving logic for now as 'grams' mode implementation in CalorieLogScreen was complex.
            // Let's implement full gram support if possible, or stick to serving for MVP builder accuracy to avoid bugs.
            // I'll stick to 'serving' mostly, but if user selected grams I'll assume standard scaling.

            // Re-using CalorieLogScreen logic for grams:
            // "const ratio = grams / serving_weight"
            // We need serving weight information.
            // If missing, I'll default to serving mode.

            // For MVP safety, I will force serving mode logic here or implement simple scaling if 100g data is known.
            // Let's stick to the logic: Calculate totals then add.

            // Actually, let's just support 'serving' mode fully for now to be safe, 
            // or implement the robust calculation from CalorieLogScreen later.
            // I'll implement serving count multiplier for now.

            const ratio = servingCount; // Using the logic from the modal state
            calories = Math.round(selectedServing.calories * ratio);
            protein = Math.round(selectedServing.protein * ratio);
            carbs = Math.round(selectedServing.carbs * ratio);
            fat = Math.round(selectedServing.fat * ratio);
            amount = servingCount;
            unit = 'serving';
            unitName = selectedServing.description;
        }

        const newIngredient: Ingredient = {
            id: Date.now().toString(),
            foodId: selectedFood.id,
            name: selectedFood.name,
            brand: selectedFood.brand,
            calories,
            protein,
            carbs,
            fat,
            amount,
            unit,
            unitName,
            originalFood: selectedFood
        };

        setIngredients([...ingredients, newIngredient]);
        setShowIngredientDetail(false);
        setShowSearch(false);
        setSearchQuery('');
    };

    const removeIngredient = (id: string) => {
        setIngredients(ingredients.filter(i => i.id !== id));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Missing Name', 'Please give your recipe a name');
            return;
        }
        if (ingredients.length === 0) {
            Alert.alert('Empty Recipe', 'Please add at least one ingredient');
            return;
        }

        setSaving(true);
        try {
            const recipeData = {
                name,
                description,
                instructions,
                ingredients,
                total_calories: totals.calories,
                total_protein: totals.protein,
                total_carbs: totals.carbs,
                total_fat: totals.fat
            };

            if (recipeId) {
                // Update existing recipe
                await recipesAPI.update(recipeId, recipeData);
                toast.success('Updated', 'Recipe updated successfully');
            } else {
                // Create new recipe
                await recipesAPI.create(recipeData);
                toast.success('Saved', 'Recipe created successfully');
            }
            router.back();
        } catch (error: any) {
            Alert.alert('Save Failed', error.message || 'Failed to save recipe');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </Pressable>
                <Text style={styles.headerTitle}>{recipeId ? 'Edit Recipe' : 'New Recipe'}</Text>
                <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn} hitSlop={12}>
                    {saving ? (
                        <ActivityIndicator color={colors.text.dark} />
                    ) : (
                        <Text style={styles.saveText}>Save</Text>
                    )}
                </Pressable>
            </View>

            <ScrollView style={styles.content}>
                {/* Details Section */}
                <View style={styles.section}>
                    <Text style={styles.label}>RECIPE DETAILS</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Recipe Name (e.g. High Protein Oats)"
                        placeholderTextColor={colors.text.subtle}
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description (optional)"
                        placeholderTextColor={colors.text.subtle}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />
                </View>

                {/* Ingredients Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.label}>INGREDIENTS</Text>
                        <Pressable onPress={() => setShowSearch(true)} style={styles.addBtn}>
                            <MaterialIcons name="add" size={20} color={colors.primary} />
                            <Text style={styles.addBtnText}>Add Food</Text>
                        </Pressable>
                    </View>

                    {ingredients.length === 0 ? (
                        <View style={styles.emptyIngredients}>
                            <Text style={styles.emptyIngredientsText}>No ingredients added yet</Text>
                        </View>
                    ) : (
                        ingredients.map((ing) => (
                            <View key={ing.id} style={styles.ingredientRow}>
                                <View style={styles.ingredientInfo}>
                                    <Text style={styles.ingredientName}>{ing.name}</Text>
                                    <Text style={styles.ingredientDetail}>
                                        {ing.amount} x {ing.unitName} • {ing.calories} kcal
                                    </Text>
                                </View>
                                <Pressable onPress={() => removeIngredient(ing.id)}>
                                    <MaterialIcons name="remove-circle-outline" size={24} color={colors.error} />
                                </Pressable>
                            </View>
                        ))
                    )}
                </View>

                {/* Totals Summary */}
                <View style={styles.section}>
                    <Text style={styles.label}>TOTAL NUTRITION</Text>
                    <View style={styles.totalsCard}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Calories</Text>
                            <Text style={styles.totalValue}>{totals.calories}</Text>
                        </View>
                        <View style={styles.macrosGrid}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroVal}>{totals.protein}g</Text>
                                <Text style={styles.macroLbl}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroVal}>{totals.carbs}g</Text>
                                <Text style={styles.macroLbl}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroVal}>{totals.fat}g</Text>
                                <Text style={styles.macroLbl}>Fat</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Food Search Modal */}
            <Modal visible={showSearch} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.searchHeader}>
                        <Pressable onPress={() => setShowSearch(false)}>
                            <Text style={styles.closeText}>Cancel</Text>
                        </Pressable>
                        <Text style={styles.modalTitle}>Add Ingredient</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color={colors.text.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search foods..."
                            placeholderTextColor={colors.text.subtle}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>
                    {searching ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            keyExtractor={i => i.id}
                            renderItem={({ item }) => (
                                <Pressable style={styles.searchItem} onPress={() => handleFoodSelect(item)}>
                                    <Text style={styles.searchItemName}>{item.name}</Text>
                                    <Text style={styles.searchItemDesc}>{item.description}</Text>
                                </Pressable>
                            )}
                            ListEmptyComponent={
                                searchQuery ? <Text style={styles.emptySearch}>{searchError || 'No results'}</Text> : null
                            }
                        />
                    )}
                </SafeAreaView>
            </Modal>

            {/* Ingredient Detail/Quantity Modal */}
            <Modal visible={showIngredientDetail} transparent animationType="fade">
                <View style={styles.detailModalBackdrop}>
                    <View style={styles.detailCard}>
                        {loadingDetail ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : selectedFood ? (
                            <>
                                <Text style={styles.detailTitle}>{selectedFood.name}</Text>
                                <View style={styles.quantityControl}>
                                    <Pressable
                                        style={styles.qtyBtn}
                                        onPress={() => setServingCount(Math.max(0.5, servingCount - 0.5))}
                                    >
                                        <MaterialIcons name="remove" size={24} color={colors.text.primary} />
                                    </Pressable>
                                    <View>
                                        <Text style={styles.qtyValue}>{servingCount}</Text>
                                        <Text style={styles.qtyUnit}>{selectedServing?.description || 'serving'}</Text>
                                    </View>
                                    <Pressable
                                        style={styles.qtyBtn}
                                        onPress={() => setServingCount(servingCount + 0.5)}
                                    >
                                        <MaterialIcons name="add" size={24} color={colors.text.primary} />
                                    </Pressable>
                                </View>
                                <View style={styles.detailStats}>
                                    <Text style={styles.detailStat}>
                                        {Math.round((selectedServing?.calories || 0) * servingCount)} cal
                                    </Text>
                                </View>
                                <View style={styles.detailActions}>
                                    <Pressable
                                        style={[styles.actionBtn, styles.cancelBtn]}
                                        onPress={() => setShowIngredientDetail(false)}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.actionBtn, styles.confirmBtn]}
                                        onPress={confirmAddIngredient}
                                    >
                                        <Text style={styles.confirmBtnText}>Add</Text>
                                    </Pressable>
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: { padding: spacing.xs },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    saveBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    saveText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    label: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginBottom: spacing.md,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text.primary,
        fontSize: typography.sizes.base,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing.md,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addBtnText: {
        color: colors.primary,
        fontFamily: typography.fontFamily.medium,
    },
    emptyIngredients: {
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    emptyIngredientsText: {
        color: colors.text.muted,
    },
    ingredientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    ingredientInfo: {
        flex: 1,
    },
    ingredientName: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.base,
    },
    ingredientDetail: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
    },
    totalsCard: {
        backgroundColor: colors.primary + '10', // 10% opacity
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: spacing.lg,
    },
    totalLabel: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    totalValue: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    macrosGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
        flex: 1,
    },
    macroVal: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    macroLbl: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginTop: 2,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    searchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeText: {
        color: colors.primary,
        fontSize: typography.sizes.base,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        margin: spacing.lg,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
    },
    searchInput: {
        flex: 1,
        color: colors.text.primary,
        fontSize: typography.sizes.base,
    },
    searchItem: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    searchItemName: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.base,
    },
    searchItemDesc: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
        marginTop: 2,
    },
    emptySearch: {
        textAlign: 'center',
        marginTop: 40,
        color: colors.text.muted,
    },

    // Detail Modal
    detailModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    detailCard: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    detailTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    quantityControl: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xl,
        marginBottom: spacing.xl,
    },
    qtyBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    qtyValue: {
        fontSize: typography.sizes['2xl'],
        fontWeight: 'bold',
        color: colors.text.primary,
        textAlign: 'center',
    },
    qtyUnit: {
        color: colors.text.muted,
        textAlign: 'center',
    },
    detailStats: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    detailStat: {
        fontSize: typography.sizes.xl,
        fontWeight: 'bold',
        color: colors.primary,
    },
    detailActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionBtn: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    confirmBtn: {
        backgroundColor: colors.primary,
    },
    cancelBtnText: {
        color: colors.text.primary,
        fontWeight: '600',
    },
    confirmBtnText: {
        color: colors.text.dark,
        fontWeight: 'bold',
    },
});

export default RecipeBuilderScreen;
