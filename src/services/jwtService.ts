import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Types } from "mongoose";

const TOKEN_SECRET=(process.env.ACCESS_TOKEN_SECRET as jwt.Secret);
interface User extends JwtPayload{
_id:string|Types.ObjectId,
role:string,

};
export const getAccessToken=(user:User)=>{
    if(!user._id)throw new Error("User ID is required to generate a token.");
    return jwt.sign({id:user._id.toString(),role:user.role},TOKEN_SECRET,{expiresIn:'15m'});
};
export const checkToken=(token:string):User|null=>{
    try {
        return jwt.verify(token,TOKEN_SECRET as string) as User;
    } catch (error) {
        return null;
    }
};
export const getRefreshedToken=(user:User)=>{
    return jwt.sign({id:user._id.toString()},TOKEN_SECRET,{expiresIn:'7d'});
}
// export const getToken=({username,email,role})=>{
//     return jwt.sign({username,email,role},process.env.secretKey);
// };