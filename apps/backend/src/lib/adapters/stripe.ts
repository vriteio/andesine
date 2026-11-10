// SPDX-License-Identifier: Elastic-2.0
// License terms: apps/backend/src/services/billing/LICENSE
import Stripe from "stripe";
import { config } from "#backend/lib/config";

const stripe = config.BILLING_ENABLED ? new Stripe(config.STRIPE_SECRET_KEY!) : null;

export { stripe };
