export function resolveGlassMode(input: {
    platform: string; nativeAvailable: boolean; reduceTransparency: boolean;
}): 'native' | 'blur' | 'opaque' {
    if (input.reduceTransparency) return 'opaque';
    if (input.platform === 'ios') return input.nativeAvailable ? 'native' : 'blur';
    return input.platform === 'web' ? 'blur' : 'opaque';
}
