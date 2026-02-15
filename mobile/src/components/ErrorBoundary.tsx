import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { router } from 'expo-router';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
        router.replace('/');
    };

    render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <MaterialIcons name="error-outline" size={64} color={colors.error} />
                        <Text style={styles.title}>Oops! Something went wrong.</Text>
                        <Text style={styles.message}>
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </Text>

                        <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
                            <Text style={styles.buttonText}>Return Home</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    content: {
        alignItems: 'center',
        gap: spacing.lg,
    },
    title: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
    },
    message: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    button: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing['2xl'],
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    buttonText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.base,
    },
});
