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

    // Chat room subscription & typing indicators
    socket.on("join_conversation", (conversationId: string) => {
      if (conversationId) {
        socket.join(`conversation_${conversationId}`);
        logger.info(`[WebSocket] ${socket.id} joined conversation_${conversationId}`);
      }
    });

    socket.on("leave_conversation", (conversationId: string) => {
      if (conversationId) {
        socket.leave(`conversation_${conversationId}`);
      }
    });

    socket.on("typing_start", (data: { conversationId: string; userName?: string }) => {
      if (data?.conversationId) {
        socket.to(`conversation_${data.conversationId}`).emit("USER_TYPING", {
          conversationId: data.conversationId,
          userName: data.userName || user?.name || "Someone",
          isTyping: true,
        });
      }
    });

    socket.on("typing_stop", (data: { conversationId: string; userName?: string }) => {
      if (data?.conversationId) {
        socket.to(`conversation_${data.conversationId}`).emit("USER_TYPING", {
          conversationId: data.conversationId,
          userName: data.userName || user?.name || "Someone",
          isTyping: false,
        });
      }
    });

    // Order live tracking room subscription
    socket.on("join_order", (orderNumber: string) => {
      if (orderNumber) {
        socket.join(`order_${orderNumber}`);
        logger.info(`[WebSocket] ${socket.id} joined tracking room order_${orderNumber}`);
      }
    });

    socket.on("leave_order", (orderNumber: string) => {
      if (orderNumber) {
        socket.leave(`order_${orderNumber}`);
      }
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
 * Real-time Event Emitters for Order Tracking
 */
export const OrderSocketEvents = {
  notifySubOrderStatusUpdated: (payload: {
    orderId: string;
    orderNumber: string;
    subOrderId: string;
    customerId: string;
    vendorId: string;
    status: string;
    trackingNumber?: string | null;
    updatedAt: string | Date;
  }) => {
    if (!io) return;
    const eventData = {
      type: "ORDER_STATUS_UPDATED",
      data: payload,
      message: `Order #${payload.orderNumber} status updated to ${payload.status}`,
      timestamp: new Date().toISOString(),
    };

    io.to(`order_${payload.orderNumber}`).emit("ORDER_STATUS_UPDATED", eventData);
    io.to(`user_${payload.customerId}`).emit("ORDER_STATUS_UPDATED", eventData);
    io.to(`vendor_${payload.vendorId}`).emit("ORDER_STATUS_UPDATED", eventData);
    io.to("admin_room").emit("ORDER_STATUS_UPDATED", eventData);
  },
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
