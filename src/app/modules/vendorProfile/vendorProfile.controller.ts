import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { VendorProfileService } from "./vendorProfile.service";

const applyVendorProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.applyVendorProfile(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Vendor application submitted successfully",
    data: result,
  });
});

const getMyVendorProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.getMyVendorProfile(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor profile retrieved successfully",
    data: result,
  });
});

const updateMyVendorProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.updateMyVendorProfile(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor profile updated successfully",
    data: result,
  });
});

const getAllVendorsPublic = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.getAllVendorsPublic(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendors retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getVendorBySlug = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.getVendorBySlug(req.params.slug as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor store retrieved successfully",
    data: result,
  });
});

const getAllVendorsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.getAllVendorsAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor applications retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getVendorById = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.getVendorById(req.params.id as string, req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor profile retrieved successfully",
    data: result,
  });
});

const updateVendorStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.updateVendorStatus(req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor status updated successfully",
    data: result,
  });
});

const addDocument = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.addDocument(
    req.user.userId,
    req.params.vendorId as string,
    req.body,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Document uploaded successfully",
    data: result,
  });
});

const deleteDocument = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.deleteDocument(req.user.userId, req.params.docId as string, req.user.role);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Document deleted successfully",
    data: result,
  });
});

const uploadStoreLogo = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  if (!file || !file.path) {
    throw new AppError(status.BAD_REQUEST, "No image file provided for store logo upload");
  }

  const result = await VendorProfileService.uploadStoreLogo(req.user.userId, file.path);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Store logo uploaded successfully",
    data: result,
  });
});

const deleteStoreLogo = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.deleteStoreLogo(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Store logo removed successfully",
    data: result,
  });
});

const uploadStoreBanner = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  if (!file || !file.path) {
    throw new AppError(status.BAD_REQUEST, "No image file provided for store banner upload");
  }

  const result = await VendorProfileService.uploadStoreBanner(req.user.userId, file.path);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Store banner uploaded successfully",
    data: result,
  });
});

const deleteStoreBanner = catchAsync(async (req: Request, res: Response) => {
  const result = await VendorProfileService.deleteStoreBanner(req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Store banner removed successfully",
    data: result,
  });
});

const uploadMyDocument = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  if (!file || !file.path) {
    throw new AppError(status.BAD_REQUEST, "No document file provided for upload");
  }

  const type = (req.body.type as string) || "legal_document";
  const result = await VendorProfileService.uploadMyDocument(req.user.userId, type, file.path);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Document uploaded successfully",
    data: result,
  });
});

export const VendorProfileController = {
  applyVendorProfile,
  getMyVendorProfile,
  updateMyVendorProfile,
  uploadStoreLogo,
  deleteStoreLogo,
  uploadStoreBanner,
  deleteStoreBanner,
  uploadMyDocument,
  getAllVendorsPublic,
  getVendorBySlug,
  getAllVendorsAdmin,
  getVendorById,
  updateVendorStatus,
  addDocument,
  deleteDocument,
};
