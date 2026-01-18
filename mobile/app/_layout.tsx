import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
    useFonts,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
} from '@expo-google-fonts/lexend';
import { useEffect } from 'react';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/components/Toast';
import { NutritionProvider } from '../src/context/NutritionContext';
import { XPProvider } from '../src/context/XPContext';
import OfflineBanner from '../src/components/OfflineBanner';
import { colors } from '../src/styles/theme';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Lexend_400Regular,
        Lexend_500Medium,
        Lexend_600SemiBold,
        Lexend_700Bold,
        Lexend_800ExtraBold,
    });

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <OfflineBanner />
            <AuthProvider>
                <ToastProvider>
                    <XPProvider>
                        <NutritionProvider>
                            <StatusBar style="light" />
                            <Stack
                                screenOptions={{
                                    headerShown: false,
                                    contentStyle: { backgroundColor: colors.background },
                                    animation: 'slide_from_right',
                                    animationDuration: 200,
                                }}
                            >
                                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                                <Stack.Screen name="index" options={{ animation: 'fade' }} />
                                <Stack.Screen name="login" options={{ animation: 'fade' }} />
                                <Stack.Screen name="register" options={{ animation: 'fade_from_bottom' }} />

                                {/* Modals and Sheets */}
                                <Stack.Screen
                                    name="qr-checkin"
                                    options={{
                                        presentation: 'modal',
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="exercise-library"
                                    options={{
                                        presentation: 'modal',
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="workout-intent"
                                    options={{
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="food-scanner"
                                    options={{
                                        presentation: 'modal',
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="log/workout"
                                    options={{
                                        presentation: 'modal',
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                                <Stack.Screen
                                    name="log/calories"
                                    options={{
                                        presentation: 'modal',
                                        animation: 'slide_from_bottom',
                                    }}
                                />
                            </Stack>
                        </NutritionProvider>
                    </XPProvider>
                </ToastProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
