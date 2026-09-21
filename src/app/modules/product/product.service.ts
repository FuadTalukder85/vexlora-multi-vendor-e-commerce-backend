import status from "http-status";
import { ProductStatus, Role, VendorStatus } from "../../../generated/prisma/enums";
import type { InputJsonValue } from "../../../generated/prisma/internal/prismaNamespace";
import { ProductModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { getCache, setCache, invalidatePattern } from "../../lib/redis";
import { IQueryParams, IQueryResult } from "../../types/query.types";
import { IRequestUser } from "../../types/request.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
  adminProductSearchableFields,
  productFilterableFields,
  productListInclude,
  productListSelect,
  productSearchableFields,
  standardProductInclude,
} from "./product.constant";
import { ICreateProductPayload, IUpdateProductPayload, IUpdateProductStatusPayload } from "./product.interface";

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const generateUniqueSlug = async (baseText: string, currentId?: string): Promise<string> => {
  const baseSlug = slugify(baseText);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (currentId && existing.id === currentId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

const createProduct = async (user: IRequestUser, payload: ICreateProductPayload) => {
  let targetVendorId: string;

  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    if (payload.vendorId) {
      const vendorExists = await prisma.vendorProfile.findUnique({
        where: { id: payload.vendorId },
      });
      if (!vendorExists) {
        throw new AppError(status.NOT_FOUND, "Specified vendor store not found");
      }
      targetVendorId = payload.vendorId;
    } else {
      const adminVendor = await prisma.vendorProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!adminVendor) {
        throw new AppError(status.BAD_REQUEST, "vendorId must be provided for product creation");
      }
      targetVendorId = adminVendor.id;
    }
  } else {
    // Regular vendor flow (owner or staff)
    let tenantId = user.tenantId;
    if (!tenantId) {
      const vendorProfile = await prisma.vendorProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!vendorProfile) {
        throw new AppError(status.FORBIDDEN, "You do not have a vendor profile");
      }
      tenantId = vendorProfile.id;
    }

    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { id: tenantId },
    });

    if (!vendorProfile || vendorProfile.status !== VendorStatus.APPROVED) {
      throw new AppError(status.FORBIDDEN, "Your vendor store is not approved yet");
    }

    targetVendorId = vendorProfile.id;
  }

  // Validate Category if provided
  if (payload.categoryId) {
    const categoryExists = await prisma.category.findUnique({
      where: { id: payload.categoryId },
    });
    if (!categoryExists) {
      throw new AppError(status.NOT_FOUND, "Category not found");
    }
  }

  // Check variant SKU uniqueness within payload and database
  if (payload.variants && payload.variants.length > 0) {
    const skus = payload.variants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      throw new AppError(status.BAD_REQUEST, "Duplicate SKUs provided in variant list");
    }

    const existingVariants = await prisma.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });

    if (existingVariants.length > 0) {
      throw new AppError(status.CONFLICT, `SKU already exists: ${existingVariants.map((v) => v.sku).join(", ")}`);
    }
  }

  const slug = await generateUniqueSlug(payload.slug || payload.title);

  // Calculate initial totalStock
  let totalStock = payload.totalStock ?? 0;
  if (payload.variants && payload.variants.length > 0) {
    totalStock = payload.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  }

  return await prisma.$transaction(async (tx) => {
    const createdProduct = await tx.product.create({
      data: {
        vendorId: targetVendorId,
        title: payload.title,
        slug,
        description: payload.description || null,
        categoryId: payload.categoryId || null,
        brand: payload.brand || null,
        images: payload.images || [],
        basePrice: payload.basePrice,
        discountPrice: payload.discountPrice || null,
        totalStock,
        status: payload.status || ProductStatus.DRAFT,
        tags: payload.tags || [],
        variants:
          payload.variants && payload.variants.length > 0
            ? {
                create: payload.variants.map((v) => ({
                  sku: v.sku,
                  attributes: v.attributes as InputJsonValue,
                  price: v.price,
                  stock: v.stock ?? 0,
                  image: v.image || null,
                })),
              }
            : undefined,
      },
      include: standardProductInclude,
    });

    await invalidatePattern("products:public:*");
    return createdProduct;
  });
};

const getAllProductsPublic = async (queryParams: IQueryParams): Promise<IQueryResult<Record<string, unknown>>> => {
  const cacheKey = "products:public:" + JSON.stringify(queryParams);

  // 1. Try fetching from Redis cache
  const cachedResult = await getCache<IQueryResult<Record<string, unknown>>>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const { minPrice, maxPrice, category, categoryId, ...otherParams } = queryParams;

  const targetCategoryParam = categoryId || category;
  let categoryIdsToFilter: string[] | undefined;

  if (targetCategoryParam && typeof targetCategoryParam === "string" && targetCategoryParam !== "all") {
    // Resolve category by ID or by slug, including all child subcategories
    const matchedCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { id: targetCategoryParam },
          { slug: targetCategoryParam.toLowerCase() },
        ],
      },
      select: {
        id: true,
        children: {
          select: {
            id: true,
            children: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (matchedCategory) {
      const allIds = [matchedCategory.id];
      matchedCategory.children?.forEach((child) => {
        allIds.push(child.id);
        child.children?.forEach((grandChild) => {
          allIds.push(grandChild.id);
        });
      });
      categoryIdsToFilter = allIds;
    } else {
      categoryIdsToFilter = [targetCategoryParam];
    }
  }

  const productQuery = new QueryBuilder<Record<string, unknown>>(prisma.product, otherParams, {
    searchableFields: productSearchableFields,
    filterableFields: productFilterableFields,
  })
    .where({
      status: ProductStatus.ACTIVE,
      vendor: {
        status: VendorStatus.APPROVED,
      },
    })
    .search()
    .filter()
    .sort()
    .paginate()
    .select(productListSelect);

  // Apply resolved category filter
  if (categoryIdsToFilter && categoryIdsToFilter.length > 0) {
    if (categoryIdsToFilter.length === 1) {
      productQuery.where({ categoryId: categoryIdsToFilter[0] });
    } else {
      productQuery.where({ categoryId: { in: categoryIdsToFilter } });
    }
  }

  // Price range filters
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) priceFilter.gte = Number(minPrice);
    if (maxPrice !== undefined) priceFilter.lte = Number(maxPrice);
    productQuery.where({ basePrice: priceFilter });
  }

  const result = await productQuery.execute();

  // 2. Save result in Redis cache (60 seconds TTL)
  await setCache(cacheKey, result, 60);

  return result;
};

const getMyVendorProducts = async (user: IRequestUser, queryParams: IQueryParams) => {
  let targetVendorId = user.tenantId;

  if (!targetVendorId) {
    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!vendorProfile) {
      throw new AppError(status.NOT_FOUND, "Vendor profile not found for this user");
    }
    targetVendorId = vendorProfile.id;
  }

  const productQuery = new QueryBuilder<ProductModel>(prisma.product, queryParams, {
    searchableFields: productSearchableFields,
    filterableFields: productFilterableFields,
  })
    .where({ vendorId: targetVendorId })
    .search()
    .filter()
    .sort()
    .paginate()
    .select(productListSelect);

  return await productQuery.execute();
};

const getAllProductsAdmin = async (queryParams: IQueryParams) => {
  const productQuery = new QueryBuilder<ProductModel>(prisma.product, queryParams, {
    searchableFields: adminProductSearchableFields,
    filterableFields: productFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .select(productListSelect);

  return await productQuery.execute();
};

const getProductBySlug = async (slug: string, requester?: IRequestUser) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      ...standardProductInclude,
      vendor: {
        select: {
          id: true,
          userId: true,
          storeName: true,
          storeSlug: true,
          storeLogo: true,
          status: true,
        },
      },
      reviews: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isPrivileged =
    requester &&
    (requester.role === Role.ADMIN ||
      requester.role === Role.SUPER_ADMIN ||
      product.vendor.userId === requester.userId ||
      (requester.tenantId && product.vendorId === requester.tenantId));

  if (!isPrivileged) {
    if (product.status !== ProductStatus.ACTIVE || product.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(status.NOT_FOUND, "Product not found");
    }
  }

  return product;
};

const getProductById = async (id: string, requester?: IRequestUser) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      ...standardProductInclude,
      vendor: {
        select: {
          id: true,
          userId: true,
          storeName: true,
          storeSlug: true,
          storeLogo: true,
          status: true,
        },
      },
      reviews: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isPrivileged =
    requester &&
    (requester.role === Role.ADMIN ||
      requester.role === Role.SUPER_ADMIN ||
      product.vendor.userId === requester.userId ||
      (requester.tenantId && product.vendorId === requester.tenantId));

  if (!isPrivileged) {
    if (product.status !== ProductStatus.ACTIVE || product.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(status.NOT_FOUND, "Product not found");
    }
  }

  return product;
};

const updateProduct = async (user: IRequestUser, id: string, payload: IUpdateProductPayload) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { vendor: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isAuthorized =
    user.role === Role.ADMIN ||
    user.role === Role.SUPER_ADMIN ||
    product.vendor.userId === user.userId ||
    (user.tenantId && product.vendorId === user.tenantId);

  if (!isAuthorized) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to update this product");
  }

  if (payload.categoryId) {
    const categoryExists = await prisma.category.findUnique({
      where: { id: payload.categoryId },
    });
    if (!categoryExists) {
      throw new AppError(status.NOT_FOUND, "Category not found");
    }
  }

  if (payload.status !== undefined) {
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    if (!isAdmin && payload.status === ProductStatus.REJECTED) {
      throw new AppError(status.FORBIDDEN, "Only admins can set product status to REJECTED");
    }
  }

  let slug = product.slug;
  if (payload.slug || payload.title) {
    slug = await generateUniqueSlug(payload.slug || payload.title!, id);
  }

  // Validate variant SKUs if variants provided
  if (payload.variants !== undefined && payload.variants.length > 0) {
    const skus = payload.variants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      throw new AppError(status.BAD_REQUEST, "Duplicate SKUs provided in variant list");
    }

    const existingVariants = await prisma.productVariant.findMany({
      where: {
        sku: { in: skus },
        productId: { not: id }, // Exclude variants belonging to this product
      },
      select: { sku: true },
    });

    if (existingVariants.length > 0) {
      throw new AppError(
        status.CONFLICT,
        `SKU already exists in another product: ${existingVariants.map((v) => v.sku).join(", ")}`
      );
    }
  }

  // Calculate totalStock if variants provided or payload specifies it
  let resolvedTotalStock = payload.totalStock !== undefined ? payload.totalStock : product.totalStock;
  if (payload.variants !== undefined) {
    if (payload.variants.length > 0) {
      resolvedTotalStock = payload.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
    }
  }

  const updatedProduct = await prisma.$transaction(async (tx) => {
    // If variants array is explicitly passed, sync variants
    if (payload.variants !== undefined) {
      // Remove all existing variants for this product
      await tx.productVariant.deleteMany({
        where: { productId: id },
      });

      // Insert new variants if any provided
      if (payload.variants.length > 0) {
        await tx.productVariant.createMany({
          data: payload.variants.map((v) => ({
            productId: id,
            sku: v.sku,
            attributes: (v.attributes || {}) as InputJsonValue,
            price: v.price,
            stock: v.stock ?? 0,
            image: v.image || null,
          })),
        });
      }
    }

    return await tx.product.update({
      where: { id },
      data: {
        ...(payload.title !== undefined && { title: payload.title }),
        slug,
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
        ...(payload.brand !== undefined && { brand: payload.brand }),
        ...(payload.images !== undefined && { images: payload.images }),
        ...(payload.basePrice !== undefined && { basePrice: payload.basePrice }),
        ...(payload.discountPrice !== undefined && { discountPrice: payload.discountPrice }),
        totalStock: resolvedTotalStock,
        ...(payload.tags !== undefined && { tags: payload.tags }),
        ...(payload.status !== undefined && { status: payload.status }),
      },
      include: standardProductInclude,
    });
  });

  await invalidatePattern("products:public:*");
  return updatedProduct;
};

const deleteProduct = async (user: IRequestUser, id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { vendor: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isAuthorized =
    user.role === Role.ADMIN ||
    user.role === Role.SUPER_ADMIN ||
    product.vendor.userId === user.userId ||
    (user.tenantId && product.vendorId === user.tenantId);

  if (!isAuthorized) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to delete this product");
  }

  const deletedProduct = await prisma.product.delete({
    where: { id },
  });

  await invalidatePattern("products:public:*");
  return deletedProduct;
};

const updateProductStatus = async (user: IRequestUser, id: string, payload: IUpdateProductStatusPayload) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { vendor: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
  const isOwnerOrStaff = product.vendor.userId === user.userId || (user.tenantId && product.vendorId === user.tenantId);

  if (!isAdmin && !isOwnerOrStaff) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to change status for this product");
  }

  // Non-admins cannot set status to REJECTED (only platform admins can reject)
  if (!isAdmin && payload.status === ProductStatus.REJECTED) {
    throw new AppError(status.FORBIDDEN, "Only admins can set product status to REJECTED");
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: { status: payload.status },
    include: standardProductInclude,
  });

  await invalidatePattern("products:public:*");
  return updatedProduct;
};
export const ProductService = {
  createProduct,
  getAllProductsPublic,
  getMyVendorProducts,
  getAllProductsAdmin,
  getProductBySlug,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductStatus,
};
