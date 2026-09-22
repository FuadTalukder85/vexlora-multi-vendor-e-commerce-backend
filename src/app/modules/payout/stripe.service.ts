import status from "http-status";
import { envVars } from "../../config/env";
import { getStripeClient } from "../../config/stripe.config";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../../types/request.types";

const createOrGetConnectAccount = async (vendorId: string, email: string, businessName: string) => {
  const stripe = getStripeClient();

  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true, stripeAccountId: true, storeName: true },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  if (vendor.stripeAccountId) {
    try {
      const existingAccount = await stripe.accounts.retrieve(vendor.stripeAccountId);
      return existingAccount;
    } catch {
      // If account no longer exists in Stripe (e.g. wiped in test mode), recreate
    }
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: email.trim().toLowerCase(),
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    business_profile: {
      name: businessName || vendor.storeName,
    },
    metadata: {
      vendorId: vendor.id,
    },
  });

  await prisma.vendorProfile.update({
    where: { id: vendorId },
    data: { stripeAccountId: account.id },
  });

  return account;
};

const createAccountOnboardingLink = async (user: IRequestUser, vendorId: string) => {
  const stripe = getStripeClient();

  const userRecord = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true },
  });

  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { storeName: true },
  });

  const email = userRecord?.email || "";
  const storeName = vendor?.storeName || "Vendor Store";

  const account = await createOrGetConnectAccount(vendorId, email, storeName);

  const vendorBaseUrl = envVars.VENDOR_CLIENT_URL || envVars.CLIENT_URL;
  const returnUrl = `${vendorBaseUrl}/payouts?status=stripe_success`;
  const refreshUrl = `${vendorBaseUrl}/payouts?status=stripe_refresh`;

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return {
    url: accountLink.url,
    stripeAccountId: account.id,
    expiresAt: accountLink.expires_at,
  };
};

const getConnectAccountStatus = async (vendorId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true, stripeAccountId: true },
  });

  if (!vendor) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  if (!vendor.stripeAccountId) {
    return {
      hasAccount: false,
      stripeAccountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      requirements: [],
    };
  }

  const stripe = getStripeClient();

  try {
    const account = await stripe.accounts.retrieve(vendor.stripeAccountId);

    return {
      hasAccount: true,
      stripeAccountId: account.id,
      detailsSubmitted: account.details_submitted ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      chargesEnabled: account.charges_enabled ?? false,
      requirements: account.requirements?.currently_due || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to retrieve Stripe account status";
    throw new AppError(status.BAD_GATEWAY, errorMessage);
  }
};

const createExpressDashboardLink = async (vendorId: string) => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { stripeAccountId: true },
  });

  if (!vendor || !vendor.stripeAccountId) {
    throw new AppError(
      status.BAD_REQUEST,
      "You do not have a connected Stripe account. Please onboard to Stripe first.",
    );
  }

  const stripe = getStripeClient();

  try {
    const loginLink = await stripe.accounts.createLoginLink(vendor.stripeAccountId);
    return {
      url: loginLink.url,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate Stripe dashboard login link";
    throw new AppError(status.BAD_GATEWAY, errorMessage);
  }
};

const executeTransferToVendor = async (
  payoutId: string,
  amount: number,
  destinationStripeAccountId: string,
): Promise<string> => {
  const stripe = getStripeClient();

  // Convert dollars to cents for Stripe
  const amountInCents = Math.round(amount * 100);

  if (amountInCents <= 0) {
    throw new AppError(status.BAD_REQUEST, "Transfer amount must be greater than zero");
  }

  // Pre-check available platform balance in Stripe
  try {
    const balance = await stripe.balance.retrieve();
    const currency = (envVars.STRIPE.CURRENCY || "usd").toLowerCase();
    
    const availableForCurrency = balance.available.find((b) => b.currency.toLowerCase() === currency)?.amount || 0;
    const pendingForCurrency = balance.pending.find((b) => b.currency.toLowerCase() === currency)?.amount || 0;

    if (availableForCurrency < amountInCents) {
      const availableDollars = (availableForCurrency / 100).toFixed(2);
      const pendingDollars = (pendingForCurrency / 100).toFixed(2);
      const requiredDollars = amount.toFixed(2);

      throw new AppError(
        status.BAD_REQUEST,
        `Insufficient available Stripe balance ($${availableDollars} available, but payout requires $${requiredDollars}). Customer payment funds ($${pendingDollars}) are currently clearing in Stripe's 2-day rolling clearance window. Please wait for pending balance to settle or top up your Stripe balance.`,
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Non-blocking if balance check fails due to network, let transfers.create attempt
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: envVars.STRIPE.CURRENCY || "usd",
      destination: destinationStripeAccountId,
      transfer_group: payoutId,
      metadata: {
        payoutId,
      },
    });

    return transfer.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Stripe transfer failed";
    throw new AppError(status.BAD_GATEWAY, `Stripe transfer error: ${errorMessage}`);
  }
};

const handleStripeWebhookEvent = async (rawBody: string | Buffer, signature: string) => {
  if (!envVars.STRIPE.WEBHOOK_SECRET || envVars.STRIPE.WEBHOOK_SECRET.includes("placeholder")) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Stripe Webhook Secret is not configured. Please set STRIPE_WEBHOOK_SECRET in .env.",
    );
  }

  const stripe = getStripeClient();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, envVars.STRIPE.WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Stripe webhook signature";
    throw new AppError(status.BAD_REQUEST, `Webhook Signature Verification Failed: ${message}`);
  }

  switch (event.type) {
    case "account.updated": {
      // Vendor updated their Express account info or completed onboarding
      const account = event.data.object;
      const vendorId = account.metadata?.vendorId;
      if (vendorId && account.details_submitted) {
        await prisma.vendorProfile.update({
          where: { id: vendorId },
          data: { stripeAccountId: account.id },
        });
      }
      break;
    }

    case "transfer.created": {
      const transfer = event.data.object;
      const payoutId = transfer.metadata?.payoutId;
      if (payoutId) {
        await prisma.payout.update({
          where: { id: payoutId },
          data: {
            stripeTransferId: transfer.id,
          },
        });
      }
      break;
    }

    default:
      break;
  }

  return { received: true, eventType: event.type };
};

const getStripePlatformBalance = async () => {
  const stripe = getStripeClient();
  const balance = await stripe.balance.retrieve();

  const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
  const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
  const currency = balance.available[0]?.currency?.toUpperCase() || "USD";

  return {
    available,
    pending,
    currency,
  };
};

export const StripeService = {
  createOrGetConnectAccount,
  createAccountOnboardingLink,
  getConnectAccountStatus,
  createExpressDashboardLink,
  executeTransferToVendor,
  handleStripeWebhookEvent,
  getStripePlatformBalance,
};
