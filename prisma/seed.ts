import "dotenv/config";
import { ModuleScope } from "../src/generated/prisma/enums";
import { prisma } from "../src/app/lib/prisma";
import { SYSTEM_PERMISSIONS } from "../src/app/modules/rbac/rbac.constant";

async function main() {
  console.log("Seeding system permissions into database...");

  // 1. Upsert all permissions
  const createdPermissions = [];
  for (const p of SYSTEM_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        name: p.name,
        category: p.category,
        scope: p.scope,
        description: p.description,
        isActive: true,
      },
      update: {
        name: p.name,
        category: p.category,
        scope: p.scope,
        description: p.description,
        isActive: true,
      },
    });
    createdPermissions.push(perm);
  }

  console.log(`Successfully seeded ${createdPermissions.length} permissions into 'permissions' table:`);
  for (const cp of createdPermissions) {
    console.log(` - [${cp.scope}] ${cp.key} (${cp.name})`);
  }

  // 2. Pre-seed default system roles
  console.log("\nSeeding system roles...");

  const superAdminRole = await prisma.appRole.upsert({
    where: { slug: "super_admin" },
    create: {
      name: "Super Admin",
      slug: "super_admin",
      description: "Complete unrestricted access across the entire platform",
      scope: ModuleScope.ADMIN,
      isSystemRole: true,
    },
    update: {
      name: "Super Admin",
      scope: ModuleScope.ADMIN,
      isSystemRole: true,
    },
  });

  const adminRole = await prisma.appRole.upsert({
    where: { slug: "admin" },
    create: {
      name: "Platform Admin",
      slug: "admin",
      description: "Platform administrative management for catalog, users, and approvals",
      scope: ModuleScope.ADMIN,
      isSystemRole: true,
    },
    update: {
      name: "Platform Admin",
      scope: ModuleScope.ADMIN,
      isSystemRole: true,
    },
  });

  const vendorOwnerRole = await prisma.appRole.upsert({
    where: { slug: "vendor_owner" },
    create: {
      name: "Vendor Owner",
      slug: "vendor_owner",
      description: "Store owner with full operational access within own tenant",
      scope: ModuleScope.VENDOR,
      isSystemRole: true,
    },
    update: {
      name: "Vendor Owner",
      scope: ModuleScope.VENDOR,
      isSystemRole: true,
    },
  });

  const vendorStaffRole = await prisma.appRole.upsert({
    where: { slug: "vendor_staff" },
    create: {
      name: "Vendor Staff",
      slug: "vendor_staff",
      description: "Default store worker role with limited fulfillment capabilities",
      scope: ModuleScope.VENDOR,
      isSystemRole: true,
    },
    update: {
      name: "Vendor Staff",
      scope: ModuleScope.VENDOR,
      isSystemRole: true,
    },
  });

  // 3. Link permissions to roles in role_permissions
  console.log("\nLinking permissions to system roles in role_permissions...");

  // Super Admin gets ALL permissions
  for (const perm of createdPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      },
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
      update: {},
    });
  }

  // Admin gets all ADMIN & BOTH permissions
  const adminPermissions = createdPermissions.filter(
    (p) => p.scope === ModuleScope.ADMIN || p.scope === ModuleScope.BOTH,
  );
  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
      update: {},
    });
  }

  // Vendor Owner gets all VENDOR & BOTH permissions
  const vendorPermissions = createdPermissions.filter(
    (p) => p.scope === ModuleScope.VENDOR || p.scope === ModuleScope.BOTH,
  );
  for (const perm of vendorPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: vendorOwnerRole.id,
          permissionId: perm.id,
        },
      },
      create: {
        roleId: vendorOwnerRole.id,
        permissionId: perm.id,
      },
      update: {},
    });
  }

  // Vendor Staff gets default read permissions
  const defaultStaffPerms = createdPermissions.filter((p) =>
    ["product:read", "order:read", "inventory:read"].includes(p.key),
  );
  for (const perm of defaultStaffPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: vendorStaffRole.id,
          permissionId: perm.id,
        },
      },
      create: {
        roleId: vendorStaffRole.id,
        permissionId: perm.id,
      },
      update: {},
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
