export const productVariantSearchableFields = ["sku"];

export const productVariantFilterableFields = ["searchTerm", "sku", "productId"];

export const standardProductVariantInclude = {
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      basePrice: true,
      vendorId: true,
      vendor: {
        select: {
          id: true,
          userId: true,
          storeName: true,
          storeSlug: true,
          status: true,
        },
      },
    },
  },
};
