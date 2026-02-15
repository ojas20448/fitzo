import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
    useFonts,
    Lexend_300Light,
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
} from '@expo-google-fonts/lexend';

import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/components/Toast';
import { XPProvider } from '../src/context/XPContext';
import { NutritionProvider } from '../src/context/NutritionContext';
import { colors } from '../src/styles/theme';

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

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
                    <XPProvider>
                        <NutritionProvider>
                            <ToastProvider>
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
                    </XPProvider>
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
