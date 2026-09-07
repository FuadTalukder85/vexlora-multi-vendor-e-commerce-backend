import { Router } from "express";
import { AddressRoutes } from "../modules/address/address.route";
import { CategoryRoutes } from "../modules/category/category.route";
import { CouponRoutes } from "../modules/coupon/coupon.route";
import { CouponUsageLogRoutes } from "../modules/couponUsageLog/couponUsageLog.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { OrderRoutes } from "../modules/order/order.route";
import { PayoutRoutes } from "../modules/payout/payout.route";
import { PayoutSubOrderRoutes } from "../modules/payoutSubOrder/payoutSubOrder.route";
import { ProductRoutes } from "../modules/product/product.route";
import { ProductVariantRoutes } from "../modules/productVariant/productVariant.route";
import { RbacRoutes } from "../modules/rbac/rbac.route";
import { ReviewRoutes } from "../modules/review/review.route";
import { SubOrderRoutes } from "../modules/subOrder/subOrder.route";
import { UserRoutes } from "../modules/user/user.route";
import { VendorProfileRoutes } from "../modules/vendorProfile/vendorProfile.route";
import { WishlistRoutes } from "../modules/wishlist/wishlist.route";

const router = Router();

router.use("/users", UserRoutes);
router.use("/addresses", AddressRoutes);
router.use("/categories", CategoryRoutes);
router.use("/vendor-profiles", VendorProfileRoutes);
router.use("/products", ProductRoutes);
router.use("/product-variants", ProductVariantRoutes);
router.use("/coupons", CouponRoutes);
router.use("/coupon-usage-logs", CouponUsageLogRoutes);
router.use("/orders", OrderRoutes);
router.use("/sub-orders", SubOrderRoutes);
router.use("/payouts", PayoutRoutes);
router.use("/payout-sub-orders", PayoutSubOrderRoutes);
router.use("/wishlists", WishlistRoutes);
router.use("/rbac", RbacRoutes);
router.use("/reviews", ReviewRoutes);
router.use("/notifications", NotificationRoutes);

export const IndexRoutes = router;
