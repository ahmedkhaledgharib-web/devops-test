import { z } from "zod";

export const signupSchema = z.object({
    name: z.string().trim().min(4, { message: "Name requires at least 4 characters" }),
    email: z.email({ message: "Invalid email address" }).toLowerCase().trim(),
    password: z.string().trim().min(8, { message: "Password requires at least 8 characters" }),
    role: z.enum(["user", "admin"]).optional().default("user"),
})

export const signinSchema = z.object({
    email: z.email({ message: "Invalid email address" }).toLowerCase().trim(),
    password: z.string().trim().min(8, { message: "Password requires at least 8 characters" }),
})