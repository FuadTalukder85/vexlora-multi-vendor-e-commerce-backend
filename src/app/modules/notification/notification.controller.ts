import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { NotificationService } from "./notification.service";

const createNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.createNotification(req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Notification created successfully",
    data: result,
  });
});

const broadcastNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.broadcastNotification(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getMyNotifications(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notifications retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getUnreadCount(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Unread notification count retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.markAsRead(req.user.userId, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification marked as read successfully",
    data: result,
  });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.markAllAsRead(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const isAdmin = req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN";
  const result = await NotificationService.deleteNotification(req.user.userId, req.params.id as string, isAdmin);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification deleted successfully",
    data: result,
  });
});

const clearAllNotifications = catchAsync(async (req: Request, res: Response) => {
  const onlyRead = req.query.onlyRead === "true";
  const result = await NotificationService.clearAllNotifications(req.user.userId, onlyRead);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const getAllNotificationsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getAllNotificationsAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All notifications retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const NotificationController = {
  createNotification,
  broadcastNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getAllNotificationsAdmin,
};
