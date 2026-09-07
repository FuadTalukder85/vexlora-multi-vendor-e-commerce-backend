import status from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { NotificationModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
  notificationFilterableFields,
  notificationSearchableFields,
  standardNotificationInclude,
} from "./notification.constant";
import { IBroadcastNotificationPayload, ICreateNotificationPayload } from "./notification.interface";

const createNotification = async (payload: ICreateNotificationPayload) => {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title ?? null,
      message: payload.message,
      link: payload.link ?? null,
    },
    include: standardNotificationInclude,
  });
};

const broadcastNotification = async (payload: IBroadcastNotificationPayload) => {
  let userWhere: Record<string, unknown> = {
    isDeleted: false,
  };

  if (payload.target === "VENDORS") {
    userWhere = {
      ...userWhere,
      role: Role.VENDOR,
    };
  } else if (payload.target === "CUSTOMERS") {
    userWhere = {
      ...userWhere,
      role: Role.CUSTOMER,
    };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true },
  });

  if (users.length === 0) {
    return { count: 0, message: "No target users found for notification broadcast" };
  }

  const notificationsData = users.map((u) => ({
    userId: u.id,
    type: payload.type,
    title: payload.title ?? null,
    message: payload.message,
    link: payload.link ?? null,
  }));

  const result = await prisma.notification.createMany({
    data: notificationsData,
  });

  return {
    count: result.count,
    target: payload.target,
    message: `Successfully broadcast notification to ${result.count} users`,
  };
};

const getMyNotifications = async (userId: string, queryParams: IQueryParams) => {
  const queryBuilder = new QueryBuilder<NotificationModel>(prisma.notification, queryParams, {
    searchableFields: notificationSearchableFields,
    filterableFields: notificationFilterableFields,
  })
    .where({ userId })
    .search()
    .filter()
    .sort()
    .paginate()
    .fields()
    .include(standardNotificationInclude);

  return await queryBuilder.execute();
};

const getUnreadCount = async (userId: string) => {
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return { unreadCount };
};

const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError(status.NOT_FOUND, "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "Forbidden! You do not own this notification");
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
    include: standardNotificationInclude,
  });
};

const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
    message: "All unread notifications marked as read",
  };
};

const deleteNotification = async (userId: string, notificationId: string, isAdmin = false) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError(status.NOT_FOUND, "Notification not found");
  }

  if (!isAdmin && notification.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "Forbidden! You do not own this notification");
  }

  return await prisma.notification.delete({
    where: { id: notificationId },
  });
};

const clearAllNotifications = async (userId: string, onlyRead = false) => {
  const whereClause: Record<string, unknown> = { userId };
  if (onlyRead) {
    whereClause.isRead = true;
  }

  const result = await prisma.notification.deleteMany({
    where: whereClause,
  });

  return {
    deletedCount: result.count,
    message: onlyRead ? "All read notifications cleared" : "All notifications cleared",
  };
};

const getAllNotificationsAdmin = async (queryParams: IQueryParams) => {
  const queryBuilder = new QueryBuilder<NotificationModel>(prisma.notification, queryParams, {
    searchableFields: notificationSearchableFields,
    filterableFields: notificationFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .fields()
    .include(standardNotificationInclude);

  return await queryBuilder.execute();
};

export const NotificationService = {
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
