export interface ISimilarProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  basePrice: number;
  discountPrice: number | null;
  images: string[];
  brand: string | null;
  totalStock: number;
  ratingAvg: number;
  ratingCount: number;
  similarityScore: number; // 0.0 - 1.0 (e.g., 0.94 for 94% visual match)
  similarityPercentage: number; // 0 - 100
  vendor: {
    id: string;
    storeName: string;
    storeLogo: string | null;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface IImageSearchResponse {
  queryPreview?: string;
  dimensions: number;
  totalFound: number;
  results: ISimilarProduct[];
}
