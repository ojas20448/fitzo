require('dotenv').config();
const fs=require('node:fs');
const path=require('node:path');
const {pool}=require('../src/config/database');
const migration=path.join(__dirname,'../src/db/migrations/20261001_ai_worker.sql');
pool.query(fs.readFileSync(migration,'utf8')).then(()=>console.log('AI worker migration applied.')).catch(()=>{console.error('AI worker migration failed; check database permissions/configuration.');process.exitCode=1;}).finally(()=>pool.end());
