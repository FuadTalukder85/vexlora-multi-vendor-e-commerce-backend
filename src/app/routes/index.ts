import { Router } from "express";
import { AddressRoutes } from "../modules/address/address.route";
import { CategoryRoutes } from "../modules/category/category.route";
import { UserRoutes } from "../modules/user/user.route";
import { VendorProfileRoutes } from "../modules/vendorProfile/vendorProfile.route";

const router = Router();

router.use("/users", UserRoutes);
router.use("/addresses", AddressRoutes);
router.use("/categories", CategoryRoutes);
router.use("/vendor-profiles", VendorProfileRoutes);

export const IndexRoutes = router;
