jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req,res,next) => { req.user={id:'new-account'}; next(); }, authenticateAdmin: (req,res,next) => next() }));
jest.mock('../services/pushNotifications', () => ({}));
const express=require('express'), request=require('supertest');
const db=require('../config/database');
const client={query:jest.fn(async()=>({rows:[]})),release:jest.fn()};
const app=express(); app.use(express.json()); app.use(require('../routes/notifications')); app.use(require('../utils/errors').errorHandler);
beforeEach(()=>{jest.clearAllMocks();db.getClient.mockResolvedValue(client);});
it('transfers a device token away from the previous account in one transaction',async()=>{
    const res=await request(app).post('/register').send({token:'ExponentPushToken[device]',platform:'ios'});
    expect(res.status).toBe(200);
    expect(client.query.mock.calls.some(([sql])=>sql.includes('push_token = NULL') && sql.includes('id <>'))).toBe(true);
    expect(client.query).toHaveBeenCalledWith('COMMIT'); expect(client.release).toHaveBeenCalledTimes(1);
});
it('removes stored device registrations as well as the active token on logout',async()=>{
    const res=await request(app).delete('/unregister');
    expect(res.status).toBe(200);
    expect(db.query.mock.calls.some(([sql])=>sql.includes('DELETE FROM push_tokens'))).toBe(true);
});
