import { usePresenceContext } from "@ark-ui/solid/presence";
import { type ParentComponent, Show } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { Fragment } from "./fragment";

interface PresencePortalProps {
  portal?: boolean;
  /** The body by default. */
  mount?: Node;
}

const PresencePortal: ParentComponent<PresencePortalProps> = (props) => {
  const presence = usePresenceContext();

  return (
    <Show when={!presence().unmounted}>
      <Dynamic component={props.portal === false ? Fragment : Portal} mount={props.mount}>
        {props.children}
      </Dynamic>
    </Show>
  );
};

export { PresencePortal };
