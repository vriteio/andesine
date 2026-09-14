import clsx from "clsx";
import { type Component, type JSX, splitProps } from "solid-js";
import styles from "./styles.module.scss";

interface DotsBackgroundProps extends JSX.HTMLAttributes<HTMLDivElement> {
  class?: string;
  contrast?: boolean;
}

const DotsBackground: Component<DotsBackgroundProps> = (props) => {
  const [, passedProps] = splitProps(props, ["class", "contrast"]);

  return (
    <div
      {...passedProps}
      class={clsx(styles.background, props.contrast && styles.contrast, props.class)}
    />
  );
};

export { DotsBackground };
