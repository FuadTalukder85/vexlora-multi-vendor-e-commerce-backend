import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AnalyticsService } from "./analytics.service";

const getAdminDashboardOverview = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await AnalyticsService.getAdminDashboardOverview();

    sendResponse(res, {
      statusCode: status.OK,
      success: true,
      message: "Admin dashboard analytics retrieved successfully",
      data: result,
    });
  }
);

const getVendorAnalyticsOverview = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AnalyticsService.getVendorAnalyticsOverview(req.user);

    sendResponse(res, {
      statusCode: status.OK,
      success: true,
      message: "Vendor analytics overview retrieved successfully",
      data: result,
    });
  }
);

export const AnalyticsController = {
  getAdminDashboardOverview,
  getVendorAnalyticsOverview,
};
