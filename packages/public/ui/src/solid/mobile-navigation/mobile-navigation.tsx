import { type JSX, type ParentComponent, onCleanup, onMount, splitProps } from "solid-js";
import { type MobileNavigationOptions, enhanceMobileNavigation } from "./enhance-mobile-navigation";

interface RootProps
  extends Omit<JSX.DetailsHtmlAttributes<HTMLDetailsElement>, "open">, MobileNavigationOptions {}

/** A `<details>` menu; without JavaScript, it still opens and closes. */
const Root: ParentComponent<RootProps> = (props) => {
  const [local, rest] = splitProps(props, ["mediaQuery", "navigationTarget", "onOpenChange"]);

  let root: HTMLDetailsElement | undefined;

  onMount(() => onCleanup(enhanceMobileNavigation(root!, local)));

  return <details {...rest} ref={root} data-scope="mobile-navigation" data-part="root" />;
};
const Trigger: ParentComponent<JSX.HTMLAttributes<HTMLElement>> = (props) => {
  return <summary {...props} data-scope="mobile-navigation" data-part="trigger" />;
};
const Content: ParentComponent<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  return <div {...props} data-scope="mobile-navigation" data-part="content" />;
};
const MobileNavigation = { Root, Trigger, Content };

export { MobileNavigation };
export type { RootProps as MobileNavigationRootProps };
