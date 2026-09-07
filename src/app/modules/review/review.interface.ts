export interface ICreateReviewPayload {
  productId: string;
  rating: number;
  comment?: string | null;
  images?: string[];
  subOrderId?: string | null;
}

export interface IUpdateReviewPayload {
  rating?: number;
  comment?: string | null;
  images?: string[];
}

export interface IVendorReplyPayload {
  vendorReply: string;
}

export interface IReviewFilterParams {
  searchTerm?: string;
  productId?: string;
  customerId?: string;
  rating?: number | string;
  hasImages?: boolean | string;
  hasReply?: boolean | string;
  isVerified?: boolean | string;
}

export interface IReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  ratingPercentages: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  verifiedPurchaseCount: number;
  withImagesCount: number;
}

export interface ICanReviewResult {
  canReview: boolean;
  alreadyReviewed: boolean;
  existingReviewId?: string;
  isVerifiedPurchase: boolean;
  eligibleSubOrderId?: string;
  message?: string;
}
