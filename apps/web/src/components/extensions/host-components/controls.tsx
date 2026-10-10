import {
  Button,
  Checkbox,
  Combobox,
  IconButton,
  Input,
  Select,
  ToggleGroup,
  Tooltip
} from "@andesine/components";
import clsx from "clsx";
import { Show } from "solid-js";
import { Setting } from "#web/pages/workspace/settings/setting";
import { type HostComponents } from "./types";

const controlComponents: Pick<
  HostComponents,
  | "Button"
  | "IconButton"
  | "Input"
  | "Textarea"
  | "Select"
  | "Combobox"
  | "Checkbox"
  | "Toggle"
  | "ToggleGroup"
  | "ColorInput"
  | "Tooltip"
  | "Setting"
> = {
  Button: (props) => (
    <Button
      variant={props.props.variant ?? "secondary"}
      size={props.props.size}
      disabled={props.props.disabled}
      loading={props.props.loading}
      onClick={() => props.emit("onClick")}
    >
      {props.children}
    </Button>
  ),
  // Icon classes come from the extension's generated CSS.
  IconButton: (props) => (
    <Tooltip content={props.props.label}>
      <IconButton
        variant={props.props.variant ?? "ghost"}
        size={props.props.size}
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
      setValue={(value) => props.emit("onInput", value)}
      onEnter={() => props.emit("onEnter")}
    />
  ),
  Textarea: (props) => (
    <label class="flex min-w-0 flex-col gap-1 text-xs text-gray-500">
      <Show when={props.props.label}>{props.props.label}</Show>
      <textarea
        class="w-full resize-y rounded-lg bg-gray-200 px-2 py-1 text-[16px] text-gray-700 outline-none focus:shadow-inner md:text-sm"
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
  Combobox: (props) => (
    <Combobox
      options={props.props.options}
      value={props.props.value}
      placeholder={props.props.placeholder}
      disabled={props.props.disabled}
      setValue={(value) => props.emit("onChange", value)}
    />
  ),
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
    <ToggleGroup
      value={props.props.value ?? ""}
      options={props.props.options}
      disabled={props.props.disabled}
      setValue={(value) => props.emit("onChange", value)}
    />
  ),
  ColorInput: (props) => (
    <label class="flex items-center gap-2 font-mono text-sm">
      <input
        type="color"
        class="h-7 w-9 cursor-pointer rounded-md border border-gray-200 bg-transparent p-0.5"
        value={props.props.value ?? "#000000"}
        disabled={props.props.disabled}
        onInput={(event) => props.emit("onInput", event.currentTarget.value)}
      />
      {props.props.value}
    </label>
  ),
  Tooltip: (props) => (
    <Tooltip content={props.props.content}>
      <span class="inline-flex">{props.children}</span>
    </Tooltip>
  ),
  Setting: (props) => (
    <Setting label={props.props.label} description={props.props.description ?? ""} fade={false}>
      {props.children}
    </Setting>
  )
};

export { controlComponents };
