export function coachEntryPrompt(source: unknown, prompt: unknown): string {
    if (source !== 'workout' && source !== 'food') return '';
    return typeof prompt === 'string' && prompt.length <= 500 ? prompt.trim() : '';
}
