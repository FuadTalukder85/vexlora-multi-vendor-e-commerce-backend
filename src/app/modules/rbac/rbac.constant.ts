import { ModuleScope } from "../../../generated/prisma/enums";

export interface ISystemPermission {
  key: string;
  name: string;
  category: string;
  scope: ModuleScope;
  description: string;
}

export const SYSTEM_PERMISSIONS: ISystemPermission[] = [
  // ==========================================
  // GLOBAL ADMIN-ONLY PERMISSIONS
  // ==========================================
  {
    key: "category:read",
    name: "View Categories",
    category: "category",
    scope: ModuleScope.ADMIN,
    description: "Browse catalog categories and taxonomy",
  },
  {
    key: "category:create",
    name: "Create Category",
    category: "category",
    scope: ModuleScope.ADMIN,
    description: "Create new categories and category hierarchy",
  },
  {
    key: "category:update",
    name: "Update Category",
    category: "category",
    scope: ModuleScope.ADMIN,
    description: "Edit category details, commissions, and statuses",
  },
  {
    key: "category:delete",
    name: "Delete Category",
    category: "category",
    scope: ModuleScope.ADMIN,
    description: "Remove categories from the system",
  },

  {
    key: "user:read",
    name: "View Users",
    category: "user",
    scope: ModuleScope.ADMIN,
    description: "View platform users, accounts, and profiles",
  },
  {
    key: "user:create",
    name: "Create User",
    category: "user",
    scope: ModuleScope.ADMIN,
    description: "Create user accounts with specific roles",
  },
  {
    key: "user:update",
    name: "Update User",
    category: "user",
    scope: ModuleScope.ADMIN,
    description: "Edit user profile, status, or administrative flags",
  },
  {
    key: "user:delete",
    name: "Delete User",
    category: "user",
    scope: ModuleScope.ADMIN,
    description: "Delete or ban user accounts from platform",
  },
  {
    key: "user:export",
    name: "Export Users",
    category: "user",
    scope: ModuleScope.ADMIN,
    description: "Export user lists and directory data",
  },

  {
    key: "vendor-approval:read",
    name: "View Vendor Applications",
    category: "vendor-approval",
    scope: ModuleScope.ADMIN,
    description: "View pending vendor applications and legal documents",
  },
  {
    key: "vendor-approval:update",
    name: "Approve/Reject Vendors",
    category: "vendor-approval",
    scope: ModuleScope.ADMIN,
    description: "Approve, suspend, or reject vendor stores",
  },

  {
    key: "global-setting:read",
    name: "View Global Settings",
    category: "global-setting",
    scope: ModuleScope.ADMIN,
    description: "View platform configurations, payout schedules, and gateway credentials",
  },
  {
    key: "global-setting:update",
    name: "Update Global Settings",
    category: "global-setting",
    scope: ModuleScope.ADMIN,
    description: "Update platform commission defaults and operational parameters",
  },

  {
    key: "admin-management:read",
    name: "View Admin RBAC",
    category: "admin-management",
    scope: ModuleScope.ADMIN,
    description: "View administrative roles and global permissions",
  },
  {
    key: "admin-management:create",
    name: "Create Admin Roles",
    category: "admin-management",
    scope: ModuleScope.ADMIN,
    description: "Create custom administrative roles and assign permissions",
  },
  {
    key: "admin-management:update",
    name: "Update Admin Roles",
    category: "admin-management",
    scope: ModuleScope.ADMIN,
    description: "Modify permissions of existing administrative roles",
  },
  {
    key: "admin-management:delete",
    name: "Delete Admin Roles",
    category: "admin-management",
    scope: ModuleScope.ADMIN,
    description: "Remove custom administrative roles",
  },

  // ==========================================
  // SHARED & VENDOR-ACCESSIBLE PERMISSIONS
  // ==========================================
  {
    key: "product:read",
    name: "View Products",
    category: "product",
    scope: ModuleScope.BOTH,
    description: "Browse product catalog and inventory lists",
  },
  {
    key: "product:create",
    name: "Create Product",
    category: "product",
    scope: ModuleScope.BOTH,
    description: "Add new products, variants, and image media",
  },
  {
    key: "product:update",
    name: "Update Product",
    category: "product",
    scope: ModuleScope.BOTH,
    description: "Edit product pricing, stock, attributes, and publish statuses",
  },
  {
    key: "product:delete",
    name: "Delete Product",
    category: "product",
    scope: ModuleScope.BOTH,
    description: "Delete products and product variants",
  },
  {
    key: "product:export",
    name: "Export Products",
    category: "product",
    scope: ModuleScope.BOTH,
    description: "Export product catalogs to Excel/CSV",
  },

  {
    key: "order:read",
    name: "View Orders",
    category: "order",
    scope: ModuleScope.BOTH,
    description: "View customer orders and fulfillment items",
  },
  {
    key: "order:update",
    name: "Update Order",
    category: "order",
    scope: ModuleScope.BOTH,
    description: "Update shipping status, tracking numbers, and delivery state",
  },
  {
    key: "order:export",
    name: "Export Orders",
    category: "order",
    scope: ModuleScope.BOTH,
    description: "Export orders for logistics and packing slips",
  },

  {
    key: "inventory:read",
    name: "View Inventory",
    category: "inventory",
    scope: ModuleScope.BOTH,
    description: "Check stock counts, SKU quantities, and reorder levels",
  },
  {
    key: "inventory:update",
    name: "Update Inventory",
    category: "inventory",
    scope: ModuleScope.BOTH,
    description: "Adjust variant stock counts and manage out-of-stock items",
  },
  {
    key: "inventory:export",
    name: "Export Inventory",
    category: "inventory",
    scope: ModuleScope.BOTH,
    description: "Export stock reports to spreadsheet",
  },

  {
    key: "coupon:read",
    name: "View Coupons",
    category: "coupon",
    scope: ModuleScope.BOTH,
    description: "View active and expired discount vouchers",
  },
  {
    key: "coupon:create",
    name: "Create Coupon",
    category: "coupon",
    scope: ModuleScope.BOTH,
    description: "Create promotional codes, flat discounts, or percentage vouchers",
  },
  {
    key: "coupon:update",
    name: "Update Coupon",
    category: "coupon",
    scope: ModuleScope.BOTH,
    description: "Edit voucher limits, discount values, and expiration dates",
  },
  {
    key: "coupon:delete",
    name: "Delete Coupon",
    category: "coupon",
    scope: ModuleScope.BOTH,
    description: "Deactivate or remove coupons",
  },

  {
    key: "payout:read",
    name: "View Payouts",
    category: "payout",
    scope: ModuleScope.BOTH,
    description: "View revenue settlements, vendor earnings, and withdrawal history",
  },
  {
    key: "payout:create",
    name: "Request Payout",
    category: "payout",
    scope: ModuleScope.BOTH,
    description: "Request earnings withdrawal to bank account or Stripe",
  },
  {
    key: "payout:update",
    name: "Update/Process Payout",
    category: "payout",
    scope: ModuleScope.BOTH,
    description: "Approve, process, mark paid/failed, or manage payout sub-orders",
  },
  {
    key: "payout:export",
    name: "Export Payouts",
    category: "payout",
    scope: ModuleScope.BOTH,
    description: "Export payout statements and financial ledgers",
  },

  // ==========================================
  // VENDOR-ONLY PERMISSIONS
  // ==========================================
  {
    key: "staff:read",
    name: "View Store Staff",
    category: "staff",
    scope: ModuleScope.VENDOR,
    description: "View sub-accounts and staff members working at the store",
  },
  {
    key: "staff:create",
    name: "Create Store Staff",
    category: "staff",
    scope: ModuleScope.VENDOR,
    description: "Create staff accounts and delegate granular permissions",
  },
  {
    key: "staff:update",
    name: "Update Store Staff",
    category: "staff",
    scope: ModuleScope.VENDOR,
    description: "Modify delegated permissions or deactivate staff accounts",
  },
  {
    key: "staff:delete",
    name: "Delete Store Staff",
    category: "staff",
    scope: ModuleScope.VENDOR,
    description: "Remove staff members from the store",
  },

  {
    key: "vendor-profile:read",
    name: "View Store Profile",
    category: "vendor-profile",
    scope: ModuleScope.VENDOR,
    description: "View own store branding, ratings, and settings",
  },
  {
    key: "vendor-profile:update",
    name: "Update Store Profile",
    category: "vendor-profile",
    scope: ModuleScope.VENDOR,
    description: "Update store banner, logo, description, and payout bank credentials",
  },

  // ==========================================
  // REVIEW & NOTIFICATION PERMISSIONS
  // ==========================================
  {
    key: "review:read",
    name: "View Reviews",
    category: "review",
    scope: ModuleScope.BOTH,
    description: "View customer reviews and ratings",
  },
  {
    key: "review:update",
    name: "Reply to Reviews",
    category: "review",
    scope: ModuleScope.BOTH,
    description: "Reply to customer reviews or update review status",
  },
  {
    key: "review:delete",
    name: "Moderate / Delete Reviews",
    category: "review",
    scope: ModuleScope.ADMIN,
    description: "Remove or moderate inappropriate customer reviews",
  },

  {
    key: "notification:read",
    name: "View Notifications",
    category: "notification",
    scope: ModuleScope.ADMIN,
    description: "View system and user notifications across the platform",
  },
  {
    key: "notification:create",
    name: "Create / Broadcast Notifications",
    category: "notification",
    scope: ModuleScope.ADMIN,
    description: "Send targeted or broadcast notifications to users",
  },
];
