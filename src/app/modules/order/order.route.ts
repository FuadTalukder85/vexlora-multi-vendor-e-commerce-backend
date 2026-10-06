import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { PermissionManager } from "../../utils/permissionManager";
import { OrderController } from "./order.controller";
import { OrderValidation } from "./order.validation";

const router = Router();

// ==========================================
// CUSTOMER ORDER ROUTES
// ==========================================

// Create Stripe PaymentIntent for checkout
router.post(
  "/create-payment-intent",
  checkAuth(),
  validateRequest(OrderValidation.createPaymentIntentSchema),
  OrderController.createPaymentIntent,
);

// Create new multi-vendor order
router.post("/", checkAuth(), validateRequest(OrderValidation.createOrderSchema), OrderController.createOrder);

// Get logged-in user's orders with sorting, filtering, searching, and pagination
router.get("/my-orders", checkAuth(), OrderController.getMyOrders);

// Get single order details for logged-in user
router.get("/my-orders/:id", checkAuth(), OrderController.getMyOrderById);

// Track order by order number (accessible by customer/guest with orderNumber)
router.get("/track/:orderNumber", OrderController.trackOrder);

// Cancel customer order if not yet shipped
router.patch("/my-orders/:id/cancel", checkAuth(), OrderController.cancelMyOrder);

// ==========================================
// ADMIN ORDER ROUTES (PermissionManager guarded)
// ==========================================

// Get all orders on the platform with sorting, filtering, searching, and pagination
router.get(
  "/admin/all",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("order:read"),
  OrderController.getAllOrdersAdmin,
);

// Get any order by ID
router.get(
  "/admin/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("order:read"),
  OrderController.getOrderByIdAdmin,
);

// Update payment status for an order
router.patch(
  "/admin/:id/payment-status",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PermissionManager.requirePermission("order:update"),
  validateRequest(OrderValidation.updatePaymentStatusSchema),
  OrderController.updatePaymentStatusAdmin,
);

export const OrderRoutes = router;
