import status from "http-status";
import {
  PaymentStatus,
  RiskLevel,
  Role,
  SubOrderStatus,
} from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
  fraudProfileFilterableFields,
  fraudProfileSearchableFields,
} from "./fraudProfile.constant";
import {
  IBatchRecalculatePayload,
  ICreateFraudProfilePayload,
  IUpdateFraudProfilePayload,
} from "./fraudProfile.interface";

const recalculateFraudProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: {
        include: {
          subOrders: true,
        },
      },
      deviceLinks: {
        include: {
          device: {
            include: {
              linkedUsers: true,
            },
          },
        },
      },
      couponUsageLogs: true,
    },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // Account age calculation
  const accountAgeDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  // Orders statistics
  const totalOrders = user.orders.length;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let returnedOrders = 0;
  let failedPayments = 0;
  let totalRefunds = 0;

  for (const order of user.orders) {
    if (order.paymentStatus === PaymentStatus.FAILED) {
      failedPayments += 1;
    }
    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      totalRefunds += 1;
    }

    for (const subOrder of order.subOrders) {
      if (subOrder.status === SubOrderStatus.DELIVERED) {
        completedOrders += 1;
      } else if (subOrder.status === SubOrderStatus.CANCELLED) {
        cancelledOrders += 1;
      } else if (subOrder.status === SubOrderStatus.RETURNED) {
        returnedOrders += 1;
      }
    }
  }

  // Multi-account detection via device links
  let multiAccountDevices = 0;
  for (const link of user.deviceLinks) {
    if (link.device.linkedUsers.length > 1) {
      multiAccountDevices += 1;
    }
  }

  // Coupon usage logs count
  const couponCount = user.couponUsageLogs.length;

  // Compute Risk Score (0-100)
  let calculatedScore = 0;
  const fraudTypesSet = new Set<string>();

  if (multiAccountDevices > 0) {
    calculatedScore += 35;
    fraudTypesSet.add("multi_account");
  }

  if (totalOrders >= 3 && cancelledOrders / totalOrders > 0.4) {
    calculatedScore += 25;
    fraudTypesSet.add("order_cancellation_abuse");
  }

  if (returnedOrders >= 2 || (totalOrders >= 3 && returnedOrders / totalOrders > 0.3)) {
    calculatedScore += 25;
    fraudTypesSet.add("return_abuse");
  }

  if (failedPayments >= 2) {
    calculatedScore += 20;
    fraudTypesSet.add("payment_failure_risk");
  }

  if (totalRefunds >= 2) {
    calculatedScore += 20;
    fraudTypesSet.add("chargeback_risk");
  }

  if (couponCount >= 5 && accountAgeDays < 7) {
    calculatedScore += 25;
    fraudTypesSet.add("coupon_abuse");
  }

  const finalScore = Math.min(100, Math.max(0, calculatedScore));

  let riskLevel: RiskLevel = RiskLevel.LOW;
  if (finalScore >= 80) {
    riskLevel = RiskLevel.CRITICAL;
  } else if (finalScore >= 60) {
    riskLevel = RiskLevel.HIGH;
  } else if (finalScore >= 30) {
    riskLevel = RiskLevel.MEDIUM;
  }

  const fraudTypes = Array.from(fraudTypesSet);

  return await prisma.fraudProfile.upsert({
    where: { userId },
    update: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      returnedOrders,
      failedPayments,
      totalRefunds,
      chargebacks: totalRefunds,
      accountAgeDays,
      riskScore: finalScore,
      riskLevel,
      fraudTypes,
      lastCalculatedAt: new Date(),
    },
    create: {
      userId,
      totalOrders,
      completedOrders,
      cancelledOrders,
      returnedOrders,
      failedPayments,
      totalRefunds,
      chargebacks: totalRefunds,
      accountAgeDays,
      riskScore: finalScore,
      riskLevel,
      fraudTypes,
      lastCalculatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });
};

const getMyFraudProfile = async (userId: string) => {
  const profile = await prisma.fraudProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!profile) {
    // If not existing yet, calculate it dynamically
    return await recalculateFraudProfile(userId);
  }

  return profile;
};

const getFraudProfileByUserId = async (
  userId: string,
  currentUserId?: string,
  role?: Role,
) => {
  const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
  if (!isAdmin && userId !== currentUserId) {
    throw new AppError(status.FORBIDDEN, "Forbidden access to user fraud profile");
  }

  const profile = await prisma.fraudProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          phone: true,
        },
      },
    },
  });

  if (!profile) {
    return await recalculateFraudProfile(userId);
  }

  return profile;
};

const getAllFraudProfiles = async (query: IQueryParams) => {
  const fraudProfileQuery = new QueryBuilder(prisma.fraudProfile, query, {
    searchableFields: fraudProfileSearchableFields,
    filterableFields: fraudProfileFilterableFields,
    defaultSortBy: "updatedAt",
  })
    .search()
    .filter()
    .paginate()
    .sort()
    .include({
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          phone: true,
        },
      },
    });

  return await fraudProfileQuery.execute();
};

const getFraudProfileById = async (id: string) => {
  const profile = await prisma.fraudProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          phone: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppError(status.NOT_FOUND, "Fraud profile not found");
  }

  return profile;
};

const createFraudProfile = async (payload: ICreateFraudProfilePayload) => {
  const existingProfile = await prisma.fraudProfile.findUnique({
    where: { userId: payload.userId },
  });

  if (existingProfile) {
    throw new AppError(
      status.CONFLICT,
      "Fraud profile already exists for this user",
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

  return await prisma.fraudProfile.create({
    data: {
      userId: payload.userId,
      riskScore,
      riskLevel,
      fraudTypes: payload.fraudTypes ?? [],
      lastCalculatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
};

const updateFraudProfile = async (
  id: string,
  payload: IUpdateFraudProfilePayload,
) => {
  const profile = await prisma.fraudProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    throw new AppError(status.NOT_FOUND, "Fraud profile not found");
  }

  const newRiskScore =
    payload.riskScore !== undefined ? payload.riskScore : profile.riskScore;

  let newRiskLevel = payload.riskLevel ?? profile.riskLevel;
  if (payload.riskScore !== undefined && payload.riskLevel === undefined) {
    if (newRiskScore >= 80) newRiskLevel = RiskLevel.CRITICAL;
    else if (newRiskScore >= 60) newRiskLevel = RiskLevel.HIGH;
    else if (newRiskScore >= 30) newRiskLevel = RiskLevel.MEDIUM;
    else newRiskLevel = RiskLevel.LOW;
  }

  return await prisma.fraudProfile.update({
    where: { id },
    data: {
      riskScore: newRiskScore,
      riskLevel: newRiskLevel,
      fraudTypes: payload.fraudTypes ?? profile.fraudTypes,
      lastCalculatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
};

const batchRecalculateFraudProfiles = async (payload?: IBatchRecalculatePayload) => {
  let targetUserIds: string[] = [];

  if (payload?.userIds && payload.userIds.length > 0) {
    targetUserIds = payload.userIds;
  } else {
    // Find all users who have orders or device links
    const users = await prisma.user.findMany({
      select: { id: true },
    });
    targetUserIds = users.map((u) => u.id);
  }

  const results = [];
  for (const userId of targetUserIds) {
    try {
      const updated = await recalculateFraudProfile(userId);
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

const deleteFraudProfile = async (id: string) => {
  const profile = await prisma.fraudProfile.findUnique({
    where: { id },
  });

  if (!profile) {
    throw new AppError(status.NOT_FOUND, "Fraud profile not found");
  }

  return await prisma.fraudProfile.delete({
    where: { id },
  });
};

const getHighRiskProfiles = async (query: IQueryParams) => {
  const queryWithHighRisk = {
    ...query,
    riskLevel: RiskLevel.HIGH,
  };

  const fraudProfileQuery = new QueryBuilder(prisma.fraudProfile, queryWithHighRisk, {
    searchableFields: fraudProfileSearchableFields,
    filterableFields: fraudProfileFilterableFields,
    defaultSortBy: "updatedAt",
  })
    .search()
    .filter()
    .paginate()
    .sort()
    .include({
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          phone: true,
        },
      },
    });

  return await fraudProfileQuery.execute();
};

export const FraudProfileService = {
  recalculateFraudProfile,
  getMyFraudProfile,
  getFraudProfileByUserId,
  getAllFraudProfiles,
  getFraudProfileById,
  createFraudProfile,
  updateFraudProfile,
  batchRecalculateFraudProfiles,
  deleteFraudProfile,
  getHighRiskProfiles,
};
