import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { WishlistController } from "./wishlist.controller";
import { WishlistValidation } from "./wishlist.validation";

const router = Router();

// Add product to current user's wishlist
router.post(
  "/",
  checkAuth(),
  validateRequest(WishlistValidation.addToWishlistSchema),
  WishlistController.addToWishlist,
);

// Toggle product in current user's wishlist (add if not present, remove if present)
router.post(
  "/toggle",
  checkAuth(),
  validateRequest(WishlistValidation.toggleWishlistSchema),
  WishlistController.toggleWishlist,
);

// Get current user's wishlist items with pagination, filtering, search, and sorting
router.get("/my-wishlist", checkAuth(), WishlistController.getMyWishlist);

// Check if a specific product is in current user's wishlist
router.get("/check/:productId", checkAuth(), WishlistController.checkProductInWishlist);

// Clear entire wishlist for current user
router.delete("/clear", checkAuth(), WishlistController.clearWishlist);

// Remove specific product by productId from current user's wishlist
router.delete("/product/:productId", checkAuth(), WishlistController.removeByProductId);

// Social proof: count of how many users have wishlisted a specific product
router.get("/product/:productId/count", optionalAuth, WishlistController.getProductWishlistCount);

// Admin route: list and inspect all wishlists across the platform
router.get(
  "/admin/all",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  WishlistController.getAllWishlists,
);

// Delete wishlist item by wishlist ID (or product ID)
router.delete("/:id", checkAuth(), WishlistController.removeFromWishlist);

export const WishlistRoutes = router;
