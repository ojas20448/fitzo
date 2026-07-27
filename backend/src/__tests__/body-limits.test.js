/**
 * Regression test for the food-photo upload 413.
 *
 * Bug: `app.use(express.json({ limit: '1mb' }))` was registered globally BEFORE
 * the router, so the `express.json({ limit: '10mb' })` declared on
 * POST /api/food/analyze-photo never ran — express.json sets `req._body` and
 * every later parser short-circuits on it. Every real phone photo (base64 of a
 * 12MP JPEG is ~2-4MB) was rejected with a 413 before reaching the route, and
 * the error handler reported it as a generic "Something went wrong".
 *
 * These tests pin the middleware ORDER, which is the actual load-bearing detail.
 */

const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../utils/errors');

const LARGE_BODY_ROUTES = ['/api/food/analyze-photo', '/api/ai/transcribe'];

/** Mirrors the parser ordering in src/index.js */
const buildApp = ({ largeFirst }) => {
    const app = express();

    if (largeFirst) {
        LARGE_BODY_ROUTES.forEach((r) => app.use(r, express.json({ limit: '10mb' })));
    }

    app.use(express.json({ limit: '1mb' }));

    if (!largeFirst) {
        // The buggy arrangement: route-level limit mounted after the global one.
        LARGE_BODY_ROUTES.forEach((r) => app.use(r, express.json({ limit: '10mb' })));
    }

    app.post('/api/food/analyze-photo', (req, res) => res.json({ ok: true, bytes: req.body.image.length }));
    app.post('/api/food/analyze-text', (req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    return app;
};

const payload = (chars) => ({ image: 'A'.repeat(chars), mimeType: 'image/jpeg' });

describe('request body limits', () => {
    // Silence the errorHandler's console.error during expected-failure tests
    let spy;
    beforeAll(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
    afterAll(() => spy.mockRestore());

    it('reproduces the bug: route-level limit after the global parser is a no-op', async () => {
        const res = await request(buildApp({ largeFirst: false }))
            .post('/api/food/analyze-photo')
            .send(payload(2_000_000));

        expect(res.status).toBe(413); // this is what TestFlight users hit
    });

    it('accepts a realistic 2MB photo payload when the large parser runs first', async () => {
        const res = await request(buildApp({ largeFirst: true }))
            .post('/api/food/analyze-photo')
            .send(payload(2_000_000));

        expect(res.status).toBe(200);
        expect(res.body.bytes).toBe(2_000_000);
    });

    it('still caps the oversized case at 10mb', async () => {
        const res = await request(buildApp({ largeFirst: true }))
            .post('/api/food/analyze-photo')
            .send(payload(11_000_000));

        expect(res.status).toBe(413);
    });

    it('keeps the 1mb limit on ordinary routes', async () => {
        const res = await request(buildApp({ largeFirst: true }))
            .post('/api/food/analyze-text')
            .send(payload(2_000_000));

        expect(res.status).toBe(413);
    });

    it('returns an actionable 413 message, not "Something went wrong"', async () => {
        const res = await request(buildApp({ largeFirst: true }))
            .post('/api/food/analyze-text')
            .send(payload(2_000_000));

        expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
        expect(res.body.message).toMatch(/too large/i);
        expect(res.body.message).not.toMatch(/something went wrong/i);
    });
});
