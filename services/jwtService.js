import {verify,sign} from "jsonwebtoken";
export const checkToken=(req,res,next)=>{
const token = req.headers.authorization;
const data = verify(token,process.env.secretKey);
if(data.role="ADMIN")next();
return res.send({status:400,data:"You Are Not Authorized."});
};
export const getToken=(data)=>{
    return sign(data,process.env.secretKey);
};