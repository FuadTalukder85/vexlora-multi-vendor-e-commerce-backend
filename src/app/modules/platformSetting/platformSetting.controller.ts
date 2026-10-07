import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PlatformSettingService } from "./platformSetting.service";

const getPlatformSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PlatformSettingService.getPlatformSettings(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Platform settings retrieved successfully",
    data: result,
  });
});

const updatePlatformSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await PlatformSettingService.updatePlatformSettings(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Platform settings updated successfully",
    data: result,
  });
});

export const PlatformSettingController = {
  getPlatformSettings,
  updatePlatformSettings,
};
