export interface IUpdatePlatformSettingPayload {
  platformName?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  defaultCommissionRate?: number;
  minPayoutAmount?: number;
  escrowHoldDays?: number;
  allowVendorRegistration?: boolean;
  maintenanceMode?: boolean;
  emailNotifications?: boolean;
  systemAlerts?: boolean;
}
