import crypto from "crypto";

const generatePassword=(length=10)=>{
    return crypto.randomBytes(length).toString("base64").slice(0,length);
};
export default generatePassword;