import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../styles/theme';
import { MaterialIcons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextData {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<{ type: ToastType; title: string; message?: string } | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));

    const showToast = useCallback((type: ToastType, title: string, message?: string) => {
        setToast({ type, title, message });

        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(3000),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setToast(null));
    }, [fadeAnim]);

    const success = (title: string, message?: string) => showToast('success', title, message);
    const error = (title: string, message?: string) => showToast('error', title, message);
    const info = (title: string, message?: string) => showToast('info', title, message);

    const getIcon = () => {
        switch (toast?.type) {
            case 'success': return 'check-circle';
            case 'error': return 'error';
            default: return 'info';
        }
    };

    const getColor = () => {
        switch (toast?.type) {
            case 'success': return colors.primary;
            case 'error': return '#FF6B6B';
            default: return '#4ECDC4';
        }
    };

    return (
        <ToastContext.Provider value={{ success, error, info }}>
            {children}
            {toast && (
                <Animated.View
                    style={[
                        styles.toastContainer,
                        { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }
                    ]}
                >
                    <View style={[styles.toastLine, { backgroundColor: getColor() }]} />
                    <View style={styles.toastContent}>
                        <MaterialIcons name={getIcon()} size={24} color={getColor()} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toastTitle}>{toast.title}</Text>
                            {toast.message && <Text style={styles.toastMessage}>{toast.message}</Text>}
                        </View>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        ...shadows.glow,
        overflow: 'hidden',
        flexDirection: 'row',
        zIndex: 9999,
    },
    toastLine: {
        width: 6,
        height: '100%',
    },
    toastContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    toastTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    toastMessage: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginTop: 2,
    },
});
