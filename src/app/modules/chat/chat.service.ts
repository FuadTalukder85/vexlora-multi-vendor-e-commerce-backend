import status from "http-status";
import { Role } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { getIO } from "../../lib/socket";
import { IRequestUser } from "../../types/request.types";
import { standardConversationInclude, standardMessageInclude } from "./chat.constant";
import { ICreateConversationPayload, ISendChatMessagePayload } from "./chat.interface";

const resolveVendorId = async (user: IRequestUser): Promise<string | null> => {
  if (user.tenantId) return user.tenantId;
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return profile ? profile.id : null;
};

const getOrCreateConversation = async (
  user: IRequestUser,
  payload: ICreateConversationPayload,
) => {
  const customerId = user.userId;
  const vendorId = payload.vendorId;

  // Verify vendor exists
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true, userId: true },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  // If sender is vendor, ensure customerId isn't vendor owner
  if (user.role === Role.VENDOR && vendor.userId === user.userId) {
    throw new AppError(status.BAD_REQUEST, "Vendors cannot start conversations with their own store");
  }

  // Find existing unified conversation between this customer and vendor
  const existing = await prisma.conversation.findFirst({
    where: {
      customerId,
      vendorId,
    },
    include: standardConversationInclude,
  });

  if (existing) {
    if (payload.productId !== undefined || payload.subOrderId !== undefined) {
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          productId: payload.productId ?? existing.productId,
          subOrderId: payload.subOrderId ?? existing.subOrderId,
        },
      });
    }

    if (payload.initialMessage) {
      await sendMessage(user, existing.id, {
        text: payload.initialMessage,
      });
    }

    const updated = await prisma.conversation.findUnique({
      where: { id: existing.id },
      include: standardConversationInclude,
    });

    return updated || existing;
  }

  // Create new conversation
  const newConversation = await prisma.conversation.create({
    data: {
      customerId,
      vendorId,
      productId: payload.productId ?? null,
      subOrderId: payload.subOrderId ?? null,
      lastMessage: payload.initialMessage ?? null,
      lastMessageAt: payload.initialMessage ? new Date() : null,
    },
    include: standardConversationInclude,
  });

  if (payload.initialMessage) {
    await sendMessage(user, newConversation.id, {
      text: payload.initialMessage,
    });
  }

  return newConversation;
};

const getUserConversations = async (user: IRequestUser) => {
  const vendorId = await resolveVendorId(user);
  let whereClause: Record<string, unknown> = {};

  if (user.role === Role.VENDOR && vendorId) {
    whereClause.vendorId = vendorId;
  } else if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    whereClause = {};
  } else {
    whereClause.customerId = user.userId;
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
    include: standardConversationInclude,
  });

  // Automatically mark pending undelivered messages for this recipient as delivered
  try {
    const convIds = conversations.map((c) => c.id);
    if (convIds.length > 0) {
      const undelivered = await prisma.chatMessage.findMany({
        where: {
          conversationId: { in: convIds },
          senderId: { not: user.userId },
          isDelivered: false,
        },
        select: { conversationId: true },
      });

      if (undelivered.length > 0) {
        await prisma.chatMessage.updateMany({
          where: {
            conversationId: { in: convIds },
            senderId: { not: user.userId },
            isDelivered: false,
          },
          data: { isDelivered: true },
        });

        const io = getIO();
        const affectedConvIds = Array.from(new Set(undelivered.map((m) => m.conversationId)));
        for (const cId of affectedConvIds) {
          const payload = { conversationId: cId, deliveredTo: user.userId };
          io.to(`conversation_${cId}`).emit("MESSAGES_DELIVERED", payload);
          const c = conversations.find((x) => x.id === cId);
          if (c) {
            io.to(`user_${c.customerId}`).emit("MESSAGES_DELIVERED", payload);
            if (c.vendor?.userId) {
              io.to(`user_${c.vendor.userId}`).emit("MESSAGES_DELIVERED", payload);
            }
          }
        }
      }
    }
  } catch {
    // Ignore background delivery sync error
  }

  return conversations;
};

const getConversationById = async (
  user: IRequestUser,
  conversationId: string,
) => {
  const vendorId = await resolveVendorId(user);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      ...standardConversationInclude,
      messages: {
        take: 50,
        orderBy: { createdAt: "asc" },
        include: standardMessageInclude,
      },
    },
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found");
  }

  const isCustomerOwner = conversation.customerId === user.userId;
  const isVendorOwner = vendorId && conversation.vendorId === vendorId;
  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

  if (!isCustomerOwner && !isVendorOwner && !isAdmin) {
    throw new AppError(status.FORBIDDEN, "Access denied to this conversation");
  }

  return conversation;
};

const getMessages = async (
  user: IRequestUser,
  conversationId: string,
  page = 1,
  limit = 50,
) => {
  await getConversationById(user, conversationId);

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { conversationId },
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
      include: standardMessageInclude,
    }),
    prisma.chatMessage.count({
      where: { conversationId },
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: messages,
  };
};

const sendMessage = async (
  user: IRequestUser,
  conversationId: string,
  payload: ISendChatMessagePayload,
) => {
  const vendorId = await resolveVendorId(user);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, userId: true, storeName: true } },
    },
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found");
  }

  const isCustomer = conversation.customerId === user.userId;
  const isVendor = vendorId ? conversation.vendorId === vendorId : conversation.vendor.userId === user.userId;
  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

  if (!isCustomer && !isVendor && !isAdmin) {
    throw new AppError(status.FORBIDDEN, "Cannot send message in this conversation");
  }

  const senderRole = isVendor ? Role.VENDOR : isCustomer ? Role.CUSTOMER : Role.ADMIN;
  const isVendorSender = senderRole === Role.VENDOR;
  let isDelivered = false;
  try {
    const io = getIO();
    const recipientUserRoom = isVendorSender
      ? `user_${conversation.customerId}`
      : conversation.vendor?.userId
        ? `user_${conversation.vendor.userId}`
        : `vendor_${conversation.vendorId}`;
    const recipientVendorRoom = isVendorSender
      ? `user_${conversation.customerId}`
      : `vendor_${conversation.vendorId}`;
    const conversationRoom = `conversation_${conversationId}`;

    isDelivered =
      (io.sockets.adapter.rooms.get(recipientUserRoom)?.size ?? 0) > 0 ||
      (io.sockets.adapter.rooms.get(recipientVendorRoom)?.size ?? 0) > 0 ||
      (io.sockets.adapter.rooms.get(conversationRoom)?.size ?? 0) > 1;
  } catch {
    // Ignore
  }

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: user.userId,
      senderRole,
      text: payload.text,
      attachments: payload.attachments ?? [],
      isDelivered,
      isRead: false,
    },
    include: standardMessageInclude,
  });

  // When replying, automatically mark all unread messages from the other party as read
  const readUpdated = await prisma.chatMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: user.userId },
      isRead: false,
    },
    data: { isRead: true, isDelivered: true },
  });

  // Update conversation last message & reset sender's unread counter
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessage: payload.text,
      lastMessageAt: new Date(),
      unreadCountCustomer: isVendorSender ? { increment: 1 } : 0,
      unreadCountVendor: !isVendorSender ? { increment: 1 } : 0,
    },
  });

  // Real-time broadcast via Socket.IO
  try {
    const io = getIO();
    const eventPayload = {
      conversationId,
      message,
    };

    // Broadcast that earlier messages were read by the replier ONLY if any existed
    if (readUpdated.count > 0) {
      io.to(`conversation_${conversationId}`).emit("MESSAGES_READ", { conversationId, readBy: user.userId });
      io.to(`user_${conversation.customerId}`).emit("MESSAGES_READ", { conversationId, readBy: user.userId });
      if (conversation.vendor?.userId) {
        io.to(`user_${conversation.vendor.userId}`).emit("MESSAGES_READ", { conversationId, readBy: user.userId });
      }
    }

    // 1. To the conversation room
    io.to(`conversation_${conversationId}`).emit("NEW_CHAT_MESSAGE", eventPayload);

    // 2. To recipient user/vendor channels for notifications
    if (isVendorSender) {
      io.to(`user_${conversation.customerId}`).emit("NEW_CHAT_NOTIFICATION", {
        conversationId,
        senderName: conversation.vendor.storeName,
        text: payload.text,
      });
    } else {
      io.to(`vendor_${conversation.vendorId}`).emit("NEW_CHAT_NOTIFICATION", {
        conversationId,
        senderName: conversation.customer.name,
        text: payload.text,
      });
    }
  } catch (err) {
    // Socket emit failure shouldn't crash REST request
  }

  return message;
};

const markConversationAsDelivered = async (
  user: IRequestUser,
  conversationId: string,
) => {
  const updated = await prisma.chatMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: user.userId },
      isDelivered: false,
    },
    data: { isDelivered: true },
  });

  if (updated.count > 0) {
    try {
      const io = getIO();
      io.to(`conversation_${conversationId}`).emit("MESSAGES_DELIVERED", {
        conversationId,
        deliveredTo: user.userId,
      });
    } catch {
      // Ignore
    }
  }

  return { success: true };
};

const markConversationAsRead = async (
  user: IRequestUser,
  conversationId: string,
) => {
  const vendorId = await resolveVendorId(user);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { vendor: { select: { userId: true } } },
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found");
  }

  const isCustomer = conversation.customerId === user.userId;
  const isVendor = vendorId ? conversation.vendorId === vendorId : conversation.vendor.userId === user.userId;

  if (isCustomer) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCountCustomer: 0 },
    });
  } else if (isVendor) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCountVendor: 0 },
    });
  }

  // Mark all unread messages as read
  const updated = await prisma.chatMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: user.userId },
      isRead: false,
    },
    data: { isRead: true, isDelivered: true },
  });

  // Always broadcast MESSAGES_READ to ensure real-time UI synchronization
  try {
    const io = getIO();
    const eventPayload = { conversationId, readBy: user.userId };
    io.to(`conversation_${conversationId}`).emit("MESSAGES_READ", eventPayload);
    io.to(`user_${conversation.customerId}`).emit("MESSAGES_READ", eventPayload);
    if (conversation.vendor?.userId) {
      io.to(`user_${conversation.vendor.userId}`).emit("MESSAGES_READ", eventPayload);
    }
    io.to(`vendor_${conversation.vendorId}`).emit("MESSAGES_READ", eventPayload);
  } catch {
    // Ignore socket error
  }

  return { success: true };
};

export const ChatService = {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationAsDelivered,
  markConversationAsRead,
};
