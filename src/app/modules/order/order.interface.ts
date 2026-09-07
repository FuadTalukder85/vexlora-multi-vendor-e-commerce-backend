import { PaymentStatus } from "../../../generated/prisma/enums";

export interface ICreateOrderItemPayload {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface ICreateOrderPayload {
  items: ICreateOrderItemPayload[];
  shippingAddressId?: string;
  paymentMethod?: string;
  paymentIntentId?: string;
  couponCode?: string;
}

export interface IUpdatePaymentStatusPayload {
  paymentStatus: PaymentStatus;
  paymentIntentId?: string;
}

export interface ICancelOrderPayload {
  reason?: string;
}
