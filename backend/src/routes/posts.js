const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../utils/errors');

/**
 * POST /api/posts
 * Create a new post
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { content, visibility = 'friends' } = req.body;
    const userId = req.user.id;

    // Validation
    if (!content || content.trim().length === 0) {
        throw new ValidationError('Post content is required');
    }

    if (content.length > 5000) {
        throw new ValidationError('Post content must be less than 5000 characters');
    }

    if (!['public', 'friends'].includes(visibility)) {
        throw new ValidationError('Visibility must be either "public" or "friends"');
    }

    // Create post
    const result = await query(
        `INSERT INTO posts (user_id, content, visibility) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_id, content, visibility, likes_count, comments_count, created_at`,
        [userId, content.trim(), visibility]
    );

    const post = result.rows[0];

    // Get user info
    const userResult = await query(
        'SELECT name, avatar_url FROM users WHERE id = $1',
        [userId]
    );

    res.status(201).json({
        message: 'Post created successfully! 🎉',
        post: {
            ...post,
            user_name: userResult.rows[0].name,
            user_avatar: userResult.rows[0].avatar_url,
            liked_by_me: false
        }
    });
}));

/**
 * GET /api/posts/feed
 * Get posts feed (friends + public based on visibility)
 */
router.get('/feed', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Get posts from friends and public posts
    const result = await query(
        `SELECT 
            p.id,
            p.user_id,
            p.content,
            p.visibility,
            p.likes_count,
            p.comments_count,
            p.created_at,
            u.name as user_name,
            u.avatar_url as user_avatar,
            EXISTS(
                SELECT 1 FROM post_likes pl 
                WHERE pl.post_id = p.id AND pl.user_id = $1
            ) as liked_by_me,
            CASE
                WHEN p.user_id = $1 THEN true
                ELSE false
            END as is_my_post
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE 
            -- Include my posts
            p.user_id = $1
            -- Include public posts
            OR p.visibility = 'public'
            -- Include friends-only posts from my friends
            OR (p.visibility = 'friends' AND EXISTS (
                SELECT 1 FROM friendships f
                WHERE (f.user_id = $1 AND f.friend_id = p.user_id AND f.status = 'accepted')
                   OR (f.friend_id = $1 AND f.user_id = p.user_id AND f.status = 'accepted')
            ))
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );

    res.json({
        posts: result.rows,
        count: result.rows.length,
        hasMore: result.rows.length === limit
    });
}));

/**
 * GET /api/posts/:id
 * Get a specific post
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
        `SELECT 
            p.id,
            p.user_id,
            p.content,
            p.visibility,
            p.likes_count,
            p.comments_count,
            p.created_at,
            u.name as user_name,
            u.avatar_url as user_avatar,
            EXISTS(
                SELECT 1 FROM post_likes pl 
                WHERE pl.post_id = p.id AND pl.user_id = $1
            ) as liked_by_me,
            CASE
                WHEN p.user_id = $1 THEN true
                ELSE false
            END as is_my_post
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = $2`,
        [userId, id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post: result.rows[0] });
}));

/**
 * POST /api/posts/:id/like
 * Like a post
 */
router.post('/:id/like', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already liked
    const likeCheck = await query(
        'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
        [id, userId]
    );

    if (likeCheck.rows.length > 0) {
        return res.json({ message: 'Already liked', liked: true });
    }

    // Add like
    await query(
        'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
        [id, userId]
    );

    // Get updated post
    const result = await query(
        'SELECT likes_count FROM posts WHERE id = $1',
        [id]
    );

    res.json({
        message: 'Post liked! 💪',
        liked: true,
        likes_count: result.rows[0].likes_count
    });
}));

/**
 * DELETE /api/posts/:id/like
 * Unlike a post
 */
router.delete('/:id/like', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Remove like
    await query(
        'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
        [id, userId]
    );

    // Get updated post
    const result = await query(
        'SELECT likes_count FROM posts WHERE id = $1',
        [id]
    );

    res.json({
        message: 'Post unliked',
        liked: false,
        likes_count: result.rows[0]?.likes_count || 0
    });
}));

/**
 * GET /api/posts/:id/comments
 * Get comments for a post
 */
router.get('/:id/comments', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT 
            pc.id,
            pc.comment,
            pc.created_at,
            pc.user_id,
            u.name as user_name,
            u.avatar_url as user_avatar
        FROM post_comments pc
        JOIN users u ON pc.user_id = u.id
        WHERE pc.post_id = $1
        ORDER BY pc.created_at ASC`,
        [id]
    );

    res.json({ comments: result.rows });
}));

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post
 */
router.post('/:id/comments', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    if (!comment || comment.trim().length === 0) {
        throw new ValidationError('Comment text is required');
    }

    if (comment.length > 1000) {
        throw new ValidationError('Comment must be less than 1000 characters');
    }

    // Check if post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
    }

    // Add comment
    const result = await query(
        `INSERT INTO post_comments (post_id, user_id, comment) 
         VALUES ($1, $2, $3) 
         RETURNING id, comment, created_at`,
        [id, userId, comment.trim()]
    );

    // Get user info
    const userResult = await query(
        'SELECT name, avatar_url FROM users WHERE id = $1',
        [userId]
    );

    // Get updated comments count
    const postResult = await query(
        'SELECT comments_count FROM posts WHERE id = $1',
        [id]
    );

    res.status(201).json({
        message: 'Comment added! 💬',
        comment: {
            ...result.rows[0],
            user_id: userId,
            user_name: userResult.rows[0].name,
            user_avatar: userResult.rows[0].avatar_url
        },
        comments_count: postResult.rows[0].comments_count
    });
}));

/**
 * DELETE /api/posts/:id
 * Delete a post (creator only)
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists and user is the creator
    const postCheck = await query(
        'SELECT user_id FROM posts WHERE id = $1',
        [id]
    );

    if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
    }

    if (postCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    // Delete post (cascades to likes and comments)
    await query('DELETE FROM posts WHERE id = $1', [id]);

    res.json({ message: 'Post deleted successfully' });
}));

/**
 * PUT /api/posts/:id
 * Update a post (creator only)
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, visibility } = req.body;
    const userId = req.user.id;

    // Validation
    if (!content || content.trim().length === 0) {
        throw new ValidationError('Post content is required');
    }

    if (content.length > 5000) {
        throw new ValidationError('Post content must be less than 5000 characters');
    }

    if (visibility && !['public', 'friends'].includes(visibility)) {
        throw new ValidationError('Visibility must be either "public" or "friends"');
    }

    // Check if post exists and user is the creator
    const postCheck = await query(
        'SELECT user_id FROM posts WHERE id = $1',
        [id]
    );

    if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
    }

    if (postCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    // Update post
    const updateFields = ['content = $1'];
    const values = [content.trim()];
    let paramCount = 2;

    if (visibility) {
        updateFields.push(`visibility = $${paramCount}`);
        values.push(visibility);
        paramCount++;
    }

    values.push(id);

    const result = await query(
        `UPDATE posts 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, user_id, content, visibility, likes_count, comments_count, created_at, updated_at`,
        values
    );

    res.json({
        message: 'Post updated successfully! ✏️',
        post: result.rows[0]
    });
}));

module.exports = router;
