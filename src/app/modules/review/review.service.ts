import status from "http-status";
import { ReviewFraudStatus, Role, SubOrderStatus } from "../../../generated/prisma/enums";
import { ReviewModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { NotificationTypes } from "../notification/notification.constant";
import { NotificationService } from "../notification/notification.service";
import { reviewFilterableFields, reviewSearchableFields, standardReviewInclude } from "./review.constant";
import {
  ICanReviewResult,
  ICreateReviewPayload,
  IReviewStats,
  IUpdateReviewPayload,
  IVendorReplyPayload,
} from "./review.interface";

const recalculateRatings = async (productId: string, vendorId?: string) => {
  const productReviewAggregate = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { id: true },
  });

  const avgRating = productReviewAggregate._avg.rating ?? 0;
  const countRating = productReviewAggregate._count.id ?? 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: Number(avgRating.toFixed(2)),
      ratingCount: countRating,
    },
  });

  let resolvedVendorId = vendorId;
  if (!resolvedVendorId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { vendorId: true },
    });
    resolvedVendorId = product?.vendorId;
  }

  if (resolvedVendorId) {
    const vendorReviewAggregate = await prisma.review.aggregate({
      where: {
        product: {
          vendorId: resolvedVendorId,
        },
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    const vendorAvg = vendorReviewAggregate._avg.rating ?? 0;
    const vendorCount = vendorReviewAggregate._count.id ?? 0;

    await prisma.vendorProfile.update({
      where: { id: resolvedVendorId },
      data: {
        ratingAvg: Number(vendorAvg.toFixed(2)),
        ratingCount: vendorCount,
      },
    });
  }
};

const createReview = async (customerId: string, payload: ICreateReviewPayload, clientIp?: string) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: {
      id: true,
      title: true,
      slug: true,
      vendorId: true,
      vendor: {
        select: {
          id: true,
          userId: true,
          storeName: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  if (product.vendor.userId === customerId) {
    throw new AppError(status.BAD_REQUEST, "Vendors are not permitted to review their own products");
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      productId: payload.productId,
      customerId,
    },
  });

  if (existingReview) {
    throw new AppError(status.CONFLICT, "You have already reviewed this product. You can update your existing review.");
  }

  let verifiedSubOrderId: string | null = null;

  if (payload.subOrderId) {
    const subOrder = await prisma.subOrder.findFirst({
      where: {
        id: payload.subOrderId,
        order: { customerId },
        items: {
          some: { productId: payload.productId },
        },
        status: SubOrderStatus.DELIVERED,
      },
    });

    if (subOrder) {
      verifiedSubOrderId = subOrder.id;
    }
  }

  if (!verifiedSubOrderId) {
    const deliveredSubOrder = await prisma.subOrder.findFirst({
      where: {
        order: { customerId },
        items: {
          some: { productId: payload.productId },
        },
        status: SubOrderStatus.DELIVERED,
      },
      select: { id: true },
    });

    if (deliveredSubOrder) {
      verifiedSubOrderId = deliveredSubOrder.id;
    }
  }

  const hasVerifiedPurchase = Boolean(verifiedSubOrderId);

  const review = await prisma.$transaction(async (tx) => {
    const newReview = await tx.review.create({
      data: {
        productId: payload.productId,
        customerId,
        subOrderId: verifiedSubOrderId,
        rating: payload.rating,
        comment: payload.comment ?? null,
        images: payload.images ?? [],
      },
      include: standardReviewInclude,
    });

    await tx.reviewFraudLog.create({
      data: {
        reviewId: newReview.id,
        reviewerId: customerId,
        productId: payload.productId,
        ipAddress: clientIp ?? null,
        hasVerifiedPurchase,
        sellerRelationshipFlag: false,
        suspicionScore: hasVerifiedPurchase ? 0 : 15,
        status: ReviewFraudStatus.CLEAN,
      },
    });

    return newReview;
  });

  await recalculateRatings(payload.productId, product.vendorId);

  try {
    await NotificationService.createNotification({
      userId: product.vendor.userId,
      type: NotificationTypes.REVIEW_RECEIVED,
      title: "New Product Review",
      message: `A customer left a ${payload.rating}-star review on "${product.title}"`,
      link: `/products/${product.slug}`,
    });
  } catch {
    // Notification failure should not fail review creation
  }

  return review;
};

const updateReview = async (customerId: string, reviewId: string, payload: IUpdateReviewPayload) => {
  const existingReview = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existingReview) {
    throw new AppError(status.NOT_FOUND, "Review not found");
  }

  if (existingReview.customerId !== customerId) {
    throw new AppError(status.FORBIDDEN, "Forbidden! You can only update your own reviews");
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(payload.rating !== undefined && { rating: payload.rating }),
      ...(payload.comment !== undefined && { comment: payload.comment }),
      ...(payload.images !== undefined && { images: payload.images }),
    },
    include: standardReviewInclude,
  });

  if (payload.rating !== undefined && payload.rating !== existingReview.rating) {
    await recalculateRatings(existingReview.productId);
  }

  return updatedReview;
};

const deleteReview = async (userId: string, role: Role, reviewId: string) => {
  const existingReview = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existingReview) {
    throw new AppError(status.NOT_FOUND, "Review not found");
  }

  const isOwner = existingReview.customerId === userId;
  const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(status.FORBIDDEN, "Forbidden! You do not have permission to delete this review");
  }

  await prisma.review.delete({
    where: { id: reviewId },
  });

  await recalculateRatings(existingReview.productId);

  return { message: "Review deleted successfully" };
};

const vendorReply = async (userId: string, role: Role, reviewId: string, payload: IVendorReplyPayload) => {
  const existingReview = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      product: {
        include: {
          vendor: true,
        },
      },
    },
  });

  if (!existingReview) {
    throw new AppError(status.NOT_FOUND, "Review not found");
  }

  const isVendorOwner = existingReview.product.vendor.userId === userId;
  const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;

  if (!isVendorOwner && !isAdmin) {
    throw new AppError(status.FORBIDDEN, "Forbidden! Only the product's vendor can reply to this review");
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      vendorReply: payload.vendorReply,
      vendorRepliedAt: new Date(),
    },
    include: standardReviewInclude,
  });

  try {
    await NotificationService.createNotification({
      userId: existingReview.customerId,
      type: NotificationTypes.VENDOR_REPLY,
      title: "Vendor Replied to Your Review",
      message: `${existingReview.product.vendor.storeName} replied to your review on "${existingReview.product.title}"`,
      link: `/products/${existingReview.product.slug}`,
    });
  } catch {
    // Notification failure should not break reply flow
  }

  return updatedReview;
};

const getProductReviews = async (productId: string, queryParams: IQueryParams) => {
  const baseWhere: Record<string, unknown> = { productId };

  if (queryParams.hasImages === "true") {
    baseWhere.images = { isEmpty: false };
  }

  if (queryParams.rating) {
    baseWhere.rating = Number(queryParams.rating);
  }

  if (queryParams.isVerified === "true") {
    baseWhere.subOrderId = { not: null };
  }

  const queryBuilder = new QueryBuilder<ReviewModel>(prisma.review, queryParams, {
    searchableFields: reviewSearchableFields,
    filterableFields: reviewFilterableFields,
  })
    .where(baseWhere)
    .search()
    .filter()
    .sort()
    .paginate()
    .fields()
    .include(standardReviewInclude);

  return await queryBuilder.execute();
};

const getProductReviewStats = async (productId: string): Promise<IReviewStats> => {
  const [totalCount, avgAggregate, ratingGroupings, verifiedCount, withImagesCount] = await Promise.all([
    prisma.review.count({ where: { productId } }),
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId },
      _count: { rating: true },
    }),
    prisma.review.count({
      where: {
        productId,
        subOrderId: { not: null },
      },
    }),
    prisma.review.count({
      where: {
        productId,
        images: { isEmpty: false },
      },
    }),
  ]);

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const group of ratingGroupings) {
    if (group.rating >= 1 && group.rating <= 5) {
      ratingDistribution[group.rating] = group._count.rating;
    }
  }

  const ratingPercentages: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (totalCount > 0) {
    for (let star = 1; star <= 5; star++) {
      ratingPercentages[star] = Number(((ratingDistribution[star] / totalCount) * 100).toFixed(1));
    }
  }

  return {
    averageRating: Number((avgAggregate._avg.rating ?? 0).toFixed(2)),
    totalReviews: totalCount,
    ratingDistribution: ratingDistribution as IReviewStats["ratingDistribution"],
    ratingPercentages: ratingPercentages as IReviewStats["ratingPercentages"],
    verifiedPurchaseCount: verifiedCount,
    withImagesCount,
  };
};

const canReviewProduct = async (customerId: string, productId: string): Promise<ICanReviewResult> => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, vendor: { select: { userId: true } } },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  if (product.vendor.userId === customerId) {
    return {
      canReview: false,
      alreadyReviewed: false,
      isVerifiedPurchase: false,
      message: "You cannot review products from your own store.",
    };
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      productId,
      customerId,
    },
    select: {
      id: true,
      subOrderId: true,
    },
  });

  if (existingReview) {
    return {
      canReview: false,
      alreadyReviewed: true,
      existingReviewId: existingReview.id,
      isVerifiedPurchase: Boolean(existingReview.subOrderId),
      message: "You have already reviewed this product.",
    };
  }

  const deliveredSubOrder = await prisma.subOrder.findFirst({
    where: {
      order: { customerId },
      items: {
        some: { productId },
      },
      status: SubOrderStatus.DELIVERED,
    },
    select: { id: true },
  });

  if (deliveredSubOrder) {
    return {
      canReview: true,
      alreadyReviewed: false,
      isVerifiedPurchase: true,
      eligibleSubOrderId: deliveredSubOrder.id,
      message: "You purchased and received this product! Your review will be marked as a Verified Purchase.",
    };
  }

  return {
    canReview: true,
    alreadyReviewed: false,
    isVerifiedPurchase: false,
    message: "You can write a review for this product.",
  };
};

const getMyReviews = async (customerId: string, queryParams: IQueryParams) => {
  const queryBuilder = new QueryBuilder<ReviewModel>(prisma.review, queryParams, {
    searchableFields: reviewSearchableFields,
    filterableFields: reviewFilterableFields,
  })
    .where({ customerId })
    .search()
    .filter()
    .sort()
    .paginate()
    .fields()
    .include(standardReviewInclude);

  return await queryBuilder.execute();
};

const getVendorReviews = async (vendorUserId: string, queryParams: IQueryParams) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId: vendorUserId },
    select: { id: true },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found for the current user");
  }

  const baseWhere: Record<string, unknown> = {
    product: {
      vendorId: vendor.id,
    },
  };

  if (queryParams.hasReply === "false") {
    baseWhere.vendorReply = null;
  } else if (queryParams.hasReply === "true") {
    baseWhere.vendorReply = { not: null };
  }

  if (queryParams.rating) {
    baseWhere.rating = Number(queryParams.rating);
  }

  if (queryParams.productId) {
    baseWhere.productId = queryParams.productId;
  }

  const queryBuilder = new QueryBuilder<ReviewModel>(prisma.review, queryParams, {
    searchableFields: reviewSearchableFields,
    filterableFields: reviewFilterableFields,
  })
    .where(baseWhere)
    .search()
    .filter()
    .sort()
    .paginate()
    .fields()
    .include(standardReviewInclude);

  return await queryBuilder.execute();
};

const getReviewById = async (reviewId: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: standardReviewInclude,
  });

  if (!review) {
    throw new AppError(status.NOT_FOUND, "Review not found");
  }

  return review;
};

const getAllReviewsAdmin = async (queryParams: IQueryParams) => {
  const queryBuilder = new QueryBuilder<ReviewModel>(prisma.review, queryParams, {
    searchableFields: reviewSearchableFields,
    filterableFields: reviewFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .fields()
    .include(standardReviewInclude);

  return await queryBuilder.execute();
};

export const ReviewService = {
  createReview,
  updateReview,
  deleteReview,
  vendorReply,
  getProductReviews,
  getProductReviewStats,
  canReviewProduct,
  getMyReviews,
  getVendorReviews,
  getReviewById,
  getAllReviewsAdmin,
};
