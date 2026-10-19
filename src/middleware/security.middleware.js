import { slidingWindow } from "@arcjet/node";
import aj from "../config/arcjet.js";

export const securityMiddleware = async (req, res, next) => {
    try {
        const role = req.user?.role || "guest"; // Default to 'guest' if no user is authenticated
        let limit;
        switch (role) {
            case "admin":
                limit = 200; // Admins can make 100 requests per minute
                break;
            case "user":
                limit = 20; // Regular users can make 50 requests per minute
                break;
            default:
                limit = 100; // Guests can make 20 requests per minute
        }
        const client = aj.withRule(slidingWindow({ mode: "LIVE", interval: '1m', max: limit, name: `slidingWindow-${role}` }));
        const decision = await client.protect(req);
        if (decision.blocked) {
            return res.status(429).json({ message: "Too many requests. Please try again later." });
        }
        if (decision.isDenied()) {
            return res.status(429).json({ message: "Too many requests. Please try again later." });
        }
        next();
    } catch (err) {
        next(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
}