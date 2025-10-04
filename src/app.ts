import express from "express";
// import questionRoutes from "./routes/question.routes";
import "./bot/index"; // start the bot

const app = express();
app.use(express.json());

// app.use("/api/questions", questionRoutes);

export default app;
