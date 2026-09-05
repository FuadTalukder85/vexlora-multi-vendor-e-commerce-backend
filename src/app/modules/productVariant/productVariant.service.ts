import status from "http-status";
import { ProductStatus, Role, VendorStatus } from "../../../generated/prisma/enums";
import type { InputJsonValue } from "../../../generated/prisma/internal/prismaNamespace";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../../types/request.types";
import { standardProductVariantInclude } from "./productVariant.constant";
import { ICreateProductVariantPayload, IUpdateProductVariantPayload } from "./productVariant.interface";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Synchronizes parent product's totalStock based on sum of variant stocks.
 * Automatically marks product as OUT_OF_STOCK if totalStock reaches 0.
 */
export const syncProductTotalStock = async (tx: TransactionClient, productId: string): Promise<number> => {
  const variants = await tx.productVariant.findMany({
    where: { productId },
    select: { stock: true },
  });

  if (variants.length > 0) {
    const totalStock = variants.reduce((sum: number, v: { stock: number }) => sum + v.stock, 0);
    await tx.product.update({
      where: { id: productId },
      data: {
        totalStock,
        ...(totalStock === 0 ? { status: ProductStatus.OUT_OF_STOCK } : {}),
      },
    });
    return totalStock;
  }

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { totalStock: true },
  });
  return product?.totalStock ?? 0;
};

const addVariant = async (userId: string, userRole: Role, productId: string, payload: ICreateProductVariantPayload) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isAuthorized = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN || product.vendor.userId === userId;

  if (!isAuthorized) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to add variants to this product");
  }

  const existingSku = await prisma.productVariant.findUnique({
    where: { sku: payload.sku },
  });

  if (existingSku) {
    throw new AppError(status.CONFLICT, `SKU '${payload.sku}' already exists`);
  }

  return await prisma.$transaction(async (tx) => {
    const createdVariant = await tx.productVariant.create({
      data: {
        productId,
        sku: payload.sku,
        attributes: payload.attributes as InputJsonValue,
        price: payload.price,
        stock: payload.stock ?? 0,
        image: payload.image || null,
      },
    });

    await syncProductTotalStock(tx, productId);

    return createdVariant;
  });
};

const getVariantsByProductId = async (productId: string, requester?: IRequestUser) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: true },
  });

  if (!product) {
    throw new AppError(status.NOT_FOUND, "Product not found");
  }

  const isPrivileged =
    requester &&
    (requester.role === Role.ADMIN ||
      requester.role === Role.SUPER_ADMIN ||
      product.vendor.userId === requester.userId);

  if (!isPrivileged) {
    if (product.status !== ProductStatus.ACTIVE || product.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(status.NOT_FOUND, "Product not found");
    }
  }

  return await prisma.productVariant.findMany({
    where: { productId },
  });
};

const getVariantById = async (variantId: string, requester?: IRequestUser) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: standardProductVariantInclude,
  });

  if (!variant) {
    throw new AppError(status.NOT_FOUND, "Product variant not found");
  }

  const isPrivileged =
    requester &&
    (requester.role === Role.ADMIN ||
      requester.role === Role.SUPER_ADMIN ||
      variant.product.vendor.userId === requester.userId);

  if (!isPrivileged) {
    if (variant.product.status !== ProductStatus.ACTIVE || variant.product.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(status.NOT_FOUND, "Product variant not found");
    }
  }

  return variant;
};

const getVariantBySku = async (sku: string, requester?: IRequestUser) => {
  const variant = await prisma.productVariant.findUnique({
    where: { sku },
    include: standardProductVariantInclude,
  });

  if (!variant) {
    throw new AppError(status.NOT_FOUND, `Product variant with SKU '${sku}' not found`);
  }

  const isPrivileged =
    requester &&
    (requester.role === Role.ADMIN ||
      requester.role === Role.SUPER_ADMIN ||
      variant.product.vendor.userId === requester.userId);

  if (!isPrivileged) {
    if (variant.product.status !== ProductStatus.ACTIVE || variant.product.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(status.NOT_FOUND, "Product variant not found");
    }
  }

  return variant;
};

const updateVariant = async (
  userId: string,
  userRole: Role,
  variantId: string,
  payload: IUpdateProductVariantPayload,
) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { vendor: true } } },
  });

  if (!variant) {
    throw new AppError(status.NOT_FOUND, "Product variant not found");
  }

  const isAuthorized =
    userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN || variant.product.vendor.userId === userId;

  if (!isAuthorized) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to update this variant");
  }

  if (payload.sku && payload.sku !== variant.sku) {
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: payload.sku },
    });
    if (existingSku && existingSku.id !== variantId) {
      throw new AppError(status.CONFLICT, `SKU '${payload.sku}' already exists`);
    }
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        ...(payload.sku !== undefined && { sku: payload.sku }),
        ...(payload.attributes !== undefined && { attributes: payload.attributes as InputJsonValue }),
        ...(payload.price !== undefined && { price: payload.price }),
        ...(payload.stock !== undefined && { stock: payload.stock }),
        ...(payload.image !== undefined && { image: payload.image }),
      },
    });

    if (payload.stock !== undefined) {
      await syncProductTotalStock(tx, variant.productId);
    }

    return updated;
  });
};

const deleteVariant = async (userId: string, userRole: Role, variantId: string) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { vendor: true } } },
  });

  if (!variant) {
    throw new AppError(status.NOT_FOUND, "Product variant not found");
  }

  const isAuthorized =
    userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN || variant.product.vendor.userId === userId;

  if (!isAuthorized) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to delete this variant");
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.productVariant.delete({
      where: { id: variantId },
    });

    await syncProductTotalStock(tx, variant.productId);

    return deleted;
  });
};

export const ProductVariantService = {
  syncProductTotalStock,
  addVariant,
  getVariantsByProductId,
  getVariantById,
  getVariantBySku,
  updateVariant,
  deleteVariant,
};
