import { z } from "zod";
import { VendorStatus } from "../../../generated/prisma/enums";

const createVendorProfileSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  storeSlug: z.string().min(1, "Store slug cannot be empty").optional(),
  storeLogo: z.string().url("Store logo must be a valid URL").optional().nullable(),
  storeBanner: z.string().url("Store banner must be a valid URL").optional().nullable(),
  description: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  documents: z
    .array(
      z.object({
        type: z.string().min(1, "Document type is required"),
        url: z.string().url("Document URL must be a valid URL"),
      }),
    )
    .optional(),
});

const updateVendorProfileSchema = z.object({
  storeName: z.string().min(1, "Store name cannot be empty").optional(),
  storeSlug: z.string().min(1, "Store slug cannot be empty").optional(),
  storeLogo: z.string().url("Store logo must be a valid URL").optional().nullable(),
  storeBanner: z.string().url("Store banner must be a valid URL").optional().nullable(),
  description: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
});

const updateVendorStatusSchema = z.object({
  status: z.nativeEnum(VendorStatus, {
    message: "Invalid vendor status",
  }),
  commissionRate: z.number().min(0).max(100).optional(),
});

const addDocumentSchema = z.object({
  type: z.string().min(1, "Document type is required"),
  url: z.string().url("Document URL must be a valid URL"),
});

export const VendorProfileValidation = {
  createVendorProfileSchema,
  updateVendorProfileSchema,
  updateVendorStatusSchema,
  addDocumentSchema,
};
