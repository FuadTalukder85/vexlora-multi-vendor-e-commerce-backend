import status from "http-status";
import {
  PaymentStatus,
  ProductStatus,
  SubOrderStatus,
  PayoutStatus,
  VendorStatus,
} from "../../../generated/prisma/enums";
import { OrderModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { IRequestUser } from "../../types/request.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { orderFilterableFields, orderSearchableFields, standardOrderInclude } from "./order.constant";
import { envVars } from "../../config/env";
import { getStripeClient } from "../../config/stripe.config";
import {
  ICreateOrderItemPayload,
  ICreateOrderPayload,
  ICreatePaymentIntentPayload,
  IUpdatePaymentStatusPayload,
} from "./order.interface";
import { CouponService } from "../coupon/coupon.service";
import { CouponUsageLogService } from "../couponUsageLog/couponUsageLog.service";

const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${randomPart}`;
};

interface IProcessedItem {
  productId: string;
  variantId?: string | null;
  name: string;
  price: number;
  quantity: number;
  vendorId: string;
}

interface IVendorSubOrderData {
  vendorId: string;
  subtotal: number;
  commissionAmount: number;
  vendorEarning: number;
  items: IProcessedItem[];
}

const calculateOrderDetails = async (
  user: IRequestUser,
  payload: {
    items?: ICreateOrderItemPayload[];
    selectedCartItemIds?: string[];
    shippingAddressId?: string;
    couponCode?: string;
  },
) => {
  let orderItemsToProcess = payload.items;

  // 1. If selectedCartItemIds provided, resolve from user's CartItem database records
  if (payload.selectedCartItemIds && payload.selectedCartItemIds.length > 0) {
    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: payload.selectedCartItemIds },
        userId: user.userId,
      },
    });

    if (cartItems.length !== payload.selectedCartItemIds.length) {
      throw new AppError(
        status.BAD_REQUEST,
        "One or more selected cart items were not found or do not belong to your account",
      );
    }

    orderItemsToProcess = cartItems.map((ci) => ({
      productId: ci.productId,
      variantId: ci.variantId || undefined,
      quantity: ci.quantity,
    }));
  }

  if (!orderItemsToProcess || orderItemsToProcess.length === 0) {
    throw new AppError(status.BAD_REQUEST, "Order must contain at least one item");
  }

  // Validate shipping address if provided
  if (payload.shippingAddressId) {
    const address = await prisma.address.findFirst({
      where: {
        id: payload.shippingAddressId,
        userId: user.userId,
      },
    });

    if (!address) {
      throw new AppError(status.BAD_REQUEST, "Invalid shipping address provided");
    }
  }

  // Fetch unique product IDs from DB (never trust frontend prices or vendors)
  const productIds = Array.from(new Set(orderItemsToProcess.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
    include: {
      variants: true,
      vendor: {
        select: {
          id: true,
          status: true,
          commissionRate: true,
        },
      },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const processedItems: IProcessedItem[] = [];

  for (const item of orderItemsToProcess) {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new AppError(status.NOT_FOUND, `Product not found with id: ${item.productId}`);
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new AppError(status.BAD_REQUEST, `Product "${product.title}" is currently not available for purchase`);
    }

    if (product.vendor.status !== VendorStatus.APPROVED) {
      throw new AppError(status.BAD_REQUEST, `Vendor for product "${product.title}" is currently not accepting orders`);
    }

    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);

      if (!variant) {
        throw new AppError(status.NOT_FOUND, `Variant not found for product "${product.title}"`);
      }

      if (variant.stock < item.quantity) {
        throw new AppError(
          status.BAD_REQUEST,
          `Insufficient stock for "${product.title}" (${variant.sku}). Available: ${variant.stock}, Requested: ${item.quantity}`,
        );
      }

      processedItems.push({
        productId: product.id,
        variantId: variant.id,
        name: `${product.title} (${variant.sku})`,
        price: Number(variant.price),
        quantity: item.quantity,
        vendorId: product.vendorId,
      });
    } else {
      if (product.totalStock < item.quantity) {
        throw new AppError(
          status.BAD_REQUEST,
          `Insufficient stock for "${product.title}". Available: ${product.totalStock}, Requested: ${item.quantity}`,
        );
      }

      const activePrice = product.discountPrice ? Number(product.discountPrice) : Number(product.basePrice);

      processedItems.push({
        productId: product.id,
        variantId: null,
        name: product.title,
        price: activePrice,
        quantity: item.quantity,
        vendorId: product.vendorId,
      });
    }
  }

  // Group items by vendor to calculate sub-orders
  const vendorGroupMap = new Map<string, IProcessedItem[]>();
  for (const item of processedItems) {
    const group = vendorGroupMap.get(item.vendorId) || [];
    group.push(item);
    vendorGroupMap.set(item.vendorId, group);
  }

  const vendorSubOrders: IVendorSubOrderData[] = [];
  let totalItemAmount = 0;

  for (const [vendorId, items] of vendorGroupMap.entries()) {
    const firstProduct = products.find((p) => p.vendorId === vendorId);
    const commissionRate = firstProduct?.vendor?.commissionRate ? Number(firstProduct.vendor.commissionRate) : 10;

    const subtotal = Number(items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0).toFixed(2));
    const commissionAmount = Number(((subtotal * commissionRate) / 100).toFixed(2));
    const vendorEarning = Number((subtotal - commissionAmount).toFixed(2));

    totalItemAmount = Number((totalItemAmount + subtotal).toFixed(2));

    vendorSubOrders.push({
      vendorId,
      subtotal,
      commissionAmount,
      vendorEarning,
      items,
    });
  }

  // Validate and calculate coupon discount if provided
  let couponDiscount = 0;
  let appliedCouponCode: string | null = null;

  if (payload.couponCode) {
    const couponValidation = await CouponService.validateAndApplyCoupon(
      {
        code: payload.couponCode,
        items: processedItems.map((item) => ({
          productId: item.productId,
          vendorId: item.vendorId,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: totalItemAmount,
      },
      user.userId,
    );

    couponDiscount = couponValidation.discountAmount;
    appliedCouponCode = couponValidation.coupon.code;
  }

  // Shipping Fee: Free shipping if item subtotal >= $100, else $15
  const isFreeShipping = totalItemAmount >= 100;
  const shippingFee = isFreeShipping ? 0 : totalItemAmount > 0 ? 15 : 0;
  const finalTotalAmount = Number(Math.max(0, totalItemAmount - couponDiscount + shippingFee).toFixed(2));

  return {
    orderItemsToProcess,
    processedItems,
    products,
    vendorSubOrders,
    totalItemAmount,
    couponDiscount,
    appliedCouponCode,
    shippingFee,
    finalTotalAmount,
  };
};

const createPaymentIntent = async (user: IRequestUser, payload: ICreatePaymentIntentPayload) => {
  const details = await calculateOrderDetails(user, payload);

  const stripe = getStripeClient();
  const amountInCents = Math.round(details.finalTotalAmount * 100);

  if (amountInCents <= 0) {
    throw new AppError(status.BAD_REQUEST, "Total amount must be greater than zero to create a payment intent");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: envVars.STRIPE.CURRENCY || "usd",
    // Explicitly card-only to match frontend Elements restriction.
    // Avoids redirect-based payment methods (Apple Pay, Google Pay, Link)
    // which cause elements.submit() to hang on HTTP localhost.
    payment_method_types: ["card"],
    metadata: {
      userId: user.userId,
      selectedCartItemIds: payload.selectedCartItemIds?.join(",") || "",
      couponCode: details.appliedCouponCode || "",
      shippingAddressId: payload.shippingAddressId || "",
    },
  });

  const publishableKey =
    envVars.STRIPE.PUBLISHABLE_KEY ||
    (envVars.STRIPE.SECRET_KEY.startsWith("sk_test_")
      ? envVars.STRIPE.SECRET_KEY.replace(/^sk_test_/, "pk_test_")
      : "");

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: details.finalTotalAmount,
    currency: envVars.STRIPE.CURRENCY || "usd",
    publishableKey,
  };
};

const createOrder = async (user: IRequestUser, payload: ICreateOrderPayload) => {
  const details = await calculateOrderDetails(user, payload);

  const paymentMethod = payload.paymentMethod?.toLowerCase() || "cod";

  // If payment method is Stripe card payment, strictly verify successful payment FIRST
  if (paymentMethod === "stripe") {
    if (!payload.paymentIntentId) {
      throw new AppError(
        status.BAD_REQUEST,
        "PaymentIntent ID is required for Stripe card payments. Please complete payment first.",
      );
    }

    const stripe = getStripeClient();
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(payload.paymentIntentId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to retrieve PaymentIntent from Stripe";
      throw new AppError(status.BAD_REQUEST, `Invalid PaymentIntent: ${msg}`);
    }

    if (paymentIntent.status !== "succeeded") {
      throw new AppError(
        status.PAYMENT_REQUIRED,
        `Payment has not been completed (status: ${paymentIntent.status}). Orders cannot be created or confirmed without successful payment.`,
      );
    }

    const expectedAmountInCents = Math.round(details.finalTotalAmount * 100);
    if (paymentIntent.amount < expectedAmountInCents) {
      throw new AppError(
        status.BAD_REQUEST,
        `Payment amount mismatch. Expected: $${details.finalTotalAmount}, but paid: $${(paymentIntent.amount / 100).toFixed(2)}`,
      );
    }

    // Ensure this payment intent has not been reused on an existing order
    const existingOrderWithIntent = await prisma.order.findFirst({
      where: { paymentIntentId: payload.paymentIntentId },
    });

    if (existingOrderWithIntent) {
      throw new AppError(
        status.CONFLICT,
        "This payment has already been associated with an existing order.",
      );
    }
  }

  const orderNumber = generateOrderNumber();
  const initialPaymentStatus = paymentMethod === "stripe" ? PaymentStatus.PAID : PaymentStatus.PENDING;

  // Execute database transaction: atomic stock decrement, create Order, SubOrders, OrderItems, CouponUsageLog, & clean up selected cart items
  return await prisma.$transaction(async (tx) => {
    // 1. Concurrency-safe atomic stock decrement
    for (const item of details.processedItems) {
      if (item.variantId) {
        const variantUpdate = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (variantUpdate.count === 0) {
          throw new AppError(
            status.BAD_REQUEST,
            `Insufficient stock for "${item.name}". Stock was changed or exhausted by another order.`,
          );
        }

        const productUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            totalStock: { gte: item.quantity },
          },
          data: {
            totalStock: { decrement: item.quantity },
          },
        });

        if (productUpdate.count === 0) {
          throw new AppError(
            status.BAD_REQUEST,
            `Insufficient total stock for product "${item.name}".`,
          );
        }
      } else {
        const productUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            totalStock: { gte: item.quantity },
          },
          data: {
            totalStock: { decrement: item.quantity },
          },
        });

        if (productUpdate.count === 0) {
          throw new AppError(
            status.BAD_REQUEST,
            `Insufficient stock for product "${item.name}". Stock was changed or exhausted by another order.`,
          );
        }
      }
    }

    // 2. Create Order with nested SubOrders and OrderItems
    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId: user.userId,
        shippingAddressId: payload.shippingAddressId ?? null,
        totalAmount: details.finalTotalAmount,
        paymentStatus: initialPaymentStatus,
        paymentMethod,
        paymentIntentId: paymentMethod === "stripe" ? payload.paymentIntentId : null,
        couponCode: details.appliedCouponCode,
        couponDiscount: details.couponDiscount > 0 ? details.couponDiscount : null,
        subOrders: {
          create: details.vendorSubOrders.map((subOrder) => ({
            vendorId: subOrder.vendorId,
            subtotal: subOrder.subtotal,
            commissionAmount: subOrder.commissionAmount,
            vendorEarning: subOrder.vendorEarning,
            status: SubOrderStatus.PENDING,
            payoutStatus: PayoutStatus.UNPAID,
            items: {
              create: subOrder.items.map((it) => ({
                productId: it.productId,
                variantId: it.variantId,
                name: it.name,
                price: it.price,
                quantity: it.quantity,
              })),
            },
          })),
        },
      },
      include: standardOrderInclude,
    });

    // 3. Record coupon usage log & atomically increment coupon usedCount
    if (details.appliedCouponCode) {
      await CouponUsageLogService.recordCouponUsage(
        {
          couponCode: details.appliedCouponCode,
          userId: user.userId,
          orderId: createdOrder.id,
          discountAmount: details.couponDiscount,
        },
        tx,
      );
    }

    // 4. Cart Cleanup: Remove ONLY the selected items from the user's cart (unselected remain untouched)
    if (payload.selectedCartItemIds && payload.selectedCartItemIds.length > 0) {
      await tx.cartItem.deleteMany({
        where: {
          id: { in: payload.selectedCartItemIds },
          userId: user.userId,
        },
      });
    }

    return createdOrder;
  });
};

const getMyOrders = async (userId: string, queryParams: IQueryParams) => {
  const orderQuery = new QueryBuilder<OrderModel>(prisma.order, queryParams, {
    searchableFields: orderSearchableFields,
    filterableFields: orderFilterableFields,
  })
    .where({ customerId: userId })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(standardOrderInclude);

  return await orderQuery.execute();
};

const getMyOrderById = async (userId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: userId,
    },
    include: standardOrderInclude,
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  return order;
};

const cancelMyOrder = async (userId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: userId,
    },
    include: {
      subOrders: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  // Check if any subOrder has already been shipped or delivered
  const nonCancellable = order.subOrders.some(
    (so) => so.status === SubOrderStatus.SHIPPED || so.status === SubOrderStatus.DELIVERED,
  );

  if (nonCancellable) {
    throw new AppError(
      status.BAD_REQUEST,
      "Order cannot be cancelled because one or more packages are already in transit or delivered",
    );
  }

  return await prisma.$transaction(async (tx) => {
    // Restore stock for all order items
    for (const subOrder of order.subOrders) {
      if (subOrder.status !== SubOrderStatus.CANCELLED) {
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
    }

    // Cancel all subOrders
    await tx.subOrder.updateMany({
      where: { orderId: order.id },
      data: { status: SubOrderStatus.CANCELLED },
    });

    // Update order payment status to REFUNDED if was PAID, otherwise keep PENDING/FAILED
    const updatedPaymentStatus =
      order.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : order.paymentStatus;

    return await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: updatedPaymentStatus,
      },
      include: standardOrderInclude,
    });
  });
};

const getAllOrdersAdmin = async (queryParams: IQueryParams) => {
  const orderQuery = new QueryBuilder<OrderModel>(prisma.order, queryParams, {
    searchableFields: orderSearchableFields,
    filterableFields: orderFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(standardOrderInclude);

  return await orderQuery.execute();
};

const getOrderByIdAdmin = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: standardOrderInclude,
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  return order;
};

const updatePaymentStatusAdmin = async (orderId: string, payload: IUpdatePaymentStatusPayload) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, "Order not found");
  }

  return await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: payload.paymentStatus,
      paymentIntentId: payload.paymentIntentId ?? order.paymentIntentId,
    },
    include: standardOrderInclude,
  });
};

const trackOrderByNumber = async (orderNumber: string, email?: string) => {
  const whereClause: { orderNumber: string; customer?: { email: string } } = {
    orderNumber: orderNumber.trim(),
  };

  if (email) {
    whereClause.customer = {
      email: email.trim().toLowerCase(),
    };
  }

  const order = await prisma.order.findFirst({
    where: whereClause,
    include: {
      ...standardOrderInclude,
      subOrders: {
        include: {
          vendor: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              storeLogo: true,
              ratingAvg: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  images: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  sku: true,
                  attributes: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError(status.NOT_FOUND, `No order found with order number "${orderNumber}"`);
  }

  return order;
};

export const OrderService = {
  createPaymentIntent,
  createOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
  getAllOrdersAdmin,
  getOrderByIdAdmin,
  updatePaymentStatusAdmin,
  trackOrderByNumber,
};
