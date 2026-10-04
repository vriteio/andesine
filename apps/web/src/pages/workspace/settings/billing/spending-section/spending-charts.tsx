import { createDelayedHover, RadialChart, type RadialChartSegment } from "@andesine/components";
import clsx from "clsx";
import { type Component, For, Show } from "solid-js";
import { formatCents } from "#web/lib/primitives";

interface SpendingChartsProps {
  /** Amounts in cents. */
  seats: number;
  apiCalls: number;
  aiCredits: number;
  limit: number | null;
  currency: string;
}

const SpendingCharts: Component<SpendingChartsProps> = (props) => {
  const [hoveredID, hover] = createDelayedHover();
  const usage = () => props.apiCalls + props.aiCredits;
  const billSegments = (): RadialChartSegment[] => [
    { id: "seats", label: "Seats", value: props.seats, opacity: 1 },
    { id: "api-calls", label: "API calls", value: props.apiCalls, opacity: 0.6 },
    { id: "ai-credits", label: "AI credits", value: props.aiCredits, opacity: 0.3 }
  ];
  const limitShare = () => (props.limit ? Math.min(usage() / props.limit, 1) : 0);

  return (
    <div class="grid gap-6 py-3 sm:grid-cols-2">
      <div class="flex items-center gap-4">
        <RadialChart
          size={128}
          thickness={12}
          cornerRadius={2}
          segments={billSegments()}
          hoveredID={hoveredID()}
          onHoverChange={hover}
          center={(segment) => (
            <>
              <span class="text-xs leading-none text-gray-400">
                {segment?.label ?? "This month"}
              </span>
              <span class="mt-1 text-base font-medium leading-none">
                {formatCents(segment?.value ?? props.seats + usage(), props.currency)}
              </span>
            </>
          )}
        />
        <div class="flex flex-col gap-1.5 text-sm">
          <For each={billSegments()}>
            {(segment) => (
              <div
                class={clsx(
                  "flex items-center gap-1.5 transition-opacity cursor-pointer",
                  hoveredID() && hoveredID() !== segment.id && "opacity-30"
                )}
                onMouseEnter={() => hover(segment.id)}
                onMouseLeave={() => hover(null)}
              >
                <div
                  class="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-tr"
                  style={{ opacity: hoveredID() === segment.id ? 1 : segment.opacity }}
                />
                <span class="text-gray-400">{segment.label}</span>
                <span class="font-medium">{formatCents(segment.value, props.currency)}</span>
              </div>
            )}
          </For>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <RadialChart
          size={128}
          thickness={12}
          sweep={Math.PI * 1.5}
          max={props.limit ?? usage()}
          segments={
            props.limit === null ? [] : [{ id: "usage", label: "Usage charges", value: usage() }]
          }
          center={() => (
            <Show
              when={props.limit !== null}
              fallback={<span class="text-xs leading-none text-gray-400">No limit</span>}
            >
              <span class="text-base font-medium leading-none">
                {Math.round(limitShare() * 100)}%
              </span>
              <span class="mt-1 text-xs leading-none text-gray-400">of limit</span>
            </Show>
          )}
        />
        <div class="flex flex-col gap-1.5 text-sm">
          <span class="text-gray-400">Usage charges</span>
          <span class="font-medium">
            {formatCents(usage(), props.currency)}
            <Show when={props.limit !== null}>
              <span class="font-normal text-gray-400">
                {" "}
                of {formatCents(props.limit ?? 0, props.currency)}
              </span>
            </Show>
          </span>
        </div>
      </div>
    </div>
  );
};

export { SpendingCharts };
