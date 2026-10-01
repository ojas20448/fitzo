const { randomUUID, createHash } = require('node:crypto');
const { schemas, validateResult, photoBytes } = require('../../../ai-worker/contracts');
const { AppError } = require('../utils/errors');
const failure = (message, status = 503, code = 'AI_UNAVAILABLE') => new AppError(message, status, code);
const hash = value => createHash('sha256').update(value).digest('hex');
class AIJobs {
    constructor(db, options = {}) { this.db = db; this.limit = options.limit || 30; this.ttl = options.ttl || 600; this.lease = options.lease || 90; }
    async tx(fn) {
        const c = await this.db.getClient();
        try { await c.query('BEGIN'); await c.query('SELECT id FROM ai_worker_state WHERE id=1 FOR UPDATE'); const r = await fn(c); await c.query('COMMIT'); return r; }
        catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    }
    async recover(c) {
        await c.query(`UPDATE ai_jobs SET status='expired', payload=NULL, result=NULL, error_code='JOB_EXPIRED', finished_at=now() WHERE expires_at<=now() AND status IN ('queued','running')`);
        await c.query(`UPDATE ai_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END, error_code=CASE WHEN attempts>=3 THEN 'WORKER_TIMEOUT' ELSE NULL END, payload=CASE WHEN attempts>=3 THEN NULL ELSE payload END, lease_until=NULL, lease_token=NULL, worker_id=NULL WHERE status='running' AND lease_until<=now()`);
        await c.query(`DELETE FROM ai_jobs WHERE expires_at < now()-interval '1 day'`);
    }
    async enqueue(userId, key, feature, payload) {
        if (!userId || !schemas[feature]) throw failure('This AI capability is unavailable.', 503, 'UNSUPPORTED_CAPABILITY');
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(key || '')) throw failure('A request ID is required.', 400, 'INVALID_REQUEST_ID');
        if (!payload || typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 64000) throw failure('Input is too large or incomplete.', 400, 'INVALID_INPUT');
        if (feature === 'food_photo') {
            try { photoBytes(payload.image, payload.mimeType); } catch { throw failure('Use a JPEG or PNG photo smaller than 5 MB.', 400, 'INVALID_PHOTO'); }
        } else if (payload.image) throw failure('This feature accepts text only.', 400, 'INVALID_INPUT');
        const digest = hash(JSON.stringify({ feature, payload }));
        return this.tx(async c => {
            await this.recover(c);
            const old = (await c.query('SELECT * FROM ai_jobs WHERE user_id=$1 AND idempotency_key=$2', [userId, key])).rows[0];
            if (old) { if (old.input_hash !== digest) throw failure('Request ID was already used for another input.', 409, 'IDEMPOTENCY_CONFLICT'); return old; }
            const state = (await c.query('SELECT *, last_seen > now()-interval \'45 seconds\' AS online, paused_until>now() AS paused FROM ai_worker_state WHERE id=1')).rows[0];
            if (state.paused || !state.online) throw failure('The laptop worker is unavailable. Try again later.');
            const count = (await c.query(`SELECT count(*)::int AS n FROM ai_jobs WHERE status IN ('queued','running')`)).rows[0].n;
            if (count >= this.limit) throw failure('The AI queue is full. Try again later.', 503, 'QUEUE_FULL');
            return (await c.query(`INSERT INTO ai_jobs(id,user_id,feature,idempotency_key,input_hash,payload,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+$7*interval '1 second') RETURNING *`, [randomUUID(),userId,feature,key,digest,JSON.stringify(payload),this.ttl])).rows[0];
        });
    }
    async get(userId, id) {
        return this.tx(async c => { await this.recover(c); const job = (await c.query('SELECT * FROM ai_jobs WHERE id=$1 AND user_id=$2', [id,userId])).rows[0]; if (!job) throw failure('Job not found.',404,'NOT_FOUND'); return job; });
    }
    async pulse() { await this.db.query('UPDATE ai_worker_state SET last_seen=now() WHERE id=1'); }
    async sweep() { return this.tx(c=>this.recover(c)); }
    async claim(workerId) {
        return this.tx(async c => {
            await this.recover(c);
            await c.query('UPDATE ai_worker_state SET last_seen=now() WHERE id=1');
            const state = (await c.query('SELECT paused_until>now() AS paused FROM ai_worker_state WHERE id=1')).rows[0];
            if (state.paused) return null;
            // The state row lock serializes every claim across all backend instances.
            if ((await c.query(`SELECT id FROM ai_jobs WHERE status='running' LIMIT 1`)).rows.length) return null;
            const job = (await c.query(`SELECT id FROM ai_jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
            if (!job) return null;
            return (await c.query(`UPDATE ai_jobs SET status='running', attempts=attempts+1, worker_id=$2, lease_token=$3, lease_until=now()+$4*interval '1 second' WHERE id=$1 RETURNING *`, [job.id,workerId,randomUUID(),this.lease])).rows[0];
        });
    }
    async owned(c, workerId, id, token, allowCompleted = false) {
        const job = (await c.query('SELECT *, lease_until>now() AND expires_at>now() AS live FROM ai_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if (!job || job.worker_id !== workerId || job.lease_token !== token || (!(allowCompleted && job.status === 'completed') && (job.status !== 'running' || !job.live))) throw failure('The job lease is stale.',409,'STALE_LEASE');
        return job;
    }
    async heartbeat(workerId,id,token) {
        return this.tx(async c => { await this.owned(c,workerId,id,token); await c.query(`UPDATE ai_jobs SET lease_until=now()+$2*interval '1 second' WHERE id=$1`,[id,this.lease]); await c.query('UPDATE ai_worker_state SET last_seen=now() WHERE id=1'); });
    }
    async complete(workerId,id,token,result) {
        return this.tx(async c => {
            const j = await this.owned(c,workerId,id,token,true);
            try { validateResult(j.feature,result); } catch { throw failure('The AI response was incomplete.',400,'INVALID_OUTPUT'); }
            if (j.status === 'completed') { if (!require('node:util').isDeepStrictEqual(j.result,result)) throw failure('Completion differs from the saved result.',409,'COMPLETION_CONFLICT'); return; }
            await c.query(`UPDATE ai_jobs SET status='completed', result=$2, payload=NULL, finished_at=now() WHERE id=$1`,[id,JSON.stringify(result)]);
        });
    }
    async fail(workerId,id,token,code) {
        const allowed = ['QUOTA_EXHAUSTED','AUTH_REQUIRED','INVALID_OUTPUT','PROVIDER_ERROR','TIMEOUT','UNSUPPORTED_CAPABILITY','PERMISSION_DENIED'];
        if (!allowed.includes(code)) code='PROVIDER_ERROR';
        return this.tx(async c => {
            const j=await this.owned(c,workerId,id,token);
            const pause=['QUOTA_EXHAUSTED','AUTH_REQUIRED','PERMISSION_DENIED'].includes(code);
            if (pause) await c.query(`UPDATE ai_worker_state SET paused_until=now()+interval '24 hours', pause_reason=$1 WHERE id=1`,[code]);
            const retry=!pause && ['TIMEOUT','PROVIDER_ERROR'].includes(code) && j.attempts<3;
            await c.query(`UPDATE ai_jobs SET status=$2,error_code=$3,payload=CASE WHEN $2='queued' THEN payload ELSE NULL END,lease_token=NULL,lease_until=NULL,worker_id=NULL,finished_at=CASE WHEN $2='queued' THEN NULL ELSE now() END WHERE id=$1`,[id,retry?'queued':'failed',code]);
        });
    }
    async cancel(userId,id) {
        return this.tx(async c => { await c.query(`UPDATE ai_jobs SET status='expired', payload=NULL, error_code='CANCELLED', lease_token=NULL,lease_until=NULL WHERE id=$1 AND user_id=$2 AND status IN ('queued','running')`,[id,userId]); });
    }
}
let instance;
function jobs() { return instance ||= new AIJobs(require('../config/database'), { limit:Number(process.env.AI_QUEUE_LIMIT||30) }); }
module.exports = { AIJobs, jobs, hash, failure };
