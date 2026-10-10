import clsx from "clsx";
import type { Component } from "solid-js";

interface PoweredByProps {
  class?: string;
}

/** Credits Andesine Pages, with the Andesine wordmark */
const PoweredBy: Component<PoweredByProps> = (props) => (
  <a
    href="https://andesine.app"
    class={clsx(
      ":base: flex items-center gap-1 rounded-md text-sm text-gray-500 transition duration-200 ease-out @hover:text-gray-700 focus-visible:text-gray-700",
      props.class
    )}
  >
    Powered by
    <span role="img" aria-label="Andesine" class="flex items-center font-bold text-gray-700">
      <span
        aria-hidden="true"
        class="i-andesine:logo h-[1.07em] w-[1.07em] shrink-0 bg-gradient-to-tr"
      />
      <span aria-hidden="true">ndesine</span>
    </span>
    Pages
  </a>
);

export { PoweredBy };
