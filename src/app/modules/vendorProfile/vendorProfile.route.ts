import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, optionalAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { VendorProfileController } from "./vendorProfile.controller";
import { VendorProfileValidation } from "./vendorProfile.validation";

import { multerUpload } from "../../config/multer.config";

const router = Router();

// Vendor self-service routes
router.post(
  "/apply",
  checkAuth(),
  validateRequest(VendorProfileValidation.createVendorProfileSchema),
  VendorProfileController.applyVendorProfile,
);
router.get("/me", checkAuth(), VendorProfileController.getMyVendorProfile);
router.patch(
  "/me",
  checkAuth(),
  validateRequest(VendorProfileValidation.updateVendorProfileSchema),
  VendorProfileController.updateMyVendorProfile,
);

// Vendor media management (Cloudinary via Multer)
router.post("/me/logo", checkAuth(), multerUpload.single("image"), VendorProfileController.uploadStoreLogo);
router.delete("/me/logo", checkAuth(), VendorProfileController.deleteStoreLogo);
router.post("/me/banner", checkAuth(), multerUpload.single("image"), VendorProfileController.uploadStoreBanner);
router.delete("/me/banner", checkAuth(), VendorProfileController.deleteStoreBanner);
router.post("/me/documents", checkAuth(), multerUpload.single("file"), VendorProfileController.uploadMyDocument);

// Documents
router.post(
  "/:vendorId/documents",
  checkAuth(),
  validateRequest(VendorProfileValidation.addDocumentSchema),
  VendorProfileController.addDocument,
);
router.delete("/documents/:docId", checkAuth(), VendorProfileController.deleteDocument);

// Admin-only management routes
router.get("/admin", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), VendorProfileController.getAllVendorsAdmin);
router.patch(
  "/:id/status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(VendorProfileValidation.updateVendorStatusSchema),
  VendorProfileController.updateVendorStatus,
);

// Public & Protected single vendor lookup (sanitized for public, complete for store owner / admin)
router.get("/", VendorProfileController.getAllVendorsPublic);
router.get("/store/:slug", optionalAuth, VendorProfileController.getVendorBySlug);
router.get("/:id", optionalAuth, VendorProfileController.getVendorById);

export const VendorProfileRoutes = router;
