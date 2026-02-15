import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import logger from '../utils/logger';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Notification types for the app
export type NotificationType = 
    | 'workout_reminder'
    | 'streak_alert'
    | 'friend_activity'
    | 'class_reminder'
    | 'achievement'
    | 'general';

export interface PushNotificationData {
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
}

export const notificationService = {
    /**
     * Register for push notifications and get Expo push token
     * Works on both iOS (APNs) and Android (FCM)
     */
    registerForPushNotificationsAsync: async (): Promise<string | undefined> => {
        let token: string | undefined;

        // Android: Create notification channel
        if (Platform.OS === 'android') {
            // Default channel for general notifications
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366f1',
                sound: 'default',
            });

            // Workout reminders channel
            await Notifications.setNotificationChannelAsync('workout-reminders', {
                name: 'Workout Reminders',
                description: 'Reminders for your scheduled workouts',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366f1',
                sound: 'default',
            });

            // Streak alerts channel
            await Notifications.setNotificationChannelAsync('streak-alerts', {
                name: 'Streak Alerts',
                description: 'Alerts about your workout streak',
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
            });

            // Social activity channel
            await Notifications.setNotificationChannelAsync('social', {
                name: 'Social Activity',
                description: 'Friend activities and interactions',
                importance: Notifications.AndroidImportance.DEFAULT,
            });

            // Class reminders channel
            await Notifications.setNotificationChannelAsync('class-reminders', {
                name: 'Class Reminders',
                description: 'Reminders for upcoming classes',
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
            });
        }

        // Only works on physical devices
        if (!Device.isDevice) {
            logger.log('Push notifications require a physical device');
            return undefined;
        }

        // Check/request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            logger.warn('Push notification permission denied');
            return undefined;
        }

        // Get Expo push token
        try {
            // Get project ID from app config
            const projectId = Constants.expoConfig?.extra?.eas?.projectId 
                ?? '30c3c5e6-e055-4640-9daa-ae04f9c32ac8';
            
            const pushToken = await Notifications.getExpoPushTokenAsync({ 
                projectId 
            });
            token = pushToken.data;
            logger.log('Expo Push Token:', token);

            // Send token to backend
            await notificationService.sendTokenToBackend(token);
        } catch (error) {
            logger.error('Error getting push token:', error);
        }

        return token;
    },

    /**
     * Send push token to backend for storage
     */
    sendTokenToBackend: async (token: string): Promise<void> => {
        try {
            await api.post('/notifications/register', { 
                token,
                platform: Platform.OS,
                deviceName: Device.deviceName ?? 'Unknown'
            });
            logger.log('Push token registered with backend');
        } catch (error) {
            logger.error('Failed to register push token:', error);
        }
    },

    /**
     * Schedule a local notification
     */
    scheduleLocalNotification: async (
        notification: PushNotificationData,
        trigger: Notifications.NotificationTriggerInput
    ): Promise<string> => {
        const channelId = notificationService.getChannelForType(notification.type);
        
        return await Notifications.scheduleNotificationAsync({
            content: {
                title: notification.title,
                body: notification.body,
                data: { type: notification.type, ...notification.data },
                sound: 'default',
                ...(Platform.OS === 'android' && { channelId }),
            },
            trigger,
        });
    },

    /**
     * Schedule a workout reminder
     */
    scheduleWorkoutReminder: async (
        workoutName: string,
        scheduledTime: Date
    ): Promise<string> => {
        // Remind 30 minutes before
        const reminderTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000);
        
        return await notificationService.scheduleLocalNotification(
            {
                type: 'workout_reminder',
                title: '🏋️ Workout Time!',
                body: `Your "${workoutName}" workout starts in 30 minutes`,
                data: { workoutName, scheduledTime: scheduledTime.toISOString() }
            },
            { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime }
        );
    },

    /**
     * Schedule a streak reminder (daily at configured time)
     */
    scheduleStreakReminder: async (hour: number = 18, minute: number = 0): Promise<string> => {
        return await notificationService.scheduleLocalNotification(
            {
                type: 'streak_alert',
                title: '🔥 Keep Your Streak Alive!',
                body: "Don't forget to log your workout today",
            },
            {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            }
        );
    },

    /**
     * Cancel a scheduled notification
     */
    cancelNotification: async (notificationId: string): Promise<void> => {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
    },

    /**
     * Cancel all scheduled notifications
     */
    cancelAllNotifications: async (): Promise<void> => {
        await Notifications.cancelAllScheduledNotificationsAsync();
    },

    /**
     * Get all scheduled notifications
     */
    getScheduledNotifications: async (): Promise<Notifications.NotificationRequest[]> => {
        return await Notifications.getAllScheduledNotificationsAsync();
    },

    /**
     * Get badge count (iOS)
     */
    getBadgeCount: async (): Promise<number> => {
        return await Notifications.getBadgeCountAsync();
    },

    /**
     * Set badge count (iOS)
     */
    setBadgeCount: async (count: number): Promise<void> => {
        await Notifications.setBadgeCountAsync(count);
    },

    /**
     * Clear all delivered notifications
     */
    dismissAllNotifications: async (): Promise<void> => {
        await Notifications.dismissAllNotificationsAsync();
    },

    /**
     * Add listener for received notifications (foreground)
     */
    addNotificationListener: (
        callback: (notification: Notifications.Notification) => void
    ): Notifications.Subscription => {
        return Notifications.addNotificationReceivedListener(callback);
    },

    /**
     * Add listener for notification responses (user tapped)
     */
    addResponseListener: (
        callback: (response: Notifications.NotificationResponse) => void
    ): Notifications.Subscription => {
        return Notifications.addNotificationResponseReceivedListener(callback);
    },

    /**
     * Get the appropriate Android channel for notification type
     */
    getChannelForType: (type: NotificationType): string => {
        const channelMap: Record<NotificationType, string> = {
            'workout_reminder': 'workout-reminders',
            'streak_alert': 'streak-alerts',
            'friend_activity': 'social',
            'class_reminder': 'class-reminders',
            'achievement': 'default',
            'general': 'default',
        };
        return channelMap[type] || 'default';
    },

    /**
     * Check if notifications are enabled
     */
    areNotificationsEnabled: async (): Promise<boolean> => {
        const { status } = await Notifications.getPermissionsAsync();
        return status === 'granted';
    },

    /**
     * Request notification permissions
     */
    requestPermissions: async (): Promise<boolean> => {
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    }
};

export default notificationService;
