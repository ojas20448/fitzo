import { Tabs, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, Modal, Text, Pressable } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';
import { AnimatedTabIcon } from '../../src/components/AnimatedTabIcon';

export default function TabLayout() {
    const [showLogModal, setShowLogModal] = useState(false);

    const handleLogOption = (route: string) => {
        setShowLogModal(false);
        router.push(route as any);
    };

    return (
        <>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: styles.tabBar,
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.text.muted,
                    tabBarLabelStyle: styles.tabLabel,
                }}
                screenListeners={{
                    tabPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Home',
                        tabBarAccessibilityLabel: 'Home tab',
                        tabBarIcon: ({ color, focused }) => (
                            <AnimatedTabIcon name="home" color={color} focused={focused} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="buddies"
                    options={{
                        title: 'Buddies',
                        tabBarAccessibilityLabel: 'Gym buddies tab',
                        tabBarIcon: ({ color, focused }) => (
                            <AnimatedTabIcon name="people" color={color} focused={focused} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="scan"
                    options={{
                        title: '',
                        tabBarAccessibilityLabel: 'Log action menu',
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.logButton} accessibilityLabel="Open log menu" accessibilityRole="button">
                                <MaterialIcons name="add" size={32} color={colors.background} />
                            </View>
                        ),
                    }}
                    listeners={() => ({
                        tabPress: (e) => {
                            e.preventDefault();
                            setShowLogModal(true);
                        },
                    })}
                />
                <Tabs.Screen
                    name="learn"
                    options={{
                        title: 'Learn',
                        tabBarAccessibilityLabel: 'Learning path tab',
                        tabBarIcon: ({ color, focused }) => (
                            <AnimatedTabIcon name="menu-book" color={color} focused={focused} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarAccessibilityLabel: 'Your profile tab',
                        tabBarIcon: ({ color, focused }) => (
                            <AnimatedTabIcon name="person" color={color} focused={focused} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="stats"
                    options={{
                        href: null,
                    }}
                />
            </Tabs>

            {/* Log Action Modal */}
            <Modal
                visible={showLogModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLogModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowLogModal(false)}
                >
                    <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.modalTitle} accessibilityRole="header">What would you like to log?</Text>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => handleLogOption('/log/workout')}
                            accessibilityLabel="Log workout"
                            accessibilityHint="Track what you trained today"
                            accessibilityRole="menuitem"
                        >
                            <View style={styles.optionIcon}>
                                <MaterialIcons name="fitness-center" size={28} color={colors.primary} />
                            </View>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionTitle}>Log Workout</Text>
                                <Text style={styles.optionSubtitle}>Track what you trained today</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => handleLogOption('/member/create-post')}
                            accessibilityLabel="Add post"
                            accessibilityHint="Share a post with your gym buddies"
                            accessibilityRole="menuitem"
                        >
                            <View style={styles.optionIcon}>
                                <MaterialIcons name="post-add" size={28} color={colors.primary} />
                            </View>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionTitle}>Add Post</Text>
                                <Text style={styles.optionSubtitle}>Share with your gym buddies</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => handleLogOption('/log/calories')}
                            accessibilityLabel="Log calories"
                            accessibilityHint="Track your nutrition"
                            accessibilityRole="menuitem"
                        >
                            <View style={styles.optionIcon}>
                                <MaterialIcons name="restaurant" size={28} color={colors.primary} />
                            </View>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionTitle}>Log Calories</Text>
                                <Text style={styles.optionSubtitle}>Track your nutrition</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => handleLogOption('/exercise-library')}
                            accessibilityLabel="Exercise library"
                            accessibilityHint="Browse 1,300+ exercises with GIFs"
                            accessibilityRole="menuitem"
                        >
                            <View style={styles.optionIcon}>
                                <MaterialIcons name="fitness-center" size={28} color={colors.primary} />
                            </View>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionTitle}>Exercise Library</Text>
                                <Text style={styles.optionSubtitle}>Browse 1,300+ exercises with GIFs</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setShowLogModal(false)}
                            accessibilityLabel="Cancel"
                            accessibilityRole="button"
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        height: 90,
        paddingTop: 8,
        elevation: 0,
        shadowOpacity: 0,
    },
    tabLabel: {
        fontSize: 9,
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 0.5,
        marginTop: -2,
    },
    activeIcon: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
    },
    logButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4, // Slight lift
        borderWidth: 4,
        borderColor: colors.surface, // Match tab bar background
        ...shadows.glow,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'rgba(20, 20, 20, 0.98)',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        paddingBottom: spacing['4xl'],
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderBottomWidth: 0,
    },
    modalTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textAlign: 'center',
        marginBottom: spacing.xl,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    optionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionInfo: {
        flex: 1,
    },
    optionTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    optionSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
        letterSpacing: 0.3,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        marginTop: spacing.md,
    },
    cancelText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        letterSpacing: 1,
    },
});
