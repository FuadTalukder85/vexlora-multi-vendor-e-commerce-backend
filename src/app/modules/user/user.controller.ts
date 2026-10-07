import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";

const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getMe(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateMe(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User profile updated successfully",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllUsers(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Users retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserById(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
});

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.createUser(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "User created successfully",
    data: result,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateUser(req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User updated successfully",
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateUserStatus(req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User status updated successfully",
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.deleteUser(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User deleted successfully",
    data: result,
  });
});

const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  if (!file || !file.path) {
    throw new AppError(status.BAD_REQUEST, "No image file provided for avatar upload");
  }

  const result = await UserService.uploadAvatar(req.user.userId, file.path);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Profile avatar uploaded successfully",
    data: result,
  });
});

const deleteAvatar = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.deleteAvatar(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Profile avatar removed successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.changePassword(req.user.userId, req.body, req.headers);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password changed successfully",
    data: result,
  });
});

const getActiveSessions = catchAsync(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const currentBearer = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : undefined;
  const rawCookie = req.cookies ? req.cookies["better-auth.session_token"] : undefined;
  const currentCookie = rawCookie ? rawCookie.split(".")[0] : undefined;
  const currentToken = currentBearer || currentCookie;

  const result = await UserService.getActiveSessions(req.user.userId, currentToken);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Active sessions retrieved successfully",
    data: result,
  });
});

const revokeSession = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.revokeSession(req.user.userId, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Session revoked successfully",
    data: result,
  });
});

const revokeOtherSessions = catchAsync(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const currentBearer = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : undefined;
  const rawCookie = req.cookies ? req.cookies["better-auth.session_token"] : undefined;
  const currentCookie = rawCookie ? rawCookie.split(".")[0] : undefined;
  const currentToken = currentBearer || currentCookie;

  const result = await UserService.revokeOtherSessions(req.user.userId, currentToken);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Other sessions revoked successfully",
    data: result,
  });
});

export const UserController = {
  getMe,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  getActiveSessions,
  revokeSession,
  revokeOtherSessions,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
