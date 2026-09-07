import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ReviewService } from "./review.service";

const createReview = catchAsync(async (req: Request, res: Response) => {
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
  const result = await ReviewService.createReview(req.user.userId, req.body, clientIp);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.updateReview(req.user.userId, req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.deleteReview(req.user.userId, req.user.role, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const vendorReply = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.vendorReply(req.user.userId, req.user.role, req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor reply posted successfully",
    data: result,
  });
});

const getProductReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getProductReviews(req.params.productId as string, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product reviews retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getProductReviewStats = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getProductReviewStats(req.params.productId as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product review statistics retrieved successfully",
    data: result,
  });
});

const canReviewProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.canReviewProduct(req.user.userId, req.params.productId as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Review eligibility checked successfully",
    data: result,
  });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getMyReviews(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "My reviews retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getVendorReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getVendorReviews(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor reviews retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getReviewById = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getReviewById(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Review retrieved successfully",
    data: result,
  });
});

const getAllReviewsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getAllReviewsAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All reviews retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const ReviewController = {
  createReview,
  updateReview,
  deleteReview,
  vendorReply,
  getProductReviews,
  getProductReviewStats,
  canReviewProduct,
  getMyReviews,
  getVendorReviews,
  getReviewById,
  getAllReviewsAdmin,
};
