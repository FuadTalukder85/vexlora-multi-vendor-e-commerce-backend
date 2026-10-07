import status from "http-status";
import { SubOrderStatus, VendorStatus } from "../../../generated/prisma/enums";
import { SubOrderModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { IRequestUser } from "../../types/request.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { standardSubOrderInclude, subOrderFilterableFields, subOrderSearchableFields } from "./subOrder.constant";
import { IUpdateSubOrderStatusPayload } from "./subOrder.interface";

const resolveVendorIdForUser = async (user: IRequestUser): Promise<string> => {
  let vendorId = user.tenantId;

  if (!vendorId) {
    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true, status: true },
    });

    if (!vendorProfile) {
      throw new AppError(status.FORBIDDEN, "You do not have an associated vendor store");
    }

    vendorId = vendorProfile.id;
  }

  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true, status: true },
  });

  if (!vendor || vendor.status !== VendorStatus.APPROVED) {
    throw new AppError(status.FORBIDDEN, "Vendor store is not active or approved");
  }

  return vendor.id;
};

const getVendorSubOrders = async (user: IRequestUser, queryParams: IQueryParams) => {
  const vendorId = await resolveVendorIdForUser(user);

  const subOrderQuery = new QueryBuilder<SubOrderModel>(prisma.subOrder, queryParams, {
    searchableFields: subOrderSearchableFields,
    filterableFields: subOrderFilterableFields,
  })
    .where({ vendorId })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(standardSubOrderInclude);

  return await subOrderQuery.execute();
};

const getVendorSubOrderById = async (user: IRequestUser, subOrderId: string) => {
  const vendorId = await resolveVendorIdForUser(user);

  const subOrder = await prisma.subOrder.findFirst({
    where: {
      id: subOrderId,
      vendorId,
    },
    include: standardSubOrderInclude,
  });

  if (!subOrder) {
    throw new AppError(status.NOT_FOUND, "Sub-order not found");
  }

  return subOrder;
};

const updateVendorSubOrderStatus = async (
  user: IRequestUser,
  subOrderId: string,
  payload: IUpdateSubOrderStatusPayload,
) => {
  const vendorId = await resolveVendorIdForUser(user);

  const subOrder = await prisma.subOrder.findFirst({
    where: {
      id: subOrderId,
      vendorId,
    },
    include: {
      items: true,
    },
  });

  if (!subOrder) {
    throw new AppError(status.NOT_FOUND, "Sub-order not found");
  }

  if (subOrder.status === SubOrderStatus.CANCELLED) {
    throw new AppError(status.BAD_REQUEST, "Cannot update status of an already cancelled sub-order");
  }

  if (subOrder.status === SubOrderStatus.DELIVERED) {
    throw new AppError(status.BAD_REQUEST, "Sub-order has already been delivered");
  }

  return await prisma.$transaction(async (tx) => {
    // If vendor cancels sub-order, restore inventory
    if (payload.status === SubOrderStatus.CANCELLED) {
      for (const item of subOrder.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { totalStock: { increment: item.quantity } },
        });
      }
    }

    const shippedAt =
      payload.status === SubOrderStatus.SHIPPED && !subOrder.shippedAt ? new Date() : subOrder.shippedAt;

    const deliveredAt =
      payload.status === SubOrderStatus.DELIVERED && !subOrder.deliveredAt ? new Date() : subOrder.deliveredAt;

    return await tx.subOrder.update({
      where: { id: subOrderId },
      data: {
        status: payload.status,
        trackingNumber: payload.trackingNumber ?? subOrder.trackingNumber,
        shippedAt,
        deliveredAt,
      },
      include: standardSubOrderInclude,
    });
  });
};

const getAllSubOrdersAdmin = async (queryParams: IQueryParams) => {
  const subOrderQuery = new QueryBuilder<SubOrderModel>(prisma.subOrder, queryParams, {
    searchableFields: subOrderSearchableFields,
    filterableFields: subOrderFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(standardSubOrderInclude);

  return await subOrderQuery.execute();
};

const getSubOrderByIdAdmin = async (subOrderId: string) => {
  const subOrder = await prisma.subOrder.findUnique({
    where: { id: subOrderId },
    include: standardSubOrderInclude,
  });

  if (!subOrder) {
    throw new AppError(status.NOT_FOUND, "Sub-order not found");
  }

  return subOrder;
};

const updateSubOrderStatusAdmin = async (subOrderId: string, payload: IUpdateSubOrderStatusPayload) => {
  const subOrder = await prisma.subOrder.findUnique({
    where: { id: subOrderId },
    include: {
      items: true,
    },
  });

  if (!subOrder) {
    throw new AppError(status.NOT_FOUND, "Sub-order not found");
  }

  return await prisma.$transaction(async (tx) => {
    if (payload.status === SubOrderStatus.CANCELLED && subOrder.status !== SubOrderStatus.CANCELLED) {
      for (const item of subOrder.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { totalStock: { increment: item.quantity } },
        });
      }
    }

    const shippedAt =
      payload.status === SubOrderStatus.SHIPPED && !subOrder.shippedAt ? new Date() : subOrder.shippedAt;

    const deliveredAt =
      payload.status === SubOrderStatus.DELIVERED && !subOrder.deliveredAt ? new Date() : subOrder.deliveredAt;

    return await tx.subOrder.update({
      where: { id: subOrderId },
      data: {
        status: payload.status,
        trackingNumber: payload.trackingNumber ?? subOrder.trackingNumber,
        shippedAt,
        deliveredAt,
      },
      include: standardSubOrderInclude,
    });
  });
};

export const SubOrderService = {
  getVendorSubOrders,
  getVendorSubOrderById,
  updateVendorSubOrderStatus,
  getAllSubOrdersAdmin,
  getSubOrderByIdAdmin,
  updateSubOrderStatusAdmin,
};
