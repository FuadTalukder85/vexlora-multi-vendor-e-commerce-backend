import { WishlistModel } from "../../../generated/prisma/models";

export interface IAddToWishlistPayload {
  productId: string;
}

export interface IToggleWishlistResult {
  inWishlist: boolean;
  productId: string;
  wishlist?: WishlistModel;
}

export interface ICheckWishlistResult {
  inWishlist: boolean;
  wishlistId: string | null;
}

export interface IWishlistCountResult {
  productId: string;
  count: number;
}
