const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Search for workout videos
 */
async function searchWorkoutVideos(query, maxResults = 10) {
    try {
        const response = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: query + ' workout',
                type: 'video',
                maxResults: maxResults,
                key: YOUTUBE_API_KEY,
                videoDuration: 'medium', // 4-20 minutes
                videoDefinition: 'high',
                order: 'relevance'
            }
        });

        return response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high.url,
            channel: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
    } catch (error) {
        console.error('YouTube API error:', error.response?.data || error.message);
        throw new Error('Failed to search workout videos');
    }
}

/**
 * Get video details by ID
 */
async function getVideoDetails(videoId) {
    try {
        const response = await axios.get(`${BASE_URL}/videos`, {
            params: {
                part: 'snippet,contentDetails,statistics',
                id: videoId,
                key: YOUTUBE_API_KEY
            }
        });

        const video = response.data.items[0];
        if (!video) {
            throw new Error('Video not found');
        }

        return {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails.high.url,
            channel: video.snippet.channelTitle,
            duration: video.contentDetails.duration,
            viewCount: parseInt(video.statistics.viewCount),
            likeCount: parseInt(video.statistics.likeCount),
            publishedAt: video.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${video.id}`
        };
    } catch (error) {
        console.error('YouTube API error:', error.response?.data || error.message);
        throw new Error('Failed to get video details');
    }
}

/**
 * Get trending fitness videos
 */
async function getTrendingFitnessVideos(maxResults = 20) {
    try {
        const response = await axios.get(`${BASE_URL}/search`, {
            params: {
                part: 'snippet',
                q: 'fitness workout gym',
                type: 'video',
                maxResults: maxResults,
                key: YOUTUBE_API_KEY,
                order: 'viewCount',
                publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Last week
            }
        });

        return response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high.url,
            channel: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
    } catch (error) {
        console.error('YouTube API error:', error.response?.data || error.message);
        throw new Error('Failed to get trending videos');
    }
}

module.exports = {
    searchWorkoutVideos,
    getVideoDetails,
    getTrendingFitnessVideos
};
