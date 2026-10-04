import { IconButton } from "@andesine/components";
import { createAsync, revalidate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { type Component, createSignal, Show } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { useWorkspace } from "#web/context/workspace";
import { client, config } from "#web/lib/api";
import { subscriptionQuery, usageQuery } from "#web/lib/data";
import { formatCents } from "#web/lib/primitives";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { SpendingCharts } from "./spending-charts";
import { SpendingLimitDialog } from "./spending-limit-dialog";

const SpendingSection: Component = () => {
  const notify = useNotify();
  const { hasPermission } = useWorkspace();
  const usage = createAsync(() => usageQuery());
  const subscription = createAsync(() => subscriptionQuery());
  const [dialogOpened, setDialogOpened] = createSignal(false);
  const spending = () => usage()?.spending;
  const currency = () => spending()?.currency ?? "usd";
  const limitDescription = () => {
    const limit = spending()?.limit ?? null;

    return limit === null
      ? "No limit set. Usage over the included amounts is billed in full."
      : `API and AI features stop at ${formatCents(limit, currency())} of usage charges a month.`;
  };
  const updateLimitMutation = createMutation(() => ({
    onSuccess: (_, { spendingLimit }) => {
      setDialogOpened(false);
      void revalidate("billing-usage");
      notify({
        type: "success",
        text: spendingLimit === null ? "Spending limit removed" : "Spending limit saved"
      });
    },
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to update the spending limit" });
    },
    mutationFn: (input: { spendingLimit: number | null }) => {
      return client.billing.updateSpendingLimit(input);
    }
  }));

  return (
    <Show when={spending()}>
      {(data) => (
        <SettingsSection label="Spending">
          <SpendingLimitDialog
            opened={dialogOpened()}
            loading={updateLimitMutation.isPending}
            limit={data().limit}
            currency={currency()}
            onClose={() => {
              if (!updateLimitMutation.isPending) setDialogOpened(false);
            }}
            onConfirm={(spendingLimit) => updateLimitMutation.mutate({ spendingLimit })}
          />
          <Setting label="Spending limit" description={limitDescription()} fade={false}>
            <Show when={hasPermission("billing")}>
              <IconButton
                label={() => (
                  <span class="px-1">{data().limit === null ? "Set limit" : "Change limit"}</span>
                )}
                class="flex-row-reverse pr-1"
                iconProps={{ class: "h-4 w-4" }}
                icon="i-lucide:gauge"
                size="small"
                color="contrast"
                variant="outlined"
                text="soft"
                onClick={() => setDialogOpened(true)}
              />
            </Show>
          </Setting>
          <SpendingCharts
            seats={(subscription()?.seats ?? 0) * config.PRICE_PER_SEAT_USD * 100}
            apiCalls={data().estimated?.apiCalls ?? 0}
            aiCredits={data().estimated?.aiCredits ?? 0}
            limit={data().limit}
            currency={currency()}
          />
        </SettingsSection>
      )}
    </Show>
  );
};

export { SpendingSection };
