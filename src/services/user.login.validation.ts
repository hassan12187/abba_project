import Joi from "joi";

export const userLoginValidationSchema=Joi.object({
    email:Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Enter a valid email',
    }),
    password:Joi.string().min(6).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters',
    })
});