import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';

const SettingsScreen = () => {
    const { logout, user } = useAuth();
    const [units, setUnits] = useState({ weight: 'kg', distance: 'km', food: 'g' });
    const [notifications, setNotifications] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        router.replace('/login');
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action is irreversible. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // In a real app, verify password first
                        // await memberAPI.deleteAccount();
                        await logout();
                        router.replace('/login');
                    },
                },
            ]
        );
    };

    const SettingItem = ({ icon, label, value, onPress, isDestructive = false }: any) => (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.settingLeft}>
                <View style={[
                    styles.iconContainer,
                    isDestructive ? { backgroundColor: colors.error + '20' } : undefined
                ]}>
                    <MaterialIcons
                        name={icon}
                        size={20}
                        color={isDestructive ? colors.error : colors.primary}
                    />
                </View>
                <Text style={[
                    styles.settingLabel,
                    isDestructive ? { color: colors.error } : undefined
                ]}>{label}</Text>
            </View>
            <View style={styles.settingRight}>
                {value && <Text style={styles.settingValue}>{value}</Text>}
                <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
            </View>
        </TouchableOpacity>
    );

    const renderToggle = (label: string, value: boolean, onValueChange: (val: boolean) => void) => (
        <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
                <Text style={[styles.settingLabel, { marginLeft: 0 }]}>{label}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: colors.glass.border, true: colors.primary }}
                thumbColor={colors.text.primary}
            />
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Account Section */}
                <Text style={styles.sectionHeader}>ACCOUNT</Text>
                <GlassCard style={styles.card}>
                    <View style={styles.userInfo}>
                        <View style={styles.userAvatar}>
                            <Text style={styles.userInitials}>
                                {user?.name?.slice(0, 2).toUpperCase() || 'U'}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.userName}>{user?.name}</Text>
                            <Text style={styles.userEmail}>{user?.email}</Text>
                        </View>
                    </View>
                </GlassCard>

                {/* Preferences */}
                <Text style={styles.sectionHeader}>PREFERENCES</Text>
                <GlassCard style={StyleSheet.flatten([styles.card, { padding: 0 }])}>
                    {renderToggle('Push Notifications', notifications, setNotifications)}
                    <View style={styles.divider} />
                    <SettingItem
                        icon="straighten"
                        label="Units"
                        value={`${units.weight} / ${units.distance}`}
                        onPress={() => {
                            // Toggle logic for demo
                            setUnits(prev => ({
                                ...prev,
                                weight: prev.weight === 'kg' ? 'lbs' : 'kg',
                                distance: prev.distance === 'km' ? 'mi' : 'km'
                            }));
                        }}
                    />
                </GlassCard>

                {/* Support */}
                <Text style={styles.sectionHeader}>SUPPORT</Text>
                <GlassCard style={StyleSheet.flatten([styles.card, { padding: 0 }])}>
                    <SettingItem
                        icon="help-outline"
                        label="Help Center"
                        onPress={() => { }}
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="lock-outline"
                        label="Privacy Policy"
                        onPress={() => {
                            // Open webview or privacy screen
                        }}
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="description"
                        label="Terms of Service"
                        onPress={() => { }}
                    />
                </GlassCard>

                {/* Actions */}
                <Text style={styles.sectionHeader}>ACTIONS</Text>
                <GlassCard style={StyleSheet.flatten([styles.card, { padding: 0 }])}>
                    <SettingItem
                        icon="logout"
                        label="Log Out"
                        onPress={handleLogout}
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="delete-outline"
                        label="Delete Account"
                        isDestructive
                        onPress={handleDeleteAccount}
                    />
                </GlassCard>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>Fitzo v1.0.0 (Build 12)</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    sectionHeader: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
        marginLeft: spacing.sm,
        letterSpacing: 1,
    },
    card: {
        padding: spacing.md,
        overflow: 'hidden',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInitials: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    userName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    userEmail: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    settingValue: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginLeft: spacing.xl + 32, // Align with text
    },
    footer: {
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    versionText: {
        fontSize: typography.sizes.xs,
        color: colors.text.subtle,
    },
});

export default SettingsScreen;
