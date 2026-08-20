import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./lib/env.js";
import { jobsRouter } from "./routes/jobs.js";
import { candidatesRouter } from "./routes/candidates.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.use("/api", jobsRouter);
app.use("/api", candidatesRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
