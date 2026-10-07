import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { PermissionManager } from "../../utils/permissionManager";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

// Admin: Marketplace dashboard overview and platform-wide KPI metrics
router.get(
  "/admin/overview",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("payout:read"),
  AnalyticsController.getAdminDashboardOverview
);

// Vendor: Store analytics and sales performance overview
router.get(
  "/vendor/overview",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  AnalyticsController.getVendorAnalyticsOverview
);

export const AnalyticsRoutes = router;
