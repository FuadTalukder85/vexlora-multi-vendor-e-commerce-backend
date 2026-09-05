export const publicVendorSearchableFields = ["storeName", "storeSlug", "description"];
export const publicVendorFilterableFields = ["searchTerm"];

export const adminVendorSearchableFields = ["storeName", "storeSlug", "description", "bankName"];
export const adminVendorFilterableFields = ["searchTerm", "status", "userId", "bankName"];

// Backward compatibility aliases
export const vendorSearchableFields = adminVendorSearchableFields;
export const vendorFilterableFields = adminVendorFilterableFields;

/**
 * Publicly accessible vendor fields.
 * Explicitly EXCLUDES sensitive data:
 * - commissionRate
 * - stripeAccountId
 * - bankAccountName
 * - bankAccountNumber
 * - bankName
 * - documents
 * - status
 * - userId
 */
export const publicVendorSelect = {
  id: true,
  storeName: true,
  storeSlug: true,
  storeLogo: true,
  storeBanner: true,
  description: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  owner: {
    select: {
      name: true,
      image: true,
    },
  },
};

/**
 * Protected relations included only for authenticated store owners and platform admins.
 */
export const protectedVendorInclude = {
  documents: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
};
