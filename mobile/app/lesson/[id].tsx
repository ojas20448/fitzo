import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Dimensions,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';

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

const { width, height } = Dimensions.get('window');

interface QuizResult {
    score: number;
    correct_count: number;
    total_questions: number;
    correct_answers: number[];
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
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [xpEarned, setXpEarned] = useState(0);
    const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Animation refs
    const questionAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

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
        setSubmitting(true);
        try {
            // Submit to API
            const result = await learnAPI.submitAttempt(lesson.id, finalAnswers);
            setQuizResult(result);

            if (result.passed) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setQuizCompleted(true);

                setTimeout(() => {
                    setShowCelebration(true);
                }, 500);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                // Show result screen for review
                setMode('result');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !lesson) {
        return (
            <SafeAreaView style={styles.container}>
                <SkeletonLesson />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                            {lesson.content || lesson.description}
                        </Markdown>

                        <View style={{ height: 120 }} />
                    </ScrollView>

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
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${((currentQ + 1) / lesson.questions.length) * 100}%` }]} />
                            </View>

                            <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
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
                                            activeOpacity={0.7}
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
                            </View>
                        );
                    })}

                    <View style={styles.resultFooter}>
                        {quizResult?.passed ? (
                            <>
                                <Button
                                    title="View Answers"
                                    onPress={() => {/* already showing */}}
                                    variant="outline"
                                    fullWidth
                                    style={{ marginBottom: 12 }}
                                />
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
