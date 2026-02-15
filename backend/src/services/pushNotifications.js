/**
 * Push Notification Service
 * Uses Expo Push API to send notifications to iOS (APNs) and Android (FCM)
 * 
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

const { query } = require('../config/database');

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Notification types matching the mobile app
 */
const NotificationType = {
    WORKOUT_REMINDER: 'workout_reminder',
    STREAK_ALERT: 'streak_alert',
    FRIEND_ACTIVITY: 'friend_activity',
    CLASS_REMINDER: 'class_reminder',
    ACHIEVEMENT: 'achievement',
    GENERAL: 'general'
};

/**
 * Send a push notification to a single user
 * @param {string} userId - User ID to send notification to
 * @param {Object} notification - Notification content
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.type - Notification type for categorization
 * @param {Object} notification.data - Additional data payload
 */
async function sendToUser(userId, notification) {
    const result = await query(
        'SELECT push_token FROM users WHERE id = $1 AND push_token IS NOT NULL',
        [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].push_token) {
        console.log(`No push token for user ${userId}`);
        return { success: false, reason: 'no_token' };
    }

    const token = result.rows[0].push_token;
    return await sendNotification(token, notification);
}

/**
 * Send push notifications to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {Object} notification - Notification content
 */
async function sendToUsers(userIds, notification) {
    const result = await query(
        'SELECT id, push_token FROM users WHERE id = ANY($1) AND push_token IS NOT NULL',
        [userIds]
    );

    const tokens = result.rows.map(row => row.push_token).filter(Boolean);
    
    if (tokens.length === 0) {
        return { success: false, reason: 'no_tokens', sent: 0 };
    }

    return await sendBulkNotifications(tokens, notification);
}

/**
 * Send push notification to a specific Expo push token
 * @param {string} token - Expo push token (ExponentPushToken[xxx])
 * @param {Object} notification - Notification content
 */
async function sendNotification(token, notification) {
    if (!isValidExpoPushToken(token)) {
        return { success: false, reason: 'invalid_token' };
    }

    const message = buildMessage(token, notification);
    
    try {
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });

        const result = await response.json();
        
        // Check for errors in the response
        if (result.data && result.data.status === 'error') {
            console.error('Push notification error:', result.data.message);
            
            // Handle invalid tokens
            if (result.data.details?.error === 'DeviceNotRegistered') {
                await removeInvalidToken(token);
            }
            
            return { success: false, reason: result.data.message };
        }

        return { success: true, ticketId: result.data?.id };
    } catch (error) {
        console.error('Failed to send push notification:', error);
        return { success: false, reason: error.message };
    }
}

/**
 * Send bulk push notifications (up to 100 at a time per Expo limits)
 * @param {string[]} tokens - Array of Expo push tokens
 * @param {Object} notification - Notification content
 */
async function sendBulkNotifications(tokens, notification) {
    const validTokens = tokens.filter(isValidExpoPushToken);
    
    if (validTokens.length === 0) {
        return { success: false, reason: 'no_valid_tokens', sent: 0 };
    }

    // Expo allows max 100 notifications per request
    const chunks = chunkArray(validTokens, 100);
    const results = [];

    for (const chunk of chunks) {
        const messages = chunk.map(token => buildMessage(token, notification));
        
        try {
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages)
            });

            const result = await response.json();
            results.push(...(result.data || []));
            
            // Handle invalid tokens
            for (let i = 0; i < result.data?.length; i++) {
                if (result.data[i]?.details?.error === 'DeviceNotRegistered') {
                    await removeInvalidToken(chunk[i]);
                }
            }
        } catch (error) {
            console.error('Bulk notification error:', error);
        }
    }

    const successCount = results.filter(r => r.status === 'ok').length;
    return { 
        success: successCount > 0, 
        sent: successCount, 
        total: validTokens.length,
        results 
    };
}

/**
 * Build Expo push message object
 */
function buildMessage(token, notification) {
    const { title, body, type = NotificationType.GENERAL, data = {}, badge, sound = 'default' } = notification;
    
    // Map notification type to Android channel
    const channelMap = {
        [NotificationType.WORKOUT_REMINDER]: 'workout-reminders',
        [NotificationType.STREAK_ALERT]: 'streak-alerts',
        [NotificationType.FRIEND_ACTIVITY]: 'social',
        [NotificationType.CLASS_REMINDER]: 'class-reminders',
        [NotificationType.ACHIEVEMENT]: 'default',
        [NotificationType.GENERAL]: 'default',
    };

    return {
        to: token,
        title,
        body,
        data: { type, ...data },
        sound,
        badge,
        channelId: channelMap[type] || 'default',
        priority: 'high',
        ttl: 86400, // 24 hours
    };
}

/**
 * Validate Expo push token format
 */
function isValidExpoPushToken(token) {
    return typeof token === 'string' && 
           (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

/**
 * Remove invalid token from database
 */
async function removeInvalidToken(token) {
    try {
        await query(
            'UPDATE users SET push_token = NULL WHERE push_token = $1',
            [token]
        );
        console.log('Removed invalid push token');
    } catch (error) {
        console.error('Failed to remove invalid token:', error);
    }
}

/**
 * Split array into chunks
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// ============================================
// Pre-built notification templates
// ============================================

/**
 * Send workout reminder notification
 */
async function sendWorkoutReminder(userId, workoutName) {
    return await sendToUser(userId, {
        type: NotificationType.WORKOUT_REMINDER,
        title: '🏋️ Workout Time!',
        body: `Time for your "${workoutName}" workout`,
        data: { workoutName }
    });
}

/**
 * Send streak alert notification
 */
async function sendStreakAlert(userId, currentStreak) {
    return await sendToUser(userId, {
        type: NotificationType.STREAK_ALERT,
        title: '🔥 Keep Your Streak Alive!',
        body: `You're on a ${currentStreak}-day streak. Don't break it!`,
        data: { currentStreak }
    });
}

/**
 * Send friend activity notification
 */
async function sendFriendActivity(userId, friendName, activity) {
    return await sendToUser(userId, {
        type: NotificationType.FRIEND_ACTIVITY,
        title: `${friendName} just worked out!`,
        body: activity,
        data: { friendName, activity }
    });
}

/**
 * Send class reminder notification
 */
async function sendClassReminder(userId, className, startsIn) {
    return await sendToUser(userId, {
        type: NotificationType.CLASS_REMINDER,
        title: '📅 Class Starting Soon',
        body: `${className} starts in ${startsIn}`,
        data: { className, startsIn }
    });
}

/**
 * Send achievement notification
 */
async function sendAchievement(userId, achievement, description) {
    return await sendToUser(userId, {
        type: NotificationType.ACHIEVEMENT,
        title: '🏆 New Achievement!',
        body: `You unlocked: ${achievement}`,
        data: { achievement, description }
    });
}

/**
 * Send notification to all users with push tokens
 */
async function sendBroadcast(notification) {
    const result = await query(
        'SELECT push_token FROM users WHERE push_token IS NOT NULL'
    );

    const tokens = result.rows.map(row => row.push_token);
    return await sendBulkNotifications(tokens, notification);
}

module.exports = {
    NotificationType,
    sendToUser,
    sendToUsers,
    sendNotification,
    sendBulkNotifications,
    sendWorkoutReminder,
    sendStreakAlert,
    sendFriendActivity,
    sendClassReminder,
    sendAchievement,
    sendBroadcast
};
