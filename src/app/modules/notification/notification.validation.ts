import { z } from "zod";

const createNotificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  type: z.string().min(1, "Notification type is required"),
  title: z.string().min(1, "Title cannot be empty").optional().nullable(),
  message: z.string().min(1, "Message is required").max(1000, "Message cannot exceed 1000 characters"),
  link: z.string().optional().nullable(),
});

const broadcastNotificationSchema = z.object({
  target: z.enum(["ALL", "VENDORS", "CUSTOMERS"], {
    message: "Target must be one of: ALL, VENDORS, CUSTOMERS",
  }),
  type: z.string().min(1, "Notification type is required"),
  title: z.string().min(1, "Title cannot be empty").optional().nullable(),
  message: z.string().min(1, "Message is required").max(1000, "Message cannot exceed 1000 characters"),
  link: z.string().optional().nullable(),
});

const markAsReadSchema = z.object({
  isRead: z.boolean().optional().default(true),
});

export const NotificationValidation = {
  createNotificationSchema,
  broadcastNotificationSchema,
  markAsReadSchema,
};
