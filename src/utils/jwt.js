import jwt from "jsonwebtoken";
import logger from "../../logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key"; // Replace with your own secret
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1h"; // Token expiry time

export const jwtToken = {
    sign: (payload) => {
        try {
            return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        } catch (error) {
            logger.error("Error signing JWT token:", error);
            throw new Error("Error signing JWT token");
        }
    },
    verify: (token) => {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            logger.error("Error verifying JWT token:", error);
            throw new Error("Error verifying JWT token");
        }
    }
}