// import { emailQueue } from "../queues/emailQueue.js";

// export const sendVerificationEmail=async(user)=>{
//     await emailQueue.add("verifyEmail");
// };
// export const changePasswordVerification=async(email,code)=>{
//     await emailQueue.add("sendPasswordChangeCode",{
//         to:email,
//         subject:"Verify Your Password Change",
//         html:`<p>Use this verification code to confirm your password change:</p>
//              <h2>${code}</h2>
//              <p>This code will expire in 5 minutes.</p>`
//     });
// };