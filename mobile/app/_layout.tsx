import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {
    useFonts,
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
import { notificationsAPI } from '../src/services/api';
import { colors } from '../src/styles/theme';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
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
            lightColor: '#FF6B35',
        });
    }

    return tokenData.data;
}

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Component that handles push notification registration once user is authenticated
function PushNotificationHandler() {
    const { isAuthenticated } = useAuth();
    const notificationListener = useRef<Notifications.EventSubscription>();
    const responseListener = useRef<Notifications.EventSubscription>();

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

        // Listen for user tapping on a notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            console.log('Notification tapped, data:', data);
            // Navigation based on notification type can be handled here
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, [isAuthenticated]);

    return null;
}

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Lexend_300Light,
        Lexend_400Regular,
        Lexend_500Medium,
        Lexend_600SemiBold,
        Lexend_700Bold,
        Lexend_800ExtraBold,
    });

    const [appReady, setAppReady] = useState(false);

    useEffect(() => {
        if (fontsLoaded) {
            setAppReady(true);
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!appReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <NutritionProvider>
                        <ToastProvider>
                            <PushNotificationHandler />
                            <StatusBar style="light" />
                            <Stack
                                screenOptions={{
                                    headerShown: false,
                                    contentStyle: { backgroundColor: colors.background },
                                    animation: 'fade',
                                }}
                            >
                                {/* Root level screens */}
                                <Stack.Screen name="index" />
                                <Stack.Screen name="login" />
                                <Stack.Screen name="register" />
                                <Stack.Screen name="forgot-password" />
                                <Stack.Screen name="(tabs)" />
                                <Stack.Screen name="onboarding" />
                                <Stack.Screen name="manager-dashboard" />
                                <Stack.Screen name="trainer-home" />
                                <Stack.Screen name="qr-checkin" />
                                <Stack.Screen name="workout-intent" />
                                <Stack.Screen name="workout-videos" />
                                <Stack.Screen name="food-scanner" />
                                <Stack.Screen name="classes" />
                                <Stack.Screen name="ai-coach" />
                                <Stack.Screen name="exercise-library" />
                                {/* Nested route groups - use full path */}
                                <Stack.Screen name="trainer" />
                                <Stack.Screen name="manager/people" />
                                <Stack.Screen name="member/curated-workouts" />
                                <Stack.Screen name="member/active-workout" />
                                <Stack.Screen name="member/add-buddy" />
                                <Stack.Screen name="member/fitness-profile" />
                                <Stack.Screen name="member/measurements" />
                                <Stack.Screen name="member/published-splits" />
                                <Stack.Screen name="member/recipe-builder" />
                                <Stack.Screen name="member/recipes" />
                                <Stack.Screen name="member/settings" />
                                <Stack.Screen name="member/workout-recap" />
                                <Stack.Screen name="member-detail/[id]" />
                                <Stack.Screen name="lesson/[id]" />
                                <Stack.Screen name="log/calories" />
                                <Stack.Screen name="log/workout" />
                            </Stack>
                        </ToastProvider>
                    </NutritionProvider>
                </AuthProvider>
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
