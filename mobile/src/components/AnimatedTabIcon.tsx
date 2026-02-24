import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    interpolate,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

interface AnimatedTabIconProps {
    focused: boolean;
    color: string;
    name: keyof typeof MaterialIcons.glyphMap;
    size?: number;
}

export const AnimatedTabIcon = ({ focused, color, name, size = 24 }: AnimatedTabIconProps) => {
    const scale = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(focused ? 1 : 0, {
            damping: 12,
            stiffness: 150,
        });
    }, [focused]);

    const iconStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: interpolate(scale.value, [0, 1], [1, 1.2]) },
            ],
        };
    });

    return (
        <View style={styles.container}>
            <Animated.View style={[iconStyle]}>
                <MaterialIcons name={name} size={size} color={color} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 48, // Touch target
        width: 48,
    },
});
