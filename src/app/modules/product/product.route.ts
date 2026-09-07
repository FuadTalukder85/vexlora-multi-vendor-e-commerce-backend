import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { ProductController } from "./product.controller";
import { ProductValidation } from "./product.validation";

const router = Router();

// Vendor self-service products list
router.get(
  "/vendor/me",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("product:read"),
  ProductController.getMyVendorProducts,
);

// Admin-only listing of all products
router.get("/admin", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), ProductController.getAllProductsAdmin);

// Public product listing
router.get("/", ProductController.getAllProductsPublic);

// Lookup by slug (public if active/approved, otherwise owner/admin only)
router.get("/slug/:slug", optionalAuth, ProductController.getProductBySlug);

// Lookup by ID (public if active/approved, otherwise owner/admin only)
router.get("/:id", optionalAuth, ProductController.getProductById);

// Create product (Vendor or Admin)
router.post(
  "/",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("product:create"),
  validateRequest(ProductValidation.createProductSchema),
  ProductController.createProduct,
);

// Update product (Owner, Staff with permission, or Admin)
router.patch(
  "/:id",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("product:update"),
  validateRequest(ProductValidation.updateProductSchema),
  ProductController.updateProduct,
);

// Delete product (Owner, Staff with permission, or Admin)
router.delete(
  "/:id",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("product:delete"),
  ProductController.deleteProduct,
);

// Update product status (Publish/Draft/Archive or Admin Approval/Rejection)
router.patch(
  "/:id/status",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requireVendorPermission("product:update"),
  validateRequest(ProductValidation.updateProductStatusSchema),
  ProductController.updateProductStatus,
);

export const ProductRoutes = router;
