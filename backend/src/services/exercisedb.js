const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Get all exercises (paginated)
 */
async function getAllExercises(limit = 20, offset = 0) {
    try {
        const response = await axios.get(`${BASE_URL}/exercises`, {
            params: { limit, offset },
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch exercises');
    }
}

/**
 * Get exercises by body part
 */
async function getExercisesByBodyPart(bodyPart) {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/bodyPart/${bodyPart}`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch exercises by body part');
    }
}

/**
 * Get exercises by target muscle
 */
async function getExercisesByTarget(targetMuscle) {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/target/${targetMuscle}`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch exercises by target muscle');
    }
}

/**
 * Get exercises by equipment
 */
async function getExercisesByEquipment(equipment) {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/equipment/${equipment}`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch exercises by equipment');
    }
}

/**
 * Get exercise by ID
 */
async function getExerciseById(id) {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/exercise/${id}`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch exercise details');
    }
}

/**
 * Search exercises by name
 */
async function searchExercises(query) {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/name/${query}`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to search exercises');
    }
}

/**
 * Get list of all body parts
 */
async function getBodyPartList() {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/bodyPartList`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch body part list');
    }
}

/**
 * Get list of all target muscles
 */
async function getTargetList() {
    try {
        const response = await axios.get(`${BASE_URL}/exercises/targetList`, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });
        return response.data;
    } catch (error) {
        console.error('ExerciseDB API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch target muscle list');
    }
}

module.exports = {
    getAllExercises,
    getExercisesByBodyPart,
    getExercisesByTarget,
    getExercisesByEquipment,
    getExerciseById,
    searchExercises,
    getBodyPartList,
    getTargetList
};
