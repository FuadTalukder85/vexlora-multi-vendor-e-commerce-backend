import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { ProductController } from "./product.controller";
import { ProductValidation } from "./product.validation";

const router = Router();

// Vendor self-service products list
router.get("/vendor/me", checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN), ProductController.getMyVendorProducts);

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
  validateRequest(ProductValidation.createProductSchema),
  ProductController.createProduct,
);

// Update product (Owner or Admin)
router.patch(
  "/:id",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ProductValidation.updateProductSchema),
  ProductController.updateProduct,
);

// Delete product (Owner or Admin)
router.delete("/:id", checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN), ProductController.deleteProduct);

// Update product status (Publish/Draft/Archive or Admin Approval/Rejection)
router.patch(
  "/:id/status",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ProductValidation.updateProductStatusSchema),
  ProductController.updateProductStatus,
);

export const ProductRoutes = router;
