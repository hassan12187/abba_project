import jwt from "jsonwebtoken";

export const checkToken=(token)=>{
return jwt.verify(token,process.env.secretKey);
};
export const getToken=({username,email,role})=>{
    return jwt.sign({username,email,role},process.env.secretKey);
};