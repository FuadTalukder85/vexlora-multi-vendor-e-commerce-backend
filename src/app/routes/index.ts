import { Router } from "express";
import { AddressRoutes } from "../modules/address/address.route";
import { CategoryRoutes } from "../modules/category/category.route";
import { ProductRoutes } from "../modules/product/product.route";
import { ProductVariantRoutes } from "../modules/productVariant/productVariant.route";
import { UserRoutes } from "../modules/user/user.route";
import { VendorProfileRoutes } from "../modules/vendorProfile/vendorProfile.route";

const router = Router();

router.use("/users", UserRoutes);
router.use("/addresses", AddressRoutes);
router.use("/categories", CategoryRoutes);
router.use("/vendor-profiles", VendorProfileRoutes);
router.use("/products", ProductRoutes);
router.use("/product-variants", ProductVariantRoutes);

export const IndexRoutes = router;
