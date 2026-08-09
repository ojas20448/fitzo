/**
 * Meal builder arithmetic — pure, no React, no imports.
 *
 * WHY THIS IS SEPARATE
 * The thali presets used to log a fixed item list on one tap, which assumes
 * every dal-chawal is the same dal-chawal. It isn't — sometimes it's two rotis,
 * sometimes none, sometimes no rice. So a preset now seeds an editable list and
 * the user adjusts before anything is written. That makes quantity scaling a
 * real calculation rather than a display detail, and calculations belong
 * somewhere they can be tested without mounting a screen.
 */

export interface PresetItem {
    meal_name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}

/** A preset item plus the quantity the user has chosen for it. */
export interface BuilderEntry extends PresetItem {
    /** Stable key — preset items have no ids, and names can repeat. */
    key: string;
    quantity: number;
}

export interface MealTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

/**
 * Half-serving granularity. Finer than this is false precision for a katori of
 * dal, and coarser can't express "one and a half rotis", which people do eat.
 */
export const QUANTITY_STEP = 0.5;
export const MIN_QUANTITY = 0.5;
export const MAX_QUANTITY = 10;

/**
 * Macros are kept to 0.1g, never rounded to whole numbers.
 *
 * A previous pass in this codebase rounded fat to integers and collapsed
 * meaningfully different foods into identical calorie totals. Half a serving of
 * something with 5g fat is 2.5g, and 2.5 must not become 2 or 3.
 */
function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

export function clampQuantity(q: number): number {
    if (!Number.isFinite(q)) return MIN_QUANTITY;
    const stepped = Math.round(q / QUANTITY_STEP) * QUANTITY_STEP;
    return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, round1(stepped)));
}

/** Seed the editable list from a preset. Every item starts at one serving. */
export function entriesFromPreset(items: PresetItem[]): BuilderEntry[] {
    return (items || []).map((item, i) => ({
        ...item,
        // Index is part of the key because a preset can legitimately repeat a
        // name (two different sabzis both called "Sabzi").
        key: `${item.meal_name}#${i}`,
        quantity: 1,
    }));
}

/** One entry scaled to its quantity, in the shape the log endpoint expects. */
export function scaleEntry(entry: BuilderEntry): PresetItem {
    const q = entry.quantity;
    return {
        meal_name: q === 1 ? entry.meal_name : `${entry.meal_name} (x${q})`,
        calories: Math.round((entry.calories || 0) * q),
        protein: round1((entry.protein || 0) * q),
        carbs: round1((entry.carbs || 0) * q),
        fat: round1((entry.fat || 0) * q),
    };
}

export function mealTotals(entries: BuilderEntry[]): MealTotals {
    return (entries || []).reduce<MealTotals>(
        (acc, e) => {
            const q = e.quantity;
            return {
                calories: acc.calories + (e.calories || 0) * q,
                protein: acc.protein + (e.protein || 0) * q,
                carbs: acc.carbs + (e.carbs || 0) * q,
                fat: acc.fat + (e.fat || 0) * q,
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

/** Totals formatted for display — calories whole, macros to 0.1g. */
export function displayTotals(entries: BuilderEntry[]): MealTotals {
    const t = mealTotals(entries);
    return {
        calories: Math.round(t.calories),
        protein: round1(t.protein),
        carbs: round1(t.carbs),
        fat: round1(t.fat),
    };
}

export function setQuantity(entries: BuilderEntry[], key: string, quantity: number): BuilderEntry[] {
    return entries.map(e => (e.key === key ? { ...e, quantity: clampQuantity(quantity) } : e));
}

export function removeEntry(entries: BuilderEntry[], key: string): BuilderEntry[] {
    return entries.filter(e => e.key !== key);
}

/** What actually gets sent to /nutrition/log-bulk. */
export function toLogPayload(entries: BuilderEntry[]): PresetItem[] {
    return entries.map(scaleEntry);
}
