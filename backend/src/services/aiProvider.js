const {randomUUID}=require('node:crypto');
const context=require('./aiContext');
const {AIUnavailableError}=require('../utils/errors');
const {jobs}=require('./aiJobs');
function getModel(legacyClient,feature,options,requestOptions,ownerId) {
    const provider=process.env.AI_PROVIDER||'gemini';
    if(provider==='gemini')return legacyClient.getGenerativeModel(options,requestOptions);
    if(provider!=='laptop-worker')throw new AIUnavailableError('Unknown AI provider configuration.');
    const workerGenerate=async input=>{
        if(feature==='transcription')throw new AIUnavailableError('Audio transcription is not verified for this worker.');
        const userId=ownerId||context.getStore()?.userId;
        if(!userId)throw new AIUnavailableError('AI request has no authenticated owner.');
        const parts=Array.isArray(input)?input:[input];
        const prompt=parts.filter(p=>typeof p==='string').join('\n');
        const media=parts.find(p=>p?.inlineData)?.inlineData;
        const payload={prompt,...(media?{image:media.data,mimeType:media.mimeType}:{})};
        const job=await jobs().enqueue(userId,randomUUID(),feature,payload);
        const deadline=Date.now()+Number(process.env.AI_WORKER_WAIT_MS||45000);
        while(Date.now()<deadline){
            const j=await jobs().get(userId,job.id);
            if(j.status==='completed')return {response:{text:()=>typeof j.result==='string'?j.result:JSON.stringify(j.result)}};
            if(['failed','expired'].includes(j.status))throw new AIUnavailableError('The laptop worker could not complete this request. Try again later.');
            await new Promise(r=>setTimeout(r,1000));
        }
        await jobs().cancel(userId,job.id);
        throw new AIUnavailableError('The laptop worker is busy. Try again later.');
    };
    return {generateContent:async input=>{
        try{return await workerGenerate(input);}
        catch(error){
            if(process.env.AI_WORKER_API_FALLBACK==='true' && process.env.GEMINI_API_KEY){
                return legacyClient.getGenerativeModel(options,requestOptions).generateContent(input);
            }
            throw error;
        }
    }};
}
module.exports={getModel};
