import {
  Button,
  Checkbox,
  ColorPicker,
  Combobox,
  Dropdown,
  IconButton,
  Input,
  Select,
  TagList,
  ToggleGroup,
  Tooltip
} from "@andesine/components";
import clsx from "clsx";
import { Show } from "solid-js";
import { Setting } from "#web/pages/workspace/settings/setting";
import { SelectableRow } from "#web/pages/workspace/settings/webhook/selectable-row";
import { type HostComponents } from "./types";

// Paths and patterns; 16px on phones, so iOS doesn't zoom into the field.
const CODE_FIELD_CLASS = "font-mono md:text-xs";
// A combobox's options are as wide as its field, so a short choice doesn't cut the longer ones.
const CHOICE_FIELD_CLASS = "min-w-48";
const controlComponents: Pick<
  HostComponents,
  | "Button"
  | "IconButton"
  | "Input"
  | "Textarea"
  | "Select"
  | "Combobox"
  | "MultiSelect"
  | "Checkbox"
  | "Toggle"
  | "ToggleGroup"
  | "ColorInput"
  | "Tooltip"
  | "Setting"
> = {
  // With an icon, as the app's settings actions, e.g. "Create webhook" with a plus after it.
  Button: (props) => (
    <Show
      when={props.props.icon}
      fallback={
        <Button
          variant={props.props.variant ?? "secondary"}
          size={props.props.size}
          class={props.props.class}
          disabled={props.props.disabled}
          loading={props.props.loading}
          onClick={() => props.emit("onClick")}
        >
          {props.children}
        </Button>
      }
    >
      {(icon) => (
        <IconButton
          variant={props.props.variant ?? "secondary"}
          size={props.props.size}
          class={clsx("flex-row-reverse pr-1", props.props.class)}
          disabled={props.props.disabled}
          loading={props.props.loading}
          icon={icon()}
          iconProps={{ class: "h-4 w-4" }}
          label={() => <span class="px-1">{props.children}</span>}
          onClick={() => props.emit("onClick")}
        />
      )}
    </Show>
  ),
  // Icon classes come from the extension's generated CSS; the tooltip shows outside the view's clip.
  IconButton: (props) => (
    <Tooltip content={props.props.label}>
      <IconButton
        variant={props.props.variant ?? "ghost"}
        size={props.props.size}
        class={props.props.class}
        disabled={props.props.disabled}
        icon={props.props.icon}
        aria-label={props.props.label}
        onClick={() => props.emit("onClick")}
      />
    </Tooltip>
  ),
  Input: (props) => (
    <Input
      value={props.props.value ?? ""}
      placeholder={props.props.placeholder}
      label={props.props.label}
      type={props.props.type ?? "text"}
      disabled={props.props.disabled}
      // Shrinks in a row with other content below its default 20 characters.
      class={clsx("min-w-0", props.props.code && CODE_FIELD_CLASS)}
      // The suffix's box sits in the field's padding, so a long value doesn't run under it.
      style={
        props.props.suffix
          ? { "padding-right": `calc(${props.props.suffix.length}ch + 1.5rem)` }
          : undefined
      }
      slotWrapperClass="w-full"
      slot={
        props.props.suffix
          ? () => (
              // Inside the field's 1px outline.
              <span class="pointer-events-none absolute inset-y-px right-px flex items-center rounded-r-[7px] border-l border-gray-200 bg-gray-100 px-2 text-[16px] text-gray-400 md:text-sm">
                {props.props.suffix}
              </span>
            )
          : undefined
      }
      setValue={(value) => props.emit("onInput", value)}
      onEnter={() => props.emit("onEnter")}
    />
  ),
  // As the outlined `Input`: its outline, shadow, focus background, and label.
  Textarea: (props) => (
    <label class="group flex min-w-0 flex-col gap-1 text-xs">
      <Show when={props.props.label}>
        <span class="leading-[1] text-gray-400 group-focus-within:text-gray-500">
          {props.props.label}
        </span>
      </Show>
      <textarea
        class={clsx(
          "w-full resize-y rounded-lg bg-white px-2 py-1 text-[16px] text-gray-700 shadow-md shadow-gray-900/8 disabled:shadow-none outline outline-1 -outline-offset-1 outline-gray-200 ring-offset-1 placeholder:opacity-50 focus:bg-gray-100 focus:outline-1",
          props.props.code ? CODE_FIELD_CLASS : "md:text-sm"
        )}
        value={props.props.value ?? ""}
        placeholder={props.props.placeholder}
        rows={props.props.rows ?? 4}
        disabled={props.props.disabled}
        onInput={(event) => props.emit("onInput", event.currentTarget.value)}
      />
    </label>
  ),
  Select: (props) => (
    <Select
      options={props.props.options}
      value={props.props.value}
      placeholder={props.props.placeholder}
      disabled={props.props.disabled}
      setValue={(value) => props.emit("onChange", value)}
    />
  ),
  // One choice: the field shows its label, and the options close once it's chosen.
  Combobox: (props) => (
    <Combobox
      class={CHOICE_FIELD_CLASS}
      displaySelectedLabel
      closeOnSelect
      options={props.props.options}
      value={props.props.value}
      placeholder={props.props.placeholder}
      disabled={props.props.disabled}
      setValue={(value) => props.emit("onChange", value)}
    />
  ),
  // As the editor's multi-select properties: the chosen options as tags, then a button that adds
  // one of the others.
  MultiSelect: (props) => {
    const values = () => props.props.values ?? [];
    const labels = () => new Map(props.props.options.map(({ value, label }) => [value, label]));
    const availableOptions = () => {
      return props.props.options.filter(({ value }) => !values().includes(value));
    };
    const setValues = (values: string[]) => props.emit("onChange", values);

    return (
      <TagList
        class="justify-end"
        values={values()}
        disabled={props.props.disabled}
        getLabel={(value) => labels().get(value) ?? value}
        setValues={setValues}
      >
        <Show when={!props.props.disabled && availableOptions().length > 0}>
          <Dropdown
            placement="bottom-end"
            // The combobox is the menu on wider screens, as in the editor; phones show it in a sheet.
            cardProps={{
              class:
                "w-56 md:border-0 md:!bg-transparent md:p-0 md:!shadow-none md:[&>div]:overflow-visible"
            }}
            trigger={() => (
              <IconButton
                class={values().length > 0 ? "p-0.75" : "py-0.5 px-0.75"}
                icon="i-lucide:plus"
                iconProps={{ class: "h-4.5 w-4.5" }}
                label={
                  values().length > 0
                    ? undefined
                    : () => <span class="px-0.5 text-sm">Add value</span>
                }
              />
            )}
          >
            <div class="flex w-full min-w-0 flex-col px-1 pb-1.5 md:px-0 md:pb-0">
              <Combobox
                class="w-full min-w-0 md:[&>label]:hidden"
                inlineOptions
                label="Add value"
                options={availableOptions()}
                placeholder={props.props.placeholder ?? "Select value"}
                portal={false}
                surfaceClass="!bg-gray-50 md:!bg-white"
                setValue={(value) => setValues([...values(), value])}
              />
            </div>
          </Dropdown>
        </Show>
      </TagList>
    );
  },
  Checkbox: (props) => (
    <label class="flex items-center gap-2 text-sm">
      <Checkbox
        checked={props.props.checked}
        disabled={props.props.disabled}
        setChecked={(checked) => props.emit("onChange", checked)}
      />
      <Show when={props.props.label}>{props.props.label}</Show>
    </label>
  ),
  Toggle: (props) => (
    <button
      type="button"
      role="switch"
      aria-checked={props.props.checked === true}
      disabled={props.props.disabled}
      class="flex items-center gap-2 text-sm disabled:opacity-50"
      onClick={() => props.emit("onChange", !props.props.checked)}
    >
      <span
        class={clsx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          props.props.checked ? "bg-gradient-to-tr" : "bg-gray-300"
        )}
      >
        <span
          class={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            props.props.checked ? "left-4.5" : "left-0.5"
          )}
        />
      </span>
      <Show when={props.props.label}>{props.props.label}</Show>
    </button>
  ),
  ToggleGroup: (props) => (
    // Options share the extra width, e.g. in a stacked setting.
    <ToggleGroup
      itemClass="flex-auto"
      value={props.props.value ?? ""}
      options={props.props.options}
      disabled={props.props.disabled}
      setValue={(value) => props.emit("onChange", value)}
    />
  ),
  ColorInput: (props) => (
    <ColorPicker
      value={props.props.value}
      presets={props.props.presets}
      disabled={props.props.disabled}
      setValue={(value) => props.emit("onInput", value)}
    />
  ),
  // Lays out as its child would without it, e.g. a full-width button in a stacked setting.
  Tooltip: (props) => (
    <Tooltip content={props.props.content} wrapperClass="items-stretch">
      <span class="flex flex-col">{props.children}</span>
    </Tooltip>
  ),
  // With only a checkbox, the whole row toggles it, as the webhook events.
  Setting: (props) => {
    const checkbox = () => {
      const nodes = props.childNodes();

      return nodes.length === 1 && nodes[0]?.component === "Checkbox" ? nodes[0] : undefined;
    };

    return (
      <Show
        when={checkbox()}
        fallback={
          <Setting
            label={props.props.label}
            description={props.props.description ?? ""}
            fade={false}
            container
          >
            {props.children}
          </Setting>
        }
      >
        {(node) => (
          <SelectableRow
            label={props.props.label}
            description={props.props.description}
            checked={node().props.checked === true}
            disabled={node().props.disabled === true}
            setChecked={(checked) => props.emitNode(node().id, "onChange", checked)}
          />
        )}
      </Show>
    );
  }
};

export { controlComponents };
