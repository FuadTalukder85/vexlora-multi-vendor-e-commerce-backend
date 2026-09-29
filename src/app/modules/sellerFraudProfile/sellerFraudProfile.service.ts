import status from "http-status";
import { RiskLevel, Role, SubOrderStatus } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
  sellerFraudProfileFilterableFields,
  sellerFraudProfileSearchableFields,
} from "./sellerFraudProfile.constant";
import {
  IBatchRecalculateSellerRiskPayload,
  ICreateSellerFraudProfilePayload,
  IUpdateSellerFraudProfilePayload,
} from "./sellerFraudProfile.interface";

const recalculateSellerFraudProfile = async (vendorId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    include: {
      subOrders: true,
      sellerFraudProfile: true,
    },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  // Preserve existing manual counts if available
  const existingProfile = vendor.sellerFraudProfile;
  const complaints = existingProfile?.complaints ?? 0;
  const fakeProductReports = existingProfile?.fakeProductReports ?? 0;
  const reviewAbuseCount = existingProfile?.reviewAbuseCount ?? 0;
  const suspiciousOrders = existingProfile?.suspiciousOrders ?? 0;

  // Sub-order metrics
  const totalOrders = vendor.subOrders.length;
  let cancelledOrders = 0;
  let returnedOrders = 0;
  let lateShipments = 0;

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  for (const subOrder of vendor.subOrders) {
    if (subOrder.status === SubOrderStatus.CANCELLED) {
      cancelledOrders += 1;
    } else if (subOrder.status === SubOrderStatus.RETURNED) {
      returnedOrders += 1;
    }

    if (subOrder.shippedAt) {
      const shipDelay =
        new Date(subOrder.shippedAt).getTime() - new Date(subOrder.createdAt).getTime();
      if (shipDelay > THREE_DAYS_MS) {
        lateShipments += 1;
      }
    } else if (
      subOrder.status === SubOrderStatus.PENDING ||
      subOrder.status === SubOrderStatus.CONFIRMED
    ) {
      const pendingDuration = Date.now() - new Date(subOrder.createdAt).getTime();
      if (pendingDuration > THREE_DAYS_MS) {
        lateShipments += 1;
      }
    }
  }

  const refundRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;
  const lateShipmentRate = totalOrders > 0 ? (lateShipments / totalOrders) * 100 : 0;
  const customerRating = Number(vendor.ratingAvg || 0);

  // Risk Score Calculation (0 - 100)
  let calculatedScore = 0;

  if (totalOrders >= 5 && refundRate > 15) {
    calculatedScore += 25;
  }
  if (totalOrders >= 5 && (cancelledOrders / totalOrders) > 0.2) {
    calculatedScore += 25;
  }
  if (totalOrders >= 5 && lateShipmentRate > 25) {
    calculatedScore += 20;
  }
  if (totalOrders >= 5 && customerRating > 0 && customerRating < 3.0) {
    calculatedScore += 20;
  }

  calculatedScore += complaints * 10;
  calculatedScore += fakeProductReports * 15;
  calculatedScore += reviewAbuseCount * 10;
  calculatedScore += suspiciousOrders * 5;

  const finalScore = Math.min(100, Math.max(0, calculatedScore));

  let riskLevel: RiskLevel = RiskLevel.LOW;
  if (finalScore >= 80) {
    riskLevel = RiskLevel.CRITICAL;
  } else if (finalScore >= 60) {
    riskLevel = RiskLevel.HIGH;
  } else if (finalScore >= 30) {
    riskLevel = RiskLevel.MEDIUM;
  }

  const isFlagged = riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
  const flaggedAt = isFlagged ? (existingProfile?.flaggedAt ?? new Date()) : null;

  return await prisma.sellerFraudProfile.upsert({
    where: { vendorId },
    update: {
      totalOrders,
      cancelledOrders,
      returnedOrders,
      complaints,
      refundRate,
      fakeProductReports,
      lateShipmentRate,
      customerRating,
      reviewAbuseCount,
      suspiciousOrders,
      riskScore: finalScore,
      riskLevel,
      flaggedAt,
    },
    create: {
      vendorId,
      totalOrders,
      cancelledOrders,
      returnedOrders,
      complaints,
      refundRate,
      fakeProductReports,
      lateShipmentRate,
      customerRating,
      reviewAbuseCount,
      suspiciousOrders,
      riskScore: finalScore,
      riskLevel,
      flaggedAt,
    },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
          ratingAvg: true,
        },
      },
    },
  });
};

const getMySellerFraudProfile = async (userId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found for this user");
  }

  const profile = await prisma.sellerFraudProfile.findUnique({
    where: { vendorId: vendor.id },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
          ratingAvg: true,
        },
      },
    },
  });

  if (!profile) {
    return await recalculateSellerFraudProfile(vendor.id);
  }

  return profile;
};

const getSellerFraudProfileByVendorId = async (
  vendorId: string,
  currentUserId?: string,
  role?: Role,
) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
  if (!isAdmin && vendor.userId !== currentUserId) {
    throw new AppError(status.FORBIDDEN, "Forbidden access to seller fraud profile");
  }

  const profile = await prisma.sellerFraudProfile.findUnique({
    where: { vendorId },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
          ratingAvg: true,
        },
      },
    },
  });

  if (!profile) {
    return await recalculateSellerFraudProfile(vendorId);
  }

  return profile;
};

const getAllSellerFraudProfiles = async (query: IQueryParams) => {
  const sellerFraudQuery = new QueryBuilder(prisma.sellerFraudProfile, query, {
    searchableFields: sellerFraudProfileSearchableFields,
    filterableFields: sellerFraudProfileFilterableFields,
    defaultSortBy: "updatedAt",
  })
    .search()
    .filter()
    .paginate()
    .sort()
    .include({
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
          ratingAvg: true,
        },
      },
    });

  return await sellerFraudQuery.execute();
};

const getSellerFraudProfileById = async (id: string) => {
  const profile = await prisma.sellerFraudProfile.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
          ratingAvg: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppError(status.NOT_FOUND, "Seller fraud profile not found");
  }

  return profile;
};

const createSellerFraudProfile = async (
  payload: ICreateSellerFraudProfilePayload,
) => {
  const existingProfile = await prisma.sellerFraudProfile.findUnique({
    where: { vendorId: payload.vendorId },
  });

  if (existingProfile) {
    throw new AppError(
      status.CONFLICT,
      "Seller fraud profile already exists for this vendor",
    );
  }

  const riskScore = payload.riskScore ?? 0;
  let riskLevel = payload.riskLevel;
  if (!riskLevel) {
    if (riskScore >= 80) riskLevel = RiskLevel.CRITICAL;
    else if (riskScore >= 60) riskLevel = RiskLevel.HIGH;
    else if (riskScore >= 30) riskLevel = RiskLevel.MEDIUM;
    else riskLevel = RiskLevel.LOW;
  }

  return await prisma.sellerFraudProfile.create({
    data: {
      vendorId: payload.vendorId,
      totalOrders: payload.totalOrders ?? 0,
      cancelledOrders: payload.cancelledOrders ?? 0,
      returnedOrders: payload.returnedOrders ?? 0,
      complaints: payload.complaints ?? 0,
      refundRate: payload.refundRate ?? 0,
      fakeProductReports: payload.fakeProductReports ?? 0,
      lateShipmentRate: payload.lateShipmentRate ?? 0,
      customerRating: payload.customerRating ?? 0,
      reviewAbuseCount: payload.reviewAbuseCount ?? 0,
      suspiciousOrders: payload.suspiciousOrders ?? 0,
      riskScore,
      riskLevel,
      flaggedAt: riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL ? new Date() : null,
    },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
        },
      },
    },
  });
};

const updateSellerFraudProfile = async (
  id: string,
  payload: IUpdateSellerFraudProfilePayload,
) => {
  const profile = await prisma.sellerFraudProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    throw new AppError(status.NOT_FOUND, "Seller fraud profile not found");
  }

  const complaints = payload.complaints !== undefined ? payload.complaints : profile.complaints;
  const fakeProductReports = payload.fakeProductReports !== undefined ? payload.fakeProductReports : profile.fakeProductReports;
  const reviewAbuseCount = payload.reviewAbuseCount !== undefined ? payload.reviewAbuseCount : profile.reviewAbuseCount;
  const suspiciousOrders = payload.suspiciousOrders !== undefined ? payload.suspiciousOrders : profile.suspiciousOrders;

  const newRiskScore = payload.riskScore !== undefined ? payload.riskScore : profile.riskScore;

  let newRiskLevel = payload.riskLevel ?? profile.riskLevel;
  if (payload.riskScore !== undefined && payload.riskLevel === undefined) {
    if (newRiskScore >= 80) newRiskLevel = RiskLevel.CRITICAL;
    else if (newRiskScore >= 60) newRiskLevel = RiskLevel.HIGH;
    else if (newRiskScore >= 30) newRiskLevel = RiskLevel.MEDIUM;
    else newRiskLevel = RiskLevel.LOW;
  }

  const isFlagged = newRiskLevel === RiskLevel.HIGH || newRiskLevel === RiskLevel.CRITICAL;
  const flaggedAt = isFlagged ? (profile.flaggedAt ?? new Date()) : null;

  return await prisma.sellerFraudProfile.update({
    where: { id },
    data: {
      complaints,
      fakeProductReports,
      reviewAbuseCount,
      suspiciousOrders,
      riskScore: newRiskScore,
      riskLevel: newRiskLevel,
      flaggedAt,
    },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
        },
      },
    },
  });
};

const batchRecalculateSellerFraudProfiles = async (
  payload?: IBatchRecalculateSellerRiskPayload,
) => {
  let targetVendorIds: string[] = [];

  if (payload?.vendorIds && payload.vendorIds.length > 0) {
    targetVendorIds = payload.vendorIds;
  } else {
    const vendors = await prisma.vendorProfile.findMany({
      select: { id: true },
    });
    targetVendorIds = vendors.map((v) => v.id);
  }

  const results = [];
  for (const vendorId of targetVendorIds) {
    try {
      const updated = await recalculateSellerFraudProfile(vendorId);
      results.push(updated);
    } catch {
      // Skip if individual calculation fails
    }
  }

  return {
    recalculatedCount: results.length,
    profiles: results,
  };
};

const deleteSellerFraudProfile = async (id: string) => {
  const profile = await prisma.sellerFraudProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    throw new AppError(status.NOT_FOUND, "Seller fraud profile not found");
  }

  return await prisma.sellerFraudProfile.delete({
    where: { id },
  });
};

const getHighRiskSellers = async (query: IQueryParams) => {
  const queryWithHighRisk = {
    ...query,
    riskLevel: RiskLevel.HIGH,
  };

  const sellerFraudQuery = new QueryBuilder(prisma.sellerFraudProfile, queryWithHighRisk, {
    searchableFields: sellerFraudProfileSearchableFields,
    filterableFields: sellerFraudProfileFilterableFields,
    defaultSortBy: "updatedAt",
  })
    .search()
    .filter()
    .paginate()
    .sort()
    .include({
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          status: true,
          ratingAvg: true,
        },
      },
    });

  return await sellerFraudQuery.execute();
};

export const SellerFraudProfileService = {
  recalculateSellerFraudProfile,
  getMySellerFraudProfile,
  getSellerFraudProfileByVendorId,
  getAllSellerFraudProfiles,
  getSellerFraudProfileById,
  createSellerFraudProfile,
  updateSellerFraudProfile,
  batchRecalculateSellerFraudProfiles,
  deleteSellerFraudProfile,
  getHighRiskSellers,
};
