import { ProductStatus } from "../../../generated/prisma/enums";
import { ICreateProductVariantPayload, IUpdateProductVariantPayload } from "../productVariant/productVariant.interface";

// Backward compatibility re-exports
export type ICreateVariantPayload = ICreateProductVariantPayload;
export type IUpdateVariantPayload = IUpdateProductVariantPayload;

export interface ICreateProductPayload {
  title: string;
  slug?: string;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  images?: string[];
  basePrice: number;
  discountPrice?: number | null;
  totalStock?: number;
  tags?: string[];
  status?: ProductStatus;
  variants?: ICreateVariantPayload[];
  vendorId?: string; // Optional: Admins can assign to any vendor
}

export interface IUpdateProductPayload {
  title?: string;
  slug?: string;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  images?: string[];
  basePrice?: number;
  discountPrice?: number | null;
  totalStock?: number;
  tags?: string[];
  status?: ProductStatus;
}

export interface IUpdateProductStatusPayload {
  status: ProductStatus;
}
