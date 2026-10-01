const router=require('express').Router();
const {authenticate}=require('../middleware/auth');
const {aiQuota}=require('../middleware/aiQuota');
const {asyncHandler}=require('../utils/errors');
const {jobs,failure}=require('../services/aiJobs');
const publicJob=j=>({id:j.id,status:j.status,result:j.result,errorCode:j.error_code,expiresAt:j.expires_at,apiFallbackAvailable:process.env.AI_WORKER_API_FALLBACK==='true'&&Boolean(process.env.GEMINI_API_KEY)});
const photoPayload=req=>({prompt:'Identify every visible food item and estimate nutrition for the pictured serving. Use correct Indian food names when applicable. Include serving sizes. Return the required schema. If no food is visible, report failure rather than inventing food.',image:req.body.image,mimeType:req.body.mimeType||'image/jpeg'});
const quotaUnlessDuplicate=asyncHandler(async(req,res,next)=>{
    if(process.env.AI_PROVIDER!=='laptop-worker')return next();
    const {query}=require('../config/database');
    const {hash}=require('../services/aiJobs');
    const digest=hash(JSON.stringify({feature:'food_photo',payload:photoPayload(req)}));
    const existing=(await query('SELECT id FROM ai_jobs WHERE user_id=$1 AND idempotency_key=$2 AND input_hash=$3',[req.user.id,req.headers['idempotency-key']||'',digest])).rows[0];
    if(existing)return next();
    return aiQuota(req,res,next);
});
router.use(authenticate);
router.get('/capabilities',asyncHandler(async(req,res)=>res.json({provider:process.env.AI_PROVIDER||'gemini',foodJobs:process.env.AI_PROVIDER==='laptop-worker',apiFallback:process.env.AI_WORKER_API_FALLBACK==='true',audio:process.env.AI_WORKER_API_FALLBACK==='true'})));
router.post('/food-photo',quotaUnlessDuplicate,asyncHandler(async(req,res)=>{
    if(process.env.AI_PROVIDER!=='laptop-worker')throw failure('Photo jobs are disabled.',503);
    const payload=photoPayload(req);
    let j;
    try{j=await jobs().enqueue(req.user.id,req.headers['idempotency-key'],'food_photo',payload);}
    catch(error){
        if(['AI_UNAVAILABLE','QUEUE_FULL'].includes(error.code) && process.env.AI_WORKER_API_FALLBACK==='true' && process.env.GEMINI_API_KEY){
            // Explicitly configured fallback; the existing synchronous endpoint remains available.
            return res.status(503).json({code:'WORKER_FALLBACK_AVAILABLE',message:'The laptop is unavailable; the configured API fallback can process this scan.'});
        }
        throw error;
    }
    res.status(202).json(publicJob(j));
}));
router.get('/by-request/:key',asyncHandler(async(req,res)=>{
    const {query}=require('../config/database');
    const j=(await query('SELECT id FROM ai_jobs WHERE user_id=$1 AND idempotency_key=$2',[req.user.id,req.params.key])).rows[0];
    if(!j)throw failure('Job not found.',404,'NOT_FOUND');
    res.json(publicJob(await jobs().get(req.user.id,j.id)));
}));
router.get('/:id',asyncHandler(async(req,res)=>res.json(publicJob(await jobs().get(req.user.id,req.params.id)))));
router.delete('/:id',asyncHandler(async(req,res)=>{await jobs().cancel(req.user.id,req.params.id);res.json({ok:true});}));
module.exports=router;
