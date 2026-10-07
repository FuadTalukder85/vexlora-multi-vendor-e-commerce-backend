import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ChatService } from "./chat.service";

const getOrCreateConversation = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatService.getOrCreateConversation(
    req.user,
    req.body,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Conversation ready",
    data: result,
  });
});

const getUserConversations = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatService.getUserConversations(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Conversations retrieved successfully",
    data: result,
  });
});

const getConversationById = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatService.getConversationById(
    req.user,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Conversation retrieved successfully",
    data: result,
  });
});

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const result = await ChatService.getMessages(
    req.user,
    req.params.id as string,
    page,
    limit,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Messages retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatService.sendMessage(
    req.user,
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const markConversationAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await ChatService.markConversationAsRead(
    req.user,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Conversation marked as read",
    data: result,
  });
});

export const ChatController = {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markConversationAsRead,
};
