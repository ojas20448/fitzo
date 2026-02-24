import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import { memberAPI, foodPhotoAPI } from '../../services/api';

export default function FoodScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [detectedFood, setDetectedFood] = useState<any>(null);
    const cameraRef = useRef<any>(null);

    // Request camera permission if not granted
    if (!permission) {
        return <View style={styles.container}><ActivityIndicator /></View>;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.permissionContainer}>
                    <MaterialIcons name="camera-alt" size={64} color={colors.text.muted} />
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionText}>
                        We need access to your camera to scan food items
                    </Text>
                    <Button title="Grant Permission" onPress={requestPermission} />
                </View>
            </SafeAreaView>
        );
    }

    const takePicture = async () => {
        if (!cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
            });
            setCapturedImage(photo.uri);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to capture photo');
        }
    };

    const analyzeFoodPhoto = async () => {
        if (!capturedImage) return;

        setAnalyzing(true);
        try {
            // In production, upload to Supabase Storage or Cloudinary first
            // For now, using a placeholder - you'll need to implement upload

            // This is a demo - you need to upload the image first and get a public URL
            const response = await foodPhotoAPI.analyzePhoto(capturedImage);

            if (response.success) {
                setDetectedFood(response.food);
            } else {
                Alert.alert('Analysis Failed', 'Could not detect food in image');
            }
        } catch (error: any) {

            Alert.alert('Error', error.message || 'Failed to analyze food');
        } finally {
            setAnalyzing(false);
        }
    };

    const logFood = async () => {
        if (!detectedFood) return;

        try {
            // Navigate to calorie log screen with pre-filled data
            router.push({
                pathname: '/log/calories',
                params: {
                    foodName: detectedFood.name,
                    calories: detectedFood.calories,
                    protein: detectedFood.protein_g,
                    carbs: detectedFood.carbs_g,
                    fat: detectedFood.fat_g,
                    source: 'camera_scan'
                }
            });
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        }
    };

    const retake = () => {
        setCapturedImage(null);
        setDetectedFood(null);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Food</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Camera or Preview */}
            <View style={styles.cameraContainer}>
                {!capturedImage ? (
                    <CameraView style={styles.camera} ref={cameraRef} facing="back">
                        <View style={styles.cameraOverlay}>
                            <View style={styles.scanFrame} />
                            <Text style={styles.scanHint}>
                                Center your food in the frame
                            </Text>
                        </View>
                    </CameraView>
                ) : (
                    <Image source={{ uri: capturedImage }} style={styles.preview} />
                )}
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {!capturedImage ? (
                    <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                        <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                ) : detectedFood ? (
                    <GlassCard style={styles.resultCard}>
                        <View style={styles.foodInfo}>
                            <MaterialIcons name="restaurant" size={32} color={colors.primary} />
                            <Text style={styles.foodName}>{detectedFood.name}</Text>
                        </View>

                        <View style={styles.macros}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.calories}</Text>
                                <Text style={styles.macroLabel}>Calories</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.protein_g}g</Text>
                                <Text style={styles.macroLabel}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.carbs_g}g</Text>
                                <Text style={styles.macroLabel}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.fat_g}g</Text>
                                <Text style={styles.macroLabel}>Fat</Text>
                            </View>
                        </View>

                        <View style={styles.buttonRow}>
                            <Button
                                title="Retake"
                                onPress={retake}
                                variant="outline"
                                style={{ flex: 1 }}
                            />
                            <Button
                                title="Log Food"
                                onPress={logFood}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </GlassCard>
                ) : (
                    <View style={styles.analyzeContainer}>
                        <Button
                            title={analyzing ? "Analyzing..." : "Analyze Photo"}
                            onPress={analyzeFoodPhoto}
                            loading={analyzing}
                            fullWidth
                        />
                        <TouchableOpacity onPress={retake} style={styles.retakeLink}>
                            <Text style={styles.retakeText}>Retake Photo</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    cameraContainer: {
        flex: 1,
        marginHorizontal: spacing.lg,
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 280,
        height: 280,
        borderWidth: 3,
        borderColor: colors.primary,
        borderRadius: borderRadius.xl,
        backgroundColor: 'transparent',
    },
    scanHint: {
        marginTop: spacing.xl,
        color: 'white',
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
    },
    preview: {
        flex: 1,
        resizeMode: 'cover',
    },
    controls: {
        padding: spacing.xl,
    },
    captureButton: {
        alignSelf: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
    },
    analyzeContainer: {
        gap: spacing.md,
    },
    retakeLink: {
        alignSelf: 'center',
        padding: spacing.sm,
    },
    retakeText: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
    },
    resultCard: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    foodInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    foodName: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        flex: 1,
    },
    macros: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: spacing.md,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    macroLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
    },
    permissionTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    permissionText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        textAlign: 'center',
    },
});
