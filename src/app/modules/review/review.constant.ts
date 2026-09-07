export const reviewSearchableFields = ["comment", "product.title", "customer.name"];

export const reviewFilterableFields = ["searchTerm", "productId", "customerId", "rating", "subOrderId"];

export const standardReviewInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      images: true,
      basePrice: true,
      vendorId: true,
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          storeLogo: true,
          userId: true,
        },
      },
    },
  },
  subOrder: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
  },
  fraudLog: {
    select: {
      id: true,
      status: true,
      hasVerifiedPurchase: true,
      suspicionScore: true,
    },
  },
};
