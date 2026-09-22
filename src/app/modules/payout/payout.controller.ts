import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PayoutService } from "./payout.service";
import { StripeService } from "./stripe.service";

const requestVendorPayout = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.requestVendorPayout(req.user, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Payout requested successfully",
    data: result,
  });
});

const getVendorPayouts = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getVendorPayouts(req.user, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor payouts retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getVendorPayoutById = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getVendorPayoutById(req.user, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payout details retrieved successfully",
    data: result,
  });
});

const cancelVendorPayout = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.cancelVendorPayout(req.user, req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payout request cancelled successfully",
    data: result,
  });
});

const getVendorPayoutStatistics = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getVendorPayoutStatistics(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Vendor payout statistics retrieved successfully",
    data: result,
  });
});

const getAllPayoutsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getAllPayoutsAdmin(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All payouts retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getPayoutByIdAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getPayoutByIdAdmin(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payout record retrieved successfully",
    data: result,
  });
});

const createPayoutAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.createPayoutAdmin(req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Payout created successfully by administrator",
    data: result,
  });
});

const updatePayoutStatusAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.updatePayoutStatusAdmin(req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payout status updated successfully",
    data: result,
  });
});

const getAdminPayoutStatistics = catchAsync(async (_req: Request, res: Response) => {
  const result = await PayoutService.getAdminPayoutStatistics();

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Admin payout statistics retrieved successfully",
    data: result,
  });
});

const createStripeOnboardingLink = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.createStripeOnboardingLink(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Stripe Connect onboarding link generated successfully",
    data: result,
  });
});

const getStripeConnectStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getStripeConnectStatus(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Stripe Connect account status retrieved successfully",
    data: result,
  });
});

const getStripeDashboardLink = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getStripeDashboardLink(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Stripe Express dashboard login link generated successfully",
    data: result,
  });
});

const disbursePayoutWithStripe = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.disbursePayoutWithStripe(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Payout funds successfully transferred to vendor via Stripe",
    data: result,
  });
});

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    res.status(status.BAD_REQUEST).json({
      success: false,
      message: "Missing 'stripe-signature' header",
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (req as any).rawBody || req.body;
  const result = await StripeService.handleStripeWebhookEvent(payload, signature);

  res.status(status.OK).json({
    success: true,
    ...result,
  });
});

const getStripePlatformBalance = catchAsync(async (_req: Request, res: Response) => {
  const result = await StripeService.getStripePlatformBalance();

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Stripe platform balance retrieved successfully",
    data: result,
  });
});

export const PayoutController = {
  requestVendorPayout,
  getVendorPayouts,
  getVendorPayoutById,
  cancelVendorPayout,
  getVendorPayoutStatistics,
  getAllPayoutsAdmin,
  getPayoutByIdAdmin,
  createPayoutAdmin,
  updatePayoutStatusAdmin,
  getAdminPayoutStatistics,
  createStripeOnboardingLink,
  getStripeConnectStatus,
  getStripeDashboardLink,
  disbursePayoutWithStripe,
  handleStripeWebhook,
  getStripePlatformBalance,
};
