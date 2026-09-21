import status from "http-status";
import { DealStatus, DealRequestStatus, Role } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../../types/request.types";
import {
  ICreateDealPayload,
  ICreateDealRequestPayload,
  IReviewDealRequestPayload,
  IDealFilterParams,
} from "./deal.interface";
import { DealSocketEvents } from "../../lib/socket";

// Automatically maintain active/expired states for deals
const autoUpdateDealStatuses = async () => {
  const now = new Date();

  // Expire finished deals
  await prisma.deal.updateMany({
    where: {
      status: { in: [DealStatus.ACTIVE, DealStatus.SCHEDULED] },
      endAt: { lte: now },
    },
    data: { status: DealStatus.EXPIRED },
  });

  // Activate scheduled deals whose time has come
  await prisma.deal.updateMany({
    where: {
      status: DealStatus.SCHEDULED,
      startAt: { lte: now },
      endAt: { gt: now },
    },
    data: { status: DealStatus.ACTIVE },
  });
};

// 1. Public: Get active hot deals
const getPublicActiveDeals = async (query: IDealFilterParams) => {
  await autoUpdateDealStatuses();

  const now = new Date();
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    status: DealStatus.ACTIVE,
    startAt: { lte: now },
    endAt: { gt: now },
  };

  if (query.categoryId) {
    whereCondition.product = {
      categoryId: query.categoryId,
    };
  }

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where: whereCondition,
      include: {
        product: {
          include: {
            vendor: {
              select: { id: true, storeName: true, storeSlug: true, storeLogo: true },
            },
            category: {
              select: { id: true, name: true, slug: true },
            },
            variants: true,
          },
        },
        variant: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.deal.count({ where: whereCondition }),
  ]);

  const enhancedDeals = deals.map((deal) => {
    const orig = Number(deal.originalPrice);
    const curr = Number(deal.dealPrice);
    const discountPercent = orig > curr ? Math.round(((orig - curr) / orig) * 100) : 0;
    const soldPercentage =
      deal.quantityLimit && deal.quantityLimit > 0
        ? Math.min(100, Math.round((deal.soldCount / deal.quantityLimit) * 100))
        : 0;

    return {
      ...deal,
      discountPercent,
      soldPercentage,
      isExpired: new Date() >= new Date(deal.endAt),
    };
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: enhancedDeals,
  };
};

// 2. Public: Get single deal
const getDealById = async (id: string) => {
  await autoUpdateDealStatuses();

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          vendor: true,
          category: true,
          variants: true,
        },
      },
      variant: true,
    },
  });

  if (!deal) {
    throw new AppError(status.NOT_FOUND, "Deal not found");
  }

  return deal;
};

// 3. Vendor: Submit a product deal request
const createDealRequest = async (user: IRequestUser | undefined, payload: ICreateDealRequestPayload) => {
  if (!user || user.role !== Role.VENDOR) {
    throw new AppError(status.FORBIDDEN, "Only verified vendors can submit deal requests");
  }

  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { userId: user.userId },
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found for this user");
  }

  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    include: { variants: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  if (product.vendorId !== vendorProfile.id) {
    throw new AppError(status.FORBIDDEN, "You can only submit deals for your own products");
  }

  const basePrice = Number(product.basePrice);
  if (payload.proposedDealPrice >= basePrice) {
    throw new AppError(
      status.BAD_REQUEST,
      `Proposed deal price (${payload.proposedDealPrice}) must be lower than product base price (${basePrice})`
    );
  }

  const dealRequest = await prisma.dealRequest.create({
    data: {
      productId: payload.productId,
      variantId: payload.variantId || null,
      vendorId: vendorProfile.id,
      requestedById: user.userId,
      proposedDealPrice: payload.proposedDealPrice,
      requestedStartAt: new Date(payload.requestedStartAt),
      requestedEndAt: new Date(payload.requestedEndAt),
      quantityLimit: payload.quantityLimit || null,
      maxPerCustomer: payload.maxPerCustomer || null,
      note: payload.note || null,
      status: DealRequestStatus.PENDING,
    },
    include: {
      product: { select: { id: true, title: true, images: true, basePrice: true } },
    },
  });

  // Real-time WebSocket emission to Admin
  DealSocketEvents.notifyDealRequestCreated({
    id: dealRequest.id,
    productId: dealRequest.productId,
    productTitle: dealRequest.product?.title,
    vendorId: vendorProfile.id,
    vendorName: vendorProfile.storeName,
    proposedDealPrice: Number(dealRequest.proposedDealPrice),
    status: dealRequest.status,
    createdAt: dealRequest.createdAt,
  });

  return dealRequest;
};

// 4. Vendor: Get own deal requests
const getVendorDealRequests = async (user: IRequestUser | undefined, query: IDealFilterParams) => {
  if (!user) throw new AppError(status.UNAUTHORIZED, "Unauthorized");

  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { userId: user.userId },
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const whereCondition: any = {
    vendorId: vendorProfile.id,
  };

  if (query.status) {
    whereCondition.status = query.status;
  }

  const [requests, total] = await Promise.all([
    prisma.dealRequest.findMany({
      where: whereCondition,
      include: {
        product: { select: { id: true, title: true, images: true, basePrice: true, slug: true } },
        deal: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.dealRequest.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data: requests,
  };
};

// 5. Admin: List all vendor deal requests
const getAllDealRequestsAdmin = async (query: IDealFilterParams) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const whereCondition: any = {};
  if (query.status) {
    whereCondition.status = query.status;
  }
  if (query.vendorId) {
    whereCondition.vendorId = query.vendorId;
  }

  const [requests, total] = await Promise.all([
    prisma.dealRequest.findMany({
      where: whereCondition,
      include: {
        product: { select: { id: true, title: true, images: true, basePrice: true, slug: true } },
        vendor: { select: { id: true, storeName: true, storeSlug: true, storeLogo: true } },
        deal: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.dealRequest.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data: requests,
  };
};

// 6. Admin: Review vendor deal request (Approve / Reject)
const reviewDealRequest = async (
  requestId: string,
  user: IRequestUser | undefined,
  payload: IReviewDealRequestPayload
) => {
  const dealRequest = await prisma.dealRequest.findUnique({
    where: { id: requestId },
    include: { product: true },
  });

  if (!dealRequest) {
    throw new AppError(status.NOT_FOUND, "Deal request not found");
  }

  if (dealRequest.status !== DealRequestStatus.PENDING) {
    throw new AppError(status.BAD_REQUEST, `This request has already been ${dealRequest.status.toLowerCase()}`);
  }

  const now = new Date();

  if (payload.status === DealRequestStatus.REJECTED) {
    const updated = await prisma.dealRequest.update({
      where: { id: requestId },
      data: {
        status: DealRequestStatus.REJECTED,
        reviewedById: user?.userId || null,
        reviewNote: payload.reviewNote || "Request rejected by admin",
        reviewedAt: now,
      },
    });

    DealSocketEvents.notifyDealRequestReviewed({
      id: requestId,
      dealId: null,
      vendorId: dealRequest.vendorId,
      vendorUserId: dealRequest.requestedById,
      productTitle: dealRequest.product?.title,
      status: "REJECTED",
      reviewNote: updated.reviewNote,
    });

    return updated;
  }

  // Approval flow: create live Deal and link
  const finalPrice = payload.approvedDealPrice || Number(dealRequest.proposedDealPrice);
  const startAt = payload.approvedStartAt ? new Date(payload.approvedStartAt) : dealRequest.requestedStartAt;
  const endAt = payload.approvedEndAt ? new Date(payload.approvedEndAt) : dealRequest.requestedEndAt;
  const quantityLimit = payload.approvedQuantityLimit !== undefined ? payload.approvedQuantityLimit : dealRequest.quantityLimit;

  const dealInitialStatus = startAt <= now && endAt > now ? DealStatus.ACTIVE : DealStatus.SCHEDULED;

  const result = await prisma.$transaction(async (tx) => {
    const liveDeal = await tx.deal.create({
      data: {
        productId: dealRequest.productId,
        variantId: dealRequest.variantId,
        vendorId: dealRequest.vendorId,
        dealPrice: finalPrice,
        originalPrice: dealRequest.product.basePrice,
        quantityLimit,
        maxPerCustomer: dealRequest.maxPerCustomer,
        startAt,
        endAt,
        status: dealInitialStatus,
        createdById: user?.userId || dealRequest.requestedById,
      },
    });

    const approvedRequest = await tx.dealRequest.update({
      where: { id: requestId },
      data: {
        status: DealRequestStatus.APPROVED,
        reviewedById: user?.userId || null,
        reviewNote: payload.reviewNote || "Approved",
        reviewedAt: now,
        dealId: liveDeal.id,
      },
      include: { deal: true },
    });

    return approvedRequest;
  });

  DealSocketEvents.notifyDealRequestReviewed({
    id: requestId,
    dealId: result.dealId,
    vendorId: dealRequest.vendorId,
    vendorUserId: dealRequest.requestedById,
    productTitle: dealRequest.product?.title,
    status: "APPROVED",
    reviewNote: result.reviewNote,
  });

  return result;
};

// 7. Admin: Create direct platform deal
const createDirectDeal = async (user: IRequestUser | undefined, payload: ICreateDealPayload) => {
  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const vendorId = payload.vendorId || product.vendorId;
  const originalPrice = product.basePrice;
  const now = new Date();
  const startAt = new Date(payload.startAt);
  const endAt = new Date(payload.endAt);

  const initialStatus = startAt <= now && endAt > now ? DealStatus.ACTIVE : DealStatus.SCHEDULED;

  const deal = await prisma.deal.create({
    data: {
      productId: payload.productId,
      variantId: payload.variantId || null,
      vendorId,
      title: payload.title || null,
      dealPrice: payload.dealPrice,
      originalPrice,
      quantityLimit: payload.quantityLimit || null,
      maxPerCustomer: payload.maxPerCustomer || null,
      startAt,
      endAt,
      status: initialStatus,
      createdById: user?.userId || "admin",
    },
    include: { product: true, vendor: true },
  });

  DealSocketEvents.notifyDealUpdated({
    id: deal.id,
    status: deal.status,
    title: deal.title || product.title,
    vendorId: deal.vendorId,
  });

  return deal;
};

// 8. Admin / Vendor: Cancel deal
const cancelDeal = async (dealId: string, _user: IRequestUser | undefined) => {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
  });

  if (!deal) {
    throw new AppError(status.NOT_FOUND, "Deal not found");
  }

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: { status: DealStatus.CANCELLED },
  });

  DealSocketEvents.notifyDealUpdated({
    id: dealId,
    status: DealStatus.CANCELLED,
    title: deal.title,
    vendorId: deal.vendorId,
  });

  return updated;
};

export const DealService = {
  getPublicActiveDeals,
  getDealById,
  createDealRequest,
  getVendorDealRequests,
  getAllDealRequestsAdmin,
  reviewDealRequest,
  createDirectDeal,
  cancelDeal,
};
