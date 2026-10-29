import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    PanResponder,
    AccessibilityInfo,
    Platform,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadow } from '../styles/theme';

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
                color: colors.success,
            };
        case 'error':
            return {
                icon: 'error' as const,
                color: colors.error,
            };
        case 'warning':
            return {
                icon: 'warning' as const,
                color: colors.warning,
            };
        case 'info':
        default:
            return {
                icon: 'info' as const,
                color: colors.primary,
            };
    }
};

const ToastItem: React.FC<{
    toast: Toast;
    onHide: () => void;
}> = ({ toast, onHide }) => {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const reducedMotion = useReducedMotion();
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dismissing = useRef(false);
    const hide = useRef(onHide);
    hide.current = onHide;
    const duration = useRef(toast.duration ?? (toast.action ? 6000 : 4000));
    const config = getToastConfig(toast.type);

    const clearTimer = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    }, []);

    const animateOut = useCallback((direction = 0) => {
        if (dismissing.current) return;
        dismissing.current = true;
        clearTimer();
        Animated.parallel([
            Animated.timing(direction ? translateX : translateY, {
                toValue: direction ? direction * 500 : -100,
                duration: reducedMotion ? 0 : 160,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: reducedMotion ? 0 : 160,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => { if (finished) hide.current(); });
    }, [clearTimer, opacity, reducedMotion, translateX, translateY]);

    const scheduleHide = useCallback(() => {
        clearTimer();
        if (!dismissing.current) timer.current = setTimeout(() => animateOut(), duration.current);
    }, [animateOut, clearTimer]);

    useEffect(() => {
        let active = true;
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: 0,
                duration: reducedMotion ? 0 : 180,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: reducedMotion ? 0 : 180,
                useNativeDriver: true,
            }),
        ]).start();
        scheduleHide();
        if (Platform.OS === 'android') {
            void AccessibilityInfo.getRecommendedTimeoutMillis(duration.current).then(timeout => {
                if (active) { duration.current = timeout; scheduleHide(); }
            }).catch(() => {});
        }
        return () => {
            active = false;
            clearTimer();
            translateX.stopAnimation(); translateY.stopAnimation(); opacity.stopAnimation();
        };
    }, [clearTimer, opacity, reducedMotion, scheduleHide, translateX, translateY]);

    const resetPosition = () => {
        Animated.parallel([translateX, translateY].map(value => reducedMotion
            ? Animated.timing(value, { toValue: 0, useNativeDriver: true, duration: 0 })
            : Animated.spring(value, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }))).start();
        scheduleHide();
    };
    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 10 || dy < -10,
        onPanResponderGrant: clearTimer,
        onPanResponderMove: (_, { dx, dy }) => { translateX.setValue(dx); translateY.setValue(Math.min(0, dy)); },
        onPanResponderRelease: (_, { dx, dy, vx, vy }) => {
            if (Math.abs(dx) > 60 || (Math.abs(dx) > 15 && Math.abs(vx) > 0.6)) animateOut(Math.sign(dx));
            else if (dy < -40 || (dy < -10 && vy < -0.6)) animateOut();
            else resetPosition();
        },
        onPanResponderTerminate: resetPosition,
    });

    return (
        <Animated.View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityActions={[{ name: 'dismiss', label: 'Dismiss notification' }]}
            onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'dismiss') animateOut(); }}
            onTouchStart={clearTimer}
            onTouchEnd={scheduleHide}
            onTouchCancel={scheduleHide}
            {...panResponder.panHandlers}
            style={[
                styles.toast,
                {
                    transform: [{ translateX }, { translateY }],
                    opacity,
                },
            ]}
        >
            <View style={styles.iconContainer}>
                <MaterialIcons name={config.icon} size={20} color={config.color} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{toast.title}</Text>
                {toast.message && <Text style={styles.message}>{toast.message}</Text>}
            </View>
            {toast.action ? (
                <TouchableOpacity
                    style={styles.actionButton}
                    accessibilityRole="button"
                    onPress={() => {
                        toast.action?.onPress();
                        animateOut();
                    }}
                    accessibilityLabel={toast.action.label}
                >
                    <MaterialIcons name="arrow-forward" size={20} color={colors.text.primary} />
                </TouchableOpacity>
            ) : <TouchableOpacity
                style={styles.closeButton}
                onPress={() => animateOut()}
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
            >
                <MaterialIcons name="close" size={18} color={colors.text.muted} />
            </TouchableOpacity>}
        </Animated.View>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const insets = useSafeAreaInsets();
    const nextId = useRef(0);

    const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = String(++nextId.current);
        setToasts(prev => prev.some(current => current.type === toast.type && current.title === toast.title && current.message === toast.message
            && !current.action && !toast.action) ? prev : [{ ...toast, id }]);
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
        width: '100%',
        maxWidth: 480,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingLeft: spacing.md,
        paddingVertical: 6,
        paddingRight: spacing.xs,
        marginBottom: spacing.sm,
        ...shadow({ y: 4, blur: 8, color: '#000000', opacity: 0.3 }),
        zIndex: 8, // was implied by elevation: 8 on Android
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    content: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 2,
    },
    title: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        lineHeight: 20,
        color: colors.text.primary,
    },
    message: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginTop: 2,
        lineHeight: 18,
    },
    actionButton: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surfaceHover,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    closeButton: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ToastProvider;
