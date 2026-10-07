import { z } from "zod";

const createConversationSchema = z.object({
  body: z.object({
    vendorId: z.string().min(1, "Vendor ID is required"),
    productId: z.string().optional(),
    subOrderId: z.string().optional(),
    initialMessage: z.string().min(1).max(2000).optional(),
  }),
});

const sendChatMessageSchema = z.object({
  body: z.object({
    text: z.string().min(1, "Message text is required").max(2000),
    attachments: z.array(z.string()).optional().default([]),
  }),
});

export const ChatValidation = {
  createConversationSchema,
  sendChatMessageSchema,
};
