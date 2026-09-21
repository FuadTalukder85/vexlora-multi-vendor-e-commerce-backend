import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "./prisma";
import { Role } from "../../generated/prisma/enums";
import { logger } from "../utils/logger";

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Socket Handshake Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.headers?.authorization?.replace("Bearer ", "") as string);

      if (token) {
        const session = await prisma.session.findFirst({
          where: {
            token,
            expiresAt: { gt: new Date() },
          },
          include: {
            user: {
              include: {
                vendorProfile: true,
              },
            },
          },
        });

        if (session?.user) {
          socket.data.user = session.user;
          socket.data.userId = session.user.id;
          socket.data.role = session.user.role;
          if (session.user.vendorProfile?.id) {
            socket.data.vendorId = session.user.vendorProfile.id;
          }
        }
      }
      return next();
    } catch (err) {
      logger.error("Socket authentication error:", err);
      return next();
    }
  });

  io.on("connection", (socket: Socket) => {
    const { user, userId, role, vendorId } = socket.data;

    if (userId) {
      socket.join(`user_${userId}`);
    }

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      socket.join("admin_room");
      logger.info(`[WebSocket] Admin connected: ${socket.id} (user: ${userId})`);
    } else if (role === Role.VENDOR && vendorId) {
      socket.join(`vendor_${vendorId}`);
      logger.info(`[WebSocket] Vendor connected: ${socket.id} (vendor: ${vendorId})`);
    } else {
      logger.info(`[WebSocket] Guest/Customer connected: ${socket.id}`);
    }

    // Allow client to subscribe to specific rooms (e.g. deals catalog)
    socket.on("join_deals", () => {
      socket.join("deals_room");
    });

    socket.on("disconnect", () => {
      // Disconnected
    });
  });

  logger.info("WebSocket Server (Socket.IO) successfully initialized");
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error("Socket.IO is not initialized! Call initSocket(httpServer) first.");
  }
  return io;
};

/**
 * Real-time Event Emitters for Deals & Flash Deals
 */
export const DealSocketEvents = {
  // 1. Vendor submits proposal -> notify Admin
  notifyDealRequestCreated: (payload: {
    id: string;
    productId: string;
    productTitle?: string;
    vendorId: string;
    vendorName?: string;
    proposedDealPrice: number;
    status: string;
    createdAt: string | Date;
  }) => {
    if (!io) return;
    io.to("admin_room").emit("DEAL_REQUEST_CREATED", {
      type: "DEAL_REQUEST_CREATED",
      data: payload,
      message: `New flash deal request submitted for ${payload.productTitle || "product"}`,
      timestamp: new Date().toISOString(),
    });
  },

  // 2. Admin reviews proposal -> notify Vendor & Admin
  notifyDealRequestReviewed: (payload: {
    id: string;
    dealId?: string | null;
    vendorId: string;
    vendorUserId?: string;
    productTitle?: string;
    status: "APPROVED" | "REJECTED";
    reviewNote?: string | null;
  }) => {
    if (!io) return;
    const eventData = {
      type: "DEAL_REQUEST_REVIEWED",
      data: payload,
      message:
        payload.status === "APPROVED"
          ? `Your deal request for "${payload.productTitle || "product"}" was approved!`
          : `Your deal request for "${payload.productTitle || "product"}" was rejected`,
      timestamp: new Date().toISOString(),
    };

    // Notify specific vendor
    io.to(`vendor_${payload.vendorId}`).emit("DEAL_REQUEST_REVIEWED", eventData);
    if (payload.vendorUserId) {
      io.to(`user_${payload.vendorUserId}`).emit("DEAL_REQUEST_REVIEWED", eventData);
    }
    // Also notify admin room
    io.to("admin_room").emit("DEAL_REQUEST_REVIEWED", eventData);
    // If approved, notify deals storefront room
    if (payload.status === "APPROVED") {
      io.to("deals_room").emit("DEAL_UPDATED", eventData);
    }
  },

  // 3. Admin launches direct deal or status changes
  notifyDealUpdated: (payload: {
    id: string;
    status: string;
    title?: string | null;
    vendorId?: string | null;
  }) => {
    if (!io) return;
    const eventData = {
      type: "DEAL_UPDATED",
      data: payload,
      message: `Flash deal updated (${payload.status})`,
      timestamp: new Date().toISOString(),
    };

    io.to("deals_room").to("admin_room").emit("DEAL_UPDATED", eventData);
    if (payload.vendorId) {
      io.to(`vendor_${payload.vendorId}`).emit("DEAL_UPDATED", eventData);
    }
  },
};
