import express, { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { PayoutController } from "./payout.controller";
import { PayoutValidation } from "./payout.validation";

const router = Router();

// ==========================================
// VENDOR ROUTES (Scoped via PermissionManager)
// ==========================================

// Request a new payout for delivered, unpaid sub-orders
router.post(
  "/vendor/request",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:create"),
  validateRequest(PayoutValidation.requestPayoutSchema),
  PayoutController.requestVendorPayout,
);

// Get vendor's own payout list (with pagination, sort, search, filters)
router.get(
  "/vendor/me",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:read"),
  PayoutController.getVendorPayouts,
);

// Get vendor payout balance and earnings statistics
router.get(
  "/vendor/statistics",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:read"),
  PayoutController.getVendorPayoutStatistics,
);

// Cancel an unpaid payout request
router.patch(
  "/vendor/:id/cancel",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:update"),
  PayoutController.cancelVendorPayout,
);

// Get single vendor payout details by ID
router.get(
  "/vendor/:id",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:read"),
  PayoutController.getVendorPayoutById,
);

// ==========================================
// ADMIN ROUTES (Guarded via PermissionManager)
// ==========================================

// List all payouts on platform
router.get(
  "/admin/all",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:read"),
  PayoutController.getAllPayoutsAdmin,
);

// Marketplace-wide payout metrics and aggregates
router.get(
  "/admin/statistics",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:read"),
  PayoutController.getAdminPayoutStatistics,
);

// Real-time live Stripe account balance for platform
router.get(
  "/admin/stripe/balance",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:read"),
  PayoutController.getStripePlatformBalance,
);

// Create a payout for a vendor directly
router.post(
  "/admin",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:create"),
  validateRequest(PayoutValidation.createPayoutAdminSchema),
  PayoutController.createPayoutAdmin,
);

// Update payout status (e.g. PROCESSING, PAID, FAILED) & Stripe reference
router.patch(
  "/admin/:id/status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:update"),
  validateRequest(PayoutValidation.updatePayoutStatusSchema),
  PayoutController.updatePayoutStatusAdmin,
);

// Get single payout details by ID
router.get(
  "/admin/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:read"),
  PayoutController.getPayoutByIdAdmin,
);

// Admin executes automated Stripe transfer for payout
router.post(
  "/admin/:id/disburse-stripe",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:update"),
  PayoutController.disbursePayoutWithStripe,
);

// ==========================================
// STRIPE CONNECT VENDOR ONBOARDING
// ==========================================

// Generate onboarding link for vendor
router.post(
  "/vendor/stripe/onboarding-link",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:create"),
  PayoutController.createStripeOnboardingLink,
);

// Get vendor's Stripe Connect account verification status
router.get(
  "/vendor/stripe/status",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:read"),
  PayoutController.getStripeConnectStatus,
);

// Get vendor's Stripe Express Dashboard login link
router.post(
  "/vendor/stripe/dashboard-link",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("payout:read"),
  PayoutController.getStripeDashboardLink,
);

// ==========================================
// STRIPE WEBHOOK LISTENER
// ==========================================

router.post("/stripe/webhook", express.raw({ type: "application/json" }), PayoutController.handleStripeWebhook);

export const PayoutRoutes = router;
