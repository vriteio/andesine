import {
  Checkbox,
  IconPicker,
  Input,
  LinkCombobox,
  Select,
  ToggleGroup
} from "@andesine/components";
import { toLinkHref } from "@andesine/document/tiptap";
import { capitalize } from "#editor/lib/labels";
import type { Editor } from "@tiptap/core";
import {
  createEffect,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch
} from "solid-js";
import type {
  EditorIcons,
  EditorLinks,
  ElementPropField,
  ElementPropsSchema
} from "#editor/client-types";
import { updateElementProps } from "#editor/ui/views/element-view/extension-view";

/** What the `icon` and `link` controls offer: the icon sets, and the entries to link. */
interface ElementPropsSources {
  links?: EditorLinks;
  icons?: EditorIcons;
}
interface ElementPropsFormProps extends ElementPropsSources {
  editor: Editor;
  /** The element's node ID; the form edits it while it stays selected. */
  elementID: string;
  schema: ElementPropsSchema;
}
interface TextFieldProps {
  field: ElementPropField;
  label: string;
  value?: string;
  commit(value: string): void;
}

type PropValue = string | number | boolean | undefined;

const NONE = "";
// The menu's keys: ↑ ↓ and Tab move between the fields and the menu's items, Escape closes it.
const MENU_KEYS = new Set(["ArrowUp", "ArrowDown", "Tab", "Escape"]);

/** Typing stays in the field; the menu's keys go on to the form and the menu. */
const stopKeys = (event: KeyboardEvent) => {
  if (!MENU_KEYS.has(event.key)) event.stopPropagation();
};
/** A field's control that takes the focus, e.g. a toggle group's selected option. */
const getFieldControl = (field: Element | undefined): HTMLElement | null => {
  const selected = field?.querySelector<HTMLElement>('[aria-checked="true"], [data-state="on"]');

  return selected ?? field?.querySelector<HTMLElement>("input, textarea, button") ?? null;
};
/** The direction of a key that moves between the fields and items, or 0 for other keys. */
const getStep = (event: KeyboardEvent): 1 | -1 | 0 => {
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

  if (hasModifier) return 0;
  if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) return 1;
  if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) return -1;

  return 0;
};
/**
 * One list for the keyboard: ↑ ↓ and Tab move between the form's fields, and from the last one to
 * the menu's items, which the menu highlights; ↑ on the first item goes back to the last field.
 */
const connectFormToMenu = (form: HTMLElement) => {
  const menu = form.closest<HTMLElement>('[role="menu"]');
  const getFields = () => Array.from(form.querySelectorAll("[data-element-prop]"));
  const onFormKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const step = getStep(event);
    const isInOpenSelect = Boolean(target.closest('[aria-expanded="true"], [role="listbox"]'));
    const fields = getFields();
    const next = fields[fields.findIndex((field) => field.contains(target)) + step];

    if (!step || isInOpenSelect || !menu) return;

    event.preventDefault();
    event.stopPropagation();

    if (next) {
      getFieldControl(next)?.focus();
    } else if (step > 0) {
      menu.focus();
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    }
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    const step = getStep(event);
    const firstItem = menu?.querySelector('[role="menuitem"]');
    const isOnFirstItem = Boolean(firstItem?.hasAttribute("data-highlighted"));

    if (event.target !== menu || !step) return;

    if (step < 0 && isOnFirstItem) {
      event.preventDefault();
      event.stopPropagation();
      getFieldControl(getFields().at(-1))?.focus();
    } else if (event.key === "Tab") {
      // As the arrow keys, so Tab doesn't leave the menu.
      event.preventDefault();
      event.stopPropagation();
      menu!.dispatchEvent(
        new KeyboardEvent("keydown", { key: step > 0 ? "ArrowDown" : "ArrowUp", bubbles: true })
      );
    }
  };

  // Into a field from elsewhere, e.g. as the menu opens: its selected option, not its first.
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    const control = getFieldControl(target.closest("[data-element-prop]") ?? undefined);
    const isFromOutside = !form.contains(event.relatedTarget as Node | null);

    if (isFromOutside && control && control !== target) control.focus();
  };

  form.addEventListener("keydown", onFormKeyDown);
  form.addEventListener("focusin", onFocusIn);
  menu?.addEventListener("keydown", onMenuKeyDown, true);
  onCleanup(() => {
    form.removeEventListener("keydown", onFormKeyDown);
    form.removeEventListener("focusin", onFocusIn);
    menu?.removeEventListener("keydown", onMenuKeyDown, true);
  });
};
/** Text, icon, and number props: typed values apply on Enter or blur. */
const TextField = (props: TextFieldProps) => {
  const [draft, setDraft] = createSignal(props.value ?? "");

  // E.g. a cleared prop that its default replaced, or an edit of the tag.
  createEffect(
    on(
      () => props.value,
      (value) => setDraft(value ?? ""),
      { defer: true }
    )
  );

  return (
    <div class="flex w-full min-w-0 flex-col gap-0.5 p-1">
      <Input
        class="w-full min-w-0 bg-gray-50"
        label={props.label}
        type={props.field.type === "string" ? "text" : "number"}
        placeholder={
          props.field.placeholder ?? (props.field.control === "icon" ? "i-lucide:rocket" : "")
        }
        maxLength={props.field.maxLength}
        value={draft()}
        setValue={setDraft}
        onConfirm={() => props.commit(draft().trim())}
        onKeyDown={stopKeys}
      />
      <Show when={props.field.description}>
        <span class="px-1 text-xs text-gray-400">{props.field.description}</span>
      </Show>
    </div>
  );
};
/** Edits the props of an element with a props schema; the tag source follows each change. */
const ElementPropsForm = (props: ElementPropsFormProps) => {
  const getCurrent = () => {
    const pos = props.editor.state.selection.from;
    const node = props.editor.state.doc.nodeAt(pos);

    return node?.type.name === "element" && node.attrs.id === props.elementID
      ? { pos, values: node.attrs.props as Record<string, unknown> }
      : null;
  };
  const [values, setValues] = createSignal(getCurrent()?.values ?? {});
  const refresh = () => {
    const current = getCurrent();

    if (current) setValues(current.values);
  };
  // Clearing a prop restores its default, or removes it when it has none.
  const write = (key: string, value: PropValue) => {
    const current = getCurrent();
    const fallback = props.schema.find((field) => field.name === key)?.default;
    const isEmpty = value === undefined || value === "";
    const next = { ...current?.values, [key]: isEmpty ? fallback : value };

    if (!current) return;
    if (next[key] === undefined) delete next[key];
    // E.g. a blur saves the field; a transaction would rebuild the menu under a click on an item.
    if (current.values[key] === next[key]) return;
    if (!updateElementProps(props.editor, current.pos, next)) refresh();
  };
  const toNumber = (field: ElementPropField, text: string): number | undefined => {
    const value = Number(text);
    const isValid =
      text !== "" &&
      Number.isFinite(value) &&
      (field.type !== "integer" || Number.isInteger(value)) &&
      (field.minimum === undefined || value >= field.minimum) &&
      (field.maximum === undefined || value <= field.maximum);

    return isValid ? value : undefined;
  };

  let form!: HTMLDivElement;

  props.editor.on("transaction", refresh);
  onCleanup(() => props.editor.off("transaction", refresh));
  onMount(() => connectFormToMenu(form));

  return (
    <div ref={form} class="flex w-full min-w-0 flex-col">
      <For each={props.schema}>
        {(field) => {
          const key = field.name;
          const label = () => field.title ?? key;
          const value = () => values()[key] ?? field.default;

          return (
            <div class="contents" data-element-prop>
              <Switch
                fallback={
                  <TextField
                    field={field}
                    label={label()}
                    value={value() === undefined ? "" : String(value())}
                    commit={(text) => {
                      write(key, field.type === "string" ? text : toNumber(field, text));
                    }}
                  />
                }
              >
                <Match when={field.type === "boolean"}>
                  <label class="flex w-full cursor-pointer items-center gap-2 p-1 text-sm">
                    <Checkbox
                      checked={value() === true}
                      setChecked={(checked) => write(key, checked)}
                    />
                    {label()}
                  </label>
                </Match>
                <Match when={field.control === "icon" && props.icons}>
                  {(icons) => (
                    <div class="flex w-full min-w-0 flex-col gap-1 p-1">
                      <span class="text-xs text-gray-500">{label()}</span>
                      <IconPicker
                        value={value() === undefined ? undefined : String(value())}
                        sets={icons().sets}
                        loadSet={icons().loadSet}
                        placeholder="No icon"
                        clearable
                        placement="right"
                        triggerClass="bg-gray-50"
                        setValue={(next) => write(key, next)}
                      />
                    </div>
                  )}
                </Match>
                <Match when={field.control === "link"}>
                  <div class="flex w-full min-w-0 flex-col gap-1 p-1">
                    <span class="text-xs text-gray-500">{label()}</span>
                    <LinkCombobox
                      value={value() === undefined ? "" : String(value())}
                      entries={props.links?.entries() ?? []}
                      toHref={(text) => toLinkHref(text, true)}
                      placeholder={field.placeholder ?? "Entry, URL, or /path"}
                      emptyLabel="Type a full URL, e.g. https://example.com, or a path, e.g. /guides."
                      optionsPlacement="right"
                      inputClass="bg-gray-50"
                      setValue={(href) => write(key, href)}
                    />
                  </div>
                </Match>
                <Match when={field.enum && field.control === "toggle"}>
                  <div class="flex w-full min-w-0 flex-col gap-1 p-1">
                    <span class="text-xs text-gray-500">{label()}</span>
                    <ToggleGroup
                      value={String(value() ?? NONE)}
                      options={field.enum!.map((option) => ({
                        value: option,
                        label: capitalize(option)
                      }))}
                      itemClass="flex-1"
                      setValue={(next) => write(key, next as string)}
                    />
                  </div>
                </Match>
                <Match when={field.enum}>
                  {(options) => (
                    <div class="flex w-full min-w-0 flex-col gap-1 p-1">
                      <span class="text-xs text-gray-500">{label()}</span>
                      <Select
                        portal={false}
                        positioningStrategy="absolute"
                        value={String(value() ?? NONE)}
                        placeholder="None"
                        options={[
                          ...(field.default === undefined ? [{ value: NONE, label: "None" }] : []),
                          ...options().map((option) => ({ value: option, label: option }))
                        ]}
                        setValue={(next) => write(key, next || undefined)}
                      />
                    </div>
                  )}
                </Match>
              </Switch>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export { ElementPropsForm };
export type { ElementPropsSources };
