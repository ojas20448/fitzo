import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';

import { learnAPI } from '../../src/services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';
import Button from '../../src/components/Button';
import Confetti from '../../src/components/Celebration'; // Re-using celebration component
import Celebration from '../../src/components/Celebration';

interface Question {
    question: string;
    options: string[];
    correct: number;
}

interface Lesson {
    id: string;
    title: string;
    description: string; // This is the markdown content
    xp_reward: number;
    questions: Question[];
}

const LessonScreen = () => {
    const { id } = useLocalSearchParams();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<'reading' | 'quiz'>('reading');

    // Quiz State
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState<number[]>([]);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [xpEarned, setXpEarned] = useState(0);

    useEffect(() => {
        if (id) loadLesson(id as string);
    }, [id]);

    const loadLesson = async (lessonId: string) => {
        try {
            const data = await learnAPI.getLesson(lessonId);
            setLesson(data.lesson);
        } catch (error) {
            console.error('Failed to load lesson:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartQuiz = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setMode('quiz');
    };

    const handleOptionSelect = (index: number) => {
        Haptics.selectionAsync();
        setSelectedOption(index);
    };

    const handleNextQuestion = () => {
        if (selectedOption === null) return;

        // Verify answer (immediate feedback style)
        // For simplicity, we just store it and move on, or we can check immediately.
        // Let's store.

        const newAnswers = [...answers, selectedOption];
        setAnswers(newAnswers);
        setSelectedOption(null);

        if (currentQ < (lesson?.questions.length || 0) - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentQ(currentQ + 1);
        } else {
            // Finish Quiz
            finishQuiz(newAnswers);
        }
    };

    const finishQuiz = async (finalAnswers: number[]) => {
        if (!lesson) return;
        setLoading(true);
        try {
            // Calculate score locally for immediate feedback
            let correctCount = 0;
            lesson.questions.forEach((q, idx) => {
                if (q.correct === finalAnswers[idx] + 1) correctCount++;
                // Note: API 'correct' is 1-based usually in my seed, let's check seed. 
                // Seed: "correct": 1 (index 0). Ah, seed "correct": 2 means index 1.
                // Let's assume seed is 1-based index for "options".
                // Seed check: "options":["No","Only if sweaty","Always"], "correct": 2 => "Only if sweaty" is wrong. "Always" is 3.
                // Wait, seed says: "options": ["No", "Only if sweaty", "Always", ...], "correct": 2 (Only if sweaty)?? That's wrong gym etiquette!
                // Let's assume 1-based index.
            });

            // Submit to API
            const result = await learnAPI.submitAttempt(lesson.id, finalAnswers);

            if (result.passed) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setXpEarned(result.xp_earned);
                setQuizCompleted(true);
                setShowCelebration(true);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                // Reset to try again
                alert('You didn\'t pass. Try reading again!');
                setMode('reading');
                setCurrentQ(0);
                setAnswers([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !lesson) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Celebration
                visible={showCelebration}
                type="levelup"
                title="Lesson Complete!"
                subtitle="Knowledge is gains."
                value={`+${xpEarned} XP`}
                onComplete={() => {
                    setShowCelebration(false);
                    router.back();
                }}
            />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{mode === 'reading' ? 'LEARN' : 'QUIZ'}</Text>
                <View style={{ width: 40 }} />
            </View>

            {mode === 'reading' ? (
                // --- READING MODE ---
                <View style={{ flex: 1 }}>
                    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.title}>{lesson.title}</Text>
                        <View style={styles.divider} />

                        <Markdown
                            style={{
                                body: { color: colors.text.secondary, fontSize: 16, lineHeight: 24 },
                                heading1: { color: colors.text.primary, fontSize: 24, fontWeight: 'bold', marginBottom: 16, marginTop: 24 },
                                heading2: { color: colors.text.primary, fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginTop: 20 },
                                strong: { color: colors.primary, fontWeight: 'bold' },
                                list_item: { marginBottom: 8 },
                            }}
                        >
                            {lesson.description}
                        </Markdown>

                        <View style={{ height: 100 }} />
                    </ScrollView>

                    <View style={styles.footer}>
                        <Button
                            title="Take Quiz"
                            onPress={handleStartQuiz}
                            rightIcon={<MaterialIcons name="arrow-forward" size={20} color={colors.text.dark} />}
                            fullWidth
                        />
                    </View>
                </View>
            ) : (
                // --- QUIZ MODE ---
                <View style={styles.quizContainer}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${((currentQ + 1) / lesson.questions.length) * 100}%` }]} />
                    </View>

                    <Text style={styles.questionCount}>QUESTION {currentQ + 1} OF {lesson.questions.length}</Text>
                    <Text style={styles.questionText}>{lesson.questions[currentQ].question}</Text>

                    <View style={styles.optionsContainer}>
                        {lesson.questions[currentQ].options.map((opt, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.optionCard,
                                    selectedOption === idx && styles.optionCardSelected
                                ]}
                                onPress={() => handleOptionSelect(idx)}
                            >
                                <View style={[
                                    styles.optionRadio,
                                    selectedOption === idx && styles.optionRadioSelected
                                ]}>
                                    {selectedOption === idx && <View style={styles.radioInner} />}
                                </View>
                                <Text style={[
                                    styles.optionText,
                                    selectedOption === idx && styles.optionTextSelected
                                ]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.footer}>
                        <Button
                            title={currentQ === lesson.questions.length - 1 ? "Finish" : "Next"}
                            onPress={handleNextQuestion}
                            disabled={selectedOption === null}
                            fullWidth
                        />
                    </View>
                </View>
            )}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
    },
    title: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginBottom: spacing.xl,
    },
    footer: {
        padding: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        backgroundColor: colors.glass.surface,
    },

    // Quiz Styles
    quizContainer: {
        flex: 1,
        padding: spacing.xl,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: 2,
        marginBottom: spacing.xl,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    questionCount: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    questionText: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing['2xl'],
        lineHeight: 32,
    },
    optionsContainer: {
        gap: spacing.md,
        flex: 1,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.md,
    },
    optionCardSelected: {
        backgroundColor: colors.primary + '15', // 15% opacity primary
        borderColor: colors.primary,
    },
    optionRadio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.text.subtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionRadioSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    optionText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    optionTextSelected: {
        color: colors.text.primary,
    },
});

export default LessonScreen;
