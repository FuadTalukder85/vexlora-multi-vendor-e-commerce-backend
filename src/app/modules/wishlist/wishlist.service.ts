import status from "http-status";
import { WishlistModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
  standardWishlistInclude,
  wishlistFilterableFields,
  wishlistSearchableFields,
} from "./wishlist.constant";
import {
  IAddToWishlistPayload,
  ICheckWishlistResult,
  IToggleWishlistResult,
  IWishlistCountResult,
} from "./wishlist.interface";

const addToWishlist = async (userId: string, payload: IAddToWishlistPayload) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: { id: true, title: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const existing = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: payload.productId,
      },
    },
  });

  if (existing) {
    throw new AppError(status.CONFLICT, "Product is already in your wishlist");
  }

  return await prisma.wishlist.create({
    data: {
      userId,
      productId: payload.productId,
    },
    include: standardWishlistInclude,
  });
};

const toggleWishlist = async (
  userId: string,
  payload: IAddToWishlistPayload,
): Promise<IToggleWishlistResult> => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: { id: true, title: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const existing = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: payload.productId,
      },
    },
  });

  if (existing) {
    await prisma.wishlist.delete({
      where: { id: existing.id },
    });

    return {
      inWishlist: false,
      productId: payload.productId,
    };
  }

  const created = await prisma.wishlist.create({
    data: {
      userId,
      productId: payload.productId,
    },
    include: standardWishlistInclude,
  });

  return {
    inWishlist: true,
    productId: payload.productId,
    wishlist: created,
  };
};

const getMyWishlist = async (userId: string, queryParams: IQueryParams) => {
  const wishlistQuery = new QueryBuilder<WishlistModel>(prisma.wishlist, queryParams, {
    searchableFields: wishlistSearchableFields,
    filterableFields: wishlistFilterableFields,
  })
    .where({ userId })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(standardWishlistInclude);

  return await wishlistQuery.execute();
};

const checkProductInWishlist = async (
  userId: string,
  productId: string,
): Promise<ICheckWishlistResult> => {
  const existing = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
    select: { id: true },
  });

  return {
    inWishlist: Boolean(existing),
    wishlistId: existing ? existing.id : null,
  };
};

const removeFromWishlist = async (userId: string, idOrProductId: string) => {
  const wishlistItem = await prisma.wishlist.findFirst({
    where: {
      OR: [
        { id: idOrProductId, userId },
        { productId: idOrProductId, userId },
      ],
    },
  });

  if (!wishlistItem) {
    throw new AppError(status.NOT_FOUND, "Wishlist item not found");
  }

  return await prisma.wishlist.delete({
    where: { id: wishlistItem.id },
  });
};

const removeByProductId = async (userId: string, productId: string) => {
  const wishlistItem = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
  });

  if (!wishlistItem) {
    throw new AppError(status.NOT_FOUND, "Product is not in your wishlist");
  }

  return await prisma.wishlist.delete({
    where: { id: wishlistItem.id },
  });
};

const clearWishlist = async (userId: string) => {
  const result = await prisma.wishlist.deleteMany({
    where: { userId },
  });

  return {
    clearedCount: result.count,
  };
};

const getProductWishlistCount = async (productId: string): Promise<IWishlistCountResult> => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const count = await prisma.wishlist.count({
    where: { productId },
  });

  return {
    productId,
    count,
  };
};

const getAllWishlists = async (queryParams: IQueryParams) => {
  const wishlistQuery = new QueryBuilder<WishlistModel>(prisma.wishlist, queryParams, {
    searchableFields: wishlistSearchableFields,
    filterableFields: wishlistFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      user: {
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
          basePrice: true,
          discountPrice: true,
          images: true,
          status: true,
          vendor: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
            },
          },
        },
      },
    });

  return await wishlistQuery.execute();
};

export const WishlistService = {
  addToWishlist,
  toggleWishlist,
  getMyWishlist,
  checkProductInWishlist,
  removeFromWishlist,
  removeByProductId,
  clearWishlist,
  getProductWishlistCount,
  getAllWishlists,
};
