import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { friendsAPI } from '../src/services/api';
import Button from '../src/components/Button';
import GlassCard from '../src/components/GlassCard';
import { colors, typography, spacing } from '../src/styles/theme';
import { parseBuddyInvite, inviteStatus, savePendingInvite, clearPendingInvite, type InviteStatus } from '../src/utils/buddyInvite';

export default function BuddyInviteHandler() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const params = useLocalSearchParams<{ id?: string; userId?: string; u?: string; username?: string }>();

    const invite = parseBuddyInvite(params.id || params.userId, params.u || params.username);
    const targetUserId = invite?.id;
    const targetUsername = invite?.u;

    const [status, setStatus] = useState<InviteStatus>('checking');
    const [retry, setRetry] = useState(0);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!targetUserId) {
            setStatus('invalid');
            return;
        }

        let active = true;
        setStatus('checking');
        if (!isAuthenticated || !user?.onboarding_completed) {
            savePendingInvite({ id: targetUserId, u: targetUsername || '' })
                .then(() => { if (active) router.replace(isAuthenticated ? '/onboarding' : '/login'); })
                .catch(() => { if (active) setStatus('error'); });
            return () => { active = false; };
        }
        void clearPendingInvite();

        if (targetUserId === user?.id) {
            setStatus('self');
            return;
        }

        // Check if already buddies
        friendsAPI.getFriendshipStatus(targetUserId)
            .then(res => {
                if (active) setStatus(inviteStatus(res.status));
            })
            .catch(() => {
                if (active) setStatus('error');
            });
        return () => { active = false; };
    }, [authLoading, isAuthenticated, targetUserId, targetUsername, user?.id, user?.onboarding_completed, router, retry]);

    const handleAdd = async () => {
        if (!targetUserId || adding || !['ready', 'pending_received'].includes(status)) return;
        setAdding(true);
        try {
            const result = await friendsAPI.sendRequest(targetUserId);
            const accepted = result.status === 'accepted';
            setStatus(accepted ? 'already_friend' : 'pending_sent');
            Alert.alert(
                accepted ? 'You’re now gym buddies!' : 'Friend Request Sent!',
                accepted ? 'Your invitation has been accepted.' : `@${targetUsername || 'Your buddy'} will see your request in their Buddies tab.`,
                [{ text: 'OK', onPress: () => router.replace('/(tabs)/buddies') }]
            );
        } catch (err: any) {
            Alert.alert(
                'Could Not Add',
                err.response?.data?.error || err.message || 'Failed to send friend request',
                [{ text: 'OK', onPress: () => router.replace('/(tabs)/buddies') }]
            );
        } finally {
            setAdding(false);
        }
    };

    const handleViewProfile = () => {
        if (!targetUserId) return;
        router.replace({
            pathname: '/member/user-profile',
            params: {
                userId: targetUserId,
                userUsername: targetUsername || '',
            }
        });
    };

    if (authLoading || status === 'checking') {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Connecting with gym buddy...</Text>
            </SafeAreaView>
        );
    }

    if (status === 'self') {
        return (
            <SafeAreaView style={styles.container}>
                <GlassCard style={styles.card} padding="lg">
                    <MaterialIcons name="person" size={48} color={colors.primary} />
                    <Text style={styles.title}>This is your invite link!</Text>
                    <Text style={styles.subtitle}>Share this link with friends so they can add you to their gym buddies.</Text>
                    <Button
                        title="Go to Gym Buddies"
                        onPress={() => router.replace('/(tabs)/buddies')}
                        style={{ marginTop: spacing.lg, width: '100%' }}
                    />
                </GlassCard>
            </SafeAreaView>
        );
    }

    if (status === 'already_friend') {
        return (
            <SafeAreaView style={styles.container}>
                <GlassCard style={styles.card} padding="lg">
                    <MaterialIcons name="check-circle" size={48} color={colors.success} />
                    <Text style={styles.title}>Already Gym Buddies!</Text>
                    <Text style={styles.subtitle}>You and @{targetUsername || 'this user'} are already connected.</Text>
                    <Button
                        title="View Profile"
                        onPress={handleViewProfile}
                        style={{ marginTop: spacing.lg, width: '100%' }}
                    />
                    <Button
                        title="Back to Buddies"
                        variant="ghost"
                        onPress={() => router.replace('/(tabs)/buddies')}
                        style={{ marginTop: spacing.sm, width: '100%' }}
                    />
                </GlassCard>
            </SafeAreaView>
        );
    }

    if (status === 'invalid') {
        return (
            <SafeAreaView style={styles.container}>
                <GlassCard style={styles.card} padding="lg">
                    <MaterialIcons name="error-outline" size={48} color={colors.error} />
                    <Text style={styles.title}>Invalid Link</Text>
                    <Text style={styles.subtitle}>This gym buddy invite link is incomplete or invalid.</Text>
                    <Button
                        title="Back to Buddies"
                        onPress={() => router.replace('/(tabs)/buddies')}
                        style={{ marginTop: spacing.lg, width: '100%' }}
                    />
                </GlassCard>
            </SafeAreaView>
        );
    }

    if (status === 'pending_sent' || status === 'blocked' || status === 'error') {
        return (
            <SafeAreaView style={styles.container}>
                <GlassCard style={styles.card} padding="lg">
                    <Text style={styles.title}>{status === 'pending_sent' ? 'Request already sent' : status === 'blocked' ? 'Invite unavailable' : 'Could not check this invite'}</Text>
                    <Text style={styles.subtitle}>{status === 'pending_sent' ? 'Your buddy can accept it in their Buddies tab.' : status === 'blocked' ? 'You cannot connect with this account.' : 'Check your connection and try again.'}</Text>
                    {status === 'error' && <Button title="Try again" onPress={() => setRetry(value => value + 1)} style={{ marginTop: spacing.lg }} />}
                    <Button title="Back" variant="ghost" onPress={() => router.replace('/')} style={{ marginTop: spacing.sm }} />
                </GlassCard>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <GlassCard style={styles.card} padding="lg">
                <MaterialIcons name="group-add" size={48} color={colors.primary} />
                <Text style={styles.title}>Gym Buddy Invite</Text>
                <Text style={styles.subtitle}>
                    Do you want to add {targetUsername ? `@${targetUsername}` : 'this member'} as your gym buddy on Fitzo?
                </Text>
                <Button
                    title={adding ? 'Connecting...' : status === 'pending_received' ? 'Accept Buddy Request' : 'Add as Gym Buddy'}
                    loading={adding}
                    onPress={handleAdd}
                    style={{ marginTop: spacing.xl, width: '100%' }}
                />
                <Button
                    title="View Profile"
                    variant="secondary"
                    onPress={handleViewProfile}
                    style={{ marginTop: spacing.sm, width: '100%' }}
                />
                <Button
                    title="Not Now"
                    variant="ghost"
                    onPress={() => router.replace('/(tabs)/buddies')}
                    style={{ marginTop: spacing.xs, width: '100%' }}
                />
            </GlassCard>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.text.secondary,
        fontSize: typography.sizes.base,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        alignItems: 'center',
    },
    title: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        marginTop: spacing.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
});
