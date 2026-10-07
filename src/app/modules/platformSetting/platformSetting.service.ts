import { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../../types/request.types";
import { IUpdatePlatformSettingPayload } from "./platformSetting.interface";

const getPlatformSettings = async (requester?: IRequestUser) => {
  let settings = await prisma.platformSetting.findUnique({
    where: { id: "global" },
  });

  if (!settings) {
    settings = await prisma.platformSetting.create({
      data: {
        id: "global",
        platformName: "Vexlora Marketplace",
        supportEmail: "support@vexlora.com",
        supportPhone: "+1 (555) 019-2834",
        currency: "USD",
        defaultCommissionRate: 10.0,
        minPayoutAmount: 50.0,
        escrowHoldDays: 7,
        allowVendorRegistration: true,
        maintenanceMode: false,
        emailNotifications: true,
        systemAlerts: true,
      },
    });
  }

  const isAdmin = requester && (requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN);

  if (isAdmin) {
    return settings;
  }

  // Public / Vendor view (sanitized safe platform details)
  return {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    currency: settings.currency,
    allowVendorRegistration: settings.allowVendorRegistration,
    maintenanceMode: settings.maintenanceMode,
    defaultCommissionRate: settings.defaultCommissionRate,
    minPayoutAmount: settings.minPayoutAmount,
    escrowHoldDays: settings.escrowHoldDays,
  };
};

const updatePlatformSettings = async (payload: IUpdatePlatformSettingPayload) => {
  const settings = await prisma.platformSetting.upsert({
    where: { id: "global" },
    update: {
      ...(payload.platformName !== undefined && { platformName: payload.platformName }),
      ...(payload.supportEmail !== undefined && { supportEmail: payload.supportEmail }),
      ...(payload.supportPhone !== undefined && { supportPhone: payload.supportPhone }),
      ...(payload.currency !== undefined && { currency: payload.currency }),
      ...(payload.defaultCommissionRate !== undefined && { defaultCommissionRate: payload.defaultCommissionRate }),
      ...(payload.minPayoutAmount !== undefined && { minPayoutAmount: payload.minPayoutAmount }),
      ...(payload.escrowHoldDays !== undefined && { escrowHoldDays: payload.escrowHoldDays }),
      ...(payload.allowVendorRegistration !== undefined && {
        allowVendorRegistration: payload.allowVendorRegistration,
      }),
      ...(payload.maintenanceMode !== undefined && { maintenanceMode: payload.maintenanceMode }),
      ...(payload.emailNotifications !== undefined && { emailNotifications: payload.emailNotifications }),
      ...(payload.systemAlerts !== undefined && { systemAlerts: payload.systemAlerts }),
    },
    create: {
      id: "global",
      platformName: payload.platformName ?? "Vexlora Marketplace",
      supportEmail: payload.supportEmail ?? "support@vexlora.com",
      supportPhone: payload.supportPhone ?? "+1 (555) 019-2834",
      currency: payload.currency ?? "USD",
      defaultCommissionRate: payload.defaultCommissionRate ?? 10.0,
      minPayoutAmount: payload.minPayoutAmount ?? 50.0,
      escrowHoldDays: payload.escrowHoldDays ?? 7,
      allowVendorRegistration: payload.allowVendorRegistration ?? true,
      maintenanceMode: payload.maintenanceMode ?? false,
      emailNotifications: payload.emailNotifications ?? true,
      systemAlerts: payload.systemAlerts ?? true,
    },
  });

  return settings;
};

export const PlatformSettingService = {
  getPlatformSettings,
  updatePlatformSettings,
};
