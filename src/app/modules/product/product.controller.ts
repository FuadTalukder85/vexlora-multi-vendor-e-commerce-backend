import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ProductService } from "./product.service";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.createProduct(req.user, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getAllProductsPublic = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getAllProductsPublic(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Products retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyVendorProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getMyVendorProducts(req.user, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor products retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAllProductsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getAllProductsAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Admin products retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getProductBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getProductBySlug(req.params.slug as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const getProductById = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getProductById(req.params.id as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.updateProduct(req.user, req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.deleteProduct(req.user, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product deleted successfully",
    data: result,
  });
});

const updateProductStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.updateProductStatus(
    req.user,
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Product status updated successfully",
    data: result,
  });
});
export const ProductController = {
  createProduct,
  getAllProductsPublic,
  getMyVendorProducts,
  getAllProductsAdmin,
  getProductBySlug,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductStatus,
};
