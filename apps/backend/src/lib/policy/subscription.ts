// SPDX-License-Identifier: Elastic-2.0
// License terms: apps/backend/src/services/billing/LICENSE
const isTerminalSubscription = (status: string): boolean => {
  return status === "canceled" || status === "incomplete_expired";
};

export { isTerminalSubscription };
