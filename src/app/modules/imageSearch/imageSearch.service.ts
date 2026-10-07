import status from "http-status";
import { ProductStatus } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  cosineSimilarity,
  generateImageEmbeddingFromBuffer,
  generateImageEmbeddingFromUrl,
} from "../../utils/imageEmbedding";
import { IImageSearchResponse, ISimilarProduct } from "./imageSearch.interface";

/**
 * Searches the catalog for products with visually similar images.
 */
const searchByImageBuffer = async (
  buffer: Buffer,
  limit = 24,
  minSimilarity = 0.20,
  queryPreview?: string
): Promise<IImageSearchResponse> => {
  if (!buffer || buffer.length === 0) {
    throw new AppError(status.BAD_REQUEST, "Invalid image payload provided");
  }

  // 1. Generate dense visual embedding of query image
  const queryEmbedding = generateImageEmbeddingFromBuffer(buffer);

  // 2. Query products that have precomputed image embeddings
  let products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      imageEmbedding: { isEmpty: false },
    },
    take: 5000,
    orderBy: { createdAt: "desc" },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeLogo: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  // If no precomputed embeddings exist yet, query published products with images
  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        images: { isEmpty: false },
      },
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            id: true,
            storeName: true,
            storeLogo: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  if (!products || products.length === 0) {
    return {
      queryPreview,
      dimensions: queryEmbedding.length,
      totalFound: 0,
      results: [],
    };
  }

  // 3. Compute cosine similarity for each product against precomputed embeddings
  const scoredProducts: ISimilarProduct[] = [];

  for (const p of products) {
    const embedding = p.imageEmbedding;

    if (embedding && embedding.length > 0) {
      const score = cosineSimilarity(queryEmbedding, embedding);
      const similarityPercentage = Math.round(score * 100);

      scoredProducts.push({
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        basePrice: Number(p.basePrice),
        discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
        images: p.images,
        brand: p.brand,
        totalStock: p.totalStock,
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        similarityScore: Number(score.toFixed(4)),
        similarityPercentage,
        vendor: p.vendor
          ? {
              id: p.vendor.id,
              storeName: p.vendor.storeName,
              storeLogo: p.vendor.storeLogo,
            }
          : null,
        category: p.category
          ? {
              id: p.category.id,
              name: p.category.name,
              slug: p.category.slug,
            }
          : null,
      });
    }
  }

  // 4. Sort descending by similarity score
  scoredProducts.sort((a, b) => b.similarityScore - a.similarityScore);

  // 5. Filter by minimum similarity threshold, or return top closest results if available
  let results = scoredProducts.filter((p) => p.similarityScore >= minSimilarity);
  if (results.length === 0 && scoredProducts.length > 0) {
    // Fallback to top 4 highest scoring items so the user gets relevant recommendations
    results = scoredProducts.slice(0, 4);
  }

  const slicedResults = results.slice(0, limit);

  return {
    queryPreview,
    dimensions: queryEmbedding.length,
    totalFound: slicedResults.length,
    results: slicedResults,
  };
};

/**
 * Searches by image URL or base64 data URI
 */
const searchByImageUrl = async (
  imageUrl: string,
  limit = 24,
  minSimilarity = 0.20
): Promise<IImageSearchResponse> => {
  if (!imageUrl) {
    throw new AppError(status.BAD_REQUEST, "Image URL is required");
  }

  let buffer: Buffer;

  if (imageUrl.startsWith("data:image/")) {
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    buffer = Buffer.from(base64Data, "base64");
  } else {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(status.BAD_REQUEST, `Could not fetch image from URL: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  return searchByImageBuffer(buffer, limit, minSimilarity, imageUrl);
};

/**
 * Find visually similar products to an existing product
 */
const searchByProductId = async (
  productId: string,
  limit = 12
): Promise<IImageSearchResponse> => {
  const targetProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, images: true, imageEmbedding: true },
  });

  if (!targetProduct) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  let embedding = targetProduct.imageEmbedding;
  if ((!embedding || embedding.length === 0) && targetProduct.images && targetProduct.images[0]) {
    embedding = await generateImageEmbeddingFromUrl(targetProduct.images[0]);
    await prisma.product.update({
      where: { id: productId },
      data: { imageEmbedding: embedding },
    });
  }

  if (!embedding || embedding.length === 0) {
    return { dimensions: 0, totalFound: 0, results: [] };
  }

  const allProducts = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      imageEmbedding: { isEmpty: false },
      id: { not: productId },
    },
    take: 1000,
    orderBy: { createdAt: "desc" },
    include: {
      vendor: {
        select: {
          id: true,
          storeName: true,
          storeLogo: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  const scored: ISimilarProduct[] = [];

  for (const p of allProducts) {
    if (p.imageEmbedding && p.imageEmbedding.length > 0) {
      const score = cosineSimilarity(embedding, p.imageEmbedding);
      scored.push({
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        basePrice: Number(p.basePrice),
        discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
        images: p.images,
        brand: p.brand,
        totalStock: p.totalStock,
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        similarityScore: Number(score.toFixed(4)),
        similarityPercentage: Math.round(score * 100),
        vendor: p.vendor
          ? {
              id: p.vendor.id,
              storeName: p.vendor.storeName,
              storeLogo: p.vendor.storeLogo,
            }
          : null,
        category: p.category
          ? {
              id: p.category.id,
              name: p.category.name,
              slug: p.category.slug,
            }
          : null,
      });
    }
  }

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  const results = scored.slice(0, limit);

  return {
    queryPreview: targetProduct.images[0] || undefined,
    dimensions: embedding.length,
    totalFound: results.length,
    results,
  };
};

export const ImageSearchService = {
  searchByImageBuffer,
  searchByImageUrl,
  searchByProductId,
};
