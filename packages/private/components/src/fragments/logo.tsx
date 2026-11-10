import { type Component } from "solid-js";
import clsx from "clsx";

interface LogoProps {
  class?: string;
}

const Logo: Component<LogoProps> = (props) => (
  <div
    role="img"
    aria-label="Andesine"
    class={clsx(":base: flex items-center font-bold text-3xl", props.class)}
  >
    <div class="h-8 w-8 i-andesine:logo bg-gradient-to-tr" />
    ndesine
  </div>
);

export { Logo };
