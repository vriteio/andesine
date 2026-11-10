import { type Component, type ComponentProps } from "solid-js";
import { Combobox } from "./combobox";
import { createLinkOptions, getLinkedEntryID, type LinkOptionsSource } from "./link-options";

interface LinkComboboxProps extends LinkOptionsSource {
  placeholder?: string;
  disabled?: boolean;
  /** Shown when typed text matches no entry and isn't a link yet, e.g. how to type a URL. */
  emptyLabel?: string;
  portal?: boolean;
  optionsPlacement?: ComponentProps<typeof Combobox>["optionsPlacement"];
  inputClass?: string;
  setValue(href: string): void;
}

/**
 * A `Combobox` of entries that also takes a typed link, e.g. a URL; typed text is taken when the
 * field is left, or dropped when it isn't a link.
 */
const LinkCombobox: Component<LinkComboboxProps> = (props) => {
  const link = createLinkOptions(props);
  // Only the chosen link's option, for its label; typed text lists the others.
  const selectedOptions = () => {
    const option = link.selected();

    return option ? [option] : [];
  };
  // As the editor's inline links: a file for an entry, a globe for others.
  const startIcon = () => {
    if (!props.value) return undefined;

    return getLinkedEntryID(props.value) ? "i-lucide:file" : "i-lucide:globe";
  };
  const setValue = (href: string) => {
    if (href !== props.value) props.setValue(href);
  };

  return (
    <Combobox
      options={selectedOptions()}
      filterOptions={link.search}
      value={props.value}
      placeholder={props.placeholder}
      disabled={props.disabled}
      portal={props.portal}
      optionsPlacement={props.optionsPlacement}
      inputClass={props.inputClass}
      indicator="i-lucide:link-2"
      startIcon={startIcon()}
      emptyLabel={props.emptyLabel}
      displaySelectedLabel
      closeOnSelect
      setValue={setValue}
      onInputCommit={(text) => {
        const href = link.resolve(text);

        if (href !== null) setValue(href);
      }}
    />
  );
};

export { LinkCombobox };
