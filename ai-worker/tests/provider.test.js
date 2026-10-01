const {test}=require('node:test');const assert=require('node:assert/strict');
const {checkSettings,run}=require('../provider');
const safe={useG1Credits:false,allowNonWorkspaceAccess:false,toolPermission:'request-review',permissions:{deny:['command(*)','write_file(*)','read_url(*)','execute_url(*)','mcp(*)']}};
test('reject billing and unsafe permissions',()=>{assert.doesNotThrow(()=>checkSettings(safe));for(const override of [{useG1Credits:true},{modelProvider:'gemini'},{allowNonWorkspaceAccess:true},{permissions:{deny:[]}}])assert.throws(()=>checkSettings({...safe,...override}));});
test('process runner cancels a hung child without shell interpretation',async()=>{await assert.rejects(run(process.execPath,['-e','setInterval(()=>{},1000)'],process.cwd(),undefined,100),/TIMEOUT/);});
