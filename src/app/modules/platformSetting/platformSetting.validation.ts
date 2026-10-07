import { z } from "zod";

const updatePlatformSettingSchema = z.object({
  body: z.object({
    platformName: z.string().min(2).max(100).optional(),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().max(50).optional().nullable(),
    currency: z.string().min(1).max(10).optional(),
    defaultCommissionRate: z.number().min(0).max(100).optional(),
    minPayoutAmount: z.number().min(0).optional(),
    escrowHoldDays: z.number().int().min(0).max(90).optional(),
    allowVendorRegistration: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    systemAlerts: z.boolean().optional(),
  }),
});

export const PlatformSettingValidation = {
  updatePlatformSettingSchema,
};
