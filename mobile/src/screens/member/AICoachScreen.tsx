import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import { aiAPI } from '../../services/api';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
};

export default function AICoachScreen() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi! I'm your AI fitness coach. Ask me anything about workouts, nutrition, or fitness!",
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);

    const quickActions = [
        { icon: 'fitness-center', label: 'Workout Plan', action: 'workout' },
        { icon: 'restaurant', label: 'Nutrition Advice', action: 'nutrition' },
        { icon: 'assessment', label: 'Form Check', action: 'form' },
    ];

    const handleSend = async (customMessage?: string) => {
        const messageText = customMessage || inputText.trim();
        if (!messageText || loading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setLoading(true);

        try {
            const response = await aiAPI.chat(messageText);
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.response,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (error: any) {
            console.error('AI Coach error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: error.message?.includes('Network')
                    ? 'I\'m having trouble connecting. Please check your internet connection and try again.'
                    : 'Sorry, I encountered an error. Please try rephrasing your question.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAction = async (action: string) => {
        let message = '';
        switch (action) {
            case 'workout':
                message = 'Create a 4-day workout plan for muscle gain';
                break;
            case 'nutrition':
                message = 'What should I eat for muscle gain?';
                break;
            case 'form':
                message = 'How do I perform a proper squat?';
                break;
        }
        handleSend(message);
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View
            style={[
                styles.messageContainer,
                item.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
        >
            <View style={styles.messageAvatar}>
                <MaterialIcons
                    name={item.role === 'user' ? 'person' : 'smart-toy'}
                    size={20}
                    color={item.role === 'user' ? colors.primary : colors.primary}
                />
            </View>
            <View style={styles.messageBubble}>
                <Text style={styles.messageText}>{item.content}</Text>
                <Text style={styles.messageTime}>
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <MaterialIcons name="smart-toy" size={28} color={colors.primary} />
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>AI Coach</Text>
                    <Text style={styles.headerSubtitle}>Powered by Gemini Pro</Text>
                </View>
            </View>

            {/* Quick Actions */}
            {messages.length <= 1 && (
                <View style={styles.quickActionsContainer}>
                    <Text style={styles.quickActionsTitle}>Quick Actions</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.quickActions}
                    >
                        {quickActions.map((action, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.quickActionCard}
                                onPress={() => handleQuickAction(action.action)}
                            >
                                <MaterialIcons name={action.icon as any} size={32} color={colors.primary} />
                                <Text style={styles.quickActionLabel}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Messages */}
            <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesList}
                inverted={false}
            />

            {/* Loading Indicator */}
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>AI is thinking...</Text>
                </View>
            )}

            {/* Input */}
            <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask me anything..."
                        placeholderTextColor={colors.text.muted}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim() || loading}
                    >
                        <MaterialIcons
                            name="send"
                            size={24}
                            color={inputText.trim() ? colors.background : colors.text.muted}
                        />
                    </TouchableOpacity>
                </View>
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
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    headerSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    quickActionsContainer: {
        padding: spacing.xl,
    },
    quickActionsTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    quickActions: {
        gap: spacing.md,
    },
    quickActionCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        width: 120,
        height: 100,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.sm,
    },
    quickActionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        textAlign: 'center',
    },
    messagesList: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    messageContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    userMessage: {
        alignSelf: 'flex-end',
        flexDirection: 'row-reverse',
    },
    assistantMessage: {
        alignSelf: 'flex-start',
    },
    messageAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageBubble: {
        maxWidth: '75%',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    messageText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        lineHeight: 20,
    },
    messageTime: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    loadingText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    inputContainer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.glass.surface,
    },
});
