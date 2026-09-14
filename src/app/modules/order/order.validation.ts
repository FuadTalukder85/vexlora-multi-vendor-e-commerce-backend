import { z } from "zod";
import { PaymentStatus } from "../../../generated/prisma/enums";

const createOrderItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

const createOrderSchema = z.object({
  items: z.array(createOrderItemSchema).min(1, "At least one item is required to place an order"),
  shippingAddressId: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentIntentId: z.string().optional(),
  couponCode: z.string().optional(),
});

const updatePaymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus, {
    message: `Payment status must be one of: ${Object.values(PaymentStatus).join(", ")}`,
  }),
  paymentIntentId: z.string().optional(),
});

export const OrderValidation = {
  createOrderSchema,
  updatePaymentStatusSchema,
};
