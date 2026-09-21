import { createServer } from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { prisma } from "./app/lib/prisma";
import { logger } from "./app/utils/logger";
import { initSocket } from "./app/lib/socket";

const bootstrap = async () => {
  try {
    const httpServer = createServer(app);
    initSocket(httpServer);

    const server = httpServer.listen(envVars.PORT, () => {
      logger.info(`Server is running on http://localhost:${envVars.PORT}`);
      logger.info(`Environment: ${envVars.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        logger.info("HTTP server closed");

        await prisma.$disconnect();
        logger.info("Database connection closed");

        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

bootstrap();
