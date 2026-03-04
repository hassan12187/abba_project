import { type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../../models/userModel.js";
import studentApplicationModel from "../../models/studentApplicationModel.js";
import NotificationModel from "../../models/notificationModel.js";
import { changePasswordVerification } from "../../services/emailJobs.js";
import redis from "../../services/Redis.js";
import { io } from "../../index.js";

export const RegisterApplication = async (req: Request, res: Response) => {
    try {
        const {
            student_name, student_email, father_name, guardian_name,
            guardian_cellphone, student_cellphone, father_cellphone,
            city, province, date_of_birth, academic_year,
            active_whatsapp_no, cnic_no, postal_address,
            permanent_address, student_roll_no, gender
        } = req.body;

        const existingStudent = await studentApplicationModel.findOne({ student_roll_no });
        if (existingStudent) {
            return res.status(400).json({ data: "You have already applied for the hostel." });
        }

        // result is already saved by .create()
        const result = await studentApplicationModel.create({
            student_name, student_email, student_roll_no, father_name,
            father_cellphone, guardian_name, guardian_cellphone,
            city, province, date_of_birth, academic_year,
            active_whatsapp_no, postal_address, permanent_address,
            student_cellphone, cnic_no, gender,
            application_submit_date: new Date().toLocaleDateString()
        });

        await NotificationModel.create({
            message: `New hostel application from ${result.student_name} (${result.student_roll_no}, ${result.academic_year})`,
            application_id: result._id
        });

        // Cache Invalidation
        let cursor = "0";
        do {
            const reply = await redis.scan(cursor, 'MATCH', 'applications*', 'COUNT', 100);
            cursor = reply[0];
            const keys = reply[1];
            if (keys.length > 0) await redis.del(...keys);
        } while (cursor !== "0");

        io.emit("newApplication", {
            message: `New hostel application from ${result.student_name} (${result.student_roll_no}, ${result.academic_year})`,
            application_id: result._id
        });

        return res.status(200).json({ data: "Form submitted successfully." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ data: "Oops! A server error occurred." });
    }
};

export const handleRequestPasswordChange = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email });

        // Security best practice: don't reveal if user exists or not, but for internal logic we check
        if (!user) return res.status(200).send("If this email exists, a code has been sent");

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        
        // We store the hashed code for comparison later
        user.passwordResetCode = await bcrypt.hash(code, salt);
        user.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
        
        await user.save();
        await changePasswordVerification(email, code);

        return res.status(200).send("Verification Code sent to Your Email");
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const verifyCode = async (req: Request, res: Response) => {
    const { email, code } = req.body;
    try {
        if (!email || !code) return res.sendStatus(400);

        const user = await userModel.findOne({ email });
        if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
            return res.sendStatus(404);
        }

        const isMatched = await bcrypt.compare(code, user.passwordResetCode);
        const isExpired = new Date(user.passwordResetExpires).getTime() < Date.now();

        if (!isMatched || isExpired) return res.status(403).send("Invalid or expired code.");

        const token = jwt.sign(
            { id: user._id, email }, 
            process.env.TEMP_PASS_TOKEN as string, 
            { expiresIn: '5m' }
        );

        user.passwordResetCode = null; // Clear the code after successful verification
        await user.save();

        return res.status(200).json({ token });
    } catch (error) {
        return res.sendStatus(500);
    }
};

export const ChangePassword = async (req: Request, res: Response) => {
    const { password, token } = req.body;
    try {
        if (!token || !password) return res.sendStatus(400);

        // Type casting decoded to access 'id'
        const decoded = jwt.verify(token, process.env.TEMP_PASS_TOKEN as string) as { id: string };
        
        const user = await userModel.findById(decoded.id);
        if (!user) return res.sendStatus(401);

        // Hash the new password before saving!
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.passwordResetExpires = null;
        
        await user.save();

        return res.status(200).send("Password Changed Successfully.");
    } catch (error) {
        // jwt.verify throws error if token is expired or malformed
        return res.status(401).send("Invalid or expired session.");
    }
};