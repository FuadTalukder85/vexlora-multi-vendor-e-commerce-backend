import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response } from "express";
import path from "path";
import qs from "qs";
import { envVars } from "./app/config/env";
import { auth } from "./app/lib/auth";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import { notFound } from "./app/middlewares/notFound";
import { requestId } from "./app/middlewares/requestId.middleware";
import { IndexRoutes } from "./app/routes";

const app: Application = express();

app.set("query parser", (str: string) => qs.parse(str));
app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), "src/app/templates"));

// Request ID for tracing
app.use(requestId);

// High-precision server response time logger
app.use((req: Request, res: Response, next) => {
  const startTime = performance.now();
  res.on("finish", () => {
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`⏱️ [${req.method}] ${req.originalUrl} - ${duration}ms (Status: ${res.statusCode})`);
  });
  next();
});

// CORS
app.use(
  cors({
    origin: [envVars.CLIENT_URL, envVars.BETTER_AUTH_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Better Auth handler (before body parsers)
app.use("/api/auth", toNodeHandler(auth));

// Body parsers (capturing rawBody for webhook signature verification)
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      if (req.originalUrl.includes("/stripe/webhook")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use("/api/v1", IndexRoutes);

// Health check
app.get("/", async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "E-Commerce API is running",
  });
});

// Error handling
app.use(globalErrorHandler);
app.use(notFound);

export default app;
