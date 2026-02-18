import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { postsAPI } from '../../src/services/api';
import { useToast } from '../../src/components/Toast';
import { colors, typography, spacing, borderRadius } from '../../src/styles/theme';

export default function CreatePostScreen() {
    const toast = useToast();
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState<'friends' | 'public'>('friends');
    const [loading, setLoading] = useState(false);

    const handlePost = async () => {
        if (!content.trim()) {
            toast.warning('Empty Post', 'Please write something');
            return;
        }

        if (content.length > 5000) {
            toast.warning('Too Long', 'Post must be less than 5000 characters');
            return;
        }

        setLoading(true);
        try {
            await postsAPI.create({ content: content.trim(), visibility });
            toast.success('Posted! 🎉', 'Your post has been shared');
            router.back();
        } catch (error: any) {
            toast.error('Failed', error.message || 'Could not create post');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.closeButton}
                    >
                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>CREATE POST</Text>
                    <TouchableOpacity
                        onPress={handlePost}
                        disabled={!content.trim() || loading}
                        style={[
                            styles.postButton,
                            (!content.trim() || loading) && styles.postButtonDisabled
                        ]}
                    >
                        <Text
                            style={[
                                styles.postButtonText,
                                (!content.trim() || loading) && styles.postButtonTextDisabled
                            ]}
                        >
                            {loading ? 'Posting...' : 'Post'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Content Input */}
                    <TextInput
                        style={styles.input}
                        placeholder="What's on your mind?"
                        placeholderTextColor={colors.text.muted}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        maxLength={5000}
                        autoFocus
                        textAlignVertical="top"
                    />

                    <Text style={styles.charCount}>
                        {content.length} / 5000
                    </Text>

                    {/* Visibility Selector */}
                    <View style={styles.visibilitySection}>
                        <View style={styles.sectionHeader}>
                            <MaterialIcons name="visibility" size={20} color={colors.text.muted} />
                            <Text style={styles.sectionTitle}>Who can see this?</Text>
                        </View>

                        <View style={styles.visibilityOptions}>
                            <TouchableOpacity
                                style={[
                                    styles.visibilityOption,
                                    visibility === 'friends' && styles.visibilityOptionActive
                                ]}
                                onPress={() => setVisibility('friends')}
                            >
                                <MaterialIcons
                                    name="people"
                                    size={24}
                                    color={visibility === 'friends' ? colors.primary : colors.text.muted}
                                />
                                <View style={styles.visibilityInfo}>
                                    <Text
                                        style={[
                                            styles.visibilityTitle,
                                            visibility === 'friends' && styles.visibilityTitleActive
                                        ]}
                                    >
                                        Friends Only
                                    </Text>
                                    <Text style={styles.visibilitySubtitle}>
                                        Only your gym buddies can see this
                                    </Text>
                                </View>
                                {visibility === 'friends' && (
                                    <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.visibilityOption,
                                    visibility === 'public' && styles.visibilityOptionActive
                                ]}
                                onPress={() => setVisibility('public')}
                            >
                                <MaterialIcons
                                    name="public"
                                    size={24}
                                    color={visibility === 'public' ? colors.primary : colors.text.muted}
                                />
                                <View style={styles.visibilityInfo}>
                                    <Text
                                        style={[
                                            styles.visibilityTitle,
                                            visibility === 'public' && styles.visibilityTitleActive
                                        ]}
                                    >
                                        Public
                                    </Text>
                                    <Text style={styles.visibilitySubtitle}>
                                        Everyone can see this
                                    </Text>
                                </View>
                                {visibility === 'public' && (
                                    <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    closeButton: {
        padding: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
    postButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary,
    },
    postButtonDisabled: {
        backgroundColor: colors.glass.surface,
    },
    postButtonText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    postButtonTextDisabled: {
        color: colors.text.muted,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    input: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        minHeight: 200,
        marginBottom: spacing.md,
    },
    charCount: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'right',
        marginBottom: spacing['2xl'],
    },
    visibilitySection: {
        marginTop: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    visibilityOptions: {
        gap: spacing.md,
    },
    visibilityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    visibilityOptionActive: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(45, 212, 191, 0.05)',
    },
    visibilityInfo: {
        flex: 1,
    },
    visibilityTitle: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    visibilityTitleActive: {
        color: colors.text.primary,
    },
    visibilitySubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
});
