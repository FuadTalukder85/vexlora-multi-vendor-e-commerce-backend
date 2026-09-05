import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { CategoryController } from "./category.controller";
import { CategoryValidation } from "./category.validation";

const router = Router();

// Public routes
router.get("/", CategoryController.getAllCategories);
router.get("/tree", CategoryController.getCategoryTree);
router.get("/slug/:slug", CategoryController.getCategoryBySlug);
router.get("/:id", CategoryController.getCategoryById);

// Admin-only management routes with granular permission guards
router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("category:create"),
  validateRequest(CategoryValidation.createCategorySchema),
  CategoryController.createCategory,
);
router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("category:update"),
  validateRequest(CategoryValidation.updateCategorySchema),
  CategoryController.updateCategory,
);
router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("category:delete"),
  CategoryController.deleteCategory,
);

export const CategoryRoutes = router;
