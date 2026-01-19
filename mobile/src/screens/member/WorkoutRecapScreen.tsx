import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import ShareCard from '../../components/ShareCard';
import { memberAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useXP } from '../../context/XPContext';

const { width, height } = Dimensions.get('window');

export default function WorkoutRecapScreen() {
    const { awardXP } = useXP();
    const params = useLocalSearchParams();
    const { user } = useAuth();

    // Parse the recap data passed as string
    const recap = params.recap ? JSON.parse(params.recap as string) : null;
    const session = params.session ? JSON.parse(params.session as string) : null;

    const [showShareModal, setShowShareModal] = useState(false);
    const [streak, setStreak] = useState(0);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [sharing, setSharing] = useState(false);

    const viewShotRef = useRef<View>(null);

    // Fetch streak and trigger Haptics
    useEffect(() => {
        const init = async () => {
            // Haptics
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            try {
                const homeData = await memberAPI.getHome();
                if (homeData?.streak?.current) {
                    setStreak(homeData.streak.current);
                }
            } catch (e) {
                console.log('Failed to fetch streak', e);
            }
        };
        init();

        // Auto-show share card after a moment
        const timer = setTimeout(() => {
            setShowShareModal(true);
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    const handleShare = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            if (!viewShotRef.current) return;

            const uri = await captureRef(viewShotRef, {
                format: 'png',
                quality: 0.9,
                result: 'tmpfile',
            });

            setCapturedImage(uri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share your workout',
                    UTI: 'public.png',
                });
            }
        } catch (error) {
            console.error('Sharing failed', error);
        } finally {
            setSharing(false);
        }
    };

    if (!recap) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ color: 'white' }}>No recap data found.</Text>
                <TouchableOpacity onPress={() => router.replace('/' as any)}>
                    <Text style={{ color: 'white' }}>Go Home</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Determine workout type name
    const workoutTypeName = session?.name || 'Custom Workout';

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>WORKOUT COMPLETE</Text>
                    <Text style={styles.headerSub}>{workoutTypeName}</Text>

                    <View style={styles.badge}>
                        <MaterialIcons name="local-fire-department" size={20} color={colors.text.dark} />
                        <Text style={styles.badgeText}>{streak} Day Streak</Text>
                    </View>
                </View>

                {/* Main Stats Grid */}
                <View style={styles.grid}>
                    <GlassCard style={styles.gridItem}>
                        <MaterialIcons name="timer" size={24} color={colors.primary} style={{ marginBottom: 8 }} />
                        <Text style={styles.statValue}>{recap.duration}</Text>
                        <Text style={styles.statLabel}>MINUTES</Text>
                    </GlassCard>

                    <GlassCard style={styles.gridItem}>
                        <MaterialIcons name="auto-awesome" size={24} color={colors.text.primary} style={{ marginBottom: 8 }} />
                        <Text style={styles.statValue}>{recap.xp_earned || 0}</Text>
                        <Text style={styles.statLabel}>XP GAINED</Text>
                    </GlassCard>

                    <GlassCard style={styles.gridItem}>
                        <MaterialIcons name="repeat" size={24} color="#60A5FA" style={{ marginBottom: 8 }} />
                        <Text style={styles.statValue}>{recap.sets}</Text>
                        <Text style={styles.statLabel}>SETS</Text>
                    </GlassCard>

                    <GlassCard style={styles.gridItem}>
                        <MaterialIcons name="emoji-events" size={24} color="#FBBF24" style={{ marginBottom: 8 }} />
                        <Text style={styles.statValue}>{recap.prs?.length || 0}</Text>
                        <Text style={styles.statLabel}>RECORDS</Text>
                    </GlassCard>
                </View>

                {/* Achievements */}
                {recap.achievements && recap.achievements.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsRow}>
                            {recap.achievements.map((ach: any, i: number) => (
                                <View key={i} style={styles.achievementCard}>

                                    <View style={styles.achievementIcon}>
                                        <MaterialIcons name={ach.icon} size={32} color={colors.text.dark} />
                                    </View>
                                    <Text style={styles.achievementTitle}>{ach.title}</Text>
                                    <Text style={styles.achievementDesc}>{ach.desc}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* PRs List */}
                {recap.prs && recap.prs.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>NEW RECORDS 🏆</Text>
                        {recap.prs.map((pr: any, i: number) => (
                            <GlassCard key={i} style={styles.prCard}>
                                <View>
                                    <Text style={styles.prExercise}>{pr.exerciseName}</Text>
                                    <Text style={styles.prImprovement}>+{pr.improvement}kg improvement</Text>
                                </View>
                                <Text style={styles.prValue}>{pr.newWeight}kg</Text>
                            </GlassCard>
                        ))}
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={() => setShowShareModal(true)}
                    >
                        <MaterialIcons name="share" size={20} color={colors.text.primary} />
                        <Text style={styles.shareText}>SHARE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.finishBtn}
                        onPress={async () => {
                            // Award XP on finish
                            const xpEarned = recap.xp_earned || 50;
                            awardXP(xpEarned, width / 2, height - 100);

                            // Small delay before navigating away to show animation
                            setTimeout(() => {
                                router.replace('/' as any);
                            }, 1000);
                        }}
                    >
                        <Text style={styles.finishText}>FINISH</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Share Card Modal */}
            <Modal
                visible={showShareModal}
                animationType="slide"
                presentationStyle="pageSheet" // or overFullScreen
                onRequestClose={() => setShowShareModal(false)}
            >
                <View style={styles.modalContainer}>
                    {/* Capture Area */}
                    <View style={styles.cardPreviewContainer}>
                        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
                            <ShareCard
                                workoutType={workoutTypeName}
                                duration={recap.duration ? `${recap.duration}m` : '0m'}
                                streak={streak}
                                date={new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                            />
                        </ViewShot>

                        {/* Overlay Gradient/Shadow for controls visibility? */}
                    </View>

                    {/* Controls Overlay */}
                    <SafeAreaView style={styles.modalOverlay} pointerEvents="box-none">
                        <View style={styles.modalHeader}>
                            <TouchableOpacity style={styles.closeButton} onPress={() => setShowShareModal(false)}>
                                <MaterialIcons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalControls}>
                            <Text style={styles.shareTitle}>Share Your Victory</Text>

                            <TouchableOpacity style={styles.instagramBtn} onPress={handleShare} disabled={sharing}>
                                {sharing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <MaterialIcons name="share" size={24} color="white" />
                                        <Text style={styles.instagramBtnText}>SHARE TO STORY</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.skipBtn} onPress={() => setShowShareModal(false)}>
                                <Text style={styles.skipBtnText}>SKIP</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginVertical: spacing.xl,
    },
    headerTitle: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.extraBold,
        color: colors.primary,
        textAlign: 'center',
        marginBottom: spacing.xs,
        letterSpacing: -1,
    },
    headerSub: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
        ...shadows.glow,
    },
    badgeText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
        textTransform: 'uppercase',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing['2xl'],
    },
    gridItem: {
        width: (width - (spacing.xl * 2) - spacing.md) / 2,
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    statValue: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginTop: 4,
        letterSpacing: 1,
    },
    section: {
        marginBottom: spacing['2xl'],
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    achievementsRow: {
        gap: spacing.md,
        paddingRight: spacing.xl,
    },
    achievementCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        width: 140,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    achievementIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        ...shadows.glow,
    },
    achievementTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: 4,
    },
    achievementDesc: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        textAlign: 'center',
    },
    prCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    prExercise: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    prImprovement: {
        fontSize: typography.sizes.xs,
        color: colors.crowd.low,
        marginTop: 2,
    },
    prValue: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.extraBold,
        color: colors.primary,
    },
    actions: {
        gap: spacing.md,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.sm,
    },
    shareText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
    finishBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        gap: spacing.sm,
        ...shadows.glow,
    },
    finishText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    cardPreviewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        padding: spacing.xl,
    },
    modalHeader: {
        alignItems: 'flex-end',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalControls: {
        width: '100%',
        alignItems: 'center',
        gap: spacing.lg,
        paddingBottom: spacing.xl,
    },
    shareTitle: {
        color: colors.text.primary,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
    },
    instagramBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E1306C', // IG Brand Color
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius.full,
        gap: spacing.md,
        width: '100%',
        ...shadows.glowMd,
    },
    instagramBtnText: {
        color: 'white',
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },
    skipBtn: {
        padding: spacing.md,
    },
    skipBtnText: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 1,
    },
});
