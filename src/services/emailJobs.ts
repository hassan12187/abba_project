import { emailQueue } from "../queues/emailQueue.js";

export const sendVerificationEmail=async(user:any)=>{
    await emailQueue.add("verifyEmail",null,{});
};
export const changePasswordVerification=async(email:string,code:string)=>{
    await emailQueue.add("sendPasswordChangeCode",{
        to:email,
        subject:"Verify Your Password Change",
        html:`<p>Use this verification code to confirm your password change:</p>
             <h2>${code}</h2>
             <p>This code will expire in 5 minutes.</p>`
    });
};
export const sentLoginCredToApproveStudent=async(email:string,pass:string)=>{
    await emailQueue.add("sendCredToStudent",{
        to:email,
        subject:"Mehran Hostel. Student Credentials",
        html:`<p>Use This Password to Login into your Mehran Student Portal</p>
        <h2>${pass}</h2>
        `
    });
};