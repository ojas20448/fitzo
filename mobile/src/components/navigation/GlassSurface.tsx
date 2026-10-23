import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveGlassMode } from '../../navigation/glassPolicy';
import { colors } from '../../styles/theme';

export function GlassSurface({ reduceTransparency }: { reduceTransparency: boolean }) {
    let glass: typeof import('expo-glass-effect') | null = null;
    // Lazy loads also allow installed binaries without these native modules to fall back.
    if (Platform.OS === 'ios' && !reduceTransparency && requireOptionalNativeModule('ExpoGlassEffect')) {
        try {
            // Deliberately lazy: a static native import can fail in older installed clients.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const candidate: typeof import('expo-glass-effect') = require('expo-glass-effect');
            if (candidate.isLiquidGlassAvailable() && candidate.isGlassEffectAPIAvailable()) glass = candidate;
        } catch { /* Unsupported native material: use regular blur/tint. */ }
    }
    const mode = resolveGlassMode({ platform: Platform.OS, nativeAvailable: !!glass, reduceTransparency });
    if (mode === 'native' && glass) {
        const NativeGlass = glass.GlassView;
        return <NativeGlass pointerEvents="none" style={styles.native} glassEffectStyle="regular" colorScheme="dark" tintColor="rgba(18,18,18,0.04)" />;
    }
    if (mode === 'blur' && (Platform.OS === 'web' || requireOptionalNativeModule('ExpoBlurView'))) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { BlurView }: typeof import('expo-blur') = require('expo-blur');
        return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <BlurView tint="dark" intensity={52} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.tint]} />
            <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.015)', 'rgba(0,0,0,0.12)']} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>;
    }
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, reduceTransparency ? styles.opaque : styles.fallback]}>
        {!reduceTransparency && <LinearGradient colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.015)', 'rgba(255,255,255,0.04)']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
    </View>;
}
const styles = StyleSheet.create({
    native: { ...StyleSheet.absoluteFillObject, borderRadius: 9999 },
    tint: { backgroundColor: 'rgba(18,18,18,0.16)' },
    fallback: { backgroundColor: 'rgba(24,25,28,0.94)' },
    opaque: { backgroundColor: colors.surfaceLight },
});
