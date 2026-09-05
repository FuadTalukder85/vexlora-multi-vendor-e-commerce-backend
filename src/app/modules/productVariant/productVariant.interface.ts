export interface ICreateProductVariantPayload {
  sku: string;
  attributes: Record<string, unknown>;
  price: number;
  stock?: number;
  image?: string | null;
}

export interface IUpdateProductVariantPayload {
  sku?: string;
  attributes?: Record<string, unknown>;
  price?: number;
  stock?: number;
  image?: string | null;
}
