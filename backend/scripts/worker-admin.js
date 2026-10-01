require('dotenv').config();
const {randomUUID,randomBytes}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {pool,query}=require('../src/config/database');
const {hash}=require('../src/services/aiJobs');
async function main(){
    const [action,file]=process.argv.slice(2);
    if(action==='issue'){
        if(!file)throw Error('Provide a NEW private token file path. No credentials are printed.');
        const token=randomBytes(32).toString('base64url'),id=randomUUID();
        fs.writeFileSync(path.resolve(file),token,{flag:'wx',mode:0o600});
        try{await query(`INSERT INTO ai_worker_credentials(id,token_hash,expires_at) VALUES($1,$2,now()+interval '90 days')`,[id,hash(token)]);}catch(e){fs.unlinkSync(path.resolve(file));throw e;}
        console.log('Credential ID:',id,'; secret saved to private file. Restrict file access to the worker OS account.');
    }else if(action==='revoke'){await query('UPDATE ai_worker_credentials SET revoked=true WHERE id=$1',[file]);}
    else if(action==='resume'){await query('UPDATE ai_worker_state SET paused_until=NULL,pause_reason=NULL WHERE id=1');}
    else if(action==='pause'){await query(`UPDATE ai_worker_state SET paused_until='infinity',pause_reason='ADMIN_PAUSED' WHERE id=1`);}
    else if(action==='status'){console.log((await query('SELECT * FROM ai_worker_state')).rows);}
    else throw Error('Usage: node scripts/worker-admin.js issue <private-file> | revoke <id> | resume | pause | status');
}
main().catch(()=>{console.error('Worker administration failed. Check configuration and arguments.');process.exitCode=1;}).finally(()=>pool.end());
