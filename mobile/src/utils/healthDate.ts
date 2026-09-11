/** Explicit device calendar day prevents a UTC server shifting imported data. */
export function localDateString(at = new Date()): string {
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}
