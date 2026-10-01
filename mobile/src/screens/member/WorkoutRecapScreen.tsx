import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import Receipt from '../../components/share/themes/Receipt';
import { CARD_W, CARD_H } from '../../components/share/SharePayload';
import { memberAPI } from '../../services/api';
import { useLastSessionStore } from '../../stores/lastSessionStore';
import { useShareComposerStore } from '../../stores/shareComposerStore';
import { getRecapSession } from '../../utils/recapSession';
import { buildSharePayload } from '../../utils/buildSharePayload';
import { TOTAL_ID } from '../../utils/shareMoment';
import * as Haptics from '../../utils/haptics';

/** Review the completed workout; photo editing and export live in one composer. */
export default function WorkoutRecapScreen() {
    const params = useLocalSearchParams();
    const [session, setSession] = useState(() => getRecapSession(params.recap, params.session, useLastSessionStore.getState().session));
    const [previewWidth, setPreviewWidth] = useState(0);
    const payload = useMemo(() => session ? buildSharePayload(session, [TOTAL_ID]) : null, [session]);
    useEffect(() => {
        let mounted = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        memberAPI.getHome().then(home => {
            const streak = home?.streak?.current;
            if (mounted && typeof streak === 'number' && streak > 0) setSession(previous => previous ? { ...previous, streak } : null);
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);
    const openComposer = () => {
        if (!session) return;
        useShareComposerStore.getState().setSource({ kind: 'session', session });
        router.push('/member/share' as any);
    };
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{session ? 'Workout complete' : 'Recap unavailable'}</Text>
                <Text style={styles.subtitle}>{session ? 'Your finished sets, ready to share.' : 'Open your workout again to view its details.'}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.previewMeasure} onLayout={event => setPreviewWidth(event.nativeEvent.layout.width)}>
                    {payload && previewWidth > 0 && <View
                        style={[styles.preview, { width: previewWidth, height: previewWidth * CARD_H / CARD_W }]}
                        accessible accessibilityRole="image"
                        accessibilityLabel={session!.title + '. ' + payload.headline + '. ' + payload.rows.map(row => row.label + ': ' + row.value).join('. ')}
                    >
                        <View style={[styles.canvas, { transform: [{ scale: previewWidth / CARD_W }] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                            <Receipt payload={payload} />
                        </View>
                    </View>}
                </View>
            </ScrollView>
            <View style={styles.footer}>
                {session && <TouchableOpacity style={styles.shareBtn} onPress={openComposer} accessibilityRole="button" accessibilityLabel="Choose a style, add an optional photo, and share your workout">
                    <MaterialIcons name="share" size={20} color={colors.background} />
                    <Text style={styles.shareText}>CHOOSE STYLE & SHARE</Text>
                </TouchableOpacity>}
                <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/' as any)} accessibilityRole="button">
                    <Text style={styles.doneText}>DONE</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
    title: { fontFamily: typography.fontFamily.bold, fontSize: 26, color: colors.text.primary },
    subtitle: { fontFamily: typography.fontFamily.regular, fontSize: 14, color: colors.text.muted, marginTop: 8 },
    content: { paddingHorizontal: 24, paddingBottom: 16 },
    previewMeasure: { width: '100%' },
    preview: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 16 },
    canvas: { width: CARD_W, height: CARD_H, flexShrink: 0 },
    footer: { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 12, gap: spacing.sm },
    shareBtn: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: borderRadius.full, backgroundColor: colors.primary },
    shareText: { fontFamily: typography.fontFamily.bold, fontSize: 14, color: colors.background },
    doneBtn: { paddingVertical: 14, alignItems: 'center' },
    doneText: { fontFamily: typography.fontFamily.semiBold, fontSize: 13, letterSpacing: 1, color: colors.text.muted },
});
