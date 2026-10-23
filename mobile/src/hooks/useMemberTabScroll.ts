import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMemberChromeMeasurements } from '../components/navigation/MemberChromeContext';

export function useMemberTabScroll() {
    const { setCompact } = useMemberChromeMeasurements();
    const scroll = useRef({ y: 0, travel: 0, focused: false });
    useFocusEffect(useCallback(() => {
        scroll.current.travel = 0;
        scroll.current.focused = true;
        setCompact(false);
        return () => { scroll.current.focused = false; };
    }, [setCompact]));

    return useCallback(({ nativeEvent: event }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const current = scroll.current;
        if (!current.focused) return;
        // Clamp overscroll so bouncing at either edge cannot toggle the bar.
        const maxY = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
        const y = Math.min(maxY, Math.max(0, event.contentOffset.y));
        const delta = y - current.y;
        current.y = y;
        if (y <= 8) {
            current.travel = 0;
            setCompact(false);
            return;
        }
        current.travel = Math.sign(delta) === Math.sign(current.travel) ? current.travel + delta : delta;
        if (y > 48 && current.travel >= 24) setCompact(true);
        else if (current.travel <= -16) setCompact(false);
    }, [setCompact]);
}
