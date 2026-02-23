import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../src/styles/theme';
import GlassCard from '../../src/components/GlassCard';

export default function SettingsScreen() {
    const { logout, user } = useAuth();

    // Mock State for Settings
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [units, setUnits] = useState('metric'); // metric | imperial

    const handleSignOut = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                        router.replace('/login' as any);
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SETTINGS</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Account Section */}
                <Text style={styles.sectionTitle}>Account</Text>
                <GlassCard style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="person" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>{user?.name || 'User'}</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="email" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>{user?.email || 'email@example.com'}</Text>
                        </View>
                    </View>
                </GlassCard>

                {/* Preferences Section */}
                <Text style={styles.sectionTitle}>Preferences</Text>
                <GlassCard style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="notifications" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>Push Notifications</Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: colors.glass.border, true: colors.primary }}
                            thumbColor={colors.text.primary}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="dark-mode" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>Dark Mode Icon</Text>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={setDarkMode}
                            trackColor={{ false: colors.glass.border, true: colors.primary }}
                            thumbColor={colors.text.primary}
                        />
                    </View>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}
                    >
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="straighten" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>Units</Text>
                        </View>
                        <Text style={styles.valueText}>{units === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lbs/ft)'}</Text>
                    </TouchableOpacity>
                </GlassCard>

                {/* System Section */}
                <Text style={styles.sectionTitle}>System</Text>
                <GlassCard style={styles.card}>
                    <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:contact@fitzoapp.in')}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="help-outline" size={24} color={colors.text.secondary} />
                            <View>
                                <Text style={styles.rowLabel}>Help & Support</Text>
                                <Text style={styles.rowSub}>contact@fitzoapp.in</Text>
                            </View>
                        </View>
                        <MaterialIcons name="open-in-new" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.rowSignOut} onPress={handleSignOut}>
                        <MaterialIcons name="logout" size={24} color={colors.error} />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </GlassCard>

                <Text style={styles.versionText}>Fitzo v1.0.0 (Build 124)</Text>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
    content: {
        padding: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        padding: 0,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    rowLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    rowSub: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    valueText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginLeft: 56,
    },
    rowSignOut: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    signOutText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.error,
    },
    versionText: {
        textAlign: 'center',
        color: colors.text.subtle,
        fontSize: typography.sizes.xs,
        marginTop: spacing.xl,
        fontFamily: typography.fontFamily.regular,
    },
});
