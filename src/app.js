import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import logger from "../logger.js";
import authRoutes from "./routes/auth.routes.js";
import { securityMiddleware } from "./middleware/security.middleware.js";
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(securityMiddleware);
app.get("/", (req, res) => {
    logger.info("Hello World!");
    res.send("Hello World!");
});
app.get("/health", (req, res) => {
    logger.info("Health check");
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});
app.get("/api", (req, res) => {
    logger.info("API check");
    res.status(200).json({ message: "API is running" });
});
app.use("/api/auth", authRoutes);
app.use((req, res) => {
    res.status(404).json({ message: "Not Found" });
})
export default app;