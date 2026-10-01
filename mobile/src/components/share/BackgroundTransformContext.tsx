import React, { createContext, useContext } from 'react';
import type { StyleProp, ImageStyle } from 'react-native';

export interface BackgroundTransformContextValue {
    animatedStyle?: StyleProp<ImageStyle>;
}

export const BackgroundTransformContext = createContext<BackgroundTransformContextValue | null>(null);

export const useBackgroundTransform = () => useContext(BackgroundTransformContext);
