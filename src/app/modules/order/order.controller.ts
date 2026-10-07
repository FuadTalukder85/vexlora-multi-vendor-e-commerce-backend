import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { OrderService } from "./order.service";

const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.createPaymentIntent(req.user, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payment intent created successfully",
    data: result,
  });
});

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.createOrder(req.user, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getMyOrders(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyOrderById = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getMyOrderById(req.user.userId, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Order details retrieved successfully",
    data: result,
  });
});

const cancelMyOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.cancelMyOrder(req.user.userId, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Order cancelled successfully",
    data: result,
  });
});

const getAllOrdersAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getAllOrdersAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All orders retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getOrderByIdAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getOrderByIdAdmin(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Order details retrieved successfully",
    data: result,
  });
});

const updatePaymentStatusAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.updatePaymentStatusAdmin(req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payment status updated successfully",
    data: result,
  });
});

export const OrderController = {
  createPaymentIntent,
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
  getAllOrdersAdmin,
  getOrderByIdAdmin,
  updatePaymentStatusAdmin,
};
