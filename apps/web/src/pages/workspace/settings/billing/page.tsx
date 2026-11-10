import { type Component, createEffect, createSignal, Show, useTransition } from "solid-js";

import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { useSearchParams, revalidate } from "@solidjs/router";
import { SubscriptionSection } from "./subscription-section";
import { UsageSection } from "./usage-section";
import { SpendingSection } from "./spending-section";
import { HistorySection } from "./history-section";
import { BillingProcessingDialog } from "./processing-dialog";

const BillingSettingsPage: Component = () => {
  const notify = useNotify();
  const { currentWorkspace, workspaceID } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [processingCheckout, setProcessingCheckout] = createSignal(false);
  // A past month chosen in the usage or the history; the current month without one.
  const [selectedMonth, setSelectedMonth] = createSignal<string>();
  // The month whose usage shows, kept until the selected one loads.
  const [usageMonth, setUsageMonth] = createSignal<string>();
  const [loadingMonth, startMonthChange] = useTransition();
  const changeMonth = (month: string | undefined) => {
    setSelectedMonth(month);
    void startMonthChange(() => setUsageMonth(month));
  };

  createEffect(() => {
    const result = searchParams.billing;
    const currentWorkspaceID = workspaceID();

    if (!result || !currentWorkspaceID || !currentWorkspace()?.billingEnabled) return;

    if (result === "success") {
      setProcessingCheckout(true);
    } else if (result === "cancel") {
      notify({ type: "info", text: "Checkout canceled. No billing changes were made." });
    } else if (result === "portal") {
      notify({ type: "info", text: "Billing portal closed. Refreshing your billing details..." });
    }

    if (result !== "success") {
      void revalidate(["billing-subscription", "billing-usage", "billing-history"]);
    }
    setSearchParams({ billing: undefined }, { replace: true });
  });

  return (
    <Show
      when={currentWorkspace()?.billingEnabled}
      fallback={
        <p class="text-sm text-gray-500">
          All Pro features are included in this installation. No subscription is required.
        </p>
      }
    >
      <SubscriptionSection />
      <SpendingSection />
      <UsageSection
        month={selectedMonth()}
        usageMonth={usageMonth()}
        loading={loadingMonth()}
        onMonthChange={changeMonth}
      />
      <HistorySection onSelect={changeMonth} />
      <BillingProcessingDialog
        opened={processingCheckout()}
        onClose={() => {
          setProcessingCheckout(false);
          void revalidate(["billing-subscription", "billing-usage", "billing-history"]);
        }}
        onConfirmed={() => {
          setProcessingCheckout(false);
          void revalidate(["billing-subscription", "billing-usage", "billing-history"]);
          notify({ type: "success", text: "Your Pro subscription is ready." });
        }}
      />
    </Show>
  );
};

export default BillingSettingsPage;
