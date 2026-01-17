const express = require('express');
const router = express.Router();
const exerciseDB = require('../services/exercisedb');
const { authenticate } = require('../middleware/auth');

// Get all exercises (with pagination)
router.get('/', authenticate, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const exercises = await exerciseDB.getAllExercises(parseInt(limit), parseInt(offset));
        res.json({ success: true, exercises, count: exercises.length });
    } catch (error) {
        console.error('Error fetching exercises:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search exercises by name
router.get('/search/:query', authenticate, async (req, res) => {
    try {
        const { query } = req.params;
        const exercises = await exerciseDB.searchExercises(query);
        res.json({ success: true, exercises, count: exercises.length });
    } catch (error) {
        console.error('Error searching exercises:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get exercises by body part
router.get('/bodypart/:bodyPart', authenticate, async (req, res) => {
    try {
        const { bodyPart } = req.params;
        const exercises = await exerciseDB.getExercisesByBodyPart(bodyPart);
        res.json({ success: true, exercises, count: exercises.length });
    } catch (error) {
        console.error('Error fetching exercises by body part:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get exercises by target muscle
router.get('/target/:target', authenticate, async (req, res) => {
    try {
        const { target } = req.params;
        const exercises = await exerciseDB.getExercisesByTarget(target);
        res.json({ success: true, exercises, count: exercises.length });
    } catch (error) {
        console.error('Error fetching exercises by target:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get exercises by equipment
router.get('/equipment/:equipment', authenticate, async (req, res) => {
    try {
        const { equipment } = req.params;
        const exercises = await exerciseDB.getExercisesByEquipment(equipment);
        res.json({ success: true, exercises, count: exercises.length });
    } catch (error) {
        console.error('Error fetching exercises by equipment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get exercise details by ID
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const exercise = await exerciseDB.getExerciseById(id);
        res.json({ success: true, exercise });
    } catch (error) {
        console.error('Error fetching exercise details:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get list of body parts
router.get('/lists/bodyparts', authenticate, async (req, res) => {
    try {
        const bodyParts = await exerciseDB.getBodyPartList();
        res.json({ success: true, bodyParts });
    } catch (error) {
        console.error('Error fetching body part list:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get list of target muscles
router.get('/lists/targets', authenticate, async (req, res) => {
    try {
        const targets = await exerciseDB.getTargetList();
        res.json({ success: true, targets });
    } catch (error) {
        console.error('Error fetching target list:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
