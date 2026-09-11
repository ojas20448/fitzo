import { enableHealthImport } from '../../src/utils/healthImportPreference';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking, ActivityIndicator, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../src/styles/theme';
import GlassCard from '../../src/components/GlassCard';
import { useToast } from '../../src/components/Toast';
import { isHealthAvailable, hasHealthData, healthSyncPayload, requestPermissions, getTodaysSummary } from '../../src/services/healthService';
import { healthAPI, settingsAPI, notificationsAPI } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Haptics from '../../src/utils/haptics';
import { isHapticsEnabled, setHapticsEnabled } from '../../src/utils/haptics';
import AIConsentModal, { getAIConsent } from '../../src/components/AIConsentModal';

const UNITS_STORAGE_KEY = 'fitzo_units';
const version = Constants.expoConfig?.version || '1.3.0';

interface GymInfo {
    id: string;
    name: string;
    access_code: string;
    capacity: number;
    member_count: number;
}

export default function SettingsScreen() {
    const { logout, user, refreshUser } = useAuth();
    const toast = useToast();

    // Preferences & Sharing States
    const [notifications, setNotifications] = useState(true);
    const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
    const [shareLogs, setShareLogs] = useState(true);
    const [hapticsOn, setHapticsOn] = useState(true);
    const [deleting, setDeleting] = useState(false);

    // Gym membership
    const [gym, setGym] = useState<GymInfo | null>(null);
    const [gymLoading, setGymLoading] = useState(true);
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [gymCode, setGymCode] = useState('');
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            // Load Gym membership
            try {
                const res = await settingsAPI.getGym();
                setGym(res.gym);
            } catch (e) {
                // ignore
            } finally {
                setGymLoading(false);
            }

            // Load persisted units setting
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

            // Reflect the live haptics gate (already loaded at boot)
            setHapticsOn(isHapticsEnabled());
        };
        loadSettings();
    }, []);

    const toggleHaptics = async (value: boolean) => {
        setHapticsOn(value);
        await setHapticsEnabled(value);
        if (value) {
            // Confirm with the very channel being re-enabled
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    };

    const toggleUnits = async () => {
        const next = units === 'metric' ? 'imperial' : 'metric';
        setUnits(next);
        try {
            await AsyncStorage.setItem(UNITS_STORAGE_KEY, next);
        } catch (e) {
            // ignore
        }
    };

    const handleShareLogsToggle = async (newValue: boolean) => {
        setShareLogs(newValue);
        try {
            await settingsAPI.updateSharingPreference(newValue);
            toast.success('Updated', newValue ? 'Logs are now shared with gym buddies.' : 'Logs are now private.');
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
                        toast.warning('Notifications Disabled', 'Notification permission was not granted');
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

    const handleJoinGym = async () => {
        const code = gymCode.trim();
        if (!code) {
            toast.error('Missing Code', 'Enter the access code from your gym');
            return;
        }
        setJoining(true);
        try {
            const res = await settingsAPI.joinGym(code);
            toast.success('Joined!', res.message);
            setShowJoinInput(false);
            setGymCode('');
            const updated = await settingsAPI.getGym();
            setGym(updated.gym);
            await refreshUser();
        } catch (error: any) {
            toast.error('Could Not Join', error?.response?.data?.message || 'Check the code and try again');
        } finally {
            setJoining(false);
        }
    };

    const handleLeaveGym = () => {
        Alert.alert(
            'Leave Gym',
            `Leave ${gym?.name}? Your check-in streak history stays, but you'll stop seeing this gym's crowd and buddies.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await settingsAPI.leaveGym();
                            setGym(null);
                            await refreshUser();
                            toast.success('Left Gym', 'Join another anytime with an access code');
                        } catch {
                            toast.error('Error', 'Could not leave gym. Try again.');
                        }
                    },
                },
            ]
        );
    };

    // Health Connect / Apple Health
    const [healthAvailable, setHealthAvailable] = useState(false);
    const [healthConnected, setHealthConnected] = useState(false);
    const [healthSyncing, setHealthSyncing] = useState(false);

    // AI Data Privacy
    const [aiConsentGranted, setAiConsentGranted] = useState(false);
    const [aiModalVisible, setAiModalVisible] = useState(false);

    useEffect(() => {
        setHealthAvailable(isHealthAvailable());
        getAIConsent().then(setAiConsentGranted);
        // Check if already connected by trying to get today's data
        if (isHealthAvailable()) {
            healthAPI.getToday().then(res => {
                if ([res?.health?.steps, res?.health?.active_calories, res?.health?.sleep_hours, res?.health?.resting_heart_rate].some(v => v != null)) setHealthConnected(true);
            }).catch(() => {});
        }
    }, []);

    const promptConnectHealth = () => {
        if (Platform.OS === 'ios' && !healthAvailable) {
            Alert.alert('Apple Health Unavailable', 'Apple Health is not supported on this device.');
            return;
        }

        Alert.alert(
            Platform.OS === 'ios' ? 'Connect Apple Health' : 'Connect Health Services',
            Platform.OS === 'ios'
                ? 'Fitzo can read your daily steps, active energy burned, resting heart rate, and sleep duration from Apple Health to display in your fitness dashboard and Health Report.\n\nFitzo only reads this data and never writes to or modifies your Apple Health data.'
                : 'Fitzo reads your daily steps, calories, heart rate, and sleep duration to display in your fitness dashboard.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: () => executeConnectHealth(),
                },
            ]
        );
    };

    const executeConnectHealth = async () => {
        if (!user) return;
        setHealthSyncing(true);
        try {
            const granted = await requestPermissions();
            if (granted) {
                await enableHealthImport(user.id);
                const summary = await getTodaysSummary();
                setHealthConnected(hasHealthData(summary));
                if (hasHealthData(summary)) {
                    await healthAPI.sync(healthSyncPayload(summary));
                    toast.success('Connected!', 'Available health data imported');
                } else {
                    toast.info('Health Access Requested', 'You can update sharing categories in the Apple Health app.');
                }
            } else {
                toast.info('Health Access', 'Health sync was not connected.');
            }
        } catch {
            toast.error('Error', 'Could not connect to health services');
        } finally {
            setHealthSyncing(false);
        }
    };

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

    // Apple 5.1.1(v) and Play policy both require in-app account deletion for
    // any app that offers account creation. Two steps on purpose: the first
    // alert explains what is lost, the second is the point of no return.
    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This permanently deletes your account and everything in it — workouts, nutrition logs, measurements, streaks and gym membership.\n\nThis cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Are you absolutely sure?',
                            `${user?.email || 'This account'} and all of its data will be erased immediately.`,
                            [
                                { text: 'Keep My Account', style: 'cancel' },
                                {
                                    text: 'Delete Forever',
                                    style: 'destructive',
                                    onPress: async () => {
                                        setDeleting(true);
                                        try {
                                            await settingsAPI.deleteAccount();
                                            await logout();
                                            router.replace('/login' as any);
                                        } catch (e: any) {
                                            setDeleting(false);
                                            toast.error(
                                                'Could not delete account',
                                                e?.response?.data?.message ||
                                                    'Something went wrong. Please try again, or email contact@fitzoapp.in.'
                                            );
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
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

                {/* Gym Section */}
                <Text style={styles.sectionTitle}>My Gym</Text>
                <GlassCard style={styles.card}>
                    {gymLoading ? (
                        <View style={styles.row}>
                            <ActivityIndicator size="small" color={colors.text.primary} />
                        </View>
                    ) : gym ? (
                        <>
                            <View style={styles.row}>
                                <View style={styles.rowLeft}>
                                    <MaterialIcons name="fitness-center" size={24} color={colors.crowd.low} />
                                    <View>
                                        <Text style={styles.rowLabel}>{gym.name}</Text>
                                        <Text style={styles.rowSub}>
                                            {gym.member_count} member{gym.member_count === 1 ? '' : 's'} · Code {gym.access_code}
                                        </Text>
                                    </View>
                                </View>
                                <MaterialIcons name="check-circle" size={22} color={colors.crowd.low} />
                            </View>
                            <View style={styles.divider} />
                            <TouchableOpacity style={styles.row} onPress={handleLeaveGym}>
                                <View style={styles.rowLeft}>
                                    <MaterialIcons name="exit-to-app" size={24} color={colors.text.secondary} />
                                    <Text style={styles.rowLabel}>Leave Gym</Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.row} onPress={() => setShowJoinInput(!showJoinInput)}>
                                <View style={styles.rowLeft}>
                                    <MaterialIcons name="add-business" size={24} color={colors.text.secondary} />
                                    <View>
                                        <Text style={styles.rowLabel}>Join a Gym</Text>
                                        <Text style={styles.rowSub}>Enter the access code from your gym's front desk</Text>
                                    </View>
                                </View>
                                <MaterialIcons
                                    name={showJoinInput ? 'expand-less' : 'expand-more'}
                                    size={24}
                                    color={colors.text.muted}
                                />
                            </TouchableOpacity>
                            {showJoinInput && (
                                <View style={styles.joinForm}>
                                    <TextInput
                                        style={styles.codeInput}
                                        value={gymCode}
                                        onChangeText={(t) => setGymCode(t.toUpperCase())}
                                        placeholder="e.g. FITZO-A1B2C3D4"
                                        placeholderTextColor={colors.text.muted}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        editable={!joining}
                                        onSubmitEditing={handleJoinGym}
                                        returnKeyType="go"
                                        accessibilityLabel="Gym access code"
                                    />
                                    <TouchableOpacity
                                        style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
                                        onPress={handleJoinGym}
                                        disabled={joining}
                                    >
                                        {joining ? (
                                            <ActivityIndicator size="small" color={colors.background} />
                                        ) : (
                                            <Text style={styles.joinBtnText}>JOIN</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </GlassCard>

                {/* Privacy & Sharing */}
                <Text style={styles.sectionTitle}>Privacy & Sharing</Text>
                <GlassCard style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="people" size={24} color={colors.text.secondary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabel}>Share with Gym Buddies</Text>
                                <Text style={styles.rowSub}>
                                    {shareLogs
                                        ? 'Buddies can see your workouts & meals'
                                        : 'Your logs are private to buddies'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={shareLogs}
                            onValueChange={handleShareLogsToggle}
                            trackColor={{ false: '#2A2A2A', true: colors.primary }}
                            thumbColor={Platform.OS === 'ios' ? undefined : (shareLogs ? colors.text.dark : colors.text.muted)}
                            ios_backgroundColor="#2A2A2A"
                        />
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
                            onValueChange={handleNotificationsToggle}
                            trackColor={{ false: '#2A2A2A', true: colors.primary }}
                            thumbColor={Platform.OS === 'ios' ? undefined : (notifications ? colors.text.dark : colors.text.muted)}
                            ios_backgroundColor="#2A2A2A"
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="vibration" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>Haptic Feedback</Text>
                        </View>
                        <Switch
                            value={hapticsOn}
                            onValueChange={toggleHaptics}
                            trackColor={{ false: '#2A2A2A', true: colors.primary }}
                            thumbColor={Platform.OS === 'ios' ? undefined : (hapticsOn ? colors.text.dark : colors.text.muted)}
                            ios_backgroundColor="#2A2A2A"
                        />
                    </View>
                    <View style={styles.divider} />
                    <TouchableOpacity
                        style={styles.row}
                        onPress={toggleUnits}
                    >
                        <View style={styles.rowLeft}>
                            <MaterialIcons name="straighten" size={24} color={colors.text.secondary} />
                            <Text style={styles.rowLabel}>Units</Text>
                        </View>
                        <Text style={styles.valueText}>{units === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lbs/ft)'}</Text>
                    </TouchableOpacity>
                </GlassCard>

                {/* Health Section */}
                <Text style={styles.sectionTitle}>Health & Fitness Data</Text>
                <GlassCard style={styles.card}>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={healthConnected ? undefined : promptConnectHealth}
                        disabled={healthSyncing || (Platform.OS === 'ios' && !healthAvailable)}
                        activeOpacity={healthConnected || (Platform.OS === 'ios' && !healthAvailable) ? 1 : 0.7}
                    >
                        <View style={styles.rowLeft}>
                            <MaterialIcons
                                name="favorite"
                                size={24}
                                color={healthConnected ? colors.accent.rose : colors.text.secondary}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabel}>
                                    {Platform.OS === 'ios' ? 'Apple Health (HealthKit)' : 'Health Connect'}
                                </Text>
                                <Text style={styles.rowSub}>
                                    {Platform.OS === 'ios' && !healthAvailable
                                        ? 'Apple Health is not supported on this device'
                                        : healthConnected
                                        ? 'Connected • Syncing steps, calories & sleep'
                                        : 'Tap to connect Apple Health to Fitzo'}
                                </Text>
                            </View>
                        </View>
                        {healthSyncing ? (
                            <ActivityIndicator size="small" color={colors.text.primary} />
                        ) : healthConnected ? (
                            <MaterialIcons name="check-circle" size={22} color={colors.success} />
                        ) : Platform.OS === 'ios' && !healthAvailable ? null : (
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        )}
                    </TouchableOpacity>
                    {healthConnected && (
                        <>
                            <View style={styles.divider} />
                            <TouchableOpacity
                                style={styles.row}
                                onPress={async () => {
                                    setHealthSyncing(true);
                                    try {
                                        const summary = await getTodaysSummary();
                                        setHealthConnected(hasHealthData(summary));
                                        await healthAPI.sync(healthSyncPayload(summary));
                                        toast.success('Synced!', 'Health data updated from Apple Health');
                                    } catch {
                                        toast.error('Sync Failed', 'Could not sync health data');
                                    } finally {
                                        setHealthSyncing(false);
                                    }
                                }}
                                disabled={healthSyncing}
                            >
                                <View style={styles.rowLeft}>
                                    <MaterialIcons name="sync" size={24} color={colors.text.secondary} />
                                    <Text style={styles.rowLabel}>Sync Apple Health Now</Text>
                                </View>
                                {healthSyncing && <ActivityIndicator size="small" color={colors.text.primary} />}
                            </TouchableOpacity>
                        </>
                    )}
                </GlassCard>
                <Text style={styles.healthExplanationText}>
                    Fitzo integrates with Apple Health (HealthKit) to sync daily steps, active calories burned, resting heart rate, and sleep duration.
                </Text>

                {/* AI Features & Privacy */}
                <Text style={styles.sectionTitle}>AI Features & Privacy</Text>
                <GlassCard style={styles.card}>
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => setAiModalVisible(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.rowLeft}>
                            <MaterialIcons
                                name="auto-awesome"
                                size={24}
                                color={aiConsentGranted ? colors.primary : colors.text.secondary}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowLabel}>AI Data Sharing & Privacy</Text>
                                <Text style={styles.rowSub}>
                                    {aiConsentGranted
                                        ? 'Enabled • Google Gemini API (Private & Encrypted)'
                                        : 'Disabled • Tap to review AI privacy & data sharing'}
                                </Text>
                            </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                    </TouchableOpacity>
                </GlassCard>
                <Text style={styles.healthExplanationText}>
                    Fitzo uses Google Cloud (Google Gemini AI API) for personalized coaching, photo meal scanning, and voice logging. Data is encrypted, never sold, and never used to train models.
                </Text>

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

                <Text style={styles.sectionTitle}>Account</Text>
                <GlassCard style={styles.card}>
                    <TouchableOpacity
                        style={styles.rowSignOut}
                        onPress={handleDeleteAccount}
                        disabled={deleting}
                        accessibilityRole="button"
                        accessibilityLabel="Delete account permanently"
                    >
                        {deleting ? (
                            <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                            <MaterialIcons name="delete-forever" size={24} color={colors.error} />
                        )}
                        <Text style={styles.signOutText}>
                            {deleting ? 'Deleting…' : 'Delete Account'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.deleteHint}>
                        Permanently erases your account and all of its data.
                    </Text>
                </GlassCard>

                <Text style={styles.versionText}>Fitzo v{version}</Text>
                <View style={{ height: 40 }} />
            </ScrollView>

            <AIConsentModal
                visible={aiModalVisible}
                featureTitle="AI Data Sharing"
                onAccept={() => {
                    setAiConsentGranted(true);
                    setAiModalVisible(false);
                    toast.success('AI Features Enabled', 'Your AI preferences have been updated.');
                }}
                onDecline={() => {
                    setAiConsentGranted(false);
                    setAiModalVisible(false);
                    toast.info('AI Features Disabled', 'AI features will remain off.');
                }}
            />
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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    rowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginRight: spacing.md,
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
    joinForm: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    codeInput: {
        flex: 1,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text.primary,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 1,
        minHeight: 44,
    },
    joinBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 44,
        minWidth: 72,
    },
    joinBtnDisabled: {
        opacity: 0.6,
    },
    joinBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
        letterSpacing: 1,
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
    deleteHint: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        marginTop: -spacing.sm,
    },
    healthExplanationText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
        lineHeight: 16,
    },
    versionText: {
        textAlign: 'center',
        color: colors.text.subtle,
        fontSize: typography.sizes.xs,
        marginTop: spacing.xl,
        fontFamily: typography.fontFamily.regular,
    },
});
