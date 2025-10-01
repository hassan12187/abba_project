import jwt from "jsonwebtoken";

export const checkToken=(token)=>{
return jwt.verify(token,process.env.secretKey);
};
export const getAccessToken=(user)=>{
    return jwt.sign({id:user._id,role:user.role},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'15m'});
};
export const getRefreshedToken=(user)=>{
    return jwt.sign({id:user._id},process.env.REFRESH_TOKEN_SECRET,{expiresIn:'7d'});
}
// export const getToken=({username,email,role})=>{
//     return jwt.sign({username,email,role},process.env.secretKey);
// };