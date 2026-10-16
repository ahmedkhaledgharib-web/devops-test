import bcrypt from "bcrypt";
import logger from "../../logger.js";
import { users } from "../models/user.model.js";
import { db } from "../config/database.js";
import { eq } from "drizzle-orm";
export const hashPasword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (err) {
        logger.error("Error in hashPassword service:", err);
        throw err;
    }
}

export const createUser = async ({ name, email, password, role }) => {
    try {
        const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUser.length > 0) throw new Error('User with this email already exists');
        const hashedPassword = await hashPasword(password);
        const newUser = await db.insert(users).values({ name, email, password: hashedPassword, role }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });
        logger.info(`User created successfully: ${newUser[0].email}`);
        return newUser;
    } catch (err) {
        logger.error("Error in createUser service:", err);
        throw err;
    }
}