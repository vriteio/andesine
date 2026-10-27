import { LinkCombobox } from "@andesine/components";
import { toLinkHref } from "@andesine/document/tiptap";
import { type Component } from "solid-js";
import { useLinkEntries } from "#web/pages/workspace/editor/links";
import { type HostComponentProps } from "./types";

const ExtensionLinkInput: Component<HostComponentProps<"LinkInput">> = (props) => {
  const entries = useLinkEntries(() => props.props.collectionID);
  // Typed text that is neither an entry nor a link yet, e.g. a URL without its protocol.
  const emptyLabel = () => {
    return props.props.paths
      ? "Type a full URL, e.g. https://example.com, or a path, e.g. /blog."
      : "Type a full URL, e.g. https://example.com.";
  };

  return (
    <LinkCombobox
      value={props.props.value ?? ""}
      entries={entries()}
      toHref={(text) => toLinkHref(text, props.props.paths)}
      placeholder={props.props.placeholder}
      disabled={props.props.disabled}
      emptyLabel={emptyLabel()}
      setValue={(href) => props.emit("onChange", href)}
    />
  );
};

export { ExtensionLinkInput };
