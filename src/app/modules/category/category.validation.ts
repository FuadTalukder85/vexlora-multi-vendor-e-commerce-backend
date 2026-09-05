import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  slug: z.string().min(1, "Slug cannot be empty").optional(),
  parentId: z.string().optional().nullable(),
  image: z.string().url("Image must be a valid URL").optional().nullable(),
  commissionOverride: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, "Category name cannot be empty").optional(),
  slug: z.string().min(1, "Slug cannot be empty").optional(),
  parentId: z.string().optional().nullable(),
  image: z.string().url("Image must be a valid URL").optional().nullable(),
  commissionOverride: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const CategoryValidation = {
  createCategorySchema,
  updateCategorySchema,
};
