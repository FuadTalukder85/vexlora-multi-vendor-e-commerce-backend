import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { ReviewController } from "./review.controller";
import { ReviewValidation } from "./review.validation";

const router = Router();

// Submit a new review (Customers, auto-detects verified purchase)
router.post(
  "/",
  checkAuth(),
  validateRequest(ReviewValidation.createReviewSchema),
  ReviewController.createReview,
);

// Get reviews written by the currently logged-in customer
router.get("/my-reviews", checkAuth(), ReviewController.getMyReviews);

// Get reviews on all products owned by the currently logged-in vendor
router.get(
  "/vendor/me",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("review:read"),
  ReviewController.getVendorReviews,
);

// Admin: inspect all reviews across the platform
router.get(
  "/admin/all",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("review:read"),
  ReviewController.getAllReviewsAdmin,
);

// Get reviews for a specific product (Public, with pagination, sorting, filters)
router.get("/product/:productId", optionalAuth, ReviewController.getProductReviews);

// Get review summary / statistics for a product (average, distribution, counts)
router.get("/product/:productId/stats", optionalAuth, ReviewController.getProductReviewStats);

// Check whether current customer is eligible to review this product
router.get("/can-review/:productId", checkAuth(), ReviewController.canReviewProduct);

// Vendor reply to a customer review
router.patch(
  "/:id/reply",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("review:update"),
  validateRequest(ReviewValidation.vendorReplySchema),
  ReviewController.vendorReply,
);

// Update review content or rating (Review author only)
router.patch(
  "/:id",
  checkAuth(),
  validateRequest(ReviewValidation.updateReviewSchema),
  ReviewController.updateReview,
);

// Delete review (Review author or Admin)
router.delete("/:id", checkAuth(), ReviewController.deleteReview);

// Get single review by ID (Public)
router.get("/:id", optionalAuth, ReviewController.getReviewById);

export const ReviewRoutes = router;
