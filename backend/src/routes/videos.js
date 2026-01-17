const express = require('express');
const router = express.Router();
const youtube = require('../services/youtube');
const { authenticate } = require('../middleware/auth');

// Search workout videos
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const videos = await youtube.searchWorkoutVideos(q, parseInt(limit));
        res.json({ success: true, videos, count: videos.length });
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get trending fitness videos
router.get('/trending', authenticate, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const videos = await youtube.getTrendingFitnessVideos(parseInt(limit));
        res.json({ success: true, videos, count: videos.length });
    } catch (error) {
        console.error('Error getting trending videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get video details
router.get('/:videoId', authenticate, async (req, res) => {
    try {
        const { videoId } = req.params;
        const video = await youtube.getVideoDetails(videoId);
        res.json({ success: true, video });
    } catch (error) {
        console.error('Error getting video details:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
