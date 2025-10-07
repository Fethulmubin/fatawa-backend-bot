import express from "express";
// import questionRoutes from "./routes/question.routes";
import "./bot/index"; // start the bot

const app = express();
app.use(express.json());

// Optional root route
app.get("/", (_, res) => res.send("Fatawa bot is running!"));

export default app;
