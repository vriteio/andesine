import clsx from "clsx";
import { type JSX, type ParentComponent, splitProps } from "solid-js";

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** A soft shadow around the card. */
  shade?: boolean;
}

const Card: ParentComponent<CardProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "shade"]);

  return (
    <div
      {...rest}
      class={clsx(
        ":base: rounded-2xl border border-gray-200 bg-gray-50 p-2 outline-none",
        local.shade && ":base: shadow-[0_0_12px_0px] shadow-gray-200",
        local.class
      )}
    />
  );
};

export { Card };
export type { CardProps };
