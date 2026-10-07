import {
  PayoutStatus,
  ReviewFraudStatus,
  RiskLevel,
  SubOrderStatus,
  VendorStatus,
} from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import status from "http-status";
import { IRequestUser } from "../../types/request.types";
import {
  IAdminDashboardOverview,
  IVendorAnalyticsOverview,
} from "./analytics.interface";

const getAdminDashboardOverview = async (): Promise<IAdminDashboardOverview> => {
  const [
    deliveredSubOrders,
    payouts,
    totalOrdersCount,
    activeVendorsCount,
    pendingVendorsCount,
    highRiskUsersCount,
    highRiskSellersCount,
    flaggedReviewsCount,
  ] = await Promise.all([
    prisma.subOrder.findMany({
      where: { status: SubOrderStatus.DELIVERED },
      select: {
        subtotal: true,
        commissionAmount: true,
        vendorEarning: true,
      },
    }),
    prisma.payout.findMany({
      select: {
        amount: true,
        status: true,
      },
    }),
    prisma.order.count(),
    prisma.vendorProfile.count({
      where: { status: VendorStatus.APPROVED },
    }),
    prisma.vendorProfile.count({
      where: { status: VendorStatus.PENDING },
    }),
    prisma.fraudProfile.count({
      where: {
        riskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] },
      },
    }),
    prisma.sellerFraudProfile.count({
      where: {
        riskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] },
      },
    }),
    prisma.reviewFraudLog.count({
      where: {
        status: { in: [ReviewFraudStatus.FLAGGED, ReviewFraudStatus.REMOVED] },
      },
    }),
  ]);

  let totalPlatformVolume = 0;
  let totalCommissionEarned = 0;
  let totalVendorEarnings = 0;

  deliveredSubOrders.forEach(
    (s: {
      subtotal: any;
      commissionAmount: any;
      vendorEarning: any;
    }) => {
      totalPlatformVolume += Number(s.subtotal);
      totalCommissionEarned += Number(s.commissionAmount);
      totalVendorEarnings += Number(s.vendorEarning);
    }
  );

  let totalPaidOut = 0;
  let pendingPayoutsAmount = 0;
  let pendingPayoutsCount = 0;
  let paidPayoutsCount = 0;

  payouts.forEach((p: { amount: any; status: PayoutStatus }) => {
    const amt = Number(p.amount);
    if (p.status === PayoutStatus.PAID) {
      totalPaidOut += amt;
      paidPayoutsCount += 1;
    } else if (
      p.status === PayoutStatus.UNPAID ||
      p.status === PayoutStatus.PROCESSING
    ) {
      pendingPayoutsAmount += amt;
      pendingPayoutsCount += 1;
    }
  });

  const flaggedFraudCount =
    highRiskUsersCount + highRiskSellersCount + flaggedReviewsCount;

  return {
    totalPlatformVolume,
    totalCommissionEarned,
    totalVendorEarnings,
    totalOrdersCount,
    activeVendorsCount,
    pendingVendorsCount,
    pendingPayoutsAmount,
    pendingPayoutsCount,
    paidPayoutsCount,
    totalPaidOut,
    flaggedFraudCount,
  };
};

const getVendorAnalyticsOverview = async (
  user?: IRequestUser
): Promise<IVendorAnalyticsOverview> => {
  if (!user?.userId) {
    throw new AppError(status.UNAUTHORIZED, "Unauthorized user");
  }

  const vendor = await prisma.vendorProfile.findFirst({
    where: {
      OR: [
        { userId: user.userId },
        ...(user.tenantId ? [{ id: user.tenantId }] : []),
      ],
    },
    select: { id: true, ratingAvg: true },
  });

  if (!vendor) {
    throw new AppError(status.FORBIDDEN, "Vendor profile not found");
  }

  const [subOrders, totalProductsCount] = await Promise.all([
    prisma.subOrder.findMany({
      where: { vendorId: vendor.id },
      select: {
        subtotal: true,
        commissionAmount: true,
        status: true,
      },
    }),
    prisma.product.count({
      where: { vendorId: vendor.id },
    }),
  ]);

  let totalRevenue = 0;
  let totalCommissionPaid = 0;
  let deliveredOrdersCount = 0;
  let pendingOrdersCount = 0;

  subOrders.forEach(
    (so: {
      subtotal: any;
      commissionAmount: any;
      status: SubOrderStatus;
    }) => {
      if (so.status === SubOrderStatus.DELIVERED) {
        totalRevenue += Number(so.subtotal);
        totalCommissionPaid += Number(so.commissionAmount);
        deliveredOrdersCount += 1;
      } else if (
        so.status === SubOrderStatus.PENDING ||
        so.status === SubOrderStatus.CONFIRMED ||
        so.status === SubOrderStatus.SHIPPED
      ) {
        pendingOrdersCount += 1;
      }
    }
  );

  return {
    totalRevenue,
    totalOrdersCount: subOrders.length,
    deliveredOrdersCount,
    pendingOrdersCount,
    totalProductsCount,
    averageRating: Number(vendor.ratingAvg) || 0,
    totalCommissionPaid,
  };
};

export const AnalyticsService = {
  getAdminDashboardOverview,
  getVendorAnalyticsOverview,
};
