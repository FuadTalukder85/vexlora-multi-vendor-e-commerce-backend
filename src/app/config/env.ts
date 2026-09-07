import dotenv from "dotenv";
import z from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("5000"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().min(1),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLIENT_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_CURRENCY: z.string().optional().default("usd"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const envVars = Object.freeze({
  NODE_ENV: parsed.data.NODE_ENV,
  PORT: parsed.data.PORT,
  DATABASE_URL: parsed.data.DATABASE_URL,
  BETTER_AUTH_SECRET: parsed.data.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: parsed.data.BETTER_AUTH_URL,
  SMTP: {
    HOST: parsed.data.SMTP_HOST,
    PORT: parsed.data.SMTP_PORT,
    USER: parsed.data.SMTP_USER,
    PASSWORD: parsed.data.SMTP_PASSWORD,
    FROM: parsed.data.SMTP_FROM,
  },
  CLOUDINARY: {
    CLOUD_NAME: parsed.data.CLOUDINARY_CLOUD_NAME,
    API_KEY: parsed.data.CLOUDINARY_API_KEY,
    API_SECRET: parsed.data.CLOUDINARY_API_SECRET,
  },
  CLIENT_URL: parsed.data.CLIENT_URL,
  STRIPE: {
    SECRET_KEY: parsed.data.STRIPE_SECRET_KEY,
    WEBHOOK_SECRET: parsed.data.STRIPE_WEBHOOK_SECRET,
    CURRENCY: parsed.data.STRIPE_CURRENCY,
  },
});

export type EnvVars = typeof envVars;
