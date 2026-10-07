export interface IAdminDashboardOverview {
  totalPlatformVolume: number;
  totalCommissionEarned: number;
  totalVendorEarnings: number;
  totalOrdersCount: number;
  activeVendorsCount: number;
  pendingVendorsCount: number;
  pendingPayoutsAmount: number;
  pendingPayoutsCount: number;
  paidPayoutsCount: number;
  totalPaidOut: number;
  flaggedFraudCount: number;
}

export interface IVendorAnalyticsOverview {
  totalRevenue: number;
  totalOrdersCount: number;
  deliveredOrdersCount: number;
  pendingOrdersCount: number;
  totalProductsCount: number;
  averageRating: number;
  totalCommissionPaid: number;
}
