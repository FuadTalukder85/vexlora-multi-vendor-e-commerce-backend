import { PermissionManager } from "../utils/permissionManager";

/**
 * Backward compatibility wrapper delegating to PermissionManager
 */
export const checkGlobalPermission = (resource: string, action: string) => {
  return PermissionManager.requirePermission(`${resource}:${action}`);
};

export const checkVendorPermission = (resource: string, action: string) => {
  return PermissionManager.requireVendorPermission(`${resource}:${action}`);
};

export const enforceTenantAccess = (resourceVendorId: string, reqUserTenantId?: string | null): void => {
  return PermissionManager.enforceTenantAccess(resourceVendorId, reqUserTenantId);
};
