import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { ModuleScope, Role } from "../../generated/prisma/enums";
import AppError from "../errors/AppError";
import { prisma } from "../lib/prisma";

/**
 * Standard Action Aliases
 * Normalizes 'view' <-> 'read' and 'edit' <-> 'update'
 */
const normalizeAction = (action: string): string => {
  const lower = action.toLowerCase().trim();
  if (lower === "read" || lower === "view") return "read";
  if (lower === "update" || lower === "edit") return "update";
  return lower;
};

/**
 * Normalize permission key (e.g. "products:create" -> "product:create")
 */
const normalizeResource = (resource: string): string => {
  const lower = resource.toLowerCase().trim();
  // Standardize plural to singular if needed
  if (lower === "products") return "product";
  if (lower === "categories") return "category";
  if (lower === "orders") return "order";
  if (lower === "coupons") return "coupon";
  if (
    lower === "payouts" ||
    lower === "payout-sub-orders" ||
    lower === "payout-sub-order" ||
    lower === "payout_sub_orders"
  )
    return "payout";
  if (lower === "users") return "user";
  if (lower === "reviews") return "review";
  if (lower === "notifications") return "notification";
  return lower;
};

export const normalizePermissionKey = (key: string): string => {
  const parts = key.trim().split(":");
  if (parts.length < 2) return key;
  const resource = normalizeResource(parts[0]);
  const action = parts[1] === "*" ? "*" : normalizeAction(parts[1]);
  return `${resource}:${action}`;
};

/**
 * Vendor-Accessible Resource Whitelist
 * Vendors and vendor-staff can ONLY access these resources.
 */
export const VENDOR_ALLOWED_RESOURCES = new Set([
  "product",
  "order",
  "inventory",
  "coupon",
  "payout",
  "staff",
  "vendor-profile",
  "vendor_profiles",
  "review",
  "notification",
]);

interface CacheEntry {
  permissions: string[];
  timestamp: number;
  ttl: number;
}

/**
 * PermissionManager - High-performance RBAC permission engine with caching & multi-tenant vendor support
 *
 * Inspired by bffb-automation architecture with enhancements for multi-vendor e-commerce:
 * - Resource:Action key format (e.g., "product:read", "category:create", "order:update")
 * - Wildcard support ("*" for SuperAdmin, "product:*" for full resource access)
 * - In-memory TTL caching with concurrency race-condition prevention
 * - Vendor & Staff delegation boundaries
 * - Server-side multi-tenant isolation
 */
export class PermissionManager {
  private static instance: PermissionManager;
  private userPermissionCache = new Map<string, CacheEntry>();
  private userPermissionPromises = new Map<string, Promise<string[]>>();

  // Cache TTL settings (5 minutes default)
  private USER_CACHE_TTL = 5 * 60 * 1000;

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  // ============================================================
  // CACHE MANAGEMENT
  // ============================================================

  /**
   * Clear cache for a specific user
   */
  public static clearUserCache(userId: string): void {
    const instance = PermissionManager.getInstance();
    instance.userPermissionCache.delete(userId.toString());
  }

  /**
   * Clear all permission caches
   */
  public static clearAllCache(): void {
    const instance = PermissionManager.getInstance();
    instance.userPermissionCache.clear();
    instance.userPermissionPromises.clear();
  }

  // ============================================================
  // PERMISSION RESOLUTION
  // ============================================================

  /**
   * Check if a user has a specific permission
   */
  public static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const instance = PermissionManager.getInstance();
    const userPermissions = await instance.getUserPermissions(userId);
    return instance.checkPermission(userPermissions, permission);
  }

  /**
   * Check if user has ANY of the specified permissions
   */
  public static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const instance = PermissionManager.getInstance();
    const userPermissions = await instance.getUserPermissions(userId);

    for (const perm of permissions) {
      if (instance.checkPermission(userPermissions, perm)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has ALL of the specified permissions
   */
  public static async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const instance = PermissionManager.getInstance();
    const userPermissions = await instance.getUserPermissions(userId);

    for (const perm of permissions) {
      if (!instance.checkPermission(userPermissions, perm)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all resolved permission keys for a user (with caching)
   */
  public static async getUserPermissions(userId: string): Promise<string[]> {
    const instance = PermissionManager.getInstance();
    return instance.getUserPermissions(userId);
  }

  /**
   * Get user permissions with TTL caching and race-condition prevention
   */
  public async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = userId.toString();
    const cached = this.userPermissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.permissions;
    }

    const existingPromise = this.userPermissionPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const permissionPromise = this.fetchAndCacheUserPermissions(userId);
    this.userPermissionPromises.set(cacheKey, permissionPromise);

    try {
      return await permissionPromise;
    } finally {
      this.userPermissionPromises.delete(cacheKey);
    }
  }

  /**
   * Fetch from DB and cache
   */
  private async fetchAndCacheUserPermissions(userId: string): Promise<string[]> {
    const permissions = await this.fetchUserPermissions(userId);

    this.userPermissionCache.set(userId.toString(), {
      permissions,
      timestamp: Date.now(),
      ttl: this.USER_CACHE_TTL,
    });

    return permissions;
  }

  /**
   * Calculate effective permissions for a user from Postgres
   */
  private async fetchUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isSuperAdmin: true,
          isOwner: true,
          tenantId: true,
        },
      });

      if (!user) return [];

      // 1. Super Admin -> Global wildcard
      if (user.role === Role.SUPER_ADMIN || user.isSuperAdmin) {
        return ["*"];
      }

      // 2. Platform Admin -> Roles & Global Permissions
      if (user.role === Role.ADMIN) {
        const permissions: string[] = [];

        // Check assigned roles
        const userRoles = await prisma.userRole.findMany({
          where: { userId, isActive: true },
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

        if (userRoles.length === 0) {
          // Default Admin: grant all ADMIN and BOTH permissions
          const adminPerms = await prisma.permission.findMany({
            where: {
              scope: { in: [ModuleScope.ADMIN, ModuleScope.BOTH] },
              isActive: true,
            },
            select: { key: true },
          });

          return adminPerms.map((p) => p.key);
        }

        for (const ur of userRoles) {
          if (!ur.role.isActive) continue;
          for (const rp of ur.role.rolePermissions) {
            if (rp.permission.isActive) {
              permissions.push(normalizePermissionKey(rp.permission.key));
            }
          }
        }

        // Direct user permissions
        const directPermissions = await prisma.userPermission.findMany({
          where: { userId },
          include: { permission: true },
        });

        for (const dp of directPermissions) {
          if (dp.permission.isActive) {
            permissions.push(normalizePermissionKey(dp.permission.key));
          }
        }

        return Array.from(new Set(permissions));
      }

      // 3. Vendor Store Owner (isOwner === true)
      if (user.role === Role.VENDOR && user.isOwner) {
        const vendorPerms = await prisma.permission.findMany({
          where: {
            scope: { in: [ModuleScope.VENDOR, ModuleScope.BOTH] },
            isActive: true,
          },
          select: { key: true },
        });

        return vendorPerms.map((p) => normalizePermissionKey(p.key));
      }

      // 4. Vendor Staff (isOwner === false)
      if (user.role === Role.VENDOR && !user.isOwner) {
        const permissions: string[] = [];

        // Check staff assigned roles within this tenant
        const staffRoles = await prisma.userRole.findMany({
          where: {
            userId: user.id,
            isActive: true,
            tenantId: user.tenantId || undefined,
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

        for (const sr of staffRoles) {
          if (!sr.role.isActive) continue;
          for (const rp of sr.role.rolePermissions) {
            const normalized = normalizePermissionKey(rp.permission.key);
            const [resource] = normalized.split(":");
            if (
              rp.permission.isActive &&
              rp.permission.scope !== ModuleScope.ADMIN &&
              VENDOR_ALLOWED_RESOURCES.has(resource)
            ) {
              permissions.push(normalized);
            }
          }
        }

        // Check direct staff delegated permissions within this tenant
        const staffPermissions = await prisma.userPermission.findMany({
          where: {
            userId: user.id,
            tenantId: user.tenantId || undefined,
          },
          include: { permission: true },
        });

        for (const sp of staffPermissions) {
          const normalized = normalizePermissionKey(sp.permission.key);
          const [resource] = normalized.split(":");
          if (
            sp.permission.isActive &&
            sp.permission.scope !== ModuleScope.ADMIN &&
            VENDOR_ALLOWED_RESOURCES.has(resource)
          ) {
            permissions.push(normalized);
          }
        }

        return Array.from(new Set(permissions));
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Check if a required permission is satisfied by the user's permission set
   */
  private checkPermission(userPermissions: string[], requiredPermission: string): boolean {
    const normalizedReq = normalizePermissionKey(requiredPermission);

    // SuperAdmin wildcard
    if (userPermissions.includes("*")) {
      return true;
    }

    // Direct match
    if (userPermissions.includes(normalizedReq)) {
      return true;
    }

    const [resource, action] = normalizedReq.split(":");

    // Resource wildcard (e.g., "product:*")
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }

    // Action wildcard for resource
    if (action === "*") {
      return userPermissions.some((perm) => perm.startsWith(`${resource}:`));
    }

    return false;
  }

  // ============================================================
  // EXPRESS MIDDLEWARE GUARDS
  // ============================================================

  /**
   * Require a specific permission (e.g., "category:create", "product:read")
   */
  public static requirePermission(requiredPermission: string) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        if (!user || !user.userId) {
          throw new AppError(status.UNAUTHORIZED, "Authentication required. Please log in.");
        }

        const normalizedReq = normalizePermissionKey(requiredPermission);
        const [resource] = normalizedReq.split(":");

        // If user is VENDOR, strictly reject any attempt to access non-vendor resources
        if (user.role === Role.VENDOR && !VENDOR_ALLOWED_RESOURCES.has(resource)) {
          throw new AppError(
            status.FORBIDDEN,
            `Forbidden: Vendors do not have access to platform resource '${resource}'.`,
          );
        }

        const hasPerm = await PermissionManager.hasPermission(user.userId, normalizedReq);
        if (!hasPerm) {
          throw new AppError(status.FORBIDDEN, `Forbidden: You lack the required permission '${requiredPermission}'.`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Require ANY of the listed permissions
   */
  public static requireAnyPermission(permissions: string[]) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        if (!user || !user.userId) {
          throw new AppError(status.UNAUTHORIZED, "Authentication required. Please log in.");
        }

        const hasAny = await PermissionManager.hasAnyPermission(user.userId, permissions);
        if (!hasAny) {
          throw new AppError(status.FORBIDDEN, `Forbidden: You require at least one of [${permissions.join(", ")}]`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Require ALL of the listed permissions
   */
  public static requireAllPermissions(permissions: string[]) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        if (!user || !user.userId) {
          throw new AppError(status.UNAUTHORIZED, "Authentication required. Please log in.");
        }

        const hasAll = await PermissionManager.hasAllPermissions(user.userId, permissions);
        if (!hasAll) {
          throw new AppError(status.FORBIDDEN, `Forbidden: You must have all permissions: [${permissions.join(", ")}]`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Require Vendor Permission with Automatic Tenant Scoping
   * Ensures:
   * 1. User is verified VENDOR (or platform admin)
   * 2. Target resource is within VENDOR_ALLOWED_RESOURCES
   * 3. User has the required permission
   * 4. Auto-resolves user.tenantId for subsequent database queries
   */
  public static requireVendorPermission(requiredPermission: string) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        if (!user || !user.userId) {
          throw new AppError(status.UNAUTHORIZED, "Authentication required. Please log in.");
        }

        // Platform administrators bypass vendor scope
        if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || user.isSuperAdmin) {
          return next();
        }

        if (user.role !== Role.VENDOR) {
          throw new AppError(status.FORBIDDEN, "Forbidden: Vendor access required.");
        }

        // Resolve tenantId if not already present
        if (!user.tenantId) {
          const profile = await prisma.vendorProfile.findUnique({
            where: { userId: user.userId },
            select: { id: true },
          });

          if (!profile) {
            throw new AppError(status.FORBIDDEN, "Forbidden: Active vendor store required.");
          }

          user.tenantId = profile.id;
        }

        const normalizedReq = normalizePermissionKey(requiredPermission);
        const [resource] = normalizedReq.split(":");

        if (!VENDOR_ALLOWED_RESOURCES.has(resource)) {
          throw new AppError(
            status.FORBIDDEN,
            `Forbidden: Resource '${resource}' is not available to the vendor role.`,
          );
        }

        const hasPerm = await PermissionManager.hasPermission(user.userId, normalizedReq);
        if (!hasPerm) {
          throw new AppError(status.FORBIDDEN, `Forbidden: Your account lacks '${requiredPermission}' for your store.`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Strict Multi-Tenant Assertion
   */
  public static enforceTenantAccess(resourceVendorId: string, userTenantId?: string | null): void {
    if (!userTenantId || resourceVendorId !== userTenantId) {
      throw new AppError(
        status.FORBIDDEN,
        "Tenant violation: You cannot access or modify resources belonging to another vendor.",
      );
    }
  }
}
