import type { LinkConfig } from "@andesine/pages";
import type { Component } from "solid-js";
import { Button, IconButton } from "../primitives/button";

interface CallToActionProps {
  link: LinkConfig;
}

/** The main action link, after the Andesine landing page: the label, then an optional icon. */
const CallToAction: Component<CallToActionProps> = (props) =>
  props.link.icon ? (
    <IconButton
      link={props.link.href}
      icon={props.link.icon}
      label={props.link.label}
      variant="primary"
      class="flex-row-reverse gap-1 pr-1.5"
      iconClass="opacity-50 h-4.5 w-4.5"
    />
  ) : (
    <Button link={props.link.href}>{props.link.label}</Button>
  );

export { CallToAction };
