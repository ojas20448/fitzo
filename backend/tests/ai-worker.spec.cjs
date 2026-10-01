const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID,randomBytes}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {AIJobs,hash}=require('../src/services/aiJobs');
const {schemas,validateResult,photoBytes}=require('../../ai-worker/contracts');
async function fixture(){
    const pg=new PGlite();
    await pg.exec('CREATE TABLE users(id uuid PRIMARY KEY,email text,name text,role text,gym_id uuid,trainer_id uuid,xp_points int,avatar_url text,token_version int DEFAULT 0)');
    await pg.exec(fs.readFileSync(require('node:path').join(__dirname,'../src/db/migrations/20261001_ai_worker.sql'),'utf8'));
    let gate=Promise.resolve();
    async function acquire(){let release;const old=gate;gate=new Promise(r=>release=r);await old;return release;}
    const db={query:async(...args)=>{const release=await acquire();try{return await pg.query(...args);}finally{release();}},getClient:async()=>{const release=await acquire();return {query:(...args)=>pg.query(...args),release};}};
    const user=randomUUID(),other=randomUUID(),worker=randomUUID();
    for(const id of [user,other])await db.query("INSERT INTO users(id,email,name,role) VALUES($1,'test@example.invalid','Test','member')",[id]);
    await db.query("INSERT INTO ai_worker_credentials(id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",[worker,hash('test')]);
    const q=new AIJobs(db,{limit:3});await q.pulse();
    return {pg,db,q,user,other,worker};
}
test('persistent ownership, idempotency, concurrency, leases, stale completion, retries and quota pause',async()=>{
    const {pg,db,q,user,other,worker}=await fixture();
    try{
        const payload={prompt:'Return advice'};
        const a=await q.enqueue(user,'request_001','coach',payload);
        const duplicate=await q.enqueue(user,'request_001','coach',payload);assert.equal(a.id,duplicate.id);
        await assert.rejects(q.enqueue(user,'request_001','coach',{prompt:'Different'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
        await assert.rejects(q.get(other,a.id),e=>e.code==='NOT_FOUND');
        await q.enqueue(user,'request_002','coach',payload);
        const claims=await Promise.all([q.claim(worker),q.claim(worker)]);assert.equal(claims.filter(Boolean).length,1);
        const first=claims.find(Boolean);
        await q.heartbeat(worker,first.id,first.lease_token);
        await db.query("UPDATE ai_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[first.id]);
        const reassigned=await q.claim(worker);assert.ok(reassigned);assert.notEqual(first.lease_token,reassigned.lease_token);
        await assert.rejects(q.complete(worker,first.id,first.lease_token,'old result'),e=>e.code==='STALE_LEASE');
        await assert.rejects(q.complete(worker,reassigned.id,reassigned.lease_token,{}),e=>e.code==='INVALID_OUTPUT');
        await q.complete(worker,reassigned.id,reassigned.lease_token,'Valid advice');
        await q.complete(worker,reassigned.id,reassigned.lease_token,'Valid advice');
        await assert.rejects(q.complete(worker,reassigned.id,reassigned.lease_token,'Different advice'),e=>e.code==='COMPLETION_CONFLICT');
        assert.equal((await q.get(user,reassigned.id)).payload,null);
        let b=await q.claim(worker);await q.fail(worker,b.id,b.lease_token,'PROVIDER_ERROR');
        b=await q.claim(worker);await q.fail(worker,b.id,b.lease_token,'TIMEOUT');
        b=await q.claim(worker);await q.fail(worker,b.id,b.lease_token,'TIMEOUT');
        assert.equal((await q.get(user,b.id)).status,'failed');
        const c=await q.enqueue(user,'request_003','coach',payload);const cLease=await q.claim(worker);
        await q.fail(worker,cLease.id,cLease.lease_token,'QUOTA_EXHAUSTED');assert.equal((await q.get(user,c.id)).status,'failed');
        assert.equal(await q.claim(worker),null);
        await assert.rejects(q.enqueue(user,'request_004','coach',payload),e=>e.code==='AI_UNAVAILABLE');
        await db.query("UPDATE ai_worker_state SET paused_until=NULL,last_seen=now()-interval '1 hour' WHERE id=1");
        await assert.rejects(q.enqueue(user,'request_004','coach',payload),e=>e.code==='AI_UNAVAILABLE');
        await q.pulse();
        const expired=await q.enqueue(user,'request_004','coach',payload);
        await db.query("UPDATE ai_jobs SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
        assert.equal((await q.get(user,expired.id)).status,'expired');
        for(let n=5;n<8;n++)await q.enqueue(user,`request_00${n}`,'coach',payload);
        await assert.rejects(q.enqueue(user,'request_008','coach',payload),e=>e.code==='QUEUE_FULL');
        await q.cancel(user,(await q.claim(worker)).id);
    }finally{await pg.close();}
});
test('real route contract: worker credentials cannot read user jobs; owner can recover and cancel; revoked credentials rejected',async()=>{
    const {pg,db,user,other,worker}=await fixture();
    const modulePath=require.resolve('../src/config/database');require.cache[modulePath]={id:modulePath,filename:modulePath,loaded:true,exports:db};
    process.env.AI_PROVIDER='laptop-worker';process.env.JWT_SECRET='local-test-only-secret';
    const token=randomBytes(32).toString('base64url');await db.query('UPDATE ai_worker_credentials SET token_hash=$1 WHERE id=$2',[hash(token),worker]);
    const express=require('express'),app=express();app.use(express.json({limit:'10mb'}));
    app.use('/api/ai-worker',require('../src/routes/aiWorker'));app.use('/api/ai-jobs',require('../src/routes/aiJobs'));app.use(require('../src/utils/errors').errorHandler);
    const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api`;
    const jwt=require('jsonwebtoken');const userToken=jwt.sign({userId:user},process.env.JWT_SECRET),otherToken=jwt.sign({userId:other},process.env.JWT_SECRET);
    const send=(route,credential,body,method='POST',headers={})=>fetch(base+route,{method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json',...headers},body:method==='GET'?undefined:JSON.stringify(body||{})});
    try{
        assert.equal((await send('/ai-worker/health',userToken)).status,401);
        assert.equal((await send('/ai-worker/health',token)).status,200);
        const image=fs.readFileSync(require('node:path').join(__dirname,'../../ai-worker/tests/fixtures/input.jpg')).toString('base64');
        const submitted=await send('/ai-jobs/food-photo',userToken,{image,mimeType:'image/jpeg'},'POST',{'Idempotency-Key':'scan_test_001'});assert.equal(submitted.status,202);const job=await submitted.json();
        assert.equal((await send(`/ai-jobs/${job.id}`,otherToken,null,'GET')).status,404);
        assert.equal((await send(`/ai-jobs/${job.id}`,token,null,'GET')).status,401);
        assert.equal((await send('/ai-jobs/by-request/scan_test_001',userToken,null,'GET')).status,200);
        assert.equal((await send(`/ai-jobs/${job.id}`,userToken,{},'DELETE')).status,200);
        await db.query('UPDATE ai_worker_credentials SET revoked=true WHERE id=$1',[worker]);assert.equal((await send('/ai-worker/health',token)).status,401);
    }finally{server.close();delete process.env.AI_PROVIDER;await pg.close();}
});
test('result schemas for every supported feature reject malformed output and images validate bytes',()=>{
    const sample={coach:'Advice',form:'Form advice',daily_insight:'Daily note',weekly_recap:'Weekly note',food_extract:[{item:'rice',quantity:'1 bowl'}],workout_extract:[{name:'squat',is_unilateral:false,sets:[{reps:10,weight_kg:20,rir:2}]}],nutrition:{calories:2000,macros:{protein_g:100,carbs_g:200,fats_g:60},meal_timing:['morning'],supplements:[],tips:['Rest']},workout_plan:{plan_name:'Plan',duration_weeks:4,days:[{day:'Monday',focus:'legs',exercises:[{name:'squat',sets:3,reps:'10',rest_seconds:60,notes:''}]}]},food_text:{name:'rice',serving_size:'1 bowl',calories:200,protein_g:4,carbs_g:45,fat_g:1,fiber_g:1,sugar_g:0}};
    sample.food_photo={items:[sample.food_text],total:{calories:200,protein_g:4,carbs_g:45,fat_g:1}};
    for(const feature of Object.keys(schemas)){assert.doesNotThrow(()=>validateResult(feature,sample[feature]));assert.throws(()=>validateResult(feature,null));}
    assert.throws(()=>validateResult('food_photo',{...sample.food_photo,total:{calories:1,protein_g:1,carbs_g:1,fat_g:1}}));
    assert.throws(()=>photoBytes(Buffer.from('not an image').toString('base64'),'image/jpeg'));
});
test('every text capability uses the queue, retains response contract, and explicit API fallback is opt-in',async()=>{
    const jobsModule=require('../src/services/aiJobs'),original=jobsModule.jobs;
    const requested=[];
    jobsModule.jobs=()=>({enqueue:async(userId,key,feature,payload)=>{requested.push({userId,feature,payload});return{id:'test-job'};},get:async()=>({status:'completed',result:'Validated queued result'})});
    delete require.cache[require.resolve('../src/services/aiProvider')];
    const {getModel}=require('../src/services/aiProvider');
    const context=require('../src/services/aiContext');
    let apiCalls=0;const legacy={getGenerativeModel:()=>({generateContent:async()=>{apiCalls++;return {response:{text:()=> 'API response'}};}})};
    process.env.AI_PROVIDER='laptop-worker';
    try{
        for(const feature of ['workout_plan','nutrition','coach','form','food_text','food_extract','workout_extract','daily_insight','weekly_recap']){
            const response=await context.run({userId:'authenticated-user'},()=>getModel(legacy,feature,{}).generateContent('Test input'));
            assert.equal(response.response.text(),'Validated queued result');assert.equal(requested.at(-1).feature,feature);assert.equal(requested.at(-1).userId,'authenticated-user');
        }
        assert.equal(apiCalls,0);
        await assert.rejects(getModel(legacy,'coach',{}).generateContent('Missing owner'));
        process.env.GEMINI_API_KEY='test-key-never-used';
        await assert.rejects(getModel(legacy,'transcription',{}).generateContent('audio'));assert.equal(apiCalls,0);
        process.env.AI_WORKER_API_FALLBACK='true';
        const fallback=await getModel(legacy,'transcription',{}).generateContent('audio');assert.equal(fallback.response.text(),'API response');assert.equal(apiCalls,1);
    }finally{jobsModule.jobs=original;delete process.env.AI_PROVIDER;delete process.env.GEMINI_API_KEY;delete process.env.AI_WORKER_API_FALLBACK;}
});
test('worker mode retains configured Groq transcription when API fallback is enabled',async()=>{
    const groq=require('../src/services/groq');
    const originalConfigured=groq.isConfigured,originalTranscribe=groq.transcribeAudio;
    groq.isConfigured=()=>true;groq.transcribeAudio=async()=> 'ten reps';
    process.env.AI_PROVIDER='laptop-worker';process.env.TRANSCRIPTION_PROVIDER='groq';
    delete require.cache[require.resolve('../src/services/transcription')];
    const {transcribe}=require('../src/services/transcription');
    try{
        await assert.rejects(transcribe('test','audio/wav'));
        process.env.AI_WORKER_API_FALLBACK='true';
        const result=await transcribe('test','audio/wav');assert.equal(result.provider,'groq');assert.ok(result.text);
    }finally{groq.isConfigured=originalConfigured;groq.transcribeAudio=originalTranscribe;delete process.env.AI_PROVIDER;delete process.env.TRANSCRIPTION_PROVIDER;delete process.env.AI_WORKER_API_FALLBACK;}
});
