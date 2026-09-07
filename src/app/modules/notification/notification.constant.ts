export const notificationSearchableFields = ["title", "message", "type"];

export const notificationFilterableFields = ["searchTerm", "type", "isRead", "userId"];

export const standardNotificationInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  },
};

export const NotificationTypes = {
  ORDER_PLACED: "ORDER_PLACED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYOUT_PROCESSED: "PAYOUT_PROCESSED",
  REVIEW_RECEIVED: "REVIEW_RECEIVED",
  VENDOR_REPLY: "VENDOR_REPLY",
  PRODUCT_APPROVED: "PRODUCT_APPROVED",
  SYSTEM_ALERT: "SYSTEM_ALERT",
} as const;

export type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];
