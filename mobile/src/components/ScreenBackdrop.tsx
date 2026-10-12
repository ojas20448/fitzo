import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../styles/theme';

/** Static, cropped training-track lines. Decoration never intercepts a tap or
 * becomes part of the screen-reader order. Keep it behind the screen content. */
export default function ScreenBackdrop() {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} aria-hidden
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width="100%" height="100%" viewBox="0 0 420 900" preserveAspectRatio="xMidYMid slice">
                <Path d="M 530 -90 L 320 120 C 240 200 250 310 330 380 L 485 520"
                    fill="none" stroke={colors.decoration.line} strokeOpacity={0.08} strokeWidth={1.2} />
                <Path d="M 560 -55 L 350 155 C 285 220 295 300 360 355 L 515 495"
                    fill="none" stroke={colors.decoration.line} strokeOpacity={0.055} strokeWidth={1.2} />
                <Path d="M -180 600 L -20 710 C 70 775 70 860 -10 950"
                    fill="none" stroke={colors.decoration.line} strokeOpacity={0.065} strokeWidth={1.2} />
                <Path d="M -150 575 L 10 685 C 120 760 120 875 20 985"
                    fill="none" stroke={colors.decoration.line} strokeOpacity={0.04} strokeWidth={1.2} />
                <Circle cx="406" cy="218" r="78" fill="none" stroke={colors.decoration.line} strokeOpacity={0.045} />
                <Circle cx="406" cy="218" r="62" fill="none" stroke={colors.decoration.line} strokeOpacity={0.035} />
            </Svg>
        </View>
    );
}
