import { z } from "zod";

const createConversationSchema = z.object({
  vendorId: z.string().min(1, "Vendor ID is required"),
  productId: z.string().optional().nullable(),
  subOrderId: z.string().optional().nullable(),
  initialMessage: z.string().min(1).max(2000).optional().nullable(),
});

const sendChatMessageSchema = z.object({
  text: z.string().min(1, "Message text is required").max(2000),
  attachments: z.array(z.string()).optional().default([]),
});

export const ChatValidation = {
  createConversationSchema,
  sendChatMessageSchema,
};

