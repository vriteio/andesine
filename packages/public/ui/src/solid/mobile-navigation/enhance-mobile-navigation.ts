import { focusTarget, getFocusable } from "../../core/focus";

interface MobileNavigationOptions {
  /** The menu works only while this media query matches, e.g. `(max-width: 767.9px)`. */
  mediaQuery?: string;
  /** Receives focus after a link to the current page closes the menu. */
  navigationTarget?: () => HTMLElement | null;
  onOpenChange?(open: boolean): void;
}

/**
 * Makes a server-rendered `<details>` menu modal: it traps focus, makes the rest of the page
 * inert, locks scrolling, closes on Escape and on navigation, and restores focus.
 * Returns a cleanup function.
 */
const enhanceMobileNavigation = (
  root: HTMLDetailsElement,
  options: MobileNavigationOptions = {}
): (() => void) => {
  const trigger = root.querySelector<HTMLElement>(":scope > summary");
  const content = root.querySelector<HTMLElement>(":scope > :not(summary)");
  const media = options.mediaQuery ? window.matchMedia(options.mediaQuery) : undefined;
  const inertElements = new Map<HTMLElement, boolean>();

  let opened = false;
  let previousOverflow = "";

  if (!trigger || !content) throw new Error("Mobile navigation needs a summary and content.");

  const setModal = (modal: boolean): void => {
    if (!modal) {
      inertElements.forEach((inert, element) => (element.inert = inert));
      inertElements.clear();
      document.body.style.overflow = previousOverflow;

      return;
    }

    for (let branch: HTMLElement = root; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;

        inertElements.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }

    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  };
  const sync = (): void => {
    const open = root.open && (media?.matches ?? true);

    if (root.open && !open) root.open = false;
    if (opened === open) return;

    opened = open;
    setModal(open);

    if (open) (getFocusable(content)[0] ?? trigger).focus({ preventScroll: true });

    options.onOpenChange?.(open);
  };
  const close = (): void => {
    root.open = false;
    sync();
  };
  const onToggle = (event: Event): void => {
    if (event.target !== root) return;

    const hadFocus = content.contains(document.activeElement);

    sync();

    if (!opened && hadFocus) trigger.focus({ preventScroll: true });
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!opened || event.defaultPrevented) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus({ preventScroll: true });
    }

    if (event.key !== "Tab") return;

    const items = [trigger, ...getFocusable(content)];
    const edge = event.shiftKey ? items[0] : items.at(-1);

    if (document.activeElement !== edge) return;

    event.preventDefault();
    (event.shiftKey ? items.at(-1) : items[0])?.focus();
  };
  const onClick = (event: MouseEvent): void => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const isMenuLink = opened && isPlainClick && link !== null && content.contains(link);

    if (!isMenuLink) return;

    const url = new URL(link.href);
    const samePage = url.origin === location.origin && url.pathname === location.pathname;

    close();

    // A link to the same page does not reload it, so move focus to its target.
    if (samePage) {
      requestAnimationFrame(() => {
        const hashTarget =
          url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
        const target = hashTarget || options.navigationTarget?.();

        if (target) {
          focusTarget(target);
        } else {
          trigger.focus({ preventScroll: true });
        }
      });
    }
  };

  root.addEventListener("toggle", onToggle);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("click", onClick);
  media?.addEventListener("change", sync);
  sync();

  return () => {
    root.removeEventListener("toggle", onToggle);
    root.removeEventListener("keydown", onKeyDown);
    root.removeEventListener("click", onClick);
    media?.removeEventListener("change", sync);

    if (opened) setModal(false);
  };
};

export { enhanceMobileNavigation };
export type { MobileNavigationOptions };
