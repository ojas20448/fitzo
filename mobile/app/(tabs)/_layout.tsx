import { Tabs, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, Modal, Text } from 'react-native';
import { useState } from 'react';
import { colors, typography, spacing, borderRadius } from '../../src/styles/theme';

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
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialIcons
                                name="home"
                                size={24}
                                color={color}
                                style={focused ? styles.activeIcon : undefined}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="buddies"
                    options={{
                        title: 'Buddies',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialIcons
                                name="groups"
                                size={24}
                                color={color}
                                style={focused ? styles.activeIcon : undefined}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="scan"
                    options={{
                        title: '',
                        tabBarIcon: ({ focused }) => (
                            <View style={styles.logButton}>
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
                    name="stats"
                    options={{
                        title: 'Progress',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialIcons
                                name="bar-chart"
                                size={24}
                                color={color}
                                style={focused ? styles.activeIcon : undefined}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialIcons
                                name="person"
                                size={24}
                                color={color}
                                style={focused ? styles.activeIcon : undefined}
                            />
                        ),
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
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowLogModal(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>What would you like to log?</Text>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => handleLogOption('/log/workout')}
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
                            onPress={() => handleLogOption('/log/calories')}
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
                            style={styles.cancelBtn}
                            onPress={() => setShowLogModal(false)}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderTopWidth: 0,
        borderRadius: 32,
        height: 64,
        paddingTop: 0,
        paddingBottom: 0,
        borderWidth: 1,
        borderColor: colors.glass.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 20,
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
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -20,
        borderWidth: 3,
        borderColor: 'rgba(20, 20, 20, 0.95)',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
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
