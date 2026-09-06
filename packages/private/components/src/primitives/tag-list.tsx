import clsx from "clsx";
import { For, type JSX, type ParentComponent, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Button } from "./button";

interface TagListProps {
  class?: string;
  disabled?: boolean;
  valueClass?: string;
  values: string[];
  getIcon?(value: string): string | (() => JSX.Element) | undefined;
  getLabel?(value: string): string;
  isValueDisabled?(value: string): boolean;
  setValues?(values: string[]): void;
}

const TagList: ParentComponent<TagListProps> = (props) => {
  const removeValue = (value: string) => {
    props.setValues?.(props.values.filter((currentValue) => currentValue !== value));
  };

  return (
    <div class={clsx(":base: flex w-full min-w-0 flex-wrap items-center gap-1", props.class)}>
      <For each={props.values}>
        {(value) => {
          const icon = () => props.getIcon?.(value);
          const valueDisabled = () => props.disabled || props.isValueDisabled?.(value);

          return (
            <Button
              size="small"
              color="contrast"
              variant="outlined"
              hover="none"
              text="softer"
              disabled={valueDisabled()}
              class={clsx(
                ":base-2: flex max-w-full items-center gap-1 p-0.5 pl-1.5 pr-0.5 group/tag",
                valueDisabled() && ":base-2: cursor-default opacity-70",
                props.valueClass
              )}
              onClick={(event) => {
                event.stopPropagation();

                if (!valueDisabled()) removeValue(value);
              }}
            >
              <Show when={icon()} keyed>
                {(icon) => (
                  <span
                    class={clsx(
                      ":base: h-4 w-4 shrink-0 text-gray-400",
                      typeof icon === "string" && icon
                    )}
                  >
                    {typeof icon === "function" && <Dynamic component={icon} />}
                  </span>
                )}
              </Show>
              <span class=":base: truncate">{props.getLabel?.(value) || value}</span>
              <span
                aria-hidden="true"
                class={clsx(
                  ":base: inline-flex justify-center items-center h-5 w-5 shrink-0 rounded-md",
                  !valueDisabled() && ":base: media-mouse:group-hover/tag:bg-red-500/10"
                )}
              >
                <span
                  class={clsx(
                    ":base: i-lucide:x h-4 w-4 text-gray-400",
                    !valueDisabled() && ":base: media-mouse:group-hover/tag:text-red-500"
                  )}
                />
              </span>
            </Button>
          );
        }}
      </For>
      {props.children}
    </div>
  );
};

export { TagList };
