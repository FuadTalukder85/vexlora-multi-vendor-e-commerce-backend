import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { ProductVariantController } from "./productVariant.controller";
import { ProductVariantValidation } from "./productVariant.validation";

const router = Router();

// Lookup variant by SKU (e.g. for barcode scanners / stock inventory lookups)
router.get("/sku/:sku", optionalAuth, ProductVariantController.getVariantBySku);

// Get all variants for a specific product
router.get("/product/:productId", optionalAuth, ProductVariantController.getVariantsByProductId);

// Add a variant to a product (Vendor owner or Admin)
router.post(
  "/product/:productId",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ProductVariantValidation.createProductVariantSchema),
  ProductVariantController.addVariant,
);

// Single variant operations by variant ID
router.get("/:id", optionalAuth, ProductVariantController.getVariantById);

router.patch(
  "/:id",
  checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(ProductVariantValidation.updateProductVariantSchema),
  ProductVariantController.updateVariant,
);

router.delete("/:id", checkAuth(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN), ProductVariantController.deleteVariant);

export const ProductVariantRoutes = router;
