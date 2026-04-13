import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, borderRadius } from '../../styles/theme';

const PICKER_ITEM_HEIGHT = 48;
const PICKER_VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ITEMS;

interface ScrollWheelPickerProps {
    values: number[];
    selectedValue: number;
    onValueChange: (v: number) => void;
    formatLabel?: (v: number) => string;
}

const ScrollWheelPicker: React.FC<ScrollWheelPickerProps> = ({
    values,
    selectedValue,
    onValueChange,
    formatLabel,
}) => {
    const scrollRef = useRef<ScrollView>(null);
    const [internalIndex, setInternalIndex] = useState(() => {
        const idx = values.indexOf(selectedValue);
        return idx >= 0 ? idx : 0;
    });

    useEffect(() => {
        const idx = values.indexOf(selectedValue);
        if (idx >= 0) {
            scrollRef.current?.scrollTo({
                y: idx * PICKER_ITEM_HEIGHT,
                animated: false,
            });
            setInternalIndex(idx);
        }
    }, [selectedValue]);

    const handleMomentumEnd = useCallback(
        (e: any) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            let idx = Math.round(offsetY / PICKER_ITEM_HEIGHT);
            idx = Math.max(0, Math.min(idx, values.length - 1));
            setInternalIndex(idx);
            onValueChange(values[idx]);
            Haptics.selectionAsync();
        },
        [values, onValueChange],
    );

    // Padding so first/last items can be centred
    const padCount = Math.floor(PICKER_VISIBLE_ITEMS / 2);

    return (
        <View style={styles.wheelContainer}>
            {/* Selection highlight band */}
            <View style={styles.selectionBand} pointerEvents="none" />

            <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={PICKER_ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumEnd}
                contentContainerStyle={{
                    paddingVertical: padCount * PICKER_ITEM_HEIGHT,
                }}
                style={{ height: PICKER_HEIGHT }}
            >
                {values.map((v, i) => {
                    const isSelected = i === internalIndex;
                    return (
                        <View key={i} style={styles.wheelItem}>
                            <Text
                                style={[
                                    styles.wheelText,
                                    isSelected && styles.wheelTextSelected,
                                ]}
                            >
                                {formatLabel ? formatLabel(v) : v.toString()}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    wheelContainer: {
        height: PICKER_HEIGHT,
        overflow: 'hidden',
        position: 'relative',
    },
    selectionBand: {
        position: 'absolute',
        top: PICKER_ITEM_HEIGHT * Math.floor(PICKER_VISIBLE_ITEMS / 2),
        left: 0,
        right: 0,
        height: PICKER_ITEM_HEIGHT,
        backgroundColor: colors.glass.surfaceHover,
        borderRadius: borderRadius.sm,
        zIndex: 0,
    },
    wheelItem: {
        height: PICKER_ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    wheelText: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    wheelTextSelected: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
});

export { PICKER_ITEM_HEIGHT, PICKER_VISIBLE_ITEMS, PICKER_HEIGHT };
export default ScrollWheelPicker;
