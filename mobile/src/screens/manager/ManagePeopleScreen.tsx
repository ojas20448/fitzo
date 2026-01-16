import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { managerAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import Input from '../../components/Input';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface UserItem {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    joined_at: string;
    checked_in_today: boolean;
    trainer_name?: string; // For members
    member_count?: number; // For trainers
}

const ManagePeopleScreen: React.FC = () => {
    const params = useLocalSearchParams<{ initialTab?: string }>();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'members' | 'trainers'>(
        (params.initialTab === 'trainers') ? 'trainers' : 'members'
    );
    const [members, setMembers] = useState<UserItem[]>([]);
    const [trainers, setTrainers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, trainersData] = await Promise.all([
                managerAPI.getMembers(),
                managerAPI.getTrainers(),
            ]);
            setMembers(membersData.members);
            setTrainers(trainersData.trainers);
        } catch (error) {
            console.error('Failed to load people:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!name || !email) {
            toast.warning('Name and Email are required');
            return;
        }

        if (activeTab === 'members' && trainers.length > 0 && !selectedTrainerId) {
            toast.warning('Please assign a trainer to this member');
            return;
        }

        setAdding(true);
        try {
            const response = await managerAPI.addUser({
                name,
                email,
                role: activeTab === 'members' ? 'member' : 'trainer',
                trainer_id: activeTab === 'members' ? selectedTrainerId : undefined,
            });

            toast.success(`User added! Temp password: ${response.temp_password}`);
            setShowAddModal(false);
            setName('');
            setEmail('');
            setSelectedTrainerId('');
            loadData(); // Refresh list
        } catch (error: any) {
            toast.error(error.message || 'Failed to add user');
        } finally {
            setAdding(false);
        }
    };

    const renderItem = ({ item }: { item: UserItem }) => (
        <GlassCard style={styles.userCard}>
            <View style={styles.userInfo}>
                <Avatar uri={item.avatar_url} size="md" showOnline={item.checked_in_today} />
                <View style={styles.userTexts}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userSubtext}>
                        {activeTab === 'members'
                            ? `Trainer: ${item.trainer_name || 'Unassigned'}`
                            : `${item.member_count || 0} Members`
                        }
                    </Text>
                </View>
            </View>
            {/* <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} /> */}
        </GlassCard>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
                    <MaterialIcons name="arrow-back" size={20} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>PEOPLE</Text>
                    <Text style={styles.headerDot}>·</Text>
                    <Text style={styles.headerSubtitle}>MANAGE</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton} accessibilityLabel="Add person">
                    <MaterialIcons name="add" size={20} color={colors.background} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'members' && styles.activeTab]}
                    onPress={() => setActiveTab('members')}
                    accessibilityLabel="View members"
                >
                    <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
                        Members ({members.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'trainers' && styles.activeTab]}
                    onPress={() => setActiveTab('trainers')}
                    accessibilityLabel="View trainers"
                >
                    <Text style={[styles.tabText, activeTab === 'trainers' && styles.activeTabText]}>
                        Trainers ({trainers.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.listContent}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <GlassCard key={i} style={styles.userCard}>
                            <View style={styles.userInfo}>
                                <Skeleton width={48} height={48} borderRadius={24} />
                                <View style={styles.userTexts}>
                                    <Skeleton width={120} height={18} borderRadius={4} />
                                    <Skeleton width={80} height={14} borderRadius={4} style={{ marginTop: 6 }} />
                                </View>
                            </View>
                        </GlassCard>
                    ))}
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'members' ? members : trainers}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={loadData}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="people-outline" size={48} color={colors.text.muted} />
                            <Text style={styles.emptyText}>No {activeTab} found</Text>
                            <Text style={styles.emptySubtext}>Tap + to add your first {activeTab === 'members' ? 'member' : 'trainer'}</Text>
                        </View>
                    }
                />
            )}

            {/* Add User Modal */}
            <Modal
                visible={showAddModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Add {activeTab === 'members' ? 'Member' : 'Trainer'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        <Input
                            label="Full Name"
                            placeholder="e.g. John Doe"
                            value={name}
                            onChangeText={setName}
                            leftIcon="person"
                            required
                            containerStyle={{ marginBottom: spacing.lg }}
                        />

                        <Input
                            label="Email Address"
                            placeholder="e.g. john@example.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            leftIcon="email"
                            required
                            containerStyle={{ marginBottom: spacing.lg }}
                        />

                        {activeTab === 'members' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Assign Trainer</Text>
                                <View style={styles.trainerSelect}>
                                    {trainers.map(t => (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[
                                                styles.trainerOption,
                                                selectedTrainerId === t.id && styles.trainerOptionSelected
                                            ]}
                                            onPress={() => setSelectedTrainerId(t.id)}
                                        >
                                            <Text style={[
                                                styles.trainerOptionText,
                                                selectedTrainerId === t.id && styles.trainerOptionTextSelected
                                            ]}>{t.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        <Button
                            title={`Add ${activeTab === 'members' ? 'Member' : 'Trainer'}`}
                            onPress={handleAddUser}
                            loading={adding}
                            style={{ marginTop: spacing.lg }}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

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
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: typography.letterSpacing.wider,
    },
    headerDot: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.light,
        color: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.light,
        color: colors.text.secondary,
        letterSpacing: typography.letterSpacing.wide,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    addButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.primary,
        ...shadows.glow,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
        gap: spacing.md,
    },
    tab: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeTab: {
        backgroundColor: colors.glass.surface,
        borderColor: colors.glass.border,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    activeTabText: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
    },
    listContent: {
        padding: spacing.xl,
        gap: spacing.md,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    userTexts: {
        gap: 2,
    },
    userName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    userSubtext: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing['3xl'],
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    emptySubtext: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius['2xl'],
        borderTopRightRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    trainerSelect: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    trainerOption: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        backgroundColor: colors.glass.surface,
    },
    trainerOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    trainerOptionText: {
        fontSize: typography.sizes.xs,
        color: colors.text.secondary,
    },
    trainerOptionTextSelected: {
        color: colors.background,
        fontWeight: 'bold',
    },
});

export default ManagePeopleScreen;
