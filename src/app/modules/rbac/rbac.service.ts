import status from "http-status";
import { ModuleScope, Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../../types/request.types";
import { PermissionManager, VENDOR_ALLOWED_RESOURCES } from "../../utils/permissionManager";
import { SYSTEM_PERMISSIONS } from "./rbac.constant";
import {
  IAssignStaffPermissionsPayload,
  IAssignUserRolePayload,
  ICreatePermissionPayload,
  ICreateRolePayload,
  ICreateVendorStaffPayload,
  IUpdatePermissionPayload,
  IUpdateRolePayload,
  IUserEffectivePermissions,
} from "./rbac.interface";

// ============================================================
// LAYER 1: GLOBAL / ADMIN RBAC SERVICES
// ============================================================

/**
 * Seed or update all system permissions in database
 */
const seedSystemPermissions = async () => {
  const operations = SYSTEM_PERMISSIONS.map((perm) =>
    prisma.permission.upsert({
      where: { key: perm.key },
      create: {
        key: perm.key,
        name: perm.name,
        category: perm.category,
        scope: perm.scope,
        description: perm.description,
        isActive: true,
      },
      update: {
        name: perm.name,
        category: perm.category,
        scope: perm.scope,
        description: perm.description,
      },
    }),
  );

  const results = await prisma.$transaction(operations);
  PermissionManager.clearAllCache();

  return {
    count: results.length,
    permissions: results,
  };
};

/**
 * Get all permissions, filtered by caller role, scope, and category
 */
const getAllPermissions = async (
  userRole: Role,
  filters?: { scope?: ModuleScope; category?: string; search?: string },
) => {
  const where: Record<string, unknown> = { isActive: true };

  if (filters?.category) {
    where.category = filters.category;
  }

  // Non-admins can only see VENDOR or BOTH scoped permissions
  if (userRole === Role.VENDOR) {
    where.scope = { in: [ModuleScope.VENDOR, ModuleScope.BOTH] };
  } else if (filters?.scope) {
    where.scope = filters.scope;
  }

  if (filters?.search) {
    where.OR = [
      { key: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return await prisma.permission.findMany({
    where,
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
};

/**
 * Get permission by ID or Key
 */
const getPermissionById = async (idOrKey: string) => {
  const perm = await prisma.permission.findFirst({
    where: {
      OR: [{ id: idOrKey }, { key: idOrKey }],
    },
  });

  if (!perm) {
    throw new AppError(status.NOT_FOUND, `Permission '${idOrKey}' not found`);
  }

  return perm;
};

/**
 * Create a new permission (Admin only)
 */
const createPermission = async (payload: ICreatePermissionPayload) => {
  const existing = await prisma.permission.findUnique({
    where: { key: payload.key },
  });

  if (existing) {
    throw new AppError(status.CONFLICT, `Permission with key '${payload.key}' already exists`);
  }

  const created = await prisma.permission.create({
    data: payload,
  });

  PermissionManager.clearAllCache();
  return created;
};

/**
 * Update permission (Admin only)
 */
const updatePermission = async (id: string, payload: IUpdatePermissionPayload) => {
  await getPermissionById(id);

  const updated = await prisma.permission.update({
    where: { id },
    data: payload,
  });

  PermissionManager.clearAllCache();
  return updated;
};

/**
 * Delete permission (Admin only)
 */
const deletePermission = async (id: string) => {
  await getPermissionById(id);

  const deleted = await prisma.permission.delete({
    where: { id },
  });

  PermissionManager.clearAllCache();
  return deleted;
};

/**
 * Get all roles
 */
const getAllRoles = async (userRole: Role, tenantId?: string | null, scopeQuery?: string) => {
  const where: Record<string, unknown> = { isActive: true };

  if (userRole === Role.VENDOR) {
    where.OR = [{ scope: { in: [ModuleScope.VENDOR, ModuleScope.BOTH] }, tenantId: null }, { tenantId }];
  } else if (scopeQuery && Object.values(ModuleScope).includes(scopeQuery as ModuleScope)) {
    where.scope = { in: [scopeQuery, ModuleScope.BOTH] };
  }

  return await prisma.appRole.findMany({
    where,
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
      _count: {
        select: { userRoles: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

/**
 * Get role by ID or slug
 */
const getRoleById = async (idOrSlug: string) => {
  const role = await prisma.appRole.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
      userRoles: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!role) {
    throw new AppError(status.NOT_FOUND, "Role not found");
  }

  return role;
};

/**
 * Create role with assigned permissions
 */
const createRole = async (payload: ICreateRolePayload, creatorId?: string) => {
  const existing = await prisma.appRole.findUnique({
    where: { slug: payload.slug },
  });

  if (existing) {
    throw new AppError(status.CONFLICT, `Role with slug '${payload.slug}' already exists`);
  }

  return await prisma.$transaction(async (tx) => {
    const role = await tx.appRole.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        scope: payload.scope || ModuleScope.BOTH,
        tenantId: payload.tenantId,
        isSystemRole: false,
      },
    });

    if (payload.permissions && payload.permissions.length > 0) {
      for (const permIdentifier of payload.permissions) {
        const perm = await tx.permission.findFirst({
          where: {
            OR: [{ id: permIdentifier }, { key: permIdentifier }],
          },
        });

        if (!perm) {
          throw new AppError(status.NOT_FOUND, `Permission '${permIdentifier}' not found`);
        }

        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
            assignedById: creatorId,
          },
        });
      }
    }

    return await tx.appRole.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  });
};

/**
 * Update role and assigned permissions
 */
const updateRole = async (id: string, payload: IUpdateRolePayload, updaterId?: string) => {
  await getRoleById(id);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.appRole.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        scope: payload.scope,
        isActive: payload.isActive,
      },
    });

    if (payload.permissions) {
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      for (const permIdentifier of payload.permissions) {
        const perm = await tx.permission.findFirst({
          where: {
            OR: [{ id: permIdentifier }, { key: permIdentifier }],
          },
        });

        if (!perm) {
          throw new AppError(status.NOT_FOUND, `Permission '${permIdentifier}' not found`);
        }

        await tx.rolePermission.create({
          data: {
            roleId: id,
            permissionId: perm.id,
            assignedById: updaterId,
          },
        });
      }
    }

    return await tx.appRole.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  });

  PermissionManager.clearAllCache();
  return updated;
};

/**
 * Delete role
 */
const deleteRole = async (id: string) => {
  const role = await getRoleById(id);

  if (role.isSystemRole) {
    throw new AppError(status.BAD_REQUEST, "Built-in system roles cannot be deleted");
  }

  const deleted = await prisma.appRole.delete({
    where: { id },
  });

  PermissionManager.clearAllCache();
  return deleted;
};

/**
 * Assign role to a user
 */
const assignRoleToUser = async (payload: IAssignUserRolePayload, assignedById?: string) => {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "Target user not found");
  }

  // If roleId is "NONE" or empty, remove existing custom roles
  if (payload.roleId === "NONE" || !payload.roleId) {
    await prisma.userRole.deleteMany({
      where: { userId: payload.userId },
    });
    PermissionManager.clearUserCache(payload.userId);
    return null;
  }

  const role = await prisma.appRole.findUnique({
    where: { id: payload.roleId },
  });

  if (!role) {
    throw new AppError(status.NOT_FOUND, "Role not found");
  }

  // Validate scope compatibility strictly on the backend
  if (role.scope !== ModuleScope.BOTH) {
    if (role.scope === ModuleScope.VENDOR && user.role !== Role.VENDOR) {
      throw new AppError(
        status.BAD_REQUEST,
        `Cannot assign a VENDOR-scoped role to a ${user.role} user`
      );
    }
    if (role.scope === ModuleScope.ADMIN && user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new AppError(
        status.BAD_REQUEST,
        `Cannot assign an ADMIN-scoped role to a ${user.role} user`
      );
    }
  }

  // Remove prior custom roles for this user so each user has one clean active custom RBAC role
  await prisma.userRole.deleteMany({
    where: {
      userId: payload.userId,
    },
  });

  const assignment = await prisma.userRole.create({
    data: {
      userId: payload.userId,
      roleId: payload.roleId,
      tenantId: payload.tenantId || user.tenantId,
      assignedById,
      isActive: true,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  PermissionManager.clearUserCache(payload.userId);
  return assignment;
};

/**
 * Remove role from a user
 */
const removeRoleFromUser = async (userId: string, roleId: string) => {
  const deleted = await prisma.userRole.delete({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
    },
  });

  PermissionManager.clearUserCache(userId);
  return deleted;
};

// ============================================================
// LAYER 2: VENDOR & STAFF RBAC SERVICES
// ============================================================

/**
 * Vendor Owner creates a new staff user for their store
 */
const createVendorStaff = async (vendorOwnerId: string, payload: ICreateVendorStaffPayload) => {
  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { userId: vendorOwnerId },
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found for this user");
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    let staffUser;

    if (existingUser) {
      // 1. Validate if existing user can be added as staff
      if (existingUser.role === Role.ADMIN || existingUser.role === Role.SUPER_ADMIN) {
        throw new AppError(status.BAD_REQUEST, "Cannot add a platform administrator as store staff");
      }
      if (existingUser.isOwner && existingUser.tenantId) {
        throw new AppError(status.BAD_REQUEST, "This user is already an owner of a vendor store");
      }
      if (existingUser.tenantId && existingUser.tenantId !== vendorProfile.id) {
        throw new AppError(status.BAD_REQUEST, "This user is already registered as staff at another store");
      }

      // 2. Link existing user account to this vendor store
      staffUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: Role.VENDOR,
          tenantId: vendorProfile.id,
          isOwner: false,
          createdById: vendorOwnerId,
          status: UserStatus.ACTIVE,
          phone: payload.phone || existingUser.phone,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          isOwner: true,
          status: true,
          phone: true,
          createdAt: true,
        },
      });
    } else {
      // 1. Create credentials via Better Auth for new user
      const createdAuthUser = await auth.api.signUpEmail({
        body: {
          email: payload.email,
          password: payload.password,
          name: payload.name,
        },
      });

      if (!createdAuthUser || !createdAuthUser.user) {
        throw new AppError(status.BAD_REQUEST, "Failed to create staff user credentials");
      }

      // 2. Set multi-tenant isolation fields
      staffUser = await prisma.user.update({
        where: { id: createdAuthUser.user.id },
        data: {
          role: Role.VENDOR,
          tenantId: vendorProfile.id,
          isOwner: false,
          createdById: vendorOwnerId,
          status: UserStatus.ACTIVE,
          phone: payload.phone,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          isOwner: true,
          status: true,
          phone: true,
          createdAt: true,
        },
      });
    }

    // 3. Automatically assign default vendor_staff role if it exists
    const staffRole = await prisma.appRole.findUnique({
      where: { slug: "vendor_staff" },
    });

    if (staffRole) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: staffUser.id,
            roleId: staffRole.id,
          },
        },
        create: {
          userId: staffUser.id,
          roleId: staffRole.id,
          tenantId: vendorProfile.id,
          assignedById: vendorOwnerId,
        },
        update: {
          tenantId: vendorProfile.id,
          assignedById: vendorOwnerId,
          isActive: true,
        },
      });
    }

    PermissionManager.clearUserCache(staffUser.id);
    return staffUser;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : "Failed to create staff user";
    throw new AppError(status.BAD_REQUEST, message);
  }
};

/**
 * Get all staff members belonging to the calling vendor's store
 */
const getVendorStaffList = async (vendorOwnerId: string, tenantId?: string | null) => {
  let resolvedTenantId = tenantId;

  if (!resolvedTenantId) {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: vendorOwnerId },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError(status.NOT_FOUND, "Vendor profile not found");
    }
    resolvedTenantId = profile.id;
  }

  return await prisma.user.findMany({
    where: {
      tenantId: resolvedTenantId,
      isOwner: false,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      userPermissions: {
        include: {
          permission: true,
        },
      },
      userRoles: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Vendor Owner delegates granular permissions to a staff member
 * Enforces:
 * 1. Target user must be staff belonging to the owner's tenant
 * 2. Permissions must have VENDOR or BOTH scope (strictly prohibited from delegating ADMIN permissions)
 * 3. Resource must be in VENDOR_ALLOWED_RESOURCES
 */
const assignStaffPermissions = async (
  vendorOwnerId: string,
  vendorTenantId: string | null | undefined,
  payload: IAssignStaffPermissionsPayload,
) => {
  let resolvedTenantId = vendorTenantId;

  if (!resolvedTenantId) {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: vendorOwnerId },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError(status.NOT_FOUND, "Vendor profile not found");
    }
    resolvedTenantId = profile.id;
  }

  // 1. Verify target staff user belongs to this tenant
  const staffUser = await prisma.user.findUnique({
    where: { id: payload.staffUserId },
  });

  if (!staffUser) {
    throw new AppError(status.NOT_FOUND, "Staff user not found");
  }

  if (staffUser.tenantId !== resolvedTenantId || staffUser.isOwner) {
    throw new AppError(
      status.FORBIDDEN,
      "Forbidden: You can only assign permissions to staff users belonging to your own store",
    );
  }

  // 2. Resolve and validate permissions
  const validatedPermissions: Array<{ id: string; key: string; scope: ModuleScope }> = [];
  for (const permIdentifier of payload.permissions) {
    const perm = await prisma.permission.findFirst({
      where: {
        OR: [{ id: permIdentifier }, { key: permIdentifier }],
      },
    });

    if (!perm) {
      throw new AppError(status.NOT_FOUND, `Permission '${permIdentifier}' not found`);
    }

    // STRICT: Vendors cannot delegate permissions for ADMIN-only resources
    if (perm.scope === ModuleScope.ADMIN) {
      throw new AppError(status.FORBIDDEN, `Forbidden: Cannot delegate platform admin-only permission '${perm.key}'`);
    }

    const [resource] = perm.key.split(":");
    if (!VENDOR_ALLOWED_RESOURCES.has(resource)) {
      throw new AppError(
        status.FORBIDDEN,
        `Forbidden: Resource '${resource}' is outside the vendor permission boundary`,
      );
    }

    validatedPermissions.push(perm);
  }

  // 3. Upsert permissions in a transaction
  const transactionResults = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const perm of validatedPermissions) {
      const assigned = await tx.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId: payload.staffUserId,
            permissionId: perm.id,
          },
        },
        create: {
          userId: payload.staffUserId,
          permissionId: perm.id,
          tenantId: resolvedTenantId,
          assignedById: vendorOwnerId,
        },
        update: {
          tenantId: resolvedTenantId,
          assignedById: vendorOwnerId,
        },
        include: {
          permission: true,
        },
      });

      results.push(assigned);
    }

    return results;
  });

  // Invalidate cached permissions for this staff user
  PermissionManager.clearUserCache(payload.staffUserId);

  return transactionResults;
};

/**
 * Get permissions assigned to a specific staff user
 */
const getStaffPermissions = async (staffUserId: string, vendorTenantId?: string | null, requesterRole?: Role) => {
  const staff = await prisma.user.findUnique({
    where: { id: staffUserId },
  });

  if (!staff) {
    throw new AppError(status.NOT_FOUND, "Staff user not found");
  }

  if (requesterRole === Role.VENDOR && staff.tenantId !== vendorTenantId) {
    throw new AppError(status.FORBIDDEN, "Forbidden: You can only view permissions for staff in your own store");
  }

  return await prisma.userPermission.findMany({
    where: { userId: staffUserId },
    include: {
      permission: true,
      assignedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
};

/**
 * Revoke permission from a staff user
 */
const revokeStaffPermission = async (
  userPermissionId: string,
  vendorTenantId?: string | null,
  requesterRole?: Role,
) => {
  const userPerm = await prisma.userPermission.findUnique({
    where: { id: userPermissionId },
  });

  if (!userPerm) {
    throw new AppError(status.NOT_FOUND, "User permission record not found");
  }

  if (requesterRole === Role.VENDOR && userPerm.tenantId !== vendorTenantId) {
    throw new AppError(status.FORBIDDEN, "Forbidden: You cannot modify permissions outside your store tenant");
  }

  const deleted = await prisma.userPermission.delete({
    where: { id: userPermissionId },
  });

  PermissionManager.clearUserCache(userPerm.userId);
  return deleted;
};

/**
 * Get currently logged-in user's effective permissions
 */
const getMyEffectivePermissions = async (user: IRequestUser): Promise<IUserEffectivePermissions> => {
  const permissions = await PermissionManager.getUserPermissions(user.userId);
  const categories = Array.from(new Set(permissions.filter((p) => p.includes(":")).map((p) => p.split(":")[0])));

  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.userId, isActive: true },
    include: { role: true },
  });
  const assignedRoles = userRoles.map((ur) => ur.role.name);

  return {
    userId: user.userId,
    role: user.role,
    isOwner: Boolean(user.isOwner),
    tenantId: user.tenantId,
    assignedRoles,
    permissions,
    categories,
  };
};

export const RbacService = {
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
