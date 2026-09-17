import { PayoutStatus } from "../../../generated/prisma/enums";

export interface IRequestPayoutPayload {
  subOrderIds?: string[];
  notes?: string;
}

export interface ICreatePayoutAdminPayload {
  vendorId: string;
  subOrderIds: string[];
  status?: PayoutStatus;
  stripeTransferId?: string;
}

export interface IUpdatePayoutStatusPayload {
  status: PayoutStatus;
  stripeTransferId?: string;
}

export interface IVendorPayoutStatistics {
  totalEarnings: number;
  totalPaidOut: number;
  pendingPayoutAmount: number;
  availableBalance: number;
  eligibleSubOrdersCount: number;
  hasPayoutMethod: boolean;
}

export interface IAdminPayoutStatistics {
  totalPlatformVolume: number;
  totalCommissionEarned: number;
  totalVendorEarnings: number;
  totalPaidOut: number;
  pendingPayoutsAmount: number;
  pendingPayoutsCount: number;
  paidPayoutsCount: number;
  failedPayoutsCount: number;
}
