import React, { createContext, useContext, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMemberChromeInset } from '../../navigation/memberTabs';

const ChromeContext = createContext({ inset: 100, compact: false, setCompact: (_compact: boolean) => {}, setBarHeight: (_height: number) => {}, setBannerHeight: (_height: number) => {} });
export function MemberChromeProvider({ children }: { children: React.ReactNode }) {
    const { bottom } = useSafeAreaInsets();
    const [barHeight, setBarHeight] = useState(64);
    const [bannerHeight, setBannerHeight] = useState(0);
    const [compact, setCompact] = useState(false);
    const value = useMemo(() => ({
        inset: getMemberChromeInset({ barHeight, bottomInset: bottom, bannerHeight }), compact, setCompact, setBarHeight, setBannerHeight,
    }), [barHeight, bottom, bannerHeight, compact]);
    return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}
export const useMemberContentInset = () => useContext(ChromeContext).inset;
export const useMemberChromeMeasurements = () => useContext(ChromeContext);
