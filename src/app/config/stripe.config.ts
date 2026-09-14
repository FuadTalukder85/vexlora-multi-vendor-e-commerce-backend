import status from "http-status";
import Stripe from "stripe";
import AppError from "../errors/AppError";
import { envVars } from "./env";

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!envVars.STRIPE.SECRET_KEY || envVars.STRIPE.SECRET_KEY.includes("placeholder")) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      "Stripe Secret Key is not configured. Please set STRIPE_SECRET_KEY in your environment variables.",
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(envVars.STRIPE.SECRET_KEY, {
      typescript: true,
    });
  }

  return stripeClient;
};
