const fs=require('node:fs/promises');
const path=require('node:path');
const {analyze,effectiveSettings}=require('./provider');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function load(){
    const file=path.resolve(process.env.FITZO_WORKER_CONFIG||path.join(__dirname,'config.json'));
    const config=JSON.parse(await fs.readFile(file,'utf8'));
    config.runtimeDir=path.resolve(path.dirname(file),config.runtimeDir||'runtime');
    config.timeoutMs=Number(config.timeoutMs||60000);
    if(!Number.isFinite(config.timeoutMs)||config.timeoutMs<1000||config.timeoutMs>60000)throw Error('INVALID_CONFIGURATION');
    const u=new URL(config.backendUrl);
    if(u.username||u.password||u.search||u.hash)throw Error('INVALID_BACKEND_URL');
    if(u.protocol!=='https:'&&!(config.allowLocalHttp&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw Error('HTTPS_REQUIRED');
    config.backendUrl=config.backendUrl.replace(/\/$/,'');
    await fs.mkdir(config.runtimeDir,{recursive:true});
    return config;
}
async function main(){
    const config=await load(),command=process.argv[2];
    const statusFile=path.join(config.runtimeDir,'status.json');
    if(command==='status'){try{console.log(await fs.readFile(statusFile,'utf8'));}catch{console.log('Worker has not started.');}return;}
    await effectiveSettings(config);
    const credential=(await fs.readFile(config.credentialFile,'utf8')).trim();
    if(!/^[A-Za-z0-9_-]{40,100}$/.test(credential))throw Error('INVALID_CREDENTIAL');
    async function request(route,body){
        const r=await fetch(`${config.backendUrl}/ai-worker/${route}`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(10000)});
        if(!r.ok)throw Error(r.status===401?'WORKER_AUTH_REQUIRED':r.status===409?'STALE_LEASE':'BACKEND_UNAVAILABLE');
        return r.json();
    }
    if(command==='diagnose'){await request('health');console.log('Backend credential accepted; provider settings safe.');return;}
    let stopping=false,current;
    for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopping=true;current?.abort();});
    const lockPath=path.join(config.runtimeDir,'worker.lock');
    try {
        const previous=JSON.parse(await fs.readFile(lockPath,'utf8'));
        let alive=true;try{process.kill(previous.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
        if(alive)throw Error('WORKER_ALREADY_RUNNING_OR_STALE_LOCK');
        await fs.rm(lockPath);
    }catch(e){if(e.code!=='ENOENT')throw e;}
    const lock=await fs.open(lockPath,'wx').catch(()=>{throw Error('WORKER_ALREADY_RUNNING_OR_STALE_LOCK');});
    await lock.writeFile(JSON.stringify({pid:process.pid}));
    // Remove abandoned job directories after a crash; never follow symlinks.
    const realRuntime=await fs.realpath(config.runtimeDir);
    for(const entry of await fs.readdir(config.runtimeDir,{withFileTypes:true})){
        if(entry.isDirectory()&&/^scan-/.test(entry.name)){
            const candidate=path.join(config.runtimeDir,entry.name),resolved=await fs.realpath(candidate);
            if(path.dirname(resolved)===realRuntime)await fs.rm(candidate,{recursive:true,force:true});
        }
    }
    const logFile=path.join(config.runtimeDir,'events.log');
    async function record(state,details={}){
        const entry={at:new Date().toISOString(),pid:process.pid,state,...details};
        await fs.writeFile(statusFile,JSON.stringify(entry));
        const stat=await fs.stat(logFile).catch(()=>null);if(stat?.size>1024*1024){await fs.rm(logFile+'.1',{force:true});await fs.rename(logFile,logFile+'.1');}
        await fs.appendFile(logFile,JSON.stringify(entry)+'\n');console.log(state);
    }
    let backoff=2000;
    try{
        while(!stopping){
            try{
                if(await fs.stat(path.join(config.runtimeDir,'stop')).catch(()=>null)){stopping=true;break;}
                await request('health');const {job}=await request('claim');backoff=2000;
                if(!job){await record('idle');await sleep(5000);continue;}
                current=new AbortController();let heartbeatBusy=false,leaseLost=false;
                const timer=setInterval(async()=>{if(heartbeatBusy)return;heartbeatBusy=true;try{await request(`${job.id}/heartbeat`,{leaseToken:job.leaseToken});}catch{leaseLost=true;current?.abort();}finally{heartbeatBusy=false;}},15000);
                try{
                    await record('processing',{jobId:job.id,feature:job.feature});
                    const {value,elapsedMs}=await analyze(config,job,current.signal);
                    if(leaseLost)throw Error('STALE_LEASE');
                    // Repeat completion on a lost response: backend completion is idempotent.
                    let sent=false;
                    for(let n=0;n<3&&!sent;n++){try{await request(`${job.id}/complete`,{leaseToken:job.leaseToken,result:value});sent=true;}catch(e){if(e.message==='STALE_LEASE'||n===2)throw e;await sleep(1000);}}
                    await record('completed',{jobId:job.id,elapsedMs});
                }catch(e){
                    if(!leaseLost&&e.message!=='STALE_LEASE')await request(`${job.id}/fail`,{leaseToken:job.leaseToken,code:e.message}).catch(()=>{});
                    await record('failed',{jobId:job.id,code:['QUOTA_EXHAUSTED','AUTH_REQUIRED','INVALID_OUTPUT','PERMISSION_DENIED','TIMEOUT','STALE_LEASE'].includes(e.message)?e.message:'PROVIDER_ERROR'});
                }finally{clearInterval(timer);current=null;}
            }catch(e){await record('offline',{code:e.message==='WORKER_AUTH_REQUIRED'?'WORKER_AUTH_REQUIRED':'BACKEND_UNAVAILABLE'});await sleep(backoff);backoff=Math.min(60000,backoff*2);}
        }
    }finally{await record('stopped');await lock.close();await fs.rm(path.join(config.runtimeDir,'worker.lock'),{force:true});await fs.rm(path.join(config.runtimeDir,'stop'),{force:true});}
}
if(require.main===module)main().catch(e=>{console.error(['UNSAFE_PROVIDER_CONFIGURATION','UNSAFE_PERMISSIONS','HTTPS_REQUIRED','WORKER_ALREADY_RUNNING_OR_STALE_LOCK'].includes(e.message)?e.message:'Worker setup failed. Run diagnostics and check configuration.');process.exitCode=1;});
module.exports={load};
