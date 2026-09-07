import { z } from "zod";

const createReviewSchema = z.object({
  productId: z.string({ message: "Product ID is required" }).min(1, "Product ID is required"),
  rating: z
    .number({ message: "Rating is required and must be a number" })
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  comment: z
    .string()
    .trim()
    .max(2000, "Review comment cannot exceed 2000 characters")
    .optional()
    .nullable(),
  images: z
    .array(z.string().url("Each review image must be a valid URL"))
    .max(10, "A maximum of 10 images are allowed")
    .optional()
    .default([]),
  subOrderId: z.string().optional().nullable(),
});

const updateReviewSchema = z.object({
  rating: z
    .number({ message: "Rating must be a number" })
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5")
    .optional(),
  comment: z
    .string()
    .trim()
    .max(2000, "Review comment cannot exceed 2000 characters")
    .optional()
    .nullable(),
  images: z
    .array(z.string().url("Each review image must be a valid URL"))
    .max(10, "A maximum of 10 images are allowed")
    .optional(),
});

const vendorReplySchema = z.object({
  vendorReply: z
    .string({ message: "Vendor reply message is required" })
    .trim()
    .min(1, "Vendor reply cannot be empty")
    .max(2000, "Vendor reply cannot exceed 2000 characters"),
});

export const ReviewValidation = {
  createReviewSchema,
  updateReviewSchema,
  vendorReplySchema,
};
