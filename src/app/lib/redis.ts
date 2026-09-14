import Redis from "ioredis";
import { envVars } from "../config/env";

let isRedisConnected = false;

export const redis = new Redis(envVars.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      if (isRedisConnected) {
        console.warn("⚠️ Redis connection unreachable. Falling back to database.");
        isRedisConnected = false;
      }
      return null; // Stop retrying automatically to avoid blocking
    }
    return Math.min(times * 100, 1000);
  },
  lazyConnect: true,
});

redis.on("connect", () => {
  isRedisConnected = true;
  console.log("⚡ Redis Client Connected");
});

redis.on("error", (err) => {
  if (isRedisConnected) {
    console.warn("⚠️ Redis Warning:", err.message);
    isRedisConnected = false;
  }
});

// Connect asynchronously without blocking bootstrap
redis.connect().catch(() => {
  console.warn("⚠️ Redis is not running locally. Requests will fetch directly from PostgreSQL.");
});

/**
 * Get cached item from Redis
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!isRedisConnected && redis.status !== "ready") {
    return null;
  }

  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.warn(`⚠️ Redis getCache error for key "${key}":`, error);
    return null;
  }
}

/**
 * Set item in Redis with TTL (seconds)
 */
export async function setCache(key: string, data: unknown, ttlSeconds = 60): Promise<void> {
  if (!isRedisConnected && redis.status !== "ready") {
    return;
  }

  try {
    const serialized = JSON.stringify(data);
    await redis.setex(key, ttlSeconds, serialized);
  } catch (error) {
    console.warn(`⚠️ Redis setCache error for key "${key}":`, error);
  }
}

/**
 * Invalidate all keys matching pattern (e.g., "products:public:*")
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  if (!isRedisConnected && redis.status !== "ready") {
    return;
  }

  try {
    const stream = redis.scanStream({
      match: pattern,
      count: 100,
    });

    const keysToDelete: string[] = [];

    stream.on("data", (resultKeys: string[]) => {
      for (const k of resultKeys) {
        keysToDelete.push(k);
      }
    });

    stream.on("end", async () => {
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
      }
    });
  } catch (error) {
    console.warn(`⚠️ Redis invalidatePattern error for "${pattern}":`, error);
  }
}
