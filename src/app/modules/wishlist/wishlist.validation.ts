import { z } from "zod";

const addToWishlistSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

const toggleWishlistSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

export const WishlistValidation = {
  addToWishlistSchema,
  toggleWishlistSchema,
};
