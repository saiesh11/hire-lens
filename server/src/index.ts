import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./lib/env.js";
import { analyzeRouter } from "./routes/analyze.js";
import { analysesRouter } from "./routes/analyses.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.use("/api", analyzeRouter);
app.use("/api", analysesRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
