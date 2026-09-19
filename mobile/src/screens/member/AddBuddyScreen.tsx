import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Share, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import { friendsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { displayName } from '../../utils/displayName';
import { shareCapturedImage } from '../../utils/shareCapture';
import { useLocalSearchParams } from 'expo-router';

type Tab = 'code' | 'scan' | 'search';

const TABS: { id: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'code', label: 'My QR Code', icon: 'qr-code-2' },
    { id: 'scan', label: 'Scan QR', icon: 'qr-code-scanner' },
    { id: 'search', label: 'Search', icon: 'search' },
];

export default function AddBuddyScreen() {
    const { user } = useAuth();
    const { tab, userId: paramUserId, username: paramUsername } = useLocalSearchParams<{
        tab?: string;
        userId?: string;
        username?: string;
    }>();
    const initialTab: Tab = (tab === 'scan' || tab === 'search' || tab === 'code') ? tab : 'code';
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const qrCardRef = useRef<View>(null);

    useEffect(() => {
        if (paramUserId && paramUserId !== user?.id) {
            Alert.alert(
                'Add Gym Buddy',
                `Add @${paramUsername || 'this user'} as your gym buddy?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Buddy', onPress: () => handleAdd(paramUserId) }
                ]
            );
        }
    }, [paramUserId]);

    useEffect(() => {
        if (searchQuery.length >= 2) {
            handleSearch();
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const handleSearch = async () => {
        setSearching(true);
        try {
            const res = await friendsAPI.search(searchQuery);
            setSearchResults(res.users);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setSearching(false);
        }
    };

    const handleAdd = async (userId: string) => {
        try {
            await friendsAPI.sendRequest(userId);
            Alert.alert('Success', 'Friend request sent!');
            handleSearch(); // Refresh list
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send request');
        }
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        setScanned(true);
        
        let userId: string | null = null;
        let username: string | null = null;
        const rawData = String(data || '').trim();

        // 1. Check if scanned data is a universal link or deep link
        if (rawData.includes('/buddy') || rawData.startsWith('fitzo://')) {
            try {
                const queryStr = rawData.includes('?') ? rawData.split('?')[1] : '';
                const searchParams = new URLSearchParams(queryStr);
                userId = searchParams.get('id') || searchParams.get('userId');
                username = searchParams.get('u') || searchParams.get('username');
            } catch {
                const idMatch = rawData.match(/[?&](?:id|userId)=([^&]+)/);
                const userMatch = rawData.match(/[?&](?:u|username)=([^&]+)/);
                if (idMatch) userId = decodeURIComponent(idMatch[1]);
                if (userMatch) username = decodeURIComponent(userMatch[1]);
            }
        }
        
        // 2. Check JSON payload
        if (!userId) {
            try {
                const parsed = JSON.parse(rawData);
                if (parsed.type === 'fitzo_profile' || parsed.userId) {
                    userId = parsed.userId;
                    username = parsed.username;
                }
            } catch {
                // 3. Fallback: check if rawData is a direct UUID / alphanumeric ID
                if (/^[0-9a-fA-F-]{8,}$/.test(rawData) || /^[a-zA-Z0-9_-]{6,36}$/.test(rawData)) {
                    userId = rawData;
                }
            }
        }

        if (!userId) {
            Alert.alert('Invalid QR Code', 'This QR code does not appear to be a valid Fitzo gym buddy code.', [
                { text: 'OK', onPress: () => setScanned(false) }
            ]);
            return;
        }

        if (userId === user?.id) {
            Alert.alert('Nice Try!', "You can't add yourself as a buddy 😄", [
                { text: 'OK', onPress: () => setScanned(false) }
            ]);
            return;
        }

        Alert.alert(
            'Buddy Found!',
            username ? `Add @${username} as your gym buddy?` : 'Add this user as your gym buddy?',
            [
                { text: 'Cancel', onPress: () => setScanned(false), style: 'cancel' },
                {
                    text: 'Add Buddy',
                    onPress: async () => {
                        await handleAdd(userId!);
                        setScanned(false);
                    }
                }
            ]
        );
    };

    const handleShareText = async () => {
        try {
            const username = user?.username || 'user';
            const quickLink = `https://www.fitzoapp.in/buddy?id=${user?.id || ''}&u=${encodeURIComponent(username)}`;
            const deepLink = `fitzo://buddy?id=${user?.id || ''}&u=${encodeURIComponent(username)}`;
            
            await Share.share({
                title: 'Add me on Fitzo!',
                message: `Hey! Add me as your gym buddy on Fitzo 💪\n\nTap this link to connect with me directly:\n${quickLink}\n\n(If you already have Fitzo installed, tap: ${deepLink})`,
            });
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        }
    };

    const handleShareImage = async () => {
        try {
            if (!qrCardRef.current) return;
            await shareCapturedImage(qrCardRef, 'Fitzo Gym Buddy QR Code');
        } catch (error: any) {
            Alert.alert('Could not share image', error.message || 'Please try sharing the invite link instead.');
        }
    };

    const renderSearchTab = () => (
        <View style={styles.tabContent}>
            <View style={styles.searchBar}>
                <MaterialIcons name="search" size={24} color={colors.text.secondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search name or @username"
                    placeholderTextColor={colors.text.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                />
            </View>

            {searching && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />}

            <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <GlassCard style={styles.resultItem} padding="md">
                        <Avatar uri={item.avatar_url} size="md" />
                        <View style={styles.resultInfo}>
                            <Text style={styles.resultName} numberOfLines={1}>{displayName(item)}</Text>
                            <Text style={styles.resultUsername}>@{item.username || 'user'}</Text>
                        </View>
                        {item.friendship_status === 'none' ? (
                            <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(item.id)}>
                                <MaterialIcons name="person-add" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        ) : (
                            // A bare <Text> here had no width of its own, so it sat
                            // flush against the name while neighbouring rows showed a
                            // 40pt round button — the rows never lined up. A chip with
                            // the same trailing footprint fixes the ragged column.
                            <View
                                style={[
                                    styles.statusChip,
                                    item.friendship_status === 'friend' && styles.statusChipFriend,
                                ]}
                            >
                                <MaterialIcons
                                    name={item.friendship_status === 'friend' ? 'check' : 'schedule'}
                                    size={12}
                                    color={item.friendship_status === 'friend' ? colors.primary : colors.text.muted}
                                />
                                <Text
                                    style={[
                                        styles.statusChipText,
                                        item.friendship_status === 'friend' && styles.statusChipTextFriend,
                                    ]}
                                >
                                    {item.friendship_status === 'friend' ? 'BUDDY' : 'SENT'}
                                </Text>
                            </View>
                        )}
                    </GlassCard>
                )}
                contentContainerStyle={styles.resultList}
                ListEmptyComponent={
                    !searching && searchQuery.length >= 2 ? (
                        <Text style={styles.emptyText}>No users found.</Text>
                    ) : null
                }
            />
        </View>
    );

    const renderScanTab = () => {
        if (!permission) return <View />;
        if (!permission.granted) {
            return (
                <View style={styles.centerContent}>
                    <Text style={styles.permissionText}>We need your permission to verify using QR code</Text>
                    <Button title="Continue" onPress={requestPermission} />
                </View>
            );
        }

        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr", "pdf417"],
                    }}
                />
                <View style={styles.overlay}>
                    <View style={styles.scanFrame} />
                    <Text style={styles.scanText}>Scan your buddy's QR code</Text>
                </View>
            </View>
        );
    };

    const renderCodeTab = () => {
        const username = user?.username || 'user';
        const quickLink = `https://www.fitzoapp.in/buddy?id=${user?.id || ''}&u=${encodeURIComponent(username)}`;

        return (
            <View style={styles.centerContent}>
                <View ref={qrCardRef} collapsable={false}>
                    <GlassCard style={styles.qrCard} padding="lg">
                        <QRCode
                            value={quickLink}
                            size={200}
                            color="black"
                            backgroundColor="white"
                        />
                        <Text style={styles.myUsername}>@{username}</Text>
                        <Text style={styles.qrBadgeText}>SCAN TO CONNECT</Text>
                    </GlassCard>
                </View>

                <TouchableOpacity style={styles.linkPill} onPress={handleShareText} activeOpacity={0.7}>
                    <MaterialIcons name="link" size={16} color={colors.primary} />
                    <Text style={styles.linkPillText} numberOfLines={1}>
                        fitzoapp.in/buddy?u={username}
                    </Text>
                    <MaterialIcons name="share" size={14} color={colors.text.muted} />
                </TouchableOpacity>

                <Text style={styles.qrHint}>Let your buddy scan this code with any camera or tap your link to add you instantly.</Text>
                
                <View style={styles.actionButtonsContainer}>
                    <Button
                        title="Share Invite Link"
                        icon={<MaterialIcons name="share" size={20} color={colors.text.dark} />}
                        onPress={handleShareText}
                        style={{ marginTop: spacing.md, width: 220 }}
                    />
                    <Button
                        title="Share QR Code Image"
                        variant="secondary"
                        icon={<MaterialIcons name="qr-code-2" size={20} color={colors.text.primary} />}
                        onPress={handleShareImage}
                        style={{ marginTop: spacing.sm, width: 220 }}
                    />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Gym Buddy</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabs}>
                {TABS.map((t) => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tab, activeTab === t.id && styles.tabActive]}
                        onPress={() => setActiveTab(t.id)}
                    >
                        <MaterialIcons
                            name={t.icon}
                            size={18}
                            color={activeTab === t.id ? colors.primary : colors.text.muted}
                            style={{ marginBottom: 4 }}
                        />
                        <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
                            {t.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.content}>
                {activeTab === 'code' && renderCodeTab()}
                {activeTab === 'scan' && renderScanTab()}
                {activeTab === 'search' && renderSearchTab()}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: colors.glass.border,
    },
    tabActive: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    tabTextActive: {
        color: colors.text.primary,
    },
    content: {
        flex: 1,
    },
    tabContent: {
        flex: 1,
        padding: spacing.lg,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        height: 50,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.sm,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.base,
    },
    resultList: {
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    resultUsername: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
    },
    addBtn: {
        padding: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    statusChipFriend: {
        borderColor: colors.primary,
    },
    statusChipText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    statusChipTextFriend: {
        color: colors.primary,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.text.muted,
        marginTop: spacing.xl,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: borderRadius.xl,
        backgroundColor: 'transparent',
    },
    scanText: {
        color: 'white',
        marginTop: spacing.xl,
        fontFamily: typography.fontFamily.medium,
        padding: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    permissionText: {
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.lg,
        fontSize: typography.sizes.base,
    },
    qrCard: {
        alignItems: 'center',
        backgroundColor: 'white', // QR needs contrast
        padding: spacing.xl,
    },
    myUsername: {
        marginTop: spacing.lg,
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: 'black',
    },
    qrBadgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: '#666',
        letterSpacing: 1.5,
        marginTop: 4,
    },
    linkPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    linkPillText: {
        fontSize: typography.sizes.xs,
        color: colors.primary,
        fontFamily: typography.fontFamily.medium,
    },
    qrHint: {
        color: colors.text.secondary,
        marginTop: spacing.md,
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
    actionButtonsContainer: {
        alignItems: 'center',
        width: '100%',
    },
});
