import type { ComponentType } from 'react';
import type { ThemeId } from '../../../utils/shareMoment';
import type { SharePayload } from '../SharePayload';
import Receipt from './Receipt';
import Spec from './Spec';
import Scoreboard from './Scoreboard';
import Anatomy from './Anatomy';
import Chalk from './Chalk';

export interface ShareTheme {
    id: ThemeId;
    label: string;
    /** True when the theme renders a single figure and cannot show a list. */
    singleSelectOnly?: boolean;
    Component: ComponentType<{ payload: SharePayload }>;
}

/**
 * All five themes are registered as of Task 6. Widened from
 * `Partial<Record<ThemeId, ShareTheme>>` to `Record<ThemeId, ShareTheme>` —
 * every ThemeId now has an entry, so the compiler enforces that a future
 * ThemeId addition must be registered here too, instead of that gap being
 * silently legal the way Partial allowed it to be.
 */
export const THEMES: Record<ThemeId, ShareTheme> = {
    receipt:    { id: 'receipt',    label: 'Receipt',    Component: Receipt },
    spec:       { id: 'spec',       label: 'Spec',       Component: Spec },
    // SCOREBOARD renders a single numeral at full frame — there is nothing
    // sensible to draw for a second selection, so the composer (Task 7)
    // must restrict it to one selected item at a time.
    scoreboard: { id: 'scoreboard', label: 'Scoreboard', Component: Scoreboard, singleSelectOnly: true },
    anatomy:    { id: 'anatomy',    label: 'Anatomy',    Component: Anatomy },
    chalk:      { id: 'chalk',      label: 'Chalk',      Component: Chalk },
};

export const THEME_ORDER: ThemeId[] = ['receipt', 'spec', 'scoreboard', 'anatomy', 'chalk'];
