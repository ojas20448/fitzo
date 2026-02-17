import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../src/styles/theme';

export default function Index() {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.text}>Loading...</Text>
            </View>
        );
    }

    if (isAuthenticated && user) {
        if (!user.onboarding_completed) {
            return <Redirect href="/onboarding" />;
        }

        if (user.role === 'manager') {
            return <Redirect href="/manager-dashboard" />;
        } else if (user.role === 'trainer') {
            return <Redirect href="/trainer" />;
        } else {
            return <Redirect href="/(tabs)" />;
        }
    }

    return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        gap: 16,
    },
    text: {
        color: colors.text.secondary,
        fontSize: 14,
    },
});
