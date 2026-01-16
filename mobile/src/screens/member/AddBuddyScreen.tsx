import React, { useState, useEffect } from 'react';
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

type Tab = 'search' | 'scan' | 'code';

export default function AddBuddyScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

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
        } catch (error) {
            console.error(error);
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
        // Assuming QR code contains JSON with userId or just userId
        let userId = data;
        try {
            const parsed = JSON.parse(data);
            if (parsed.userId) userId = parsed.userId;
        } catch (e) {
            // Not JSON, assume string ID
        }

        Alert.alert(
            'Buddy Found!',
            `Add this user?`,
            [
                { text: 'Cancel', onPress: () => setScanned(false), style: 'cancel' },
                {
                    text: 'Add',
                    onPress: async () => {
                        await handleAdd(userId);
                        setScanned(false);
                    }
                }
            ]
        );
    };

    const handleShare = async () => {
        try {
            // Create a deep link or just share username
            await Share.share({
                message: `Add me on Fitzo! My username is @${user?.username || 'user'}.`,
            });
        } catch (error) {
            console.error(error);
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
                            <Text style={styles.resultName}>{item.name}</Text>
                            <Text style={styles.resultUsername}>@{item.username || 'user'}</Text>
                        </View>
                        {item.friendship_status === 'none' ? (
                            <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(item.id)}>
                                <MaterialIcons name="person-add" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        ) : (
                            <Text style={styles.statusText}>
                                {item.friendship_status === 'friend' ? 'Buddy' : 'Pending'}
                            </Text>
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
                    <Button title="Grant Permission" onPress={requestPermission} />
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

    const renderCodeTab = () => (
        <View style={styles.centerContent}>
            <GlassCard style={styles.qrCard} padding="lg">
                <QRCode
                    value={JSON.stringify({ userId: user?.id, username: user?.username })}
                    size={200}
                    color="white"
                    backgroundColor="transparent"
                />
                <Text style={styles.myUsername}>@{user?.username || 'user'}</Text>
            </GlassCard>
            <Text style={styles.qrHint}>Let your buddy scan this code to add you.</Text>
            <Button
                title="Share Profile"
                icon={<MaterialIcons name="share" size={20} color={colors.text.dark} />}
                onPress={handleShare}
                style={{ marginTop: spacing.xl, width: 200 }}
            />
        </View>
    );

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
                {(['search', 'scan', 'code'] as Tab[]).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.content}>
                {activeTab === 'search' && renderSearchTab()}
                {activeTab === 'scan' && renderScanTab()}
                {activeTab === 'code' && renderCodeTab()}
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
    statusText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        textTransform: 'uppercase',
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
    qrHint: {
        color: colors.text.secondary,
        marginTop: spacing.xl,
        fontSize: typography.sizes.base,
    },
});
