import { Request, Response } from "express";
import status from "http-status";
import { ModuleScope } from "../../../generated/prisma/enums";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { RbacService } from "./rbac.service";

// ============================================================
// GLOBAL / ADMIN CONTROLLERS
// ============================================================

const seedSystemPermissions = catchAsync(async (_req: Request, res: Response) => {
  const result = await RbacService.seedSystemPermissions();

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "System permissions seeded and synchronized successfully",
    data: result,
  });
});

const getAllPermissions = catchAsync(async (req: Request, res: Response) => {
  const { scope, category, search } = req.query;
  const result = await RbacService.getAllPermissions(req.user.role, {
    scope: scope as ModuleScope | undefined,
    category: category as string | undefined,
    search: search as string | undefined,
  });

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Permissions retrieved successfully",
    data: result,
  });
});

const getPermissionById = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.getPermissionById(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Permission retrieved successfully",
    data: result,
  });
});

const createPermission = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.createPermission(req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Permission created successfully",
    data: result,
  });
});

const updatePermission = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.updatePermission(req.params.id as string, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Permission updated successfully",
    data: result,
  });
});

const deletePermission = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.deletePermission(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Permission deleted successfully",
    data: result,
  });
});

const getAllRoles = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.getAllRoles(req.user.role, req.user.tenantId, req.query.scope as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Roles retrieved successfully",
    data: result,
  });
});

const getRoleById = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.getRoleById(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Role retrieved successfully",
    data: result,
  });
});

const createRole = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.createRole(req.body, req.user.userId);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Role created successfully",
    data: result,
  });
});

const updateRole = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.updateRole(req.params.id as string, req.body, req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Role updated successfully",
    data: result,
  });
});

const deleteRole = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.deleteRole(req.params.id as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Role deleted successfully",
    data: result,
  });
});

const assignRoleToUser = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.assignRoleToUser(req.body, req.user.userId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Role assigned to user successfully",
    data: result,
  });
});

const removeRoleFromUser = catchAsync(async (req: Request, res: Response) => {
  const { userId, roleId } = req.params;
  const result = await RbacService.removeRoleFromUser(userId as string, roleId as string);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Role assignment removed successfully",
    data: result,
  });
});

// ============================================================
// VENDOR & STAFF CONTROLLERS
// ============================================================

const createVendorStaff = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.createVendorStaff(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Staff member created successfully",
    data: result,
  });
});

const getVendorStaffList = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.getVendorStaffList(req.user.userId, req.user.tenantId);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Store staff members retrieved successfully",
    data: result,
  });
});

const assignStaffPermissions = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.assignStaffPermissions(req.user.userId, req.user.tenantId, req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Permissions delegated to staff member successfully",
    data: result,
  });
});

const getStaffPermissions = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.getStaffPermissions(
    req.params.staffUserId as string,
    req.user.tenantId,
    req.user.role,
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Staff permissions retrieved successfully",
    data: result,
  });
});

const revokeStaffPermission = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.revokeStaffPermission(req.params.id as string, req.user.tenantId, req.user.role);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Staff permission revoked successfully",
    data: result,
  });
});

const getMyEffectivePermissions = catchAsync(async (req: Request, res: Response) => {
  const result = await RbacService.getMyEffectivePermissions(req.user);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Effective permissions retrieved successfully",
    data: result,
  });
});

export const RbacController = {
  // Global / Admin
  seedSystemPermissions,
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,

  // Vendor & Staff
  createVendorStaff,
  getVendorStaffList,
  assignStaffPermissions,
  getStaffPermissions,
  revokeStaffPermission,
  getMyEffectivePermissions,
};
