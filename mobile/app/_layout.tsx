import { useEffect, useState, useRef } from 'react';
import { Stack, router as expoRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import {
    Lexend_300Light,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
} from '@expo-google-fonts/lexend';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ToastProvider } from '../src/components/Toast';
import { NutritionProvider } from '../src/context/NutritionContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { BrandIntro } from '../src/components/BrandIntro';
import OfflineBanner from '../src/components/OfflineBanner';
import { notificationsAPI, wakeBackend } from '../src/services/api';
import { loadHapticsSetting } from '../src/utils/haptics';
import { colors } from '../src/styles/theme';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    } as any),
});

// Register for push notifications and send token to backend
async function registerForPushNotificationsAsync(): Promise<string | undefined> {
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return undefined;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return undefined;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
    });

    // Set up Android notification channel
    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FFFFFF',
        });
    }

    return tokenData.data;
}

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Map a push payload to the screen it is about. The backend sends either an
// explicit `screen` field (friends.js, workout-sessions.js) or a `type` from
// the pushNotifications templates (buildMessage merges it into data);
// anything unrecognized lands on Home rather than being dropped.
function routeFromNotification(data: Record<string, unknown>) {
    const screen = typeof data.screen === 'string' ? data.screen : undefined;
    const type = typeof data.type === 'string' ? data.type : undefined;

    switch (screen ?? type) {
        case 'friends':
        case 'friend_activity':
            expoRouter.push('/(tabs)/buddies');
            break;
        case 'workout_reminder':
            expoRouter.push('/log/workout');
            break;
        case 'class_reminder':
            expoRouter.push('/classes');
            break;
        case 'achievement':
            expoRouter.push('/(tabs)/stats');
            break;
        case 'home':
        default:
            expoRouter.push('/(tabs)');
    }
}

// Component that handles push notification registration once user is authenticated
function PushNotificationHandler() {
    const { isAuthenticated } = useAuth();
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        // Register for push notifications and send token to backend
        registerForPushNotificationsAsync()
            .then(async (token) => {
                if (token) {
                    try {
                        await notificationsAPI.registerPushToken(token, Platform.OS);
                    } catch (error) {
                        console.log('Failed to register push token with backend:', error);
                    }
                }
            })
            .catch((error) => {
                console.log('Push notification registration error:', error);
            });

        // Listen for incoming notifications while app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log('Notification received:', notification.request.content.title);
        });

        // Listen for user tapping on a notification and route to the screen it
        // is about. expo-notifications replays the launch notification after a
        // cold start, so this also covers taps that opened the app from quit.
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
            routeFromNotification(data);
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [isAuthenticated]);

    return null;
}

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        Lexend_300Light,
        Lexend_400Regular,
        Lexend_500Medium,
        Lexend_600SemiBold,
        Lexend_700Bold,
        Lexend_800ExtraBold,
        'VT323_400Regular': require('../assets/fonts/VT323-Regular.ttf'),
    });

    const [appReady, setAppReady] = useState(false);

    useEffect(() => {
        // Fire backend wake-up immediately — runs in parallel with font loading
        // so the server is warm by the time the user reaches the home screen
        wakeBackend();
        // Restore the haptics preference before the first tab press
        loadHapticsSetting();
    }, []);

    useEffect(() => {
        // Fall through on font errors too — otherwise a failed font fetch leaves
        // the app stuck on the native splash forever. System fonts are a far
        // better outcome than a dead launch.
        if (!fontsLoaded && !fontError) return;

        setAppReady(true);

        // BrandIntro lifts the splash itself, the moment it has measured its
        // lockup and is ready to play its first frame. Both the native splash
        // and the intro's opening frame are the F on black, so the handoff has
        // no visible seam. This timer is only the safety net for the case where
        // the intro never gets that far.
        const failsafe = setTimeout(() => {
            SplashScreen.hideAsync().catch(() => {});
        }, 1500);
        return () => clearTimeout(failsafe);
    }, [fontsLoaded, fontError]);

    if (!appReady) {
        // Deliberately empty: the native splash is still covering this. Anything
        // drawn here (a spinner, say) can only ever appear as a flash of chrome
        // between the splash lifting and the intro's first frame.
        return <View style={styles.loadingContainer} />;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ErrorBoundary>
                <AuthProvider>
                    <NutritionProvider>
                        <ToastProvider>
                            <PushNotificationHandler />
                            <OfflineBanner />
                            <StatusBar style="light" />
                            <Stack
                                screenOptions={{
                                    headerShown: false,
                                    contentStyle: { backgroundColor: colors.background },
                                    animation: 'slide_from_right', // Default premium slide-in
                                }}
                            >
                                {/* Root level screens */}
                                <Stack.Screen name="index" />
                                <Stack.Screen name="login" options={{ animation: 'fade' }} />
                                <Stack.Screen name="register" options={{ animation: 'fade' }} />
                                <Stack.Screen name="forgot-password" />
                                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                                <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
                                <Stack.Screen name="manager-dashboard" options={{ animation: 'fade' }} />
                                <Stack.Screen name="qr-checkin" options={{ animation: 'slide_from_bottom' }} />
                                <Stack.Screen name="workout-intent" />
                                <Stack.Screen name="food-scanner" options={{ animation: 'slide_from_bottom' }} />
                                <Stack.Screen name="classes" />
                                <Stack.Screen name="ai-coach" />
                                <Stack.Screen name="exercise-library" />
                                {/* Nested route groups - use full path */}
                                <Stack.Screen name="trainer" />
                                <Stack.Screen name="manager/people" />
                                <Stack.Screen name="member/curated-workouts" />
                                <Stack.Screen name="member/add-buddy" />
                                <Stack.Screen name="member/fitness-profile" />
                                <Stack.Screen name="member/measurements" />
                                <Stack.Screen name="member/published-splits" />
                                <Stack.Screen name="member/recipe-builder" />
                                <Stack.Screen name="member/recipes" />
                                <Stack.Screen name="member/settings" />
                                <Stack.Screen name="member/workout-recap" />
                                <Stack.Screen name="member/share" />
                                <Stack.Screen name="member/nutrition-insights" />
                                <Stack.Screen name="member/health-report" />
                                <Stack.Screen name="member/user-profile" />
                                <Stack.Screen name="member/buddy-activity" />
                                <Stack.Screen name="member/squad-feed" options={{ animation: 'slide_from_right' }} />
                                <Stack.Screen name="lesson/[id]" />
                                <Stack.Screen name="log/calories" options={{ animation: 'slide_from_bottom' }} />
                                <Stack.Screen name="log/workout" options={{ animation: 'slide_from_bottom' }} />
                            </Stack>
                        </ToastProvider>
                    </NutritionProvider>
                </AuthProvider>
                </ErrorBoundary>

                {/* Sits outside ErrorBoundary and above everything else: the
                    app boots, restores auth and wakes the backend underneath
                    this curtain, so the intro costs the user no time at all. */}
                <BrandIntro />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
});
