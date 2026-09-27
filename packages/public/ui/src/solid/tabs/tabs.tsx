import { Tabs as ArkTabs } from "@ark-ui/solid/tabs";
import {
  type ComponentProps,
  type ParentComponent,
  createSignal,
  onCleanup,
  onMount,
  splitProps
} from "solid-js";
import { readSession, writeSession } from "../../core/storage";

interface RootProps extends Omit<ComponentProps<typeof ArkTabs.Root>, "value" | "defaultValue"> {
  values: string[];
  defaultValue?: string;
  /**
   * Tabs with the same key share their selection, in this page and later pages. A group
   * without the selected value keeps its own selection.
   */
  syncKey?: string;
}

const syncEvent = "andesine:tabs";

const Root: ParentComponent<RootProps> = (props) => {
  const [local, rest] = splitProps(props, ["values", "defaultValue", "syncKey", "onValueChange"]);
  const [value, setValue] = createSignal(local.defaultValue ?? local.values[0] ?? "");
  const storageKey = (): string => `andesine-tabs:${local.syncKey}`;
  const select = (next: unknown): void => {
    if (typeof next === "string" && local.values.includes(next)) setValue(next);
  };

  onMount(() => {
    if (!local.syncKey) return;

    const sync = (event: Event): void => {
      const { key, value } = (event as CustomEvent<{ key: string; value: string }>).detail;

      if (key === local.syncKey) select(value);
    };

    select(readSession(storageKey()));
    window.addEventListener(syncEvent, sync);
    onCleanup(() => window.removeEventListener(syncEvent, sync));
  });

  return (
    <ArkTabs.Root
      {...rest}
      value={value()}
      onValueChange={(details) => {
        setValue(details.value);
        local.onValueChange?.(details);

        if (!local.syncKey) return;

        writeSession(storageKey(), details.value);
        window.dispatchEvent(
          new CustomEvent(syncEvent, { detail: { key: local.syncKey, value: details.value } })
        );
      }}
    />
  );
};
const Tabs = {
  Root,
  List: ArkTabs.List,
  Trigger: ArkTabs.Trigger,
  Content: ArkTabs.Content,
  Indicator: ArkTabs.Indicator
};

export { Tabs };
export type { RootProps as TabsRootProps };
