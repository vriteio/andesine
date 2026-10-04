import { Button, Dialog, IconButton, Input, Tooltip } from "@andesine/components";
import { type Component, createEffect, createSignal, on, Show } from "solid-js";

interface SpendingLimitDialogProps {
  opened: boolean;
  loading: boolean;
  /** In cents. */
  limit: number | null;
  currency: string;
  onClose(): void;
  onConfirm(spendingLimit: number | null): void;
}

const toAmount = (cents: number | null): string => (cents === null ? "" : `${cents / 100}`);
const getCurrencySymbol = (currency: string): string => {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? currency.toUpperCase();
};

const SpendingLimitDialog: Component<SpendingLimitDialogProps> = (props) => {
  const [amount, setAmount] = createSignal("");
  const [pendingAction, setPendingAction] = createSignal<"save" | "remove">("save");
  const cents = () => Math.round(Number(amount().trim()) * 100);
  const error = () => {
    const isValid = Number.isFinite(cents()) && cents() >= 100 && cents() <= 100_000_000;

    return isValid ? "" : "Enter an amount from 1 to 1,000,000";
  };
  const save = () => {
    if (props.loading || error()) return;

    setPendingAction("save");
    props.onConfirm(cents());
  };
  const remove = () => {
    setPendingAction("remove");
    props.onConfirm(null);
  };

  createEffect(
    on(
      () => props.opened,
      (opened) => {
        if (opened) setAmount(toAmount(props.limit));
      }
    )
  );

  return (
    <Dialog
      opened={props.opened}
      onOverlayClick={props.onClose}
      cardClass={props.limit === null ? undefined : "relative"}
      portal
      aria-label="Spending limit"
    >
      <div class="flex flex-col gap-0.5">
        <h3 class="text-lg font-semibold leading-tight">
          {props.limit === null ? "Set spending limit" : "Change spending limit"}
        </h3>
        <p class="text-sm leading-tight text-gray-400">
          API and AI features stop until the next month when usage charges reach the limit. Admins
          get an email at 80% and 100%.
        </p>
      </div>
      <Input
        value={amount()}
        setValue={setAmount}
        type="number"
        min="1"
        placeholder="100"
        class="w-full pl-6 pr-18"
        size="small"
        color="contrast"
        variant="outlined"
        disabled={props.loading}
        slotWrapperClass="w-full"
        slot={() => (
          <>
            <span class="pointer-events-none absolute left-2 text-sm text-gray-400">
              {getCurrencySymbol(props.currency)}
            </span>
            <div class="pointer-events-none absolute right-2 flex items-center gap-1.5">
              <Show when={amount() && error()}>
                <Tooltip content={error()} placement="top" wrapperClass="pointer-events-auto">
                  <div
                    class="i-lucide:triangle-alert h-4.5 w-4.5 text-red-500"
                    title={error()}
                    aria-label={error()}
                    tabindex="0"
                  />
                </Tooltip>
              </Show>
              <span class="text-sm text-gray-400">{props.currency.toUpperCase()} / mo.</span>
            </div>
          </>
        )}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;

          event.preventDefault();
          save();
        }}
      />
      <Show
        when={props.limit !== null}
        fallback={
          <div class="flex justify-end gap-2">
            <IconButton
              variant="outlined"
              color="contrast"
              size="small"
              text="soft"
              icon="i-lucide:x"
              disabled={props.loading}
              onClick={props.onClose}
            />
            <Button
              class="flex-1"
              color="primary"
              variant="outlined"
              size="small"
              loading={props.loading}
              disabled={Boolean(error())}
              onClick={save}
            >
              Set limit
            </Button>
          </div>
        }
      >
        <Tooltip content="Close" wrapperClass="absolute right-2 top-2" placement="left">
          <IconButton
            variant="text"
            text="soft"
            size="small"
            icon="i-lucide:x"
            disabled={props.loading}
            onClick={props.onClose}
          />
        </Tooltip>
        <div class="flex flex-col gap-1">
          <Button
            class="w-full"
            color="primary"
            variant="outlined"
            size="small"
            loading={props.loading && pendingAction() === "save"}
            disabled={Boolean(error()) || (props.loading && pendingAction() === "remove")}
            onClick={save}
          >
            Save limit
          </Button>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <div class="h-px flex-1 bg-gray-200" />
            or
            <div class="h-px flex-1 bg-gray-200" />
          </div>
          <IconButton
            icon="i-lucide:x"
            iconProps={{ class: "h-4 w-4 text-gray-400" }}
            label="Remove limit"
            color="contrast"
            variant="outlined"
            size="small"
            class="w-full"
            loading={props.loading && pendingAction() === "remove"}
            disabled={props.loading && pendingAction() === "save"}
            onClick={remove}
          />
        </div>
      </Show>
    </Dialog>
  );
};

export { SpendingLimitDialog };
