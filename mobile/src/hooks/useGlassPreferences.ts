import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useGlassPreferences() {
    const [reduceMotion, setReduceMotion] = useState(true);
    const [reduceTransparency, setReduceTransparency] = useState(true);
    useEffect(() => {
        let active = true;
        let motionChanged = false;
        let transparencyChanged = false;
        const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
            motionChanged = true;
            if (active) setReduceMotion(value);
        });
        const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => {
            transparencyChanged = true;
            if (active) setReduceTransparency(value);
        });
        void AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (active && !motionChanged) setReduceMotion(value);
        }).catch(() => {});
        const preference = Platform.OS === 'ios' ? AccessibilityInfo.isReduceTransparencyEnabled() : Promise.resolve(false);
        void preference.then(value => {
            if (active && !transparencyChanged) setReduceTransparency(value);
        }).catch(() => {});
        return () => { active = false; motion.remove(); transparency.remove(); };
    }, []);
    return { reduceMotion, reduceTransparency };
}
