import React from 'react';
import { Text, type TextProps } from 'react-native';

/** Export typography is fixed to the canvas; accessible descriptions live in the UI. */
export function CardText(props: TextProps) {
    return <Text {...props} allowFontScaling={false} />;
}
