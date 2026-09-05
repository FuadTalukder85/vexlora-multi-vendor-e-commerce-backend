import { z } from "zod";
import { ModuleScope } from "../../../generated/prisma/enums";

const createPermissionSchema = z.object({
  key: z
    .string()
    .min(2, "Permission key must be at least 2 characters")
    .regex(/^[a-z0-9_-]+:[a-z0-9_*-]+$/, "Permission key must follow 'resource:action' format (e.g. 'product:create')"),
  name: z.string().min(2, "Permission name is required"),
  category: z.string().min(2, "Category is required"),
  scope: z.nativeEnum(ModuleScope, {
    message: "Scope must be ADMIN, VENDOR, or BOTH",
  }),
  description: z.string().optional(),
});

const updatePermissionSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  scope: z
    .nativeEnum(ModuleScope, {
      message: "Scope must be ADMIN, VENDOR, or BOTH",
    })
    .optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createRoleSchema = z.object({
  name: z.string().min(2, "Role name is required"),
  slug: z
    .string()
    .min(2, "Role slug is required")
    .regex(/^[a-z0-9_-]+$/, "Role slug must only contain lowercase alphanumeric, underscores or hyphens"),
  description: z.string().optional(),
  scope: z
    .nativeEnum(ModuleScope, {
      message: "Scope must be ADMIN, VENDOR, or BOTH",
    })
    .optional(),
  permissions: z.array(z.string().min(1)).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  scope: z
    .nativeEnum(ModuleScope, {
      message: "Scope must be ADMIN, VENDOR, or BOTH",
    })
    .optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string().min(1)).optional(),
});

const assignUserRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  roleId: z.string().min(1, "Role ID is required"),
});

const createVendorStaffSchema = z.object({
  name: z.string().min(2, "Staff name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional().nullable(),
});

const assignStaffPermissionsSchema = z.object({
  staffUserId: z.string().min(1, "Staff user ID is required"),
  permissions: z
    .array(z.string().min(1))
    .min(1, "At least one permission must be provided"),
});

export const RbacValidation = {
  createPermissionSchema,
  updatePermissionSchema,
  createRoleSchema,
  updateRoleSchema,
  assignUserRoleSchema,
  createVendorStaffSchema,
  assignStaffPermissionsSchema,
};
