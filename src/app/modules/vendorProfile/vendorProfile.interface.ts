import { VendorStatus } from "../../../generated/prisma/enums";

export interface ICreateVendorProfilePayload {
  storeName: string;
  storeSlug?: string;
  storeLogo?: string | null;
  storeBanner?: string | null;
  description?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  documents?: Array<{ type: string; url: string }>;
}

export interface IUpdateVendorProfilePayload {
  storeName?: string;
  storeSlug?: string;
  storeLogo?: string | null;
  storeBanner?: string | null;
  description?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
}

export interface IUpdateVendorStatusPayload {
  status: VendorStatus;
  commissionRate?: number;
}

export interface ICreateVendorDocumentPayload {
  type: string;
  url: string;
}
