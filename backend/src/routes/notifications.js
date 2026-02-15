const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { authenticate, authenticateAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');
const pushNotifications = require('../services/pushNotifications');

// ============================================
// Push Token Management
// ============================================

// Register push token
router.post('/register', authenticate, asyncHandler(async (req, res) => {
    const { token, platform, deviceName } = req.body;
    const userId = req.user.id;

    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    // Validate token format
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        return res.status(400).json({ message: 'Invalid push token format' });
    }

    await query(
        `UPDATE users 
         SET push_token = $1, 
             push_platform = $2, 
             push_device_name = $3,
             push_registered_at = NOW()
         WHERE id = $4`,
        [token, platform || 'unknown', deviceName || 'Unknown Device', userId]
    );

    res.json({ message: 'Push token registered successfully' });
}));

// Unregister push token (logout/disable notifications)
router.delete('/unregister', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await query(
        'UPDATE users SET push_token = NULL, push_registered_at = NULL WHERE id = $1',
        [userId]
    );

    res.json({ message: 'Push token unregistered successfully' });
}));

// Check notification status
router.get('/status', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT push_token IS NOT NULL as registered,
                push_platform,
                push_device_name,
                push_registered_at
         FROM users WHERE id = $1`,
        [userId]
    );

    res.json({
        enabled: result.rows[0]?.registered || false,
        platform: result.rows[0]?.push_platform,
        deviceName: result.rows[0]?.push_device_name,
        registeredAt: result.rows[0]?.push_registered_at
    });
}));

// ============================================
// Notification Preferences
// ============================================

// Get notification preferences
router.get('/preferences', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT notification_preferences FROM users WHERE id = $1`,
        [userId]
    );

    const defaults = {
        workoutReminders: true,
        streakAlerts: true,
        friendActivity: true,
        classReminders: true,
        achievements: true,
        marketing: false
    };

    res.json(result.rows[0]?.notification_preferences || defaults);
}));

// Update notification preferences
router.put('/preferences', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const preferences = req.body;

    await query(
        `UPDATE users SET notification_preferences = $1 WHERE id = $2`,
        [JSON.stringify(preferences), userId]
    );

    res.json({ message: 'Preferences updated', preferences });
}));

// ============================================
// Send Notifications (Admin/System)
// ============================================

// Send test notification to self
router.post('/test', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await pushNotifications.sendToUser(userId, {
        type: pushNotifications.NotificationType.GENERAL,
        title: '🧪 Test Notification',
        body: 'Push notifications are working!',
        data: { test: true }
    });

    res.json(result);
}));

// Send notification to specific user (admin only)
router.post('/send/:userId', authenticateAdmin, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { title, body, type = 'general', data = {} } = req.body;

    if (!title || !body) {
        return res.status(400).json({ message: 'Title and body are required' });
    }

    const result = await pushNotifications.sendToUser(userId, {
        type,
        title,
        body,
        data
    });

    res.json(result);
}));

// Broadcast to all users (admin only)
router.post('/broadcast', authenticateAdmin, asyncHandler(async (req, res) => {
    const { title, body, type = 'general', data = {} } = req.body;

    if (!title || !body) {
        return res.status(400).json({ message: 'Title and body are required' });
    }

    const result = await pushNotifications.sendBroadcast({
        type,
        title,
        body,
        data
    });

    res.json(result);
}));

module.exports = router;
