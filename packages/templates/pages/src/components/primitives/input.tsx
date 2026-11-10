import clsx from "clsx";
import { type Component, type JSX, splitProps } from "solid-js";

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

// Fields use at least 16px text on mobile to prevent zoom on iOS.
const Input: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      {...rest}
      class={clsx(
        ":base: h-7 w-full rounded-lg bg-gray-200 px-2 text-[16px] text-gray-700 outline-gray-200 placeholder:(text-gray-500 opacity-50) focus:(shadow-inner outline-none) md:text-sm",
        local.class
      )}
    />
  );
};

export { Input };
export type { InputProps };
