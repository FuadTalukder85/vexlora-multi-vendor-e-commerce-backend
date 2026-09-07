import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/enums";

const updateMeSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  phone: z.string().optional().nullable(),
  image: z.string().url("Image must be a valid URL").optional().nullable(),
});

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  phone: z.string().optional(),
  tenantId: z.string().optional(),
  isOwner: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  phone: z.string().optional().nullable(),
  image: z.string().url("Image must be a valid URL").optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  tenantId: z.string().optional().nullable(),
  isOwner: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    message: "Invalid user status",
  }),
});

export const UserValidation = {
  updateMeSchema,
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
};
