import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import { aiAPI } from '../../services/api';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useToast } from '../../components/Toast';

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
            content: "I've read your last 14 days — training, food and recovery. Ask me anything.",
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const toast = useToast();

    // Inverted list, so the data is reversed once per change rather than on
    // every render. See the FlatList below for why inverted.
    const feed = useMemo(() => [...messages].reverse(), [messages]);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                toast.error('Permission Denied', 'Microphone access is required to record audio');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err: any) {
            toast.error('Error', 'Failed to start recording');
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        setTranscribing(true);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            if (uri) {
                const base64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: 'base64',
                });

                const extension = uri.split('.').pop() || 'm4a';
                const mimeType = `audio/${extension === 'm4a' ? 'm4a' : extension}`;

                const res = await aiAPI.transcribeAudio(base64, mimeType);
                if (res.success && res.text) {
                    setInputText(prev => (prev ? prev + ' ' : '') + res.text);
                    toast.success('Success', 'Audio transcribed!');
                } else {
                    toast.error('Error', 'Failed to transcribe audio');
                }
            }
        } catch (err) {
            console.error('Failed to stop recording', err);
            toast.error('Error', 'Failed to transcribe audio');
        } finally {
            setTranscribing(false);
        }
    };

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const response = await aiAPI.getChatHistory();
                if (response.success && response.history && response.history.length > 0) {
                    const formatted = response.history.map((msg: any) => ({
                        id: msg.id,
                        role: msg.sender === 'user' ? 'user' : 'assistant',
                        content: msg.message,
                        timestamp: new Date(msg.created_at),
                    }));
                    setMessages(formatted);
                }
            } catch (err) {
                console.error('Failed to load chat history:', err);
            } finally {
                setHistoryLoading(false);
            }
        };
        loadHistory();
    }, []);

    // Prompts phrased to hit the context pack — the coach answers from YOUR
    // data (volume, skipped muscles, streak, macros), not generic advice.
    const quickActions = [
        { icon: 'fitness-center', label: 'What should I train today?', action: 'today' },
        { icon: 'assessment', label: 'Rate my week', action: 'rate-week' },
        { icon: 'restaurant', label: 'Plan my nutrition', action: 'nutrition' },
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
            case 'today':
                message = 'What should I train today? Look at what I have and haven\'t trained recently.';
                break;
            case 'rate-week':
                message = 'Rate my week — training, food and consistency. Be honest.';
                break;
            case 'nutrition':
                message = 'Plan my nutrition for my goal based on what I\'ve been eating.';
                break;
        }
        handleSend(message);
    };

/**
 * Three dots, staggered. Rendered as the first item of the inverted list so it
 * appears exactly where the reply will land, instead of as a separate row that
 * pushes the composer around every time Spotter is called.
 */
function TypingDots() {
    const dots = [useRef(new Animated.Value(0.25)).current,
                  useRef(new Animated.Value(0.25)).current,
                  useRef(new Animated.Value(0.25)).current];

    useEffect(() => {
        const loops = dots.map((dot, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 160),
                    Animated.timing(dot, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0.25, duration: 380, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                    Animated.delay((2 - i) * 160),
                ]),
            ),
        );
        loops.forEach((l) => l.start());
        return () => loops.forEach((l) => l.stop());
    }, []);

    return (
        <View style={[styles.row, styles.rowSpotter]}>
            <Text style={styles.speaker}>SPOTTER</Text>
            <View style={[styles.spotterBody, styles.typingRow]}>
                {dots.map((dot, i) => (
                    <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
                ))}
            </View>
        </View>
    );
}

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.row, isUser ? styles.rowUser : styles.rowSpotter]}>
                <Text style={styles.speaker}>{isUser ? 'YOU' : 'SPOTTER'}</Text>
                {/*
                  * Only the user gets a bubble. Spotter speaks directly onto the
                  * page behind a hairline rule — the coach is the app talking,
                  * not a second party in a container. Two mirrored bubbles is
                  * the generic messaging-app look and says nothing about Fitzo.
                  */}
                {isUser ? (
                    <View style={styles.bubbleUser}>
                        <Text style={styles.textUser}>{item.content}</Text>
                    </View>
                ) : (
                    <View style={styles.spotterBody}>
                        <Text style={styles.textSpotter}>{item.content}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <KeyboardAvoidingView
            style={styles.flex}
            // iOS needs padding; on Android the window already resizes, and
            // applying padding there double-counts and leaves a dead gap.
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
                    <MaterialIcons name="chevron-left" size={32} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>SPOTTER</Text>
                    <Text style={styles.headerSubtitle}>Has read your last 14 days</Text>
                </View>
            </View>

            {historyLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.medium }}>
                        Loading chat history...
                    </Text>
                </View>
            ) : (
                <>
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

                    {/*
                      * INVERTED, deliberately.
                      *
                      * This list previously ran inverted={false} with no ref and
                      * no scroll call anywhere, so handleSend appended a message
                      * that rendered below the viewport and the list never
                      * moved. The message appeared to vanish, and with no
                      * KeyboardAvoidingView the keyboard covered what was left —
                      * which is what "stuck, can't scroll back" actually was.
                      *
                      * Inverting fixes it structurally rather than by chasing
                      * scrollToEnd: new messages land at the visual bottom by
                      * construction, the scroll position anchors to that edge
                      * natively, and scrolling back through history comes free.
                      * No scroll call can race the render because there is none.
                      */}
                    <FlatList
                        data={feed}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.messagesList}
                        inverted
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={loading ? <TypingDots /> : null}
                    />
                </>
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
                        style={[
                            styles.sendButton,
                            isRecording && { backgroundColor: colors.error }
                        ]}
                        onPress={isRecording ? stopRecording : startRecording}
                        disabled={loading || transcribing}
                        accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
                    >
                        {transcribing ? (
                            <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                            <MaterialIcons
                                name={isRecording ? "stop" : "mic"}
                                size={24}
                                color={colors.background}
                            />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={() => handleSend()}
                        disabled={!inputText.trim() || loading || isRecording}
                    >
                        <MaterialIcons
                            name="send"
                            size={24}
                            color={inputText.trim() ? colors.background : colors.text.muted}
                        />
                    </TouchableOpacity>
                </View>
            </View>
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
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backButton: {
        marginRight: -4,
        marginLeft: -8,
        padding: 4,
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
    flex: {
        flex: 1,
    },
    messagesList: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
        gap: spacing.xl,
    },

    // ── Message rows ────────────────────────────────────────────────────────
    // Speaker is carried by alignment plus a letterspaced label, reusing the
    // app's own "CONSISTENCY MATTERS." idiom. No avatars: a robot glyph is the
    // oldest AI tell and a sparkle is the current one, and neither says
    // anything about a gym app.
    row: {
        gap: spacing.sm,
        maxWidth: '86%',
    },
    rowUser: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    rowSpotter: {
        alignSelf: 'flex-start',
    },
    speaker: {
        fontSize: 11,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        letterSpacing: 2,
    },

    // The user gets a solid white bubble — the same inversion the primary
    // action buttons use, so "what I said" reads as the committed thing.
    bubbleUser: {
        backgroundColor: colors.text.primary,
        borderRadius: borderRadius.lg,
        borderBottomRightRadius: 4,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    textUser: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.dark,
        lineHeight: 22,
    },

    // Spotter has no bubble. It speaks onto the page behind a hairline rule —
    // the app talking, not a second party in a container. Two mirrored bubbles
    // is the generic messaging look.
    spotterBody: {
        borderLeftWidth: 1,
        borderLeftColor: colors.glass.borderLight,
        paddingLeft: spacing.lg,
    },
    textSpotter: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        lineHeight: 24,
    },

    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text.primary,
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
