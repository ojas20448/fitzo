const request = require('supertest');
const express = require('express');
const foodRoutes = require('../src/routes/food'); // Adjust path as needed

// Mock dependencies
jest.mock('../src/services/indianFood', () => ({
    searchFoods: jest.fn().mockReturnValue({ foods: [{ id: '1', name: 'Paneer', source: 'indian' }] })
}));
jest.mock('../src/services/usda', () => ({
    searchFoods: jest.fn().mockResolvedValue({ foods: [{ id: '2', name: 'Apple', source: 'usda' }] })
}));
jest.mock('../src/services/fatsecret', () => ({
    searchFoods: jest.fn().mockResolvedValue({ foods: [] })
}));

// Mock Auth Middleware
jest.mock('../src/middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'test_user_id' };
        next();
    }
}));

const app = express();
app.use(express.json());
app.use('/api/food', foodRoutes);

describe('Food API Routes', () => {
    describe('GET /api/food/search', () => {
        it('should return aggregated results from all sources', async () => {
            const res = await request(app)
                .get('/api/food/search')
                .query({ q: 'apple' });

            expect(res.statusCode).toBe(200);
            expect(res.body.foods).toHaveLength(2); // 1 Indian + 1 USDA
            expect(res.body.sources.indian).toBe(1);
            expect(res.body.sources.usda).toBe(1);
        });

        it('should handle empty query gracefully', async () => {
            const res = await request(app)
                .get('/api/food/search')
                .query({ q: '' });

            expect(res.statusCode).toBe(200);
            expect(res.body.foods).toEqual([]);
        });
    });
});
