import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ProductVariantService } from "./productVariant.service";

const addVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantService.addVariant(
    req.user.userId,
    req.user.role,
    req.params.productId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Product variant created successfully",
    data: result,
  });
});

const getVariantsByProductId = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantService.getVariantsByProductId(req.params.productId as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product variants retrieved successfully",
    data: result,
  });
});

const getVariantById = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantService.getVariantById(req.params.id as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product variant retrieved successfully",
    data: result,
  });
});

const getVariantBySku = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantService.getVariantBySku(req.params.sku as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product variant retrieved successfully",
    data: result,
  });
});

const updateVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantService.updateVariant(
    req.user.userId,
    req.user.role,
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product variant updated successfully",
    data: result,
  });
});

const deleteVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantService.deleteVariant(req.user.userId, req.user.role, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product variant deleted successfully",
    data: result,
  });
});

export const ProductVariantController = {
  addVariant,
  getVariantsByProductId,
  getVariantById,
  getVariantBySku,
  updateVariant,
  deleteVariant,
};
