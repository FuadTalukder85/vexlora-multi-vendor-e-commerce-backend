import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { WishlistService } from "./wishlist.service";

const addToWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.addToWishlist(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Product added to wishlist successfully",
    data: result,
  });
});

const toggleWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.toggleWishlist(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: result.inWishlist
      ? "Product added to wishlist successfully"
      : "Product removed from wishlist successfully",
    data: result,
  });
});

const getMyWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.getMyWishlist(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Wishlist retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const checkProductInWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.checkProductInWishlist(
    req.user.userId,
    req.params.productId as string,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Wishlist status checked successfully",
    data: result,
  });
});

const removeFromWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.removeFromWishlist(
    req.user.userId,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product removed from wishlist successfully",
    data: result,
  });
});

const removeByProductId = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.removeByProductId(
    req.user.userId,
    req.params.productId as string,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product removed from wishlist successfully",
    data: result,
  });
});

const clearWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.clearWishlist(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Wishlist cleared successfully",
    data: result,
  });
});

const getProductWishlistCount = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.getProductWishlistCount(
    req.params.productId as string,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product wishlist count retrieved successfully",
    data: result,
  });
});

const getAllWishlists = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.getAllWishlists(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All wishlists retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const WishlistController = {
  addToWishlist,
  toggleWishlist,
  getMyWishlist,
  checkProductInWishlist,
  removeFromWishlist,
  removeByProductId,
  clearWishlist,
  getProductWishlistCount,
  getAllWishlists,
};
