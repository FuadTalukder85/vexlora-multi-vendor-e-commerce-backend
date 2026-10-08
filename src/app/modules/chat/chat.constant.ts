export const standardConversationInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  vendor: {
    select: {
      id: true,
      userId: true,
      storeName: true,
      storeSlug: true,
      storeLogo: true,
      ratingAvg: true,
    },
  },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      images: true,
      basePrice: true,
      discountPrice: true,
    },
  },
  subOrder: {
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      subtotal: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
  },
};

export const standardMessageInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  },
};
