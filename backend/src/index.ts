import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRouter from "./routes/chat.js";
import dashboardRouter from "./routes/dashboard.js";
import adminRouter from "./routes/admin.js";
import webhookRouter from "./routes/webhook.js";
import { requireApiKey } from "./middleware/auth.middleware.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173"
  })
);
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buffer) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  }
}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use("/chat", chatRouter);
app.use("/dashboard", requireApiKey, dashboardRouter);
app.use("/admin", requireApiKey, adminRouter);
app.use("/webhook", webhookRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`Hey Concrete backend running on http://localhost:${port}`);
});
