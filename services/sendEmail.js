import { config } from "dotenv";
import {createTransport} from "nodemailer";
config({path:'../.env'});
const transporter = createTransport({
    service:"gmail",
    auth:{
        user: process.env.GOOGLE_APP_USS,
        pass: process.env.GOOGLE_APP_PASS,
    },
});
export const sendEmail=async(subject,to,html)=>{
    const info = await transporter.sendMail({
        from:process.env.GOOGLE_APP_USS,
        to,
        subject,
        html
    });
    console.log(info.messageId);
};