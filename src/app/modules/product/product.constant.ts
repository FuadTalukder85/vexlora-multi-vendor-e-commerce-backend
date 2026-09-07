export const productSearchableFields = ["title", "description", "brand", "slug"];

export const productFilterableFields = [
  "searchTerm",
  "categoryId",
  "vendorId",
  "status",
  "brand",
  "minPrice",
  "maxPrice",
];

export const standardProductInclude = {
  variants: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  vendor: {
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      storeLogo: true,
    },
  },
};

// Lightweight include for list endpoints — skips heavy variant.attributes JSON blob
export const productListInclude = {
  variants: {
    select: {
      id: true,
      sku: true,
      price: true,
      stock: true,
      image: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  vendor: {
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      storeLogo: true,
    },
  },
};

// Explicit select for list endpoints — excludes large description field
export const productListSelect = {
  id: true,
  vendorId: true,
  title: true,
  slug: true,
  categoryId: true,
  brand: true,
  images: true,
  basePrice: true,
  discountPrice: true,
  totalStock: true,
  status: true,
  ratingAvg: true,
  ratingCount: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  ...productListInclude,
};
