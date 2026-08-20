import "./lib/pdfPolyfills.js";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { jobsRouter } from "./routes/jobs.js";
import { candidatesRouter } from "./routes/candidates.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

app.use("/api", jobsRouter);
app.use("/api", candidatesRouter);
app.use("/api", dashboardRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export default app;
