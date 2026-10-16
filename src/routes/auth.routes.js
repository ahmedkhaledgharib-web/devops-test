import express from "express";
import { signup } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/sign-up", signup);

router.post("/sign-in", (req, res) => {

})

router.post("/sign-out", (req, res) => {

})

export default router;