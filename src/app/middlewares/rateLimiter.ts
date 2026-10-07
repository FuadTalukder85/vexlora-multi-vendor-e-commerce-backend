import { Request, Response, NextFunction } from "express";
import status from "http-status";
import AppError from "../errors/AppError";
import { redis } from "../lib/redis";

interface RateLimiterOptions {
  windowMs?: number; // Time window in milliseconds (default: 60s)
  max?: number; // Max requests per window per IP (default: 20)
  message?: string;
  prefix?: string;
}

// In-memory fallback map if Redis is not available
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimiter = (options: RateLimiterOptions = {}) => {
  const windowMs = options.windowMs || 60 * 1000;
  const maxRequests = options.max || 20;
  const prefix = options.prefix || "rate-limit";
  const errorMessage =
    options.message || "Too many image search requests. Please slow down and try again in a moment.";

  return async (req: Request, res: Response, next: NextFunction) => {
    // Determine client identifier: user ID (if authenticated) or IP address
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown-client";
    const userIdentifier = (req as any).user?.userId || clientIp;
    const redisKey = `${prefix}:${userIdentifier}`;

    const now = Date.now();

    // Try Redis first
    try {
      if (redis.status === "ready") {
        const currentCount = await redis.incr(redisKey);
        if (currentCount === 1) {
          await redis.pexpire(redisKey, windowMs);
        }

        const ttlMs = await redis.pttl(redisKey);

        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - currentCount));
        res.setHeader("X-RateLimit-Reset", Math.ceil((now + ttlMs) / 1000));

        if (currentCount > maxRequests) {
          throw new AppError(status.TOO_MANY_REQUESTS, errorMessage);
        }

        return next();
      }
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      // Redis error: fallback to memory
    }

    // In-Memory Fallback
    const record = inMemoryStore.get(redisKey);
    if (!record || record.resetAt <= now) {
      inMemoryStore.set(redisKey, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      return next();
    }

    record.count++;
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetAt / 1000));

    if (record.count > maxRequests) {
      return next(new AppError(status.TOO_MANY_REQUESTS, errorMessage));
    }

    next();
  };
};
