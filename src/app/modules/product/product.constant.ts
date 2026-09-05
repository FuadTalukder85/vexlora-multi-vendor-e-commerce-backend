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
