import type { ComponentType } from 'react';
import type { ThemeId } from '../../../utils/shareMoment';
import type { SharePayload } from '../SharePayload';
import Receipt from './Receipt';
import Spec from './Spec';
import Scoreboard from './Scoreboard';
import Anatomy from './Anatomy';
import Chalk from './Chalk';

/**
 * Task 10: every theme component shares this prop shape, not just
 * `{ payload }` any more. `onBackgroundLoad` is a THEME-level prop rather
 * than something threaded through `payload.background` itself, because the
 * composer renders the same `payload` object at two call sites (hero
 * preview, hidden capture target — ShareComposerScreen.tsx:193,270-ish) and
 * needs to know when SPECIFICALLY THE CAPTURE TARGET's image has decoded
 * (RULING R30) — baking one shared callback into `payload.background` could
 * not distinguish the two. Themes that never render a background (Anatomy)
 * simply never call it; see `supportsBackground` below for why the composer
 * must not wait on a callback such a theme will never invoke.
 */
export interface ShareThemeProps {
    payload: SharePayload;
    onBackgroundLoad?: () => void;
}

export interface ShareTheme {
    id: ThemeId;
    label: string;
    /** True when the theme renders a single figure and cannot show a list. */
    singleSelectOnly?: boolean;
    /**
     * False/omitted means this theme never renders `payload.background` at
     * all (Anatomy — see Anatomy.tsx's file doc for why). The composer's
     * RULING R30 share-gate must check this before waiting on
     * `onBackgroundLoad`: a theme that never mounts CardBackground never
     * fires it, and a gate that didn't know that would disable sharing
     * forever the moment a photo was taken and Anatomy was the active theme.
     */
    supportsBackground?: boolean;
    Component: ComponentType<ShareThemeProps>;
}

/**
 * All five themes are registered as of Task 6. Widened from
 * `Partial<Record<ThemeId, ShareTheme>>` to `Record<ThemeId, ShareTheme>` —
 * every ThemeId now has an entry, so the compiler enforces that a future
 * ThemeId addition must be registered here too, instead of that gap being
 * silently legal the way Partial allowed it to be.
 */
export const THEMES: Record<ThemeId, ShareTheme> = {
    receipt:    { id: 'receipt',    label: 'Receipt',    Component: Receipt,    supportsBackground: true },
    spec:       { id: 'spec',       label: 'Spec',       Component: Spec,       supportsBackground: true },
    // SCOREBOARD renders a single numeral at full frame — there is nothing
    // sensible to draw for a second selection, so the composer (Task 7)
    // must restrict it to one selected item at a time.
    scoreboard: { id: 'scoreboard', label: 'Scoreboard', Component: Scoreboard, singleSelectOnly: true, supportsBackground: true },
    // ANATOMY deliberately does NOT opt in — see Anatomy.tsx's file doc.
    anatomy:    { id: 'anatomy',    label: 'Anatomy',    Component: Anatomy },
    chalk:      { id: 'chalk',      label: 'Chalk',      Component: Chalk,      supportsBackground: true },
};

export const THEME_ORDER: ThemeId[] = ['receipt', 'spec', 'scoreboard', 'anatomy', 'chalk'];
