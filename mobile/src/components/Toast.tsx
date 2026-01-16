import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastContextType {
    showToast: (toast: Omit<Toast, 'id'>) => void;
    hideToast: (id: string) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const getToastConfig = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                icon: 'check-circle' as const,
                color: colors.crowd.low,
                haptic: Haptics.NotificationFeedbackType.Success,
            };
        case 'error':
            return {
                icon: 'error' as const,
                color: colors.error,
                haptic: Haptics.NotificationFeedbackType.Error,
            };
        case 'warning':
            return {
                icon: 'warning' as const,
                color: colors.crowd.medium,
                haptic: Haptics.NotificationFeedbackType.Warning,
            };
        case 'info':
        default:
            return {
                icon: 'info' as const,
                color: colors.primary,
                haptic: Haptics.NotificationFeedbackType.Success,
            };
    }
};

const ToastItem: React.FC<{
    toast: Toast;
    onHide: () => void;
}> = ({ toast, onHide }) => {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const config = getToastConfig(toast.type);

    useEffect(() => {
        // Animate in
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Haptic feedback
        Haptics.notificationAsync(config.haptic);

        // Auto hide
        const timer = setTimeout(() => {
            animateOut();
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, []);

    const animateOut = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => onHide());
    };

    return (
        <Animated.View
            style={[
                styles.toast,
                {
                    transform: [{ translateY }],
                    opacity,
                    borderLeftColor: config.color,
                },
            ]}
        >
            <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
                <MaterialIcons name={config.icon} size={24} color={config.color} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{toast.title}</Text>
                {toast.message && <Text style={styles.message}>{toast.message}</Text>}
            </View>
            {toast.action ? (
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        toast.action?.onPress();
                        animateOut();
                    }}
                    accessibilityLabel={toast.action.label}
                >
                    <Text style={styles.actionText}>{toast.action.label}</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={animateOut}
                    accessibilityLabel="Dismiss notification"
                >
                    <MaterialIcons name="close" size={18} color={colors.text.muted} />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const insets = useSafeAreaInsets();

    const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString();
        setToasts((prev) => [...prev, { ...toast, id }]);
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = useCallback((title: string, message?: string) => {
        showToast({ type: 'success', title, message });
    }, [showToast]);

    const error = useCallback((title: string, message?: string) => {
        showToast({ type: 'error', title, message });
    }, [showToast]);

    const warning = useCallback((title: string, message?: string) => {
        showToast({ type: 'warning', title, message });
    }, [showToast]);

    const info = useCallback((title: string, message?: string) => {
        showToast({ type: 'info', title, message });
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, success, error, warning, info }}>
            {children}
            <View style={[styles.container, { top: insets.top + 10 }]} pointerEvents="box-none">
                {toasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onHide={() => hideToast(toast.id)}
                    />
                ))}
            </View>
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    toast: {
        width: width - spacing.lg * 2,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderLeftWidth: 4,
        padding: spacing.md,
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    message: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginTop: 2,
    },
    actionButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    actionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    closeButton: {
        padding: spacing.sm,
    },
});

export default ToastProvider;
