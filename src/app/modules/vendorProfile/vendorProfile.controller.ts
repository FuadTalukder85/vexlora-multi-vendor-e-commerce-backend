import { Request, Response } from "express";
import status from "http-status";
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

export const VendorProfileController = {
  applyVendorProfile,
  getMyVendorProfile,
  updateMyVendorProfile,
  getAllVendorsPublic,
  getVendorBySlug,
  getAllVendorsAdmin,
  getVendorById,
  updateVendorStatus,
  addDocument,
  deleteDocument,
};
