import { Job, Worker } from "bullmq";
import { redisConnection } from "../services/Redis.js";
import { sendEmail } from "../services/sendEmail.js";
export const emailWorker=new Worker("emailQueue",async job=>{
    const {to,subject,html}=job.data;
    await sendEmail(subject,to,html);
},
{
    connection:redisConnection
});
emailWorker.on("completed",(job:Job)=>console.log(`job ${job.id} completed.`));
emailWorker.on("failed",(job:Job|undefined)=>console.log(`job ${job?.id} failed.`));