const focusableSelector = "a[href], button, input, select, textarea, summary, [tabindex]";

/** Moves keyboard focus to an element without a second scroll, e.g. after anchor navigation. */
const focusTarget = (target: HTMLElement): void => {
  const temporary = !target.matches(focusableSelector);

  if (temporary) target.setAttribute("tabindex", "-1");

  target.focus({ preventScroll: true });

  if (temporary) {
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
};
/** Returns the visible, enabled elements that take keyboard focus. */
const getFocusable = (root: HTMLElement): HTMLElement[] => {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    return (
      element.tabIndex >= 0 &&
      !element.matches(":disabled, [aria-disabled='true']") &&
      !element.closest("[inert], [hidden]") &&
      element.getClientRects().length > 0
    );
  });
};

export { focusTarget, getFocusable };
