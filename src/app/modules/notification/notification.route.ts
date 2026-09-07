import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { NotificationController } from "./notification.controller";
import { NotificationValidation } from "./notification.validation";

const router = Router();

// Get current user's notifications (paginated, filterable, sortable)
router.get("/my-notifications", checkAuth(), NotificationController.getMyNotifications);

// Get current user's unread notification count
router.get("/unread-count", checkAuth(), NotificationController.getUnreadCount);

// Mark all unread notifications as read for current user
router.patch("/mark-all-as-read", checkAuth(), NotificationController.markAllAsRead);

// Clear all notifications (or only read ones via ?onlyRead=true) for current user
router.delete("/clear-all", checkAuth(), NotificationController.clearAllNotifications);

// Mark specific notification as read
router.patch("/:id/read", checkAuth(), NotificationController.markAsRead);

// Delete specific notification
router.delete("/:id", checkAuth(), NotificationController.deleteNotification);

// Admin: broadcast notification to all users, all vendors, or all customers
router.post(
  "/broadcast",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("notification:create"),
  validateRequest(NotificationValidation.broadcastNotificationSchema),
  NotificationController.broadcastNotification,
);

// Admin: create targeted notification for a specific user
router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("notification:create"),
  validateRequest(NotificationValidation.createNotificationSchema),
  NotificationController.createNotification,
);

// Admin: get all notifications across the platform
router.get(
  "/admin/all",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("notification:read"),
  NotificationController.getAllNotificationsAdmin,
);

export const NotificationRoutes = router;
