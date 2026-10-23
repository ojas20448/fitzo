/** Keep partial text in the editor; only ordinary decimal values may be logged. */
export function workoutNumber(value: unknown): number {
    const text = String(value ?? '').trim().replace(',', '.');
    return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}
