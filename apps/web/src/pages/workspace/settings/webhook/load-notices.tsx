import { Button } from "@andesine/components";
import { type Component } from "solid-js";

interface LoadErrorProps {
  label: string;
  onBack(): void;
  onRetry(): void;
}
interface StaleNoticeProps {
  /** What changed; “webhook” by default. */
  subject?: string;
  onReload(): void;
}

const LoadError: Component<LoadErrorProps> = (props) => (
  <div class="mb-3 flex items-center gap-2 text-sm">
    <div class="i-lucide:circle-alert h-5.5 w-5.5 text-red-500" />
    <span class="flex-1">{props.label}</span>
    <div class="flex gap-1">
      <Button variant="ghost" text="soft" onClick={props.onBack}>
        Back
      </Button>
      <Button variant="secondary" onClick={props.onRetry}>
        Retry
      </Button>
    </div>
  </div>
);
const StaleNotice: Component<StaleNoticeProps> = (props) => (
  <div class="mb-3 flex items-center gap-2 text-sm">
    <div class="i-lucide:refresh-ccw h-5 w-5 shrink-0 text-gray-400" />
    <span class="flex-1">
      This {props.subject ?? "webhook"} changed or was deleted. Reload it to continue; unsaved edits
      will be discarded.
    </span>
    <Button variant="secondary" onClick={props.onReload}>
      Reload
    </Button>
  </div>
);

export { LoadError, StaleNotice };
