import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { PlatformSettingController } from "./platformSetting.controller";
import { PlatformSettingValidation } from "./platformSetting.validation";

const router = Router();

// Public / Authenticated read (sanitized view for vendors/users, full view for admins)
router.get("/", optionalAuth, PlatformSettingController.getPlatformSettings);

// Admin-only update of platform settings
router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("global-setting:update"),
  validateRequest(PlatformSettingValidation.updatePlatformSettingSchema),
  PlatformSettingController.updatePlatformSettings,
);

export const PlatformSettingRoutes = router;
