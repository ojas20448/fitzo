import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api'; // Correct default import
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import Avatar from './Avatar';
import GlassCard from './GlassCard'; // This import is not used, but I will keep it as per instructions.

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    user_name: string;
    avatar_url: string | null;
}

interface CommentModalProps {
    visible: boolean;
    onClose: () => void;
    workoutId: string;
}

const CommentModal: React.FC<CommentModalProps> = ({ visible, onClose, workoutId }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (visible && workoutId) {
            loadComments();
        }
    }, [visible, workoutId]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/comments/${workoutId}`);
            setComments(response.data.comments);
        } catch (error) {
            console.error('Failed to load comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!newComment.trim()) return;

        setSubmitting(true);
        try {
            const response = await api.post(`/comments/${workoutId}`, {
                content: newComment
            });
            // Add new comment to list
            setComments(prev => [...prev, response.data.comment]);
            setNewComment('');
        } catch (error) {
            console.error('Failed to post comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const getTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return `${Math.floor(diffHrs / 24)}d ago`;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Close by tapping overlay */}
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.container}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Comments</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <MaterialIcons name="close" size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <View style={styles.loader}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : (
                            <FlatList
                                data={comments}
                                keyExtractor={item => item.id}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                                    </View>
                                }
                                renderItem={({ item }) => (
                                    <View style={styles.commentItem}>
                                        <Avatar uri={item.avatar_url} size="sm" />
                                        <View style={styles.commentContent}>
                                            <View style={styles.commentHeader}>
                                                <Text style={styles.commentName}>{item.user_name}</Text>
                                                <Text style={styles.commentTime}>{getTimeAgo(item.created_at)}</Text>
                                            </View>
                                            <Text style={styles.commentText}>{item.content}</Text>
                                        </View>
                                    </View>
                                )}
                            />
                        )}

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Add a comment..."
                                placeholderTextColor={colors.text.muted}
                                value={newComment}
                                onChangeText={setNewComment}
                                returnKeyType="send"
                                onSubmitEditing={handleSubmit}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, !newComment.trim() && styles.sendBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={!newComment.trim() || submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color={colors.background} />
                                ) : (
                                    <MaterialIcons name="send" size={20} color={colors.background} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        maxHeight: '80%',
    },
    modalContent: {
        backgroundColor: '#121212', // Dark background since we don't have BlurView
        borderTopLeftRadius: borderRadius['2xl'],
        borderTopRightRadius: borderRadius['2xl'],
        overflow: 'hidden',
        flex: 1,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        backgroundColor: '#1A1A1A',
    },
    title: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeBtn: {
        padding: spacing.xs,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
    },
    commentItem: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    commentContent: {
        flex: 1,
        gap: 2,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    commentName: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    commentTime: {
        fontSize: typography.sizes.xs,
        color: colors.text.subtle,
    },
    commentText: {
        fontSize: typography.sizes.base,
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.regular,
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text.primary,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: colors.text.subtle,
        opacity: 0.5,
    },
});

export default CommentModal;
