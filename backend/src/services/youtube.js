const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Search for workout videos
 */
// Mock Data
function getMockVideos() {
    return [
        {
            id: 'mock_vid_1',
            title: '15 Min Full Body Workout (No Equipment)',
            description: 'A quick and effective workout you can do anywhere.',
            thumbnail: 'https://img.youtube.com/vi/ubHcK85_4XQ/hqdefault.jpg',
            channel: 'Fitzo Coach',
            publishedAt: new Date().toISOString(),
            url: 'https://www.youtube.com/watch?v=ubHcK85_4XQ'
        },
        {
            id: 'mock_vid_2',
            title: 'Perfect Pushup Form Guide',
            description: 'Learn how to do a pushup correctly to avoid injury.',
            thumbnail: 'https://img.youtube.com/vi/IODxDxX7oi4/hqdefault.jpg',
            channel: 'Fitness Pro',
            publishedAt: new Date().toISOString(),
            url: 'https://www.youtube.com/watch?v=IODxDxX7oi4'
        },
        {
            id: 'mock_vid_3',
            title: 'HIIT Cardio for Fat Loss',
            description: 'Intense cardio session to burn calories fast.',
            thumbnail: 'https://img.youtube.com/vi/ml6cT4AZdqI/hqdefault.jpg',
            channel: 'Cardio King',
            publishedAt: new Date().toISOString(),
            url: 'https://www.youtube.com/watch?v=ml6cT4AZdqI'
        }
    ];
}

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
        console.error('YouTube API error (Switching to MOCK):', error.response?.data || error.message);
        return getMockVideos();
    }
}

/**
 * Get video details by ID
 */
async function getVideoDetails(videoId) {
    try {
        if (videoId.startsWith('mock_')) {
            const mock = getMockVideos().find(v => v.id === videoId) || getMockVideos()[0];
            return {
                ...mock,
                duration: 'PT15M',
                viewCount: 15000,
                likeCount: 500
            };
        }

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
        console.error('YouTube API error (Switching to MOCK):', error.response?.data || error.message);
        // Return mock detail
        const mock = getMockVideos()[0];
        return {
            ...mock,
            id: videoId,
            duration: 'PT15M',
            viewCount: 10000,
            likeCount: 200
        };
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
        console.error('YouTube API error (Switching to MOCK):', error.response?.data || error.message);
        return getMockVideos();
    }
}

module.exports = {
    searchWorkoutVideos,
    getVideoDetails,
    getTrendingFitnessVideos
};
