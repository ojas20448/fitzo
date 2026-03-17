import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    Switch,
    Linking,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { settingsAPI, notificationsAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';

const UNITS_STORAGE_KEY = 'fitzo_units';
const version = Constants.expoConfig?.version || '1.0.0';

const SettingsScreen = () => {
    const { logout, user } = useAuth();
    const toast = useToast();
    const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
    const [notifications, setNotifications] = useState(true);
    const [shareLogs, setShareLogs] = useState(true);
    const [deleting, setDeleting] = useState(false);

    // Load persisted settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const stored = await AsyncStorage.getItem(UNITS_STORAGE_KEY);
                if (stored === 'metric' || stored === 'imperial') {
                    setUnits(stored);
                }
            } catch (e) {
                // ignore
            }

            // Load sharing preference
            try {
                const data = await settingsAPI.getSharingPreference();
                setShareLogs(data.share_logs_default);
            } catch (e) {
                setShareLogs(true);
            }

            // Load notification preference
            try {
                const status = await notificationsAPI.getStatus();
                setNotifications(status.enabled);
            } catch (e) {
                // default to true
            }
        };
        loadSettings();
    }, []);

    const toggleUnits = async () => {
        const next = units === 'metric' ? 'imperial' : 'metric';
        setUnits(next);
        try {
            await AsyncStorage.setItem(UNITS_STORAGE_KEY, next);
        } catch (e) {
            // ignore
        }
    };

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

    const handleShareLogsToggle = async (newValue: boolean) => {
        setShareLogs(newValue);
        try {
            await settingsAPI.updateSharingPreference(newValue);
        } catch (e) {
            setShareLogs(!newValue);
            toast.error('Error', 'Failed to update sharing preferences');
        }
    };

    const handleNotificationsToggle = async (newValue: boolean) => {
        setNotifications(newValue);
        try {
            if (newValue) {
                // Re-register for push notifications
                const { status } = await import('expo-notifications').then(m => m.getPermissionsAsync());
                if (status !== 'granted') {
                    const { status: newStatus } = await import('expo-notifications').then(m => m.requestPermissionsAsync());
                    if (newStatus !== 'granted') {
                        setNotifications(false);
                        toast.warning('Permissions Required', 'Enable notifications in your device settings');
                        return;
                    }
                }
                const token = await import('expo-notifications').then(m => m.getExpoPushTokenAsync());
                await notificationsAPI.registerPushToken(token.data, Platform.OS);
            } else {
                // Unregister push token
                await notificationsAPI.unregisterPushToken();
            }
        } catch (e) {
            setNotifications(!newValue);
            toast.error('Error', 'Failed to update notification preferences');
        }
    };

    const performDeleteAccount = async () => {
        setDeleting(true);
        try {
            await settingsAPI.deleteAccount();
            await logout();
            router.replace('/login');
        } catch (e: any) {
            setDeleting(false);
            toast.error('Error', e.message || 'Failed to delete account');
        }
    };

    const handleDeleteAccount = () => {
        if (Platform.OS === 'ios') {
            Alert.prompt(
                'Delete Account',
                'This action is irreversible. All your data will be permanently deleted.\n\nType "DELETE" to confirm.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async (input) => {
                            if (input?.trim() === 'DELETE') {
                                performDeleteAccount();
                            } else {
                                toast.warning('Not deleted', 'You must type "DELETE" to confirm.');
                            }
                        },
                    },
                ],
                'plain-text',
                '',
                'default'
            );
        } else {
            Alert.alert(
                'Delete Account',
                'This action is irreversible. All your data will be permanently deleted.\n\nAre you sure you want to proceed?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Yes, Delete',
                        style: 'destructive',
                        onPress: () => {
                            Alert.alert(
                                'Final Confirmation',
                                'This cannot be undone. All your data will be permanently deleted.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'DELETE MY ACCOUNT',
                                        style: 'destructive',
                                        onPress: performDeleteAccount,
                                    },
                                ]
                            );
                        },
                    },
                ]
            );
        }
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

                {/* Privacy & Sharing */}
                <Text style={styles.sectionHeader}>PRIVACY & SHARING</Text>
                <GlassCard style={StyleSheet.flatten([styles.card, { padding: 0 }])}>
                    <View style={styles.settingItem}>
                        <View style={styles.settingLeftCol}>
                            <MaterialIcons
                                name="people"
                                size={20}
                                color={colors.primary}
                                style={styles.toggleIcon}
                            />
                            <View>
                                <Text style={styles.settingLabel}>Share with Gym Buddies</Text>
                                <Text style={styles.settingDescription}>
                                    {shareLogs
                                        ? 'Buddies can see your workouts & meals'
                                        : 'Your logs are private to buddies'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={shareLogs}
                            onValueChange={handleShareLogsToggle}
                            trackColor={{ false: colors.glass.border, true: colors.primary }}
                            thumbColor={colors.text.primary}
                        />
                    </View>
                </GlassCard>

                {/* Preferences */}
                <Text style={styles.sectionHeader}>PREFERENCES</Text>
                <GlassCard style={StyleSheet.flatten([styles.card, { padding: 0 }])}>
                    {renderToggle('Push Notifications', notifications, handleNotificationsToggle)}
                    <View style={styles.divider} />
                    <SettingItem
                        icon="straighten"
                        label="Units"
                        value={units === 'metric' ? 'kg / km' : 'lbs / mi'}
                        onPress={toggleUnits}
                    />
                </GlassCard>

                {/* Support */}
                <Text style={styles.sectionHeader}>SUPPORT</Text>
                <GlassCard style={StyleSheet.flatten([styles.card, { padding: 0 }])}>
                    <SettingItem
                        icon="help-outline"
                        label="Help Center"
                        onPress={() => Linking.openURL('https://www.fitzoapp.in/help')}
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="lock-outline"
                        label="Privacy Policy"
                        onPress={() => Linking.openURL('https://www.fitzoapp.in/privacy-policy')}
                    />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="description"
                        label="Terms of Service"
                        onPress={() => Linking.openURL('https://www.fitzoapp.in/terms')}
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
                    <Text style={styles.versionText}>Fitzo v{version}</Text>
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
    settingLeftCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    toggleIcon: {
        marginRight: spacing.sm,
    },
    settingDescription: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
});

export default SettingsScreen;
