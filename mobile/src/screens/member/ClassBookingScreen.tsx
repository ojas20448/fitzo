import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { classesAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Skeleton, { SkeletonCard } from '../../components/Skeleton';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface ClassSession {
    id: string;
    name: string;
    trainer: {
        name: string;
        avatar_url: string | null;
    };
    scheduled_at: string;
    duration_mins: number;
    slots_available: number;
    max_capacity: number;
    is_booked: boolean;
    time_of_day: 'morning' | 'afternoon' | 'evening';
}

const ClassBookingScreen: React.FC = () => {
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('today');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [bookingId, setBookingId] = useState<string | null>(null);

    const dateOptions = ['Today', 'Tomorrow', 'Sat, 26', 'Sun, 27'];

    useEffect(() => {
        loadClasses();
    }, [selectedDate]);

    const loadClasses = async () => {
        try {
            const response = await classesAPI.getClasses();
            setSessions(response.sessions || []);
        } catch (error) {
            console.error('Failed to load classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadClasses();
        setRefreshing(false);
    };

    const handleBook = async (sessionId: string, className: string) => {
        setBookingId(sessionId);
        try {
            await classesAPI.bookClass(sessionId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Booked!', `You're booked for ${className} 🎉`);
            await loadClasses();
        } catch (error: any) {
            Alert.alert('Booking Failed', error.message);
        } finally {
            setBookingId(null);
        }
    };

    const handleCancelBooking = async (sessionId: string) => {
        try {
            await classesAPI.cancelBooking(sessionId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadClasses();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatTimeOfDay = (time: string): string => {
        return time.charAt(0).toUpperCase() + time.slice(1);
    };

    // Group sessions by time of day
    const morningClasses = sessions.filter(s => s.time_of_day === 'morning');
    const eveningClasses = sessions.filter(s => s.time_of_day === 'evening' || s.time_of_day === 'afternoon');

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>CLASSES</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>BOOK</Text>
                    </View>
                    <Skeleton width={36} height={36} radius={18} />
                </View>
                <View style={styles.dateSelector}>
                    <View style={styles.dateSelectorContent}>
                        {[1, 2, 3, 4].map((_, i) => (
                            <Skeleton key={i} width={80} height={36} radius={18} />
                        ))}
                    </View>
                </View>
                <View style={styles.content}>
                    {[1, 2, 3].map((_, i) => (
                        <SkeletonCard key={i} style={{ marginBottom: spacing.md }} />
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>CLASSES</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtitle}>BOOK</Text>
                </View>
                <TouchableOpacity style={styles.filterBtn}>
                    <MaterialIcons name="tune" size={18} color={colors.text.muted} />
                </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateSelector}
                contentContainerStyle={styles.dateSelectorContent}
            >
                {dateOptions.map((date, index) => (
                    <TouchableOpacity
                        key={date}
                        style={[
                            styles.dateOption,
                            index === 0 && styles.dateOptionSelected,
                        ]}
                        onPress={() => setSelectedDate(date.toLowerCase())}
                    >
                        <Text style={[
                            styles.dateOptionText,
                            index === 0 && styles.dateOptionTextSelected,
                        ]}>
                            {date}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Morning Classes */}
                {morningClasses.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionLine} />
                            <View style={styles.sectionLabelRow}>
                                <MaterialIcons name="wb-sunny" size={14} color={colors.text.muted} />
                                <Text style={styles.sectionTitle}>MORNING</Text>
                            </View>
                            <View style={styles.sectionLine} />
                        </View>

                        {morningClasses.map((session) => (
                            <ClassCard
                                key={session.id}
                                session={session}
                                onBook={() => handleBook(session.id, session.name)}
                                onCancel={() => handleCancelBooking(session.id)}
                                isBooking={bookingId === session.id}
                                formatTime={formatTime}
                            />
                        ))}
                    </View>
                )}

                {/* Evening Classes */}
                {eveningClasses.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionLine} />
                            <View style={styles.sectionLabelRow}>
                                <MaterialIcons name="dark-mode" size={14} color={colors.text.muted} />
                                <Text style={styles.sectionTitle}>EVENING</Text>
                            </View>
                            <View style={styles.sectionLine} />
                        </View>

                        {eveningClasses.map((session) => (
                            <ClassCard
                                key={session.id}
                                session={session}
                                onBook={() => handleBook(session.id, session.name)}
                                onCancel={() => handleCancelBooking(session.id)}
                                isBooking={bookingId === session.id}
                                formatTime={formatTime}
                            />
                        ))}
                    </View>
                )}

                {sessions.length === 0 && (
                    <GlassCard style={styles.emptyCard}>
                        <MaterialIcons name="event-busy" size={48} color={colors.text.muted} />
                        <Text style={styles.emptyText}>No classes scheduled</Text>
                        <Text style={styles.emptySubtext}>Check back later for new sessions</Text>
                    </GlassCard>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// Separate ClassCard component for cleaner code
const ClassCard: React.FC<{
    session: ClassSession;
    onBook: () => void;
    onCancel: () => void;
    isBooking: boolean;
    formatTime: (date: string) => string;
}> = ({ session, onBook, onCancel, isBooking, formatTime }) => {
    const isFull = session.slots_available === 0;
    const timeParts = formatTime(session.scheduled_at).split(' ');

    return (
        <GlassCard style={styles.classCard}>
            <View style={styles.classContent}>
                {/* Time */}
                <View style={styles.timeColumn}>
                    <Text style={styles.timeText}>{timeParts[0]}</Text>
                    <Text style={styles.timeAmPm}>{timeParts[1]}</Text>
                </View>

                <View style={styles.timeDivider} />

                {/* Class Info */}
                <View style={styles.classInfo}>
                    <Text style={styles.className}>{session.name}</Text>
                    <Text style={styles.trainerName}>with {session.trainer.name}</Text>

                    <View style={styles.slotsContainer}>
                        {session.is_booked ? (
                            <Badge label="BOOKED" variant="success" size="sm" />
                        ) : isFull ? (
                            <Badge label="WAITLIST" variant="muted" size="sm" />
                        ) : (
                            <Badge
                                label={`${session.slots_available} slots left`}
                                variant="default"
                                size="sm"
                                icon={<View style={styles.slotDot} />}
                            />
                        )}
                    </View>
                </View>

                {/* Action Button */}
                <View style={styles.actionColumn}>
                    {session.is_booked ? (
                        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    ) : (
                        <Button
                            title={isFull ? 'Join' : 'Book'}
                            onPress={onBook}
                            size="sm"
                            loading={isBooking}
                            disabled={isFull}
                        />
                    )}
                </View>
            </View>
        </GlassCard>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        letterSpacing: 2,
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    filterBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateSelector: {
        marginVertical: spacing.lg,
    },
    dateSelectorContent: {
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    dateOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    dateOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dateOptionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    dateOptionTextSelected: {
        color: colors.background,
        fontFamily: typography.fontFamily.semiBold,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    sectionLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.glass.border,
    },
    sectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        letterSpacing: 2,
    },
    classCard: {
        marginBottom: spacing.md,
    },
    classContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeColumn: {
        width: 50,
        alignItems: 'center',
    },
    timeText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    timeAmPm: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timeDivider: {
        width: 1,
        height: 36,
        backgroundColor: colors.glass.border,
        marginHorizontal: spacing.md,
    },
    classInfo: {
        flex: 1,
    },
    className: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    trainerName: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
        letterSpacing: 0.3,
    },
    slotsContainer: {
        marginTop: spacing.sm,
        flexDirection: 'row',
    },
    slotDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    actionColumn: {
        marginLeft: spacing.md,
    },
    cancelBtn: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    cancelBtnText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: spacing['3xl'],
    },
    emptyText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginTop: spacing.lg,
        letterSpacing: 0.5,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.sm,
        letterSpacing: 0.3,
    },
});

export default ClassBookingScreen;
