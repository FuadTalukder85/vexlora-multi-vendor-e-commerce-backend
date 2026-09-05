export const wishlistSearchableFields = ["product.title", "product.brand", "product.slug"];

export const wishlistFilterableFields = [
  "searchTerm",
  "productId",
  "userId",
  "product.categoryId",
  "product.status",
];

export const standardWishlistInclude = {
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      brand: true,
      images: true,
      basePrice: true,
      discountPrice: true,
      totalStock: true,
      status: true,
      ratingAvg: true,
      ratingCount: true,
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
      variants: {
        select: {
          id: true,
          sku: true,
          price: true,
          stock: true,
          attributes: true,
          image: true,
        },
      },
    },
  },
};
