import { ModuleScope } from "../../../generated/prisma/enums";

export interface ICreatePermissionPayload {
  key: string;
  name: string;
  category: string;
  scope: ModuleScope;
  description?: string;
}

export interface IUpdatePermissionPayload {
  name?: string;
  category?: string;
  scope?: ModuleScope;
  description?: string;
  isActive?: boolean;
}

export interface ICreateRolePayload {
  name: string;
  slug: string;
  description?: string;
  scope?: ModuleScope;
  tenantId?: string | null;
  permissions?: string[]; // array of permission IDs or keys
}

export interface IUpdateRolePayload {
  name?: string;
  description?: string;
  scope?: ModuleScope;
  isActive?: boolean;
  permissions?: string[]; // array of permission IDs or keys
}

export interface IAssignUserRolePayload {
  userId: string;
  roleId: string;
  tenantId?: string | null;
}

export interface ICreateVendorStaffPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface IAssignStaffPermissionsPayload {
  staffUserId: string;
  permissions: string[]; // array of permission IDs or keys (e.g. ["product:create", "product:read"])
}

export interface IUserEffectivePermissions {
  userId: string;
  role: string;
  isOwner: boolean;
  tenantId?: string | null;
  permissions: string[];
  categories: string[];
}
