import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useGlassPreferences } from '../hooks/useGlassPreferences';
import { exerciseMediaCandidates, MediaExercise } from '../utils/exerciseMedia';
import { borderRadius, colors, spacing, typography } from '../styles/theme';

export default function ExercisePreview({ exercise, large = false, style }: { exercise: MediaExercise; large?: boolean; style?: ViewStyle }) {
    const { reduceMotion } = useGlassPreferences();
    const [failed, setFailed] = useState<string[]>([]);
    const [loaded, setLoaded] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);
    const candidates = exerciseMediaCandidates(exercise);
    const media = candidates.find(item => !failed.includes(item.uri));
    const still = (media?.poster && !failed.includes(media.poster) ? media.poster : undefined) || candidates.find(item => item.kind === 'photo' && !failed.includes(item.uri))?.uri;
    const pause = reduceMotion || paused;
    const uri = !large ? still || media?.uri : media?.kind === 'animation' && pause ? still : media?.uri;
    const isAnimated = large && media?.kind === 'animation' && !pause;
    useEffect(() => {
        if (!uri || loaded === uri) return;
        const timeout = setTimeout(() => setFailed(previous => previous.includes(uri) ? previous : [...previous, uri]), 12000);
        return () => clearTimeout(timeout);
    }, [uri, loaded]);
    return <View style={large ? styles.large : undefined}>
        <View style={[styles.frame, large ? styles.largeFrame : styles.thumb, large && !uri && styles.unavailableFrame, style]}>
            {uri && !failed.includes(uri) ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain"
                cachePolicy="memory-disk" autoplay={isAnimated} recyclingKey={uri}
                accessible accessibilityLabel={`${exercise.name} demonstration`}
                onLoad={() => setLoaded(uri)} onError={() => setFailed(previous => [...previous, uri])} />
                : <View style={styles.placeholder}><Ionicons name="barbell-outline" size={large ? 30 : 22} color={colors.text.muted} />
                    {large && <><Text style={styles.note}>{media?.kind === 'animation' && pause ? 'Animation is paused. Read the guide below.' : candidates.length ? 'Couldn’t load the demo or photo. You can keep logging this exercise.' : 'No demo or photo is available for this exercise yet.'}</Text>
                        {!!failed.length && <Pressable accessibilityRole="button" accessibilityLabel="Retry exercise media" style={styles.control} onPress={() => { setFailed([]); setLoaded(null); }}><Text style={styles.label}>Try again</Text></Pressable>}
                    </>}</View>}
            {!large && uri && media?.kind === 'animation' && <View style={styles.playBadge} pointerEvents="none"><Ionicons name="play" size={11} color={colors.text.primary} /></View>}
            {large && uri && !failed.includes(uri) && loaded !== uri && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={colors.text.secondary} /><Text style={styles.note}>Loading demonstration…</Text></View>}
        </View>
        {large && media && <View style={styles.details}>
            <Text style={styles.label}>{media.kind === 'animation' ? 'Animated demo' : 'Exercise photo'}</Text>
            {media.kind === 'animation' && !reduceMotion && <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Play exercise demo' : 'Pause exercise demo'} onPress={() => setPaused(value => !value)} style={styles.control}>
                <Ionicons name={paused ? 'play-outline' : 'pause-outline'} size={17} color={colors.text.primary} /><Text style={styles.label}>{paused ? 'Play' : 'Pause'}</Text>
            </Pressable>}
        </View>}
        {large && media?.credit && <View style={styles.credits}>
            <Pressable accessibilityRole="link" accessibilityLabel={`Demo by ${media.credit.author}, ${media.credit.license}. Open source.`} onPress={() => void Linking.openURL(media.credit!.sourcePageUrl)} style={styles.credit}>
                <Text style={styles.note}>{media.credit.author} · {media.credit.license} · Source ↗</Text>
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel="Exercise demo license" onPress={() => void Linking.openURL(media.credit!.licenseUrl)} style={styles.credit}><Text style={styles.note}>View license ↗</Text></Pressable>
        </View>}
    </View>;
}
const styles = StyleSheet.create({
    large: { gap: spacing.sm },
    frame: { overflow: 'hidden', borderRadius: borderRadius.lg, backgroundColor: colors.surfaceLight },
    thumb: { width: 72, height: 72 },
    largeFrame: { width: '100%', height: 240 },
    unavailableFrame: { height: 150 },
    playBadge: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.sm, gap: spacing.md },
    loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    note: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 11, lineHeight: 18 },
    label: { fontFamily: typography.fontFamily.medium, color: colors.text.secondary, fontSize: 12 },
    details: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    control: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    credit: { minHeight: 44, justifyContent: 'center' },
    credits: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.md },
});
