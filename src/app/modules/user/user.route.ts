import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

import { multerUpload } from "../../config/multer.config";

const router = Router();

// Current authenticated user profile
router.get("/me", checkAuth(), UserController.getMe);
router.patch("/me", checkAuth(), validateRequest(UserValidation.updateMeSchema), UserController.updateMe);

// User avatar management (Cloudinary via Multer)
router.post("/me/avatar", checkAuth(), multerUpload.single("image"), UserController.uploadAvatar);
router.delete("/me/avatar", checkAuth(), UserController.deleteAvatar);

// Password change & active sessions
router.post(
  "/change-password",
  checkAuth(),
  validateRequest(UserValidation.changePasswordSchema),
  UserController.changePassword,
);
router.get("/me/sessions", checkAuth(), UserController.getActiveSessions);
router.delete("/me/sessions/other", checkAuth(), UserController.revokeOtherSessions);
router.delete("/me/sessions/:id", checkAuth(), UserController.revokeSession);

// Admin user management routes
router.get("/", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), UserController.getAllUsers);
router.post(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UserValidation.createUserSchema),
  UserController.createUser,
);
router.get("/:id", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), UserController.getUserById);
router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UserValidation.updateUserSchema),
  UserController.updateUser,
);
router.patch(
  "/:id/status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(UserValidation.updateUserStatusSchema),
  UserController.updateUserStatus,
);
router.delete("/:id", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), UserController.deleteUser);

export const UserRoutes = router;
