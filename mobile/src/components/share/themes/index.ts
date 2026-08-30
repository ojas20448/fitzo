import type { ComponentType } from 'react';
import type { ThemeId } from '../../../utils/shareMoment';
import type { SharePayload } from '../SharePayload';
import Receipt from './Receipt';
import Spec from './Spec';

export interface ShareTheme {
    id: ThemeId;
    label: string;
    /** True when the theme renders a single figure and cannot show a list. */
    singleSelectOnly?: boolean;
    Component: ComponentType<{ payload: SharePayload }>;
}

/**
 * Partial until Task 6 registers the remaining three. Typed as Partial so the
 * gap is visible to the compiler rather than hidden behind a cast.
 */
export const THEMES: Partial<Record<ThemeId, ShareTheme>> = {
    receipt: { id: 'receipt', label: 'Receipt', Component: Receipt },
    spec:    { id: 'spec',    label: 'Spec',    Component: Spec },
};

export const THEME_ORDER: ThemeId[] = ['receipt', 'spec', 'scoreboard', 'anatomy', 'chalk'];
