const router = require('express').Router();
const { query } = require('../config/database');
const { jobs, hash, failure } = require('../services/aiJobs');
const { asyncHandler } = require('../utils/errors');
router.use(asyncHandler(async (req,res,next) => {
    if (process.env.AI_PROVIDER !== 'laptop-worker') throw failure('Worker mode is disabled.',503);
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)?.[1];
    if (!token) throw failure('Worker authentication required.',401,'WORKER_AUTH_REQUIRED');
    const credential=(await query('SELECT id FROM ai_worker_credentials WHERE token_hash=$1 AND NOT revoked AND expires_at>now()',[hash(token)])).rows[0];
    if (!credential) throw failure('Worker credential expired or revoked.',401,'WORKER_AUTH_REQUIRED');
    req.workerId=credential.id; next();
}));
router.post('/health',asyncHandler(async(req,res)=>{await jobs().pulse();res.json({ok:true});}));
router.post('/claim',asyncHandler(async(req,res)=>{
    const job=await jobs().claim(req.workerId);
    res.json({job:job ? {id:job.id,feature:job.feature,payload:job.payload,leaseToken:job.lease_token,expiresAt:job.expires_at}:null});
}));
const lease=(req)=>{ if (!/^[0-9a-f-]{36}$/i.test(req.params.id)||! /^[0-9a-f-]{36}$/i.test(req.body.leaseToken||'')) throw failure('Invalid lease.',400,'INVALID_LEASE');return [req.workerId,req.params.id,req.body.leaseToken];};
router.post('/:id/heartbeat',asyncHandler(async(req,res)=>{await jobs().heartbeat(...lease(req));res.json({ok:true});}));
router.post('/:id/complete',asyncHandler(async(req,res)=>{await jobs().complete(...lease(req),req.body.result);res.json({ok:true});}));
router.post('/:id/fail',asyncHandler(async(req,res)=>{await jobs().fail(...lease(req),req.body.code);res.json({ok:true});}));
module.exports=router;
