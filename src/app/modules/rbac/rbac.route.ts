import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { RbacController } from "./rbac.controller";
import { RbacValidation } from "./rbac.validation";

const router = Router();

// ============================================================
// CURRENT USER EFFECTIVE PERMISSIONS
// ============================================================
router.get("/me/permissions", checkAuth(), RbacController.getMyEffectivePermissions);

// ============================================================
// LAYER 1: GLOBAL / ADMIN RBAC ROUTES
// Strictly restricted to platform administrators
// ============================================================

// Seed System Permissions
router.post(
  "/admin/seed",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.seedSystemPermissions,
);

// Permissions Registry (Admin)
router.get(
  "/admin/permissions",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.getAllPermissions,
);
router.post(
  "/admin/permissions",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(RbacValidation.createPermissionSchema),
  RbacController.createPermission,
);
router.get(
  "/admin/permissions/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.getPermissionById,
);
router.patch(
  "/admin/permissions/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(RbacValidation.updatePermissionSchema),
  RbacController.updatePermission,
);
router.delete(
  "/admin/permissions/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.deletePermission,
);

// Roles Registry (Admin)
router.get(
  "/admin/roles",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.getAllRoles,
);
router.post(
  "/admin/roles",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(RbacValidation.createRoleSchema),
  RbacController.createRole,
);
router.get(
  "/admin/roles/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.getRoleById,
);
router.patch(
  "/admin/roles/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(RbacValidation.updateRoleSchema),
  RbacController.updateRole,
);
router.delete(
  "/admin/roles/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.deleteRole,
);

// Assign Roles to Users
router.post(
  "/admin/roles/assign",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(RbacValidation.assignUserRoleSchema),
  RbacController.assignRoleToUser,
);
router.delete(
  "/admin/roles/:roleId/user/:userId",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.removeRoleFromUser,
);

// ============================================================
// LAYER 2: VENDOR & STAFF RBAC ROUTES
// Strictly scoped to the vendor's store and staff members
// ============================================================

// View permissions allowed for vendors (VENDOR or BOTH)
router.get(
  "/vendor/permissions",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.getAllPermissions,
);

// Staff account creation (Vendor Owner only)
router.post(
  "/vendor/staff",
  checkAuth(Role.VENDOR),
  validateRequest(RbacValidation.createVendorStaffSchema),
  RbacController.createVendorStaff,
);

// List staff members for vendor store
router.get(
  "/vendor/staff",
  checkAuth(Role.VENDOR),
  RbacController.getVendorStaffList,
);

// Delegate granular permissions to staff member
router.post(
  "/vendor/staff/permissions",
  checkAuth(Role.VENDOR),
  validateRequest(RbacValidation.assignStaffPermissionsSchema),
  RbacController.assignStaffPermissions,
);

// View specific staff member's permissions
router.get(
  "/vendor/staff/:staffUserId/permissions",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.getStaffPermissions,
);

// Revoke a delegated permission
router.delete(
  "/vendor/staff/permissions/:id",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  RbacController.revokeStaffPermission,
);

export const RbacRoutes = router;
