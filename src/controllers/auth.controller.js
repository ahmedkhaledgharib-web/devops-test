import logger from "../../logger.js";
import { createUser } from "../services/auth.service.js";
import { cookies } from "../utils/cookies.js";
import { formatValidationErrors } from "../utils/format.js";
import { jwtToken } from "../utils/jwt.js";
import { signupSchema } from "../validations/auth.validations.js";

export const signup = async (req, res, next) => {
    try {
        const validationResult = signupSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: "Validation failed", details: formatValidationErrors(validationResult.error) });
        }
        const { name, email, role } = validationResult.data;
        const user = await createUser(validationResult.data);
        const token = jwtToken.sign({ id: user[0].id, email: user[0].email, role: user[0].role });
        cookies.setCookie(res, "token", token)
        res.status(201).json({ message: "User registered successfully", user: { name, email, role } });
    } catch (err) {
        logger.error("Error in signup controller:", err);
        if (err.message === 'User with this email already exists') {
            return res.status(409).json({ message: err.message });
        }
        next(err);
    }

}