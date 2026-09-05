import { z } from "zod";

const createProductVariantSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  attributes: z.record(z.string(), z.unknown(), {
    message: "Attributes must be an object of key-value pairs",
  }),
  price: z.number().positive("Variant price must be greater than 0"),
  stock: z.number().int().nonnegative("Variant stock cannot be negative").optional().default(0),
  image: z.string().url("Variant image must be a valid URL").optional().nullable(),
});

const updateProductVariantSchema = z.object({
  sku: z.string().min(1, "SKU cannot be empty").optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  price: z.number().positive("Variant price must be greater than 0").optional(),
  stock: z.number().int().nonnegative("Variant stock cannot be negative").optional(),
  image: z.string().url("Variant image must be a valid URL").optional().nullable(),
});

export const ProductVariantValidation = {
  createProductVariantSchema,
  updateProductVariantSchema,
};
