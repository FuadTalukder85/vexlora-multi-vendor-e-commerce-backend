import { z } from "zod";
import { ProductStatus } from "../../../generated/prisma/enums";
import { ProductVariantValidation } from "../productVariant/productVariant.validation";

const createVariantSchema = ProductVariantValidation.createProductVariantSchema;
const updateVariantSchema = ProductVariantValidation.updateProductVariantSchema;

const createProductSchema = z
  .object({
    title: z.string().min(2, "Product title must be at least 2 characters"),
    slug: z.string().min(1, "Product slug cannot be empty").optional(),
    description: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    images: z.array(z.string().url("Product image must be a valid URL")).optional().default([]),
    basePrice: z.number().positive("Base price must be greater than 0"),
    discountPrice: z.number().positive("Discount price must be positive").optional().nullable(),
    totalStock: z.number().int().nonnegative("Stock cannot be negative").optional().default(0),
    tags: z.array(z.string()).optional().default([]),
    status: z.nativeEnum(ProductStatus, { message: "Invalid product status" }).optional().default(ProductStatus.DRAFT),
    vendorId: z.string().optional(),
    variants: z.array(createVariantSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.discountPrice !== undefined && data.discountPrice !== null) {
        return data.discountPrice < data.basePrice;
      }
      return true;
    },
    {
      message: "Discount price must be less than base price",
      path: ["discountPrice"],
    },
  );

const updateProductSchema = z
  .object({
    title: z.string().min(2, "Product title must be at least 2 characters").optional(),
    slug: z.string().min(1, "Product slug cannot be empty").optional(),
    description: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    images: z.array(z.string().url("Product image must be a valid URL")).optional(),
    basePrice: z.number().positive("Base price must be greater than 0").optional(),
    discountPrice: z.number().positive("Discount price must be positive").optional().nullable(),
    totalStock: z.number().int().nonnegative("Stock cannot be negative").optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.basePrice !== undefined && data.discountPrice !== undefined && data.discountPrice !== null) {
        return data.discountPrice < data.basePrice;
      }
      return true;
    },
    {
      message: "Discount price must be less than base price",
      path: ["discountPrice"],
    },
  );

const updateProductStatusSchema = z.object({
  status: z.nativeEnum(ProductStatus, {
    message: "Invalid product status",
  }),
});

export const ProductValidation = {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  createVariantSchema,
  updateVariantSchema,
};
