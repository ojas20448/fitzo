import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { recipesAPI, caloriesAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { useToast } from '../../components/Toast';

const RecipeListScreen = () => {
    const [recipes, setRecipes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const toast = useToast();

    const loadRecipes = async () => {
        try {
            const data = await recipesAPI.getAll();
            setRecipes(data.recipes || []);
        } catch (error) {
            console.error('Failed to load recipes:', error);
            toast.error('Error', 'Could not load recipes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadRecipes();
        }, [])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadRecipes();
    };

    const handleLog = async (recipe: any) => {
        try {
            await caloriesAPI.log({
                calories: recipe.total_calories,
                protein: recipe.total_protein,
                carbs: recipe.total_carbs,
                fat: recipe.total_fat,
                meal_name: recipe.name,
                visibility: 'friends'
            });
            toast.success('Logged', `${recipe.name} added to diary`);
            router.back(); // Go back to where we came from (likely CalorieLog or Home)
        } catch (error) {
            toast.error('Error', 'Failed to log recipe');
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <Pressable
                style={styles.cardContent}
                onPress={() => router.push({
                    pathname: '/member/recipe-builder',
                    params: { id: item.id }
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <MaterialIcons name="restaurant-menu" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.recipeName}>{item.name}</Text>
                        {item.description ? (
                            <Text style={styles.recipeDesc} numberOfLines={1}>{item.description}</Text>
                        ) : null}
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{item.total_calories}</Text>
                        <Text style={styles.statLabel}>kcal</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{item.total_protein}g</Text>
                        <Text style={styles.statLabel}>Prot</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{item.total_carbs}g</Text>
                        <Text style={styles.statLabel}>Carbs</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{item.total_fat}g</Text>
                        <Text style={styles.statLabel}>Fat</Text>
                    </View>
                </View>
            </Pressable>

            <View style={styles.cardActions}>
                <Pressable
                    style={styles.logBtn}
                    onPress={() => handleLog(item)}
                >
                    <MaterialIcons name="add-circle" size={20} color={colors.text.dark} />
                    <Text style={styles.logBtnText}>Log Recipe</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </Pressable>
                <Text style={styles.headerTitle}>My Recipes</Text>
                <Pressable
                    style={styles.addBtn}
                    onPress={() => router.push('/member/recipe-builder')}
                >
                    <MaterialIcons name="add" size={24} color={colors.primary} />
                </Pressable>
            </View>

            <FlatList
                data={recipes}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="menu-book" size={64} color={colors.text.subtle} />
                            <Text style={styles.emptyText}>No recipes yet</Text>
                            <Text style={styles.emptySubtext}>Create custom meals to quickly log them later</Text>
                            <Pressable
                                style={styles.createBtn}
                                onPress={() => router.push('/member/recipe-builder')}
                            >
                                <Text style={styles.createBtnText}>Create Recipe</Text>
                            </Pressable>
                        </View>
                    ) : null
                }
            />
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    addBtn: {
        padding: spacing.sm,
    },
    listContent: {
        padding: spacing.xl,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        overflow: 'hidden',
    },
    cardContent: {
        padding: spacing.lg,
    },
    cardActions: {
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        padding: spacing.sm,
        backgroundColor: colors.glass.surfaceLight,
    },
    logBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    logBtnText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    recipeName: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    recipeDesc: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginVertical: spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginTop: spacing.lg,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        textAlign: 'center',
        maxWidth: 250,
    },
    createBtn: {
        marginTop: spacing.xl,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
    },
    createBtnText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.md,
    },
});

export default RecipeListScreen;
