import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import * as Haptics from '../../src/utils/haptics';

interface Question {
    question: string;
    options: string[];
    correct: number;
}

interface Lesson {
    id: string;
    title: string;
    description: string;
    content?: string; // Markdown content
    xp_reward: number;
    questions: Question[];
}

import { learnAPI } from '../../src/services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';
import Button from '../../src/components/Button';
import Celebration from '../../src/components/Celebration';
import { SkeletonLesson } from '../../src/components/Skeleton';
import EmptyState from '../../src/components/EmptyState';

interface QuizResult {
    score: number;
    correct_count: number;
    total_questions: number;
    correct_answers: number[];
    // Parallel to correct_answers. Null per question until content carries an
    // explanation, so this stays optional — an older server that predates the
    // field must not crash the results screen.
    explanations?: (string | null)[];
    passed: boolean;
    xp_earned: number;
}

const LessonScreen = () => {
    const { id } = useLocalSearchParams();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<'reading' | 'quiz' | 'result'>('reading');

    // Quiz State
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState<number[]>([]);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
    const [submitting, setSubmitting] = useState(false);
    /** Fetch failure. Without this the screen showed a skeleton forever. */
    const [error, setError] = useState<string | null>(null);
    /** Submit failure. Keeps the member on the quiz with answers intact. */
    const [submitError, setSubmitError] = useState(false);
    /**
     * The exact answer array that was submitted, so a retry replays the SAME
     * payload. Reading it back off component state let a second Finish press
     * append an extra entry, making answers.length !== questions.length, which
     * the backend rejects forever — a permanent soft-lock on the last question.
     */
    const lastAnswersRef = useRef<number[]>([]);

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (id) loadLesson(id as string);
    }, [id]);

    const loadLesson = async (lessonId: string) => {
        setError(null);
        try {
            const data = await learnAPI.getLesson(lessonId);
            setLesson(data.lesson);
        } catch (e: any) {
            // Was console.error only. The render guard is `loading || !lesson`,
            // so a failed fetch left `lesson` null with `loading` false and the
            // guard still true — a permanent skeleton. Members are on Indian
            // mobile networks inside gym buildings; this is not an edge case.
            setError(e?.message || 'Could not load this lesson');
        } finally {
            setLoading(false);
        }
    };

    const retryLoad = () => {
        setLoading(true);
        loadLesson(id as string);
    };

    const handleStartQuiz = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setMode('quiz');
        setCurrentQ(0);
        setAnswers([]);
        setSelectedOption(null);
        setQuizResult(null);
    };

    const handleOptionSelect = (index: number) => {
        if (submitting) return;
        Haptics.selectionAsync();
        setSelectedOption(index);
    };

    const animateToNextQuestion = () => {
        // Slide out, then slide in
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
    };

    const handleNextQuestion = () => {
        if (selectedOption === null) return;

        const newAnswers = [...answers, selectedOption];
        setAnswers(newAnswers);

        if (currentQ < (lesson?.questions.length || 0) - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            animateToNextQuestion();
            setTimeout(() => {
                setCurrentQ(currentQ + 1);
                setSelectedOption(null);
            }, 150);
        } else {
            // Finish Quiz
            setSelectedOption(null);
            finishQuiz(newAnswers);
        }
    };

    const finishQuiz = async (finalAnswers: number[]) => {
        if (!lesson) return;
        // Remember the exact payload so a retry replays it rather than
        // rebuilding from state and appending a duplicate answer.
        lastAnswersRef.current = finalAnswers;
        setSubmitting(true);
        setSubmitError(false);
        try {
            const result = await learnAPI.submitAttempt(lesson.id, finalAnswers);
            setQuizResult(result);

            if (result.passed) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => {
                    setShowCelebration(true);
                }, 500);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                // Show result screen for review
                setMode('result');
            }
        } catch {
            // Stay on the quiz with the answers intact and say so. Silently
            // swallowing this discarded a completed quiz with no message.
            setSubmitError(true);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !lesson) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* The close-X lived only inside the success return, so a failed
                    fetch rendered a skeleton with NO way out. It exists in every
                    state now. */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Close lesson"
                    >
                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>LEARN</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <SkeletonLesson />
                ) : (
                    <EmptyState
                        variant="error"
                        message={error || 'Could not load this lesson'}
                        actionLabel="Retry"
                        onAction={retryLoad}
                    />
                )}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Celebration
                visible={showCelebration}
                type="achievement"
                title="Lesson Complete!"
                subtitle="Knowledge is gains."
                value="Completed"
                onComplete={() => {
                    setShowCelebration(false);
                    setMode('result');
                }}
            />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backBtn}
                    // 24px icon + 4px padding = a 32x32 tap area, under the
                    // 44pt minimum — and this is the only exit from the screen.
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close lesson"
                >
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {mode === 'reading' ? 'LEARN' : 'QUIZ'}
                </Text>
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
                            {lesson.content || lesson.description}
                        </Markdown>

                        <View style={{ height: 120 }} />
                    </ScrollView>

                    {/* No footer at all when there is nothing to be quizzed on.
                        Quiz mode indexes questions[0] with no length check, so a
                        lesson with an empty array crashed at render. */}
                    {lesson.questions.length > 0 && (
                        <View style={styles.quizFooter}>
                            <View style={styles.quizFooterInfo}>
                                <MaterialIcons name="quiz" size={20} color={colors.primary} />
                                <Text style={styles.quizFooterHint}>
                                    {lesson.questions.length} questions · Need 70% to pass
                                </Text>
                            </View>
                            <Button
                                title="Take Quiz →"
                                onPress={handleStartQuiz}
                                fullWidth
                            />
                        </View>
                    )}
                </View>
            ) : mode === 'quiz' ? (
                // --- QUIZ MODE ---
                <View style={styles.quizContainer}>
                    {submitting ? (
                        // Submitting overlay
                        <View style={styles.submittingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.submittingText}>Grading your answers...</Text>
                        </View>
                    ) : (
                        <>
                            {submitError && (
                                <View style={styles.submitErrorBar}>
                                    <Text style={styles.submitErrorText}>Couldn't submit your answers</Text>
                                    <TouchableOpacity
                                        onPress={() => finishQuiz(lastAnswersRef.current)}
                                        hitSlop={8}
                                        accessibilityRole="button"
                                        accessibilityLabel="Retry submitting your answers"
                                    >
                                        <Text style={styles.submitErrorRetry}>RETRY</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View
                                style={styles.progressBar}
                                accessibilityRole="progressbar"
                                accessibilityValue={{ now: currentQ + 1, min: 1, max: lesson.questions.length }}
                            >
                                <View style={[styles.progressFill, { width: `${((currentQ + 1) / lesson.questions.length) * 100}%` }]} />
                            </View>

                            <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
                                <Text style={styles.questionCount}>QUESTION {currentQ + 1} OF {lesson.questions.length}</Text>
                                <Text style={styles.questionText}>{lesson.questions[currentQ].question}</Text>

                                <View style={styles.optionsContainer} accessibilityRole="radiogroup">
                                    {(lesson.questions[currentQ]?.options ?? []).map((opt, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[
                                                styles.optionCard,
                                                selectedOption === idx && styles.optionCardSelected
                                            ]}
                                            onPress={() => handleOptionSelect(idx)}
                                            activeOpacity={0.7}
                                            // Custom radios: without a role and
                                            // checked state, selecting an option
                                            // produced no confirmation at all
                                            // for a screen reader.
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: selectedOption === idx }}
                                            accessibilityLabel={opt}
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
                            </Animated.View>

                            <View style={styles.footer}>
                                <Button
                                    title={currentQ === lesson.questions.length - 1 ? "Finish" : "Next"}
                                    onPress={handleNextQuestion}
                                    disabled={selectedOption === null}
                                    fullWidth
                                />
                            </View>
                        </>
                    )}
                </View>
            ) : (
                // --- RESULT MODE ---
                <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultContent}>
                    <View style={styles.resultHeader}>
                        <View style={[styles.resultIconContainer, quizResult?.passed && styles.resultIconContainerPass]}>
                            <MaterialIcons 
                                name={quizResult?.passed ? "emoji-events" : "refresh"} 
                                size={48} 
                                color={quizResult?.passed ? colors.primary : colors.warning} 
                            />
                        </View>
                        <Text style={styles.resultTitle}>
                            {quizResult?.passed ? 'Great Job! 🎉' : 'Keep Learning!'}
                        </Text>
                        <Text style={styles.resultSubtitle}>
                            You scored {quizResult?.score}% ({quizResult?.correct_count}/{quizResult?.total_questions} correct)
                        </Text>
                        {quizResult?.passed ? (
                            <View style={styles.xpEarnedBadge}>
                                <MaterialIcons name="check-circle" size={16} color={colors.success} />
                                <Text style={styles.xpEarnedText}>Quiz passed!</Text>
                            </View>
                        ) : (
                            <Text style={styles.resultInfo}>
                                You need 70% to pass. Review the material and try again!
                            </Text>
                        )}
                    </View>

                    <View style={styles.resultDivider} />

                    <Text style={styles.reviewTitle}>Review Your Answers</Text>
                    
                    {lesson.questions.map((q, idx) => {
                        const userAnswer = answers[idx];
                        const correctAnswer = quizResult?.correct_answers?.[idx];
                        const wasCorrect = userAnswer === correctAnswer;
                        const explanation = quizResult?.explanations?.[idx];
                        
                        return (
                            <View key={idx} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View style={[
                                        styles.reviewBadge,
                                        wasCorrect ? styles.reviewBadgeCorrect : styles.reviewBadgeIncorrect
                                    ]}>
                                        <MaterialIcons 
                                            name={wasCorrect ? "check" : "close"} 
                                            size={14} 
                                            color={wasCorrect ? colors.success : colors.error} 
                                        />
                                    </View>
                                    <Text style={styles.reviewQuestion}>Q{idx + 1}: {q.question}</Text>
                                </View>
                                
                                {!wasCorrect && (
                                    <View style={styles.reviewAnswers}>
                                        <Text style={styles.reviewYourAnswer}>
                                            Your answer: <Text style={{ color: colors.error }}>{q.options[userAnswer]}</Text>
                                        </Text>
                                        <Text style={styles.reviewCorrectAnswer}>
                                            Correct: <Text style={{ color: colors.success }}>{q.options[correctAnswer!]}</Text>
                                        </Text>
                                    </View>
                                )}

                                {/* Shown whether or not they got it right. Being
                                    told you were correct without knowing why
                                    teaches nothing, and a right answer for the
                                    wrong reason is worth catching. */}
                                {!!explanation && (
                                    <Text style={styles.reviewExplanation}>{explanation}</Text>
                                )}
                            </View>
                        );
                    })}

                    <View style={styles.resultFooter}>
                        {quizResult?.passed ? (
                            <>
                                {/* A full-width "View Answers" button used to sit
                                    here with `onPress={() => {}}` — a focusable
                                    48pt control that did nothing, immediately
                                    after the best moment in the feature. The
                                    answers are already rendered above it. */}
                                <Button
                                    title="Done"
                                    onPress={() => router.back()}
                                    fullWidth
                                />
                            </>
                        ) : (
                            <>
                                <Button
                                    title="Read Again"
                                    onPress={() => {
                                        setMode('reading');
                                        setCurrentQ(0);
                                        setAnswers([]);
                                        setQuizResult(null);
                                    }}
                                    variant="outline"
                                    fullWidth
                                    style={{ marginBottom: 12 }}
                                />
                                <Button
                                    title="Retry Quiz"
                                    onPress={handleStartQuiz}
                                    fullWidth
                                />
                            </>
                        )}
                    </View>
                </ScrollView>
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
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
    quizFooter: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        backgroundColor: colors.background,
    },
    quizFooterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    quizFooterHint: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },

    // Quiz Styles
    submitErrorBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.error,
        marginBottom: spacing.md,
    },
    submitErrorText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.error,
        flex: 1,
    },
    submitErrorRetry: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.error,
        letterSpacing: 1,
    },
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
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        flex: 1,
    },
    optionTextSelected: {
        color: colors.text.primary,
    },

    // Result Styles
    resultContainer: {
        flex: 1,
    },
    resultContent: {
        padding: spacing.xl,
    },
    resultHeader: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    resultIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.warning + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    resultIconContainerPass: {
        backgroundColor: colors.primary + '20',
    },
    resultTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    resultSubtitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    resultInfo: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
    },
    resultDivider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginVertical: spacing.xl,
    },
    reviewTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    reviewCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    reviewBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    reviewBadgeCorrect: {
        backgroundColor: colors.success + '20',
    },
    reviewBadgeIncorrect: {
        backgroundColor: colors.error + '20',
    },
    reviewQuestion: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        flex: 1,
        lineHeight: 20,
    },
    reviewAnswers: {
        marginTop: spacing.sm,
        marginLeft: 32,
    },
    reviewYourAnswer: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginBottom: 4,
    },
    reviewCorrectAnswer: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    reviewExplanation: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 20,
        marginTop: spacing.sm,
        marginLeft: 32,
        paddingLeft: spacing.sm,
        borderLeftWidth: 2,
        borderLeftColor: colors.glass.border,
    },
    resultFooter: {
        marginTop: spacing.xl,
        paddingBottom: spacing['2xl'],
    },
    submittingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xl,
    },
    submittingText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    xpEarnedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.primary + '15',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: borderRadius.full,
        marginTop: spacing.md,
    },
    xpEarnedText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
});

export default LessonScreen;
